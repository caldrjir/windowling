import { approach } from './math.ts';

export type AnimationState = 'idle' | 'walk' | 'sit' | 'lie';

export const ANIMATION_STATES: readonly AnimationState[] = ['idle', 'walk', 'sit', 'lie'];

/** What the hands are busy with, layered on top of the body state. */
export type ActivityAnimation =
	| 'none'
	| 'eat'
	| 'work'
	| 'play'
	| 'wave'
	| 'cook'
	| 'clean'
	| 'exercise'
	| 'phone'
	| 'read'
	| 'tv'
	| 'music';

const ACTIVITY_LAYERS = [
	'eat',
	'work',
	'play',
	'wave',
	'cook',
	'clean',
	'exercise',
	'phone',
	'read',
	'tv',
	'music',
] as const;
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
	/** Props for the richer day (shown above 0.5). */
	broom: number;
	book: number;
	phone: number;
	/** Right arm raised and waving (0..1) and its side-to-side swing. */
	wave: number;
	waveSwing: number;
	/** 0 closed .. 1 wide open (basic lip sync). */
	mouth: number;
	/** Thrown off balance (shaken room): arms out, body swaying. */
	startle: number;
	/** Sideways sway of the whole body while startled (radians). */
	sway: number;
}

/** Feelings the body can show for a moment (mirrors the AI's emotion set). */
export type Emotion =
	| 'neutral'
	| 'happy'
	| 'sad'
	| 'angry'
	| 'annoyed'
	| 'surprised'
	| 'embarrassed'
	| 'tired'
	| 'nervous';

const EMOTION_SECONDS = 6;

const CROSSFADE_PER_SECOND = 3.5;

/**
 * Crossfading state machine. `setState` picks the target; `update` advances
 * time and blend weights; `pose` mixes the per-state poses by weight.
 */
export class Animator {
	private readonly weights: Record<AnimationState, number> = { idle: 1, walk: 0, sit: 0, lie: 0 };
	private readonly layers: Record<ActivityLayer, number> = {
		eat: 0,
		work: 0,
		play: 0,
		wave: 0,
		cook: 0,
		clean: 0,
		exercise: 0,
		phone: 0,
		read: 0,
		tv: 0,
		music: 0,
	};
	/** Looking at the player: head yaw relative to the body, and how much. */
	private lookTarget: number | null = null;
	private lookYaw = 0;
	private lookWeight = 0;
	private target: AnimationState = 'idle';
	private activityTarget: ActivityAnimation = 'none';
	/** 0..1, how the character feels; shows in posture and pace. */
	private _mood = 0.6;
	private speaking = false;
	private mouthOpen = 0;
	private syllable = 0;
	private emotion: Emotion = 'neutral';
	private emotionWeight = 0;
	private emotionLeft = 0;
	private startleLeft = 0;
	private startleStrength = 0;
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

	/** Talking: the mouth moves in syllable-like beats; `pulse` marks a new word. */
	setSpeaking(speaking: boolean): void {
		this.speaking = speaking;
	}

	pulseMouth(): void {
		this.syllable = 0;
		this.mouthOpen = Math.max(this.mouthOpen, 0.9);
	}

	/** Shows a feeling for a few seconds, then fades back to the mood's baseline. */
	showEmotion(emotion: Emotion, intensity: number): void {
		this.emotion = emotion;
		this.emotionLeft = EMOTION_SECONDS * (0.5 + Math.min(1, Math.max(0, intensity)) * 0.5);
	}

	/** The ground moved: lose balance for a moment, harder for stronger jolts. */
	startle(intensity: number): void {
		this.startleStrength = Math.max(this.startleStrength, Math.min(1, Math.max(0, intensity)));
		this.startleLeft = 0.8 + this.startleStrength;
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
		this.startleLeft = Math.max(0, this.startleLeft - dt);
		if (this.startleLeft === 0) this.startleStrength = Math.max(0, this.startleStrength - dt * 2);
		this.emotionLeft = Math.max(0, this.emotionLeft - dt);
		this.emotionWeight = approach(this.emotionWeight, this.emotionLeft > 0 ? 1 : 0, dt * 2);
		this.syllable += dt;
		// Roughly 5 syllables a second, with open/close variation.
		// On the phone it talks in bursts, with pauses for the other side.
		const onPhone = this.layers.phone > 0.5 && Math.sin(this.syllable * 0.9) > -0.2;
		const target = this.speaking || onPhone ? (Math.sin(this.syllable * 31) * 0.5 + 0.5) * 0.8 : 0;
		this.mouthOpen = approach(this.mouthOpen, target, dt * 12);
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

		const { eat, work, play, wave, cook, clean, exercise, phone, read, tv, music } = this.layers;
		/** Hands busy with something - no idle fidgeting or glancing around. */
		const handsBusy = Math.min(1, eat + work + play + cook + clean + phone + read);
		const stir = Math.sin(t * 4);
		const sweep = Math.sin(t * 3.2);
		// Squats: down and up every ~2.5 s.
		const squat = exercise * (Math.sin(t * 2.5 - Math.PI / 2) * 0.5 + 0.5);
		const bobHead = music * Math.sin(t * 7) * 0.12;
		const look = this.lookWeight * (1 - w.lie * 0.6);
		// Eating: a spoonful every ~4 s. Working: quick alternating typing. Gaming: thumbs + leaning in.
		const bite = Math.max(0, Math.sin((t * Math.PI * 2) / 4)) ** 2;
		const typing = Math.sin(t * 18) * 0.06;
		const gamingLean = Math.sin(t * 0.9) * 0.5 + 0.5;
		const sad = Math.max(0, 0.5 - this._mood) * 2; // 0 when fine, 1 when miserable
		const feel = this.emotionWeight;
		const e = this.emotion;
		const down = feel * (e === 'sad' || e === 'tired' || e === 'embarrassed' ? 1 : 0);
		const up = feel * (e === 'happy' || e === 'surprised' ? 1 : 0);
		const tense = feel * (e === 'angry' || e === 'annoyed' || e === 'nervous' ? 1 : 0);

		return {
			bob:
				w.idle * Math.sin(t * 1.6) * 0.004 +
				w.walk * Math.abs(Math.cos(this.walkPhase)) * 0.035 +
				up * w.idle * Math.max(0, Math.sin(t * 7)) * 0.015 -
				squat * 0.25,
			legSwing: w.walk * swing * 0.42,
			armSwing:
				w.walk * -swing * 0.45 * (1 - sad * 0.5) +
				w.idle * Math.sin(t * 0.8) * 0.03 * (1 - handsBusy) +
				clean * sweep * 0.25,
			knee:
				w.walk * Math.max(0, -Math.sin(this.walkPhase + 0.6)) * 0.45 +
				w.sit * (Math.PI / 2) +
				squat * 1.3,
			hipFlex: w.sit * (Math.PI / 2) + squat * 0.9,
			lie: w.lie,
			breath: breath * (w.idle + w.sit + w.lie * 1.4),
			headYaw:
				(w.idle + w.sit) * glanceYaw * (1 - handsBusy) * (1 - look) +
				this.lookYaw * look +
				phone * Math.sin(t * 0.4) * 0.3,
			headPitch:
				(eat * 0.3 +
					work * 0.12 +
					play * 0.4 +
					cook * 0.35 +
					clean * 0.25 +
					read * 0.4 -
					tv * 0.05 +
					bobHead +
					sad * 0.25 * (1 - w.lie)) *
					(1 - look) -
				look * 0.05 +
				down * 0.35 -
				up * 0.15 +
				tense * Math.sin(t * 5) * 0.05,
			armForward:
				eat * 0.7 +
				work * 0.75 +
				play * 0.65 +
				cook * (0.6 + stir * 0.08) +
				clean * 0.55 +
				read * 0.6 +
				squat * 1.2,
			elbow:
				eat * 0.8 +
				work * (0.55 + typing) +
				play * (1.1 + typing * 0.5) +
				cook * (0.9 + stir * 0.15) +
				clean * 0.4 +
				read * 1.3,
			// The phone is held to the ear (close enough to the mouth for this rig).
			handToMouth: eat * bite + phone,
			slump:
				(work * 0.15 +
					play * gamingLean * 0.2 +
					sad * 0.3 +
					down * 0.25 -
					up * 0.1 -
					tense * 0.05 +
					clean * 0.2 -
					tv * 0.15 +
					squat * 0.35) *
				(1 - w.lie),
			bowl: eat,
			handheld: play,
			broom: clean,
			book: read,
			phone,
			wave,
			waveSwing: Math.sin(t * 9) * wave,
			mouth: this.mouthOpen,
			startle: this.startleStrength,
			sway: Math.sin(t * 17) * 0.12 * this.startleStrength * (1 - w.lie),
		};
	}
}
