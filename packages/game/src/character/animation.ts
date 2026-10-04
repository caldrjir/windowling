import { approach } from './math.ts';

export type AnimationState = 'idle' | 'walk' | 'sit' | 'lie';

export const ANIMATION_STATES: readonly AnimationState[] = ['idle', 'walk', 'sit', 'lie'];

/**
 * Joint values for the placeholder rig. Angles in radians, offsets in metres.
 * The rig applies these blindly; all timing lives here.
 */
export interface Pose {
	/** Extra vertical offset of the hips (bobbing). */
	bob: number;
	/** Forward/back swing of the legs (walk cycle). */
	legSwing: number;
	/** Forward/back swing of the arms. */
	armSwing: number;
	/** Knee bend; ~PI/2 when sitting. */
	knee: number;
	/** Hip flexion; ~PI/2 when sitting (thighs forward). */
	hipFlex: number;
	/** 0 standing/sitting upright, 1 fully lying on the back. */
	lie: number;
	/** Chest rise for breathing. */
	breath: number;
	/** Head yaw relative to the body (looking around). */
	headYaw: number;
}

const CROSSFADE_PER_SECOND = 3.5;

/**
 * Crossfading state machine. `setState` picks the target; `update` advances
 * time and blend weights; `pose` mixes the per-state poses by weight.
 */
export class Animator {
	private readonly weights: Record<AnimationState, number> = { idle: 1, walk: 0, sit: 0, lie: 0 };
	private target: AnimationState = 'idle';
	private time = 0;
	private walkPhase = 0;
	/** Seconds since the head last started a glance; drives occasional looking around. */
	private glance = 0;

	get state(): AnimationState {
		return this.target;
	}

	weight(state: AnimationState): number {
		return this.weights[state];
	}

	setState(state: AnimationState): void {
		this.target = state;
	}

	/** `speed` is the current ground speed in m/s; it drives the walk cycle. */
	update(dt: number, speed = 0): void {
		this.time += dt;
		this.glance += dt;
		this.walkPhase += dt * Math.max(speed, 0) * 5.2;
		const step = dt * CROSSFADE_PER_SECOND;
		for (const state of ANIMATION_STATES) {
			this.weights[state] = approach(this.weights[state], state === this.target ? 1 : 0, step);
		}
	}

	pose(): Pose {
		const w = this.weights;
		const t = this.time;
		const swing = Math.sin(this.walkPhase);
		const breath = Math.sin(t * 1.6) * 0.5 + 0.5;
		// Idle: weight shift + an occasional look around every ~7 s.
		const glancePhase = (this.glance % 7) / 7;
		const look = glancePhase > 0.75 ? Math.sin(((glancePhase - 0.75) / 0.25) * Math.PI) * 0.6 : 0;

		return {
			bob: w.idle * Math.sin(t * 1.6) * 0.004 + w.walk * Math.abs(Math.cos(this.walkPhase)) * 0.035,
			legSwing: w.walk * swing * 0.42,
			armSwing: w.walk * -swing * 0.45 + w.idle * Math.sin(t * 0.8) * 0.03,
			knee: w.walk * Math.max(0, -Math.sin(this.walkPhase + 0.6)) * 0.45 + w.sit * (Math.PI / 2),
			hipFlex: w.sit * (Math.PI / 2),
			lie: w.lie,
			breath: breath * (w.idle + w.sit + w.lie * 1.4),
			headYaw: (w.idle + w.sit) * look,
		};
	}
}
