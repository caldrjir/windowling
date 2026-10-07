import { targetSupports, type CharacterAction } from '@windowling/shared';
import { OUTSIDE, TARGETS, type Spot, type Vec2 } from '../room/layout.ts';
import { Animator, type ActivityAnimation, type AnimationState } from './animation.ts';
import { approach, ease, turnTowards, wrapAngle, yawTowards } from './math.ts';
import { planPath } from './path.ts';

export type Posture = 'standing' | 'sitting' | 'lying';

export const WALK_SPEED = 1.1; // m/s
export const TURN_SPEED = 4; // rad/s
/** Lowering onto a seat, lying back, getting up (the pose blends over the same time). */
export const SIT_SECONDS = 0.8;
export const LIE_SECONDS = 1.2;
export const STAND_UP_SECONDS = 0.8;
/** Backing up to a seat or stepping away from it. */
export const SHUFFLE_SPEED = 0.6; // m/s

type Step =
	| { kind: 'walk'; to: Vec2 }
	| { kind: 'turn'; yaw: number }
	/** A few small steps without turning: backing up to a seat, stepping away from it. */
	| { kind: 'shuffle'; to: Vec2; seat: string }
	/**
	 * Sitting down, lying back, sitting up, getting up: the root moves from
	 * where it is to `to` while the body blends into `state` over `seconds`.
	 */
	| {
			kind: 'settle';
			to: Spot;
			state: AnimationState;
			posture: Posture;
			seat: string;
			seconds: number;
			elapsed: number;
			from?: Spot;
	  }
	| { kind: 'gesture'; activity: ActivityAnimation; duration: number; elapsed: number }
	/** Through the door: leaving the flat, or coming back. */
	| { kind: 'pass'; from: Vec2; to: Vec2; leaving: boolean; elapsed: number };

export const WAVE_SECONDS = 2.4;
export const DOOR_PASS_SECONDS = 2.2;

/** Where the broom goes: a loop through the open floor. */
const SWEEP_TOUR: Vec2[] = [
	{ x: 0, z: 0.3 },
	{ x: -0.9, z: 1.0 },
	{ x: 1.2, z: 0.9 },
	{ x: 0.6, z: -0.6 },
	{ x: -0.6, z: -0.3 },
];

export type ControllerEvent =
	| { type: 'completed'; action: CharacterAction }
	| { type: 'rejected'; action: CharacterAction; reason: string };

export interface CharacterSnapshot {
	x: number;
	y: number;
	z: number;
	yaw: number;
	posture: Posture;
	/** Target the character is currently sitting or lying on. */
	occupying: string | null;
	animation: AnimationState;
	/** What the hands are doing once the character got where it was going. */
	activity: ActivityAnimation;
	busy: boolean;
	/** Not in the flat (gone out through the door). */
	away: boolean;
	/** The door: 0 closed .. 1 open. */
	door: number;
	/** How far the swivel chair is turned from facing the desk (radians). */
	swivel: number;
}

type TargetAction = Extract<CharacterAction, { target: string }>;

/** Targets one can sit or lie on. */
type SeatId = keyof typeof TARGETS;

/** Posture each targeted action ends in. */
const TARGET_POSTURE: Record<TargetAction['type'], Posture> = {
	walkTo: 'standing',
	eat: 'standing',
	sit: 'sitting',
	work: 'sitting',
	play: 'sitting',
	sleep: 'lying',
	cook: 'standing',
	watch: 'sitting',
	read: 'sitting',
	listen: 'sitting',
	call: 'standing',
	exercise: 'standing',
	dance: 'standing',
	leave: 'standing',
};

const ACTIVITY_OF: Partial<Record<CharacterAction['type'], ActivityAnimation>> = {
	eat: 'eat',
	work: 'work',
	play: 'play',
	cook: 'cook',
	watch: 'tv',
	read: 'read',
	listen: 'music',
	call: 'phone',
	exercise: 'exercise',
	clean: 'clean',
	dance: 'dance',
};

/** Slower and heavier when sad, a little brisker when happy. */
export function walkSpeedFor(mood: number): number {
	return WALK_SPEED * (0.75 + 0.4 * Math.min(1, Math.max(0, mood)));
}

/**
 * Turns high-level CharacterActions into movement. Pure logic (no three.js):
 * it never *chooses* actions - the simulation does - it only carries them out.
 */
export class CharacterController {
	readonly animator = new Animator();
	private x: number;
	private z: number;
	private y = 0;
	private yaw = 0;
	private speed = 0;
	private posture: Posture = 'standing';
	/** Seat or bed the character is on (sitting or lying). */
	private occupying: SeatId | null = null;
	private swivel = 0;
	private steps: Step[] = [];
	private action: CharacterAction | null = null;
	private pending: CharacterAction | null = null;
	private events: ControllerEvent[] = [];
	private attentive = false;
	private away = false;
	private door = 0;

	constructor(start: Vec2 = TARGETS['room.center'].approach, yaw = 0) {
		this.x = start.x;
		this.z = start.z;
		this.yaw = yaw;
	}

	snapshot(): CharacterSnapshot {
		return {
			x: this.x,
			y: this.y,
			z: this.z,
			yaw: this.yaw,
			posture: this.posture,
			occupying: this.occupying,
			animation: this.animator.state,
			activity: this.animator.activity,
			busy: this.action !== null || this.pending !== null,
			away: this.away,
			door: this.door,
			swivel: this.swivel,
		};
	}

	/**
	 * Starts an action, replacing the current one. Returns false (and emits a
	 * `rejected` event) for actions that are impossible in this room.
	 */
	perform(action: CharacterAction): boolean {
		const problem = this.validate(action);
		if (problem) {
			this.events.push({ type: 'rejected', action, reason: problem });
			return false;
		}
		// Never cut a sit-down / stand-up in half - finish it, then switch.
		const current = this.steps[0];
		if (current?.kind === 'settle') {
			this.pending = action;
			return true;
		}
		this.begin(action);
		return true;
	}

	/** Advances by `dt` seconds and returns events that happened. */
	update(dt: number): ControllerEvent[] {
		let remaining = dt;
		// Several short steps (e.g. a finished turn) may complete in one frame.
		for (let guard = 0; guard < 8 && remaining > 0; guard++) {
			const step = this.steps[0];
			if (!step) break;
			remaining = this.runStep(step, remaining);
			if (remaining >= 0) this.finishStep();
			else remaining = 0;
		}
		if (this.steps.length === 0) this.speed = 0;
		// The door is open only while someone is going through it.
		this.door = approach(this.door, this.steps[0]?.kind === 'pass' ? 1 : 0, dt * 2.5);
		this.updateSwivel(dt);
		// The player is "out there" in +z: yaw 0 in world space.
		this.animator.setLook(this.attentive ? wrapAngle(-this.yaw) : null);
		this.animator.update(dt, this.speed);

		if (this.steps.length === 0 && this.action) {
			this.animator.setActivity(ACTIVITY_OF[this.action.type] ?? 'none');
			this.events.push({ type: 'completed', action: this.action });
			this.action = null;
		}
		const out = this.events;
		this.events = [];
		return out;
	}

	private validate(action: CharacterAction): string | null {
		if (
			action.type === 'idle' ||
			action.type === 'lookAtPlayer' ||
			action.type === 'wave' ||
			action.type === 'clean'
		) {
			return null;
		}
		if (!(action.target in TARGETS)) return `unknown target "${action.target}"`;
		if (!targetSupports(action.target, action.type)) {
			return `"${action.target}" does not support ${action.type}`;
		}
		return null;
	}

	/** Turns the head towards the player (the camera, at +z) while true. */
	setAttention(on: boolean): void {
		this.attentive = on;
	}

	/** Mood (0..1) shows in pace and posture. */
	setMood(mood: number): void {
		this.animator.setMood(mood);
	}

	private begin(action: CharacterAction): void {
		this.action = action;
		this.pending = null;
		this.steps = [];
		const placement = 'target' in action ? TARGETS[action.target as keyof typeof TARGETS] : null;

		// Already where we need to be? (e.g. stop gaming and keep sitting on the sofa)
		const wanted = 'target' in action ? TARGET_POSTURE[action.type] : 'standing';
		if (
			'target' in action &&
			action.type !== 'walkTo' &&
			wanted !== 'standing' &&
			this.occupying === action.target
		) {
			if (this.posture === wanted) return;
			// Same bed: lie back or sit up without getting off it.
			this.animator.setActivity('none');
			const { seat, lie } = TARGETS[this.occupying];
			if (seat && lie) {
				this.steps.push(
					wanted === 'lying'
						? this.settleStep(this.occupying, lie, 'lie', 'lying', LIE_SECONDS)
						: this.settleStep(this.occupying, seat.at, 'sit', 'sitting', LIE_SECONDS),
				);
				return;
			}
		}
		this.animator.setActivity('none');
		if (this.away && action.type === 'leave') return; // already out
		if (action.type === 'lookAtPlayer' && this.posture !== 'standing' && !this.away) {
			// Seated: stays put. Head-turning towards the player arrives with awareness (Iteration 3).
			return;
		}

		if (action.type === 'wave' && !this.away) {
			// Waves from wherever it is - no need to stand up from the sofa for that.
			if (this.posture === 'standing') this.steps.push({ kind: 'turn', yaw: 0 });
			this.steps.push({ kind: 'gesture', activity: 'wave', duration: WAVE_SECONDS, elapsed: 0 });
			return;
		}

		// Coming home first, if it was out.
		const start = this.away ? this.comeBack() : this.standUpIfNeeded();
		switch (action.type) {
			case 'idle':
				break;
			case 'lookAtPlayer':
			case 'wave':
				this.steps.push({ kind: 'turn', yaw: 0 });
				break;
			case 'clean': {
				// Sweeping while walking a loop through the room.
				this.animator.setActivity('clean');
				let from = start;
				for (const stop of SWEEP_TOUR) {
					for (const point of planPath(from, stop)) this.steps.push({ kind: 'walk', to: point });
					from = stop;
				}
				break;
			}
			case 'leave': {
				const door = TARGETS.door;
				for (const point of planPath(start, door.approach)) {
					this.steps.push({ kind: 'walk', to: point });
				}
				this.steps.push({ kind: 'turn', yaw: door.approachYaw });
				this.steps.push({
					kind: 'pass',
					from: door.approach,
					to: OUTSIDE,
					leaving: true,
					elapsed: 0,
				});
				break;
			}
			default: {
				if (!placement) break;
				for (const point of planPath(start, placement.approach)) {
					this.steps.push({ kind: 'walk', to: point });
				}
				this.steps.push({ kind: 'turn', yaw: placement.approachYaw });
				const posture = TARGET_POSTURE[action.type];
				const id = action.target as SeatId;
				if (posture !== 'standing' && placement.seat) {
					// Back up to the seat, then sit down onto it.
					const { seat } = placement;
					this.steps.push({ kind: 'shuffle', to: seat.edge, seat: id });
					this.steps.push(this.settleStep(id, seat.at, 'sit', 'sitting', SIT_SECONDS));
					if (posture === 'lying' && placement.lie) {
						this.steps.push(this.settleStep(id, placement.lie, 'lie', 'lying', LIE_SECONDS));
					} else if (seat.turnTo !== undefined) {
						this.steps.push({ kind: 'turn', yaw: seat.turnTo });
					}
				}
				break;
			}
		}
	}

	/** Queues walking back in through the door; returns where it will be standing. */
	private comeBack(): Vec2 {
		const inside = TARGETS.door.approach;
		this.steps.push({ kind: 'pass', from: OUTSIDE, to: inside, leaving: false, elapsed: 0 });
		return inside;
	}

	/**
	 * Queues getting up when seated or lying - the way down, backwards: sit up,
	 * turn the chair back, stand up at the edge, step away. Returns where the
	 * character will be standing.
	 */
	private standUpIfNeeded(): Vec2 {
		const id = this.occupying;
		if (this.posture === 'standing' || !id) return { x: this.x, z: this.z };
		const { seat, approach, approachYaw } = TARGETS[id];
		if (!seat) return { x: this.x, z: this.z };
		if (this.posture === 'lying') {
			this.steps.push(this.settleStep(id, seat.at, 'sit', 'sitting', LIE_SECONDS));
		}
		if (seat.turnTo !== undefined) this.steps.push({ kind: 'turn', yaw: seat.at.yaw });
		this.steps.push(
			this.settleStep(
				id,
				{ ...seat.edge, y: 0, yaw: approachYaw },
				'idle',
				'standing',
				STAND_UP_SECONDS,
			),
		);
		this.steps.push({ kind: 'shuffle', to: approach, seat: id });
		return approach;
	}

	private settleStep(
		seat: SeatId,
		to: Spot,
		state: AnimationState,
		posture: Posture,
		seconds: number,
	): Step {
		return { kind: 'settle', to, state, posture, seat, seconds, elapsed: 0 };
	}

	/** The swivel chair turns with whoever sits on it, and to meet them as they sit down. */
	private updateSwivel(dt: number): void {
		const chair = TARGETS['desk.chair'].seat;
		if (!chair || chair.turnTo === undefined) return;
		if (this.occupying === 'desk.chair') {
			this.swivel = wrapAngle(this.yaw - chair.turnTo);
			return;
		}
		const step = this.steps[0];
		const near =
			(step?.kind === 'shuffle' || step?.kind === 'settle') && step.seat === 'desk.chair';
		const target = near ? wrapAngle(chair.at.yaw - chair.turnTo) : 0;
		this.swivel = turnTowards(this.swivel, target, dt * 3);
	}

	/** Runs a step for up to `dt`; returns leftover time (>= 0) if it finished, -1 otherwise. */
	private runStep(step: Step, dt: number): number {
		switch (step.kind) {
			case 'walk': {
				this.animator.setState('walk');
				const dx = step.to.x - this.x;
				const dz = step.to.z - this.z;
				const distance = Math.hypot(dx, dz);
				if (distance < 1e-4) return dt;
				// Face the direction of travel first, then walk (slowing while turning).
				const desiredYaw = yawTowards(this.x, this.z, step.to.x, step.to.z);
				this.yaw = turnTowards(this.yaw, desiredYaw, TURN_SPEED * dt);
				const misalignment = Math.abs(wrapAngle(desiredYaw - this.yaw));
				this.speed =
					walkSpeedFor(this.animator.mood) * Math.max(0, 1 - misalignment / (Math.PI / 2));
				const travel = this.speed * dt;
				if (travel >= distance) {
					this.x = step.to.x;
					this.z = step.to.z;
					return this.speed > 0 ? dt - distance / this.speed : 0;
				}
				this.x += (dx / distance) * travel;
				this.z += (dz / distance) * travel;
				return -1;
			}
			case 'turn': {
				this.speed = 0;
				if (this.posture === 'standing') this.animator.setState('idle');
				this.yaw = turnTowards(this.yaw, step.yaw, TURN_SPEED * dt);
				return Math.abs(wrapAngle(step.yaw - this.yaw)) < 1e-3 ? dt : -1;
			}
			case 'shuffle': {
				this.animator.setState('walk');
				const dx = step.to.x - this.x;
				const dz = step.to.z - this.z;
				const distance = Math.hypot(dx, dz);
				this.speed = SHUFFLE_SPEED;
				const travel = SHUFFLE_SPEED * dt;
				if (travel >= distance) {
					this.x = step.to.x;
					this.z = step.to.z;
					this.speed = 0;
					return dt - distance / SHUFFLE_SPEED;
				}
				this.x += (dx / distance) * travel;
				this.z += (dz / distance) * travel;
				return -1;
			}
			case 'settle': {
				this.speed = 0;
				const from = (step.from ??= { x: this.x, z: this.z, y: this.y, yaw: this.yaw });
				// The pose blends over exactly the time the body takes to get there.
				this.animator.setState(step.state, step.seconds);
				step.elapsed += dt;
				const t = Math.min(1, step.elapsed / step.seconds);
				this.x = from.x + (step.to.x - from.x) * t;
				this.z = from.z + (step.to.z - from.z) * t;
				this.y = from.y + (step.to.y - from.y) * t;
				this.yaw = wrapAngle(from.yaw + wrapAngle(step.to.yaw - from.yaw) * t);
				return step.elapsed < step.seconds ? -1 : step.elapsed - step.seconds;
			}
			case 'gesture': {
				this.speed = 0;
				this.animator.setActivity(step.activity);
				step.elapsed += dt;
				return step.elapsed < step.duration ? -1 : step.elapsed - step.duration;
			}
			case 'pass': {
				// The door swings open first, then the character walks through it.
				if (!step.leaving) this.away = false;
				step.elapsed += dt;
				const t = ease(Math.min(1, Math.max(0, (step.elapsed / DOOR_PASS_SECONDS - 0.3) / 0.7)));
				this.animator.setState(t > 0 && t < 1 ? 'walk' : 'idle');
				this.speed = t > 0 && t < 1 ? WALK_SPEED * 0.6 : 0;
				this.yaw = yawTowards(step.from.x, step.from.z, step.to.x, step.to.z);
				this.x = step.from.x + (step.to.x - step.from.x) * t;
				this.z = step.from.z + (step.to.z - step.from.z) * t;
				if (step.elapsed < DOOR_PASS_SECONDS) return -1;
				if (step.leaving) this.away = true;
				return step.elapsed - DOOR_PASS_SECONDS;
			}
		}
	}

	private finishStep(): void {
		const step = this.steps.shift();
		if (!step) return;
		if (step.kind === 'settle') {
			this.posture = step.posture;
			this.occupying = step.posture === 'standing' ? null : (step.seat as SeatId);
			this.y = step.to.y;
			if (this.pending) {
				const next = this.pending;
				this.begin(next);
			}
		}
		if (this.steps.length === 0 && this.posture === 'standing') this.animator.setState('idle');
	}
}
