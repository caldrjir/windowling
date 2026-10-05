import { targetSupports, type CharacterAction } from '@windowling/shared';
import { TARGETS, type TargetPlacement, type Vec2 } from '../room/layout.ts';
import { Animator, type ActivityAnimation, type AnimationState } from './animation.ts';
import { ease, turnTowards, wrapAngle, yawTowards } from './math.ts';
import { planPath } from './path.ts';

export type Posture = 'standing' | 'sitting' | 'lying';

export const WALK_SPEED = 1.1; // m/s
export const TURN_SPEED = 4; // rad/s
export const SETTLE_SECONDS = 1.0;
export const STAND_UP_SECONDS = 0.9;

type Use = NonNullable<TargetPlacement['use']>;

type Step =
	| { kind: 'walk'; to: Vec2 }
	| { kind: 'turn'; yaw: number }
	| { kind: 'settle'; use: Use; posture: 'sitting' | 'lying'; from: Vec2; elapsed: number }
	| { kind: 'standUp'; to: Vec2; from: Use; elapsed: number };

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
}

type TargetAction = Extract<CharacterAction, { target: string }>;

/** Posture each targeted action ends in. */
const TARGET_POSTURE: Record<TargetAction['type'], Posture> = {
	walkTo: 'standing',
	eat: 'standing',
	sit: 'sitting',
	work: 'sitting',
	play: 'sitting',
	sleep: 'lying',
};

const ACTIVITY_OF: Partial<Record<CharacterAction['type'], ActivityAnimation>> = {
	eat: 'eat',
	work: 'work',
	play: 'play',
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
	private occupying: { id: string; use: Use; approach: Vec2 } | null = null;
	private steps: Step[] = [];
	private action: CharacterAction | null = null;
	private pending: CharacterAction | null = null;
	private events: ControllerEvent[] = [];

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
			occupying: this.occupying?.id ?? null,
			animation: this.animator.state,
			activity: this.animator.activity,
			busy: this.action !== null || this.pending !== null,
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
		if (current && (current.kind === 'settle' || current.kind === 'standUp')) {
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
		if (action.type === 'idle' || action.type === 'lookAtPlayer') return null;
		if (!(action.target in TARGETS)) return `unknown target "${action.target}"`;
		if (!targetSupports(action.target, action.type)) {
			return `"${action.target}" does not support ${action.type}`;
		}
		return null;
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
		if (
			'target' in action &&
			action.type !== 'walkTo' &&
			TARGET_POSTURE[action.type] !== 'standing' &&
			this.occupying?.id === action.target &&
			this.posture === TARGET_POSTURE[action.type]
		) {
			return;
		}
		this.animator.setActivity('none');
		if (action.type === 'lookAtPlayer' && this.posture !== 'standing') {
			// Seated: stays put. Head-turning towards the player arrives with awareness (Iteration 3).
			return;
		}

		const start = this.standUpIfNeeded();
		switch (action.type) {
			case 'idle':
				break;
			case 'lookAtPlayer':
				this.steps.push({ kind: 'turn', yaw: 0 });
				break;
			default: {
				if (!placement) break;
				for (const point of planPath(start, placement.approach)) {
					this.steps.push({ kind: 'walk', to: point });
				}
				this.steps.push({ kind: 'turn', yaw: placement.approachYaw });
				const posture = TARGET_POSTURE[action.type];
				if (posture !== 'standing' && placement.use) {
					this.steps.push({
						kind: 'settle',
						use: placement.use,
						posture,
						from: placement.approach,
						elapsed: 0,
					});
				}
				break;
			}
		}
	}

	/** Queues a stand-up when seated; returns where the character will be standing. */
	private standUpIfNeeded(): Vec2 {
		if (this.posture === 'standing' || !this.occupying) return { x: this.x, z: this.z };
		const { use, approach } = this.occupying;
		this.steps.push({ kind: 'standUp', to: approach, from: use, elapsed: 0 });
		return approach;
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
			case 'settle': {
				this.speed = 0;
				this.animator.setState(step.posture === 'sitting' ? 'sit' : 'lie');
				step.elapsed += dt;
				const t = ease(step.elapsed / SETTLE_SECONDS);
				this.x = step.from.x + (step.use.x - step.from.x) * t;
				this.z = step.from.z + (step.use.z - step.from.z) * t;
				this.y = step.use.y * t;
				this.yaw = turnTowards(this.yaw, step.use.yaw, TURN_SPEED * dt);
				if (step.elapsed < SETTLE_SECONDS) return -1;
				this.yaw = step.use.yaw;
				return step.elapsed - SETTLE_SECONDS;
			}
			case 'standUp': {
				this.speed = 0;
				this.animator.setState('idle');
				step.elapsed += dt;
				const t = ease(step.elapsed / STAND_UP_SECONDS);
				this.x = step.from.x + (step.to.x - step.from.x) * t;
				this.z = step.from.z + (step.to.z - step.from.z) * t;
				this.y = step.from.y * (1 - t);
				return step.elapsed < STAND_UP_SECONDS ? -1 : step.elapsed - STAND_UP_SECONDS;
			}
		}
	}

	private finishStep(): void {
		const step = this.steps.shift();
		if (!step) return;
		if (step.kind === 'settle') {
			this.posture = step.posture;
			const id = this.action && 'target' in this.action ? this.action.target : '';
			this.occupying = { id, use: step.use, approach: step.from };
		}
		if (step.kind === 'standUp') {
			this.posture = 'standing';
			this.occupying = null;
			this.y = 0;
			if (this.pending) {
				const next = this.pending;
				this.begin(next);
			}
		}
		if (step.kind === 'settle' && this.pending) {
			const next = this.pending;
			this.begin(next);
		}
		if (this.steps.length === 0 && this.posture === 'standing') this.animator.setState('idle');
	}
}
