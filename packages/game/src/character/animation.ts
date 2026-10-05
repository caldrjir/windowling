import { approach } from './math.ts';

export type AnimationState = 'idle' | 'walk' | 'sit' | 'lie';

export const ANIMATION_STATES: readonly AnimationState[] = ['idle', 'walk', 'sit', 'lie'];

/** What the hands are busy with, layered on top of the body state. */
export type ActivityAnimation = 'none' | 'eat' | 'work' | 'play' | 'wave';

const ACTIVITY_LAYERS = ['eat', 'work', 'play', 'wave'] as const;
type ActivityLayer = (typeof ACTIVITY_LAYERS)[number];

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
	/** Head tilt down (looking at food, a screen, a handheld). */
	headPitch: number;
	/** Both shoulders raised forward (reaching for a keyboard, holding something). */
	armForward: number;
	/** Extra elbow bend for both arms. */
	elbow: number;
	/** Right hand going up to the mouth (0..1). */
	handToMouth: number;
	/** Upper body leaning forward; low mood slumps the shoulders. */
	slump: number;
	/** Visibility of hand-held props (0..1); the rig shows them above 0.5. */
	bowl: number;
	handheld: number;
	/** Right arm raised and waving (0..1) and its side-to-side swing. */
	wave: number;
	waveSwing: number;
}

const CROSSFADE_PER_SECOND = 3.5;

/**
 * Crossfading state machine. `setState` picks the target; `update` advances
 * time and blend weights; `pose` mixes the per-state poses by weight.
 */
export class Animator {
	private readonly weights: Record<AnimationState, number> = { idle: 1, walk: 0, sit: 0, lie: 0 };
	private readonly layers: Record<ActivityLayer, number> = { eat: 0, work: 0, play: 0, wave: 0 };
	/** Looking at the player: head yaw relative to the body, and how much. */
	private lookTarget: number | null = null;
	private lookYaw = 0;
	private lookWeight = 0;
	private target: AnimationState = 'idle';
	private activityTarget: ActivityAnimation = 'none';
	/** 0..1, how the character feels; shows in posture and pace. */
	private _mood = 0.6;
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

	get activity(): ActivityAnimation {
		return this.activityTarget;
	}

	activityWeight(layer: ActivityLayer): number {
		return this.layers[layer];
	}

	setActivity(activity: ActivityAnimation): void {
		this.activityTarget = activity;
	}

	/** Turns the head towards `relativeYaw` (radians from the body's forward), or back with null. */
	setLook(relativeYaw: number | null): void {
		this.lookTarget = relativeYaw === null ? null : Math.max(-1.3, Math.min(1.3, relativeYaw));
	}

	get looking(): number {
		return this.lookWeight;
	}

	get mood(): number {
		return this._mood;
	}

	setMood(mood: number): void {
		this._mood = Math.min(1, Math.max(0, mood));
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
		this.lookWeight = approach(this.lookWeight, this.lookTarget === null ? 0 : 1, dt * 2.5);
		if (this.lookTarget !== null) this.lookYaw = this.lookTarget;
		for (const layer of ACTIVITY_LAYERS) {
			this.layers[layer] = approach(
				this.layers[layer],
				layer === this.activityTarget ? 1 : 0,
				step,
			);
		}
	}

	pose(): Pose {
		const w = this.weights;
		const t = this.time;
		const swing = Math.sin(this.walkPhase);
		const breath = Math.sin(t * 1.6) * 0.5 + 0.5;
		// Idle: weight shift + an occasional look around every ~7 s.
		const glancePhase = (this.glance % 7) / 7;
		const glanceYaw =
			glancePhase > 0.75 ? Math.sin(((glancePhase - 0.75) / 0.25) * Math.PI) * 0.6 : 0;

		const { eat, work, play, wave } = this.layers;
		const look = this.lookWeight * (1 - w.lie * 0.6);
		// Eating: a spoonful every ~4 s. Working: quick alternating typing. Gaming: thumbs + leaning in.
		const bite = Math.max(0, Math.sin((t * Math.PI * 2) / 4)) ** 2;
		const typing = Math.sin(t * 18) * 0.06;
		const gamingLean = Math.sin(t * 0.9) * 0.5 + 0.5;
		const sad = Math.max(0, 0.5 - this._mood) * 2; // 0 when fine, 1 when miserable

		return {
			bob: w.idle * Math.sin(t * 1.6) * 0.004 + w.walk * Math.abs(Math.cos(this.walkPhase)) * 0.035,
			legSwing: w.walk * swing * 0.42,
			armSwing:
				w.walk * -swing * 0.45 * (1 - sad * 0.5) +
				w.idle * Math.sin(t * 0.8) * 0.03 * (1 - eat - work - play),
			knee: w.walk * Math.max(0, -Math.sin(this.walkPhase + 0.6)) * 0.45 + w.sit * (Math.PI / 2),
			hipFlex: w.sit * (Math.PI / 2),
			lie: w.lie,
			breath: breath * (w.idle + w.sit + w.lie * 1.4),
			headYaw:
				(w.idle + w.sit) * glanceYaw * (1 - eat - work - play) * (1 - look) + this.lookYaw * look,
			headPitch:
				(eat * 0.3 + work * 0.12 + play * 0.4 + sad * 0.25 * (1 - w.lie)) * (1 - look) -
				look * 0.05,
			armForward: eat * 0.7 + work * 0.75 + play * 0.65,
			elbow: eat * 0.8 + work * (0.55 + typing) + play * (1.1 + typing * 0.5),
			handToMouth: eat * bite,
			slump: (work * 0.15 + play * gamingLean * 0.2 + sad * 0.3) * (1 - w.lie),
			bowl: eat,
			handheld: play,
			wave,
			waveSwing: Math.sin(t * 9) * wave,
		};
	}
}
