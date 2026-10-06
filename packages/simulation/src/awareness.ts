import { isAway, type Activity, type AwarenessState } from '@windowling/shared';

/**
 * Whether the character knows it is being watched. Opening the app never
 * means being noticed (principle 3): suspicion has to build up from what the
 * player does, filtered through what the character is busy with. Session
 * state only - it lives in the browser while someone is looking.
 */
export interface Awareness {
	state: AwarenessState;
	/** 0..1, how sure the character is that someone is there. */
	suspicion: number;
	/** Seconds spent in the current state. */
	elapsed: number;
	/** Seconds since the player last did anything (moved, knocked). */
	sinceInput: number;
	/** The character is standing at the window, facing the player. */
	atWindow: boolean;
	/** Recent knocks on a sleeping character (seconds ago). */
	sleepKnocks: number[];
	/** Knocks while being ignored - it gets annoying. */
	ignoredKnocks: number;
	/** Seconds the player has been watching this time (since opening / coming back). */
	watching: number;
}

export interface AwarenessContext {
	activity: Activity;
	/** 0..1 */
	mood: number;
	/** -1..1, how it feels about the player (default neutral). */
	affinity?: number;
	/** Lost in a private moment (dancing, raging at a game...): it notices much later. */
	absorbed?: boolean;
}

export type AwarenessInput =
	/** Time passes while the window is open (seconds). */
	| { type: 'tick'; dt: number }
	/** The player moves behind the glass; `amount` ~ fraction of the screen crossed. */
	| { type: 'movement'; amount: number }
	| { type: 'knock' }
	/** The player spoke to the character (push-to-talk). */
	| { type: 'spoke' }
	/** The phone was shaken - the whole room moved. Intensity 0..1. */
	| { type: 'shake'; intensity: number }
	/** The character reached the window after deciding to approach. */
	| { type: 'arrived' }
	/** The player left (tab hidden, app closed). */
	| { type: 'away' };

export type AwarenessEvent =
	/** Something feels off: a glance towards the window. */
	| { type: 'suspected' }
	/** Nothing there after all: back to normal. */
	| { type: 'dismissed' }
	| { type: 'detected'; response: 'approach' | 'ignore' }
	/** At the window and the player responded: wave. */
	| { type: 'interacting' }
	/**
	 * Turns its back and carries on with its life. `no_response`: it came over
	 * or talked and the player stayed silent - it may say so before leaving.
	 */
	| { type: 'ignoring'; reason?: 'no_response' }
	/** Knocked while asleep: rolls over. */
	| { type: 'stirred' }
	/** Knocked awake. Persistent consequences are applied by the server. */
	| { type: 'woken' }
	/** The room was shaken while it was awake (or shook it awake). */
	| { type: 'shaken'; intensity: number };

export interface AwarenessStep {
	awareness: Awareness;
	events: AwarenessEvent[];
}

export const SUSPECT_AT = 0.4;
export const DETECT_AT = 0.85;
export const DISMISS_BELOW = 0.15;
/** How much each activity lets the character notice the world around it. */
export const SENSITIVITY: Record<Activity, number> = {
	idle: 1,
	eat: 0.7,
	work: 0.4,
	gaming: 0.3,
	sleep: 0,
	cook: 0.6,
	clean: 0.8,
	exercise: 0.5,
	tv: 0.4,
	music: 0.5,
	read: 0.4,
	phone: 0.5,
	// Not in the flat at all.
	shower: 0,
	out: 0,
};
const PRESENCE_GAIN = 0.006; // per second, just from someone being there
const MOVEMENT_GAIN = 0.5; // per screen-width of movement
const STILL_DECAY = 0.004; // per second once the player keeps still
const STILL_AFTER = 5;
/**
 * Now and then the character simply looks up and sees the window - no input
 * needed, so it can start the contact itself (per second; a look is +0.5
 * suspicion, two looks = noticed). Idle ~1 min, absorbed in work or a game
 * ~4-5 min, asleep never: you can still watch unnoticed for a while.
 */
export const SPONTANEOUS_LOOK: Record<Activity, number> = {
	idle: 1 / 30,
	eat: 1 / 60,
	work: 1 / 120,
	gaming: 1 / 150,
	sleep: 0,
	cook: 1 / 60,
	clean: 1 / 40,
	exercise: 1 / 60,
	tv: 1 / 120,
	music: 1 / 60,
	read: 1 / 120,
	phone: 1 / 45,
	shower: 0,
	out: 0,
};
const LOOK_GAIN = 0.5;
/** Opening the app is never being noticed: no spontaneous looks in the first seconds. */
export const GRACE_SECONDS = 15;
const WAKE_KNOCKS = 3;
const SLEEP_KNOCK_WINDOW = 8;
/** At the window, waiting for the player to react. */
const WAIT_AT_WINDOW = 12;
/** Interaction ends after this much silence. */
const INTERACTION_TIMEOUT = 20;
/** Being ignored long enough, it forgets you might still be there. */
const FORGET_AFTER = 120;
const ANNOYED_KNOCKS = 3;

export function initialAwareness(): Awareness {
	return {
		state: 'UNKNOWN',
		suspicion: 0,
		elapsed: 0,
		sinceInput: 0,
		atWindow: false,
		sleepKnocks: [],
		ignoredKnocks: 0,
		watching: 0,
	};
}

/** Approach the window or pretend nobody is there? */
export function chooseResponse(
	ctx: AwarenessContext,
	rng: () => number,
	woken = false,
): 'approach' | 'ignore' {
	// Freshly woken people come to complain.
	if (woken) return rng() < 0.85 ? 'approach' : 'ignore';
	// Past moments matter: someone it likes gets a visit, someone who annoyed it doesn't.
	let chance = 0.6 + (ctx.mood - 0.5) * 0.8 + (ctx.affinity ?? 0) * 0.35;
	if (ctx.activity === 'work') chance -= 0.3;
	if (ctx.activity === 'gaming') chance -= 0.2;
	return rng() < Math.min(0.95, Math.max(0.05, chance)) ? 'approach' : 'ignore';
}

function enter(a: Awareness, state: AwarenessState): Awareness {
	return { ...a, state, elapsed: 0, atWindow: state === 'INTERACTING' ? a.atWindow : false };
}

export function stepAwareness(
	current: Awareness,
	input: AwarenessInput,
	ctx: AwarenessContext,
	rng: () => number,
): AwarenessStep {
	let a = current;
	const events: AwarenessEvent[] = [];
	const asleep = ctx.activity === 'sleep';
	const sensitivity = SENSITIVITY[ctx.activity] * (ctx.absorbed ? 0.4 : 1);

	const detect = (woken = false) => {
		const response = chooseResponse(ctx, rng, woken);
		a = enter(
			{ ...a, suspicion: 1, ignoredKnocks: 0 },
			response === 'approach' ? 'DETECTED' : 'IGNORING',
		);
		events.push({ type: 'detected', response });
		if (response === 'ignore') events.push({ type: 'ignoring' });
	};

	// Nobody home: knocks and shakes go unanswered, and whatever it knew is gone.
	if (isAway(ctx.activity) && input.type !== 'away') {
		if (current.state === 'UNKNOWN') return { awareness: current, events: [] };
		return { awareness: initialAwareness(), events: [{ type: 'dismissed' }] };
	}

	switch (input.type) {
		case 'away':
			return {
				awareness: initialAwareness(),
				events: current.state === 'UNKNOWN' ? [] : [{ type: 'dismissed' }],
			};

		case 'arrived':
			if (a.state === 'DETECTED') a = { ...a, atWindow: true, elapsed: 0 };
			return { awareness: a, events };

		case 'movement': {
			a = { ...a, sinceInput: 0 };
			if (a.state === 'UNKNOWN' || a.state === 'SUSPECTED') {
				a = {
					...a,
					suspicion: Math.min(1, a.suspicion + input.amount * MOVEMENT_GAIN * sensitivity),
				};
			} else if (a.state === 'DETECTED' && a.atWindow && input.amount > 0.05) {
				a = enter(a, 'INTERACTING');
				events.push({ type: 'interacting' });
			}
			break;
		}

		case 'shake': {
			const k = Math.min(1, Math.max(0, input.intensity));
			a = { ...a, sinceInput: 0 };
			if (asleep) {
				// A gentle shake rocks a sleeper; a real one throws them out of bed.
				if (k < 0.5) {
					events.push({ type: 'stirred' });
					break;
				}
				events.push({ type: 'woken' }, { type: 'shaken', intensity: k });
				detect(true);
				break;
			}
			events.push({ type: 'shaken', intensity: k });
			// Nobody mistakes an earthquake for nothing: whoever is out there, it knows now.
			if (a.state === 'UNKNOWN' || a.state === 'SUSPECTED' || a.state === 'IGNORING') {
				a = { ...a, suspicion: 1 };
				if (a.state === 'IGNORING') {
					a = enter(a, 'DETECTED');
					events.push({ type: 'detected', response: 'approach' });
				}
			}
			break;
		}

		case 'spoke':
		case 'knock': {
			a = { ...a, sinceInput: 0 };
			if (input.type === 'spoke' && asleep) break; // talking doesn't reach a sleeper
			if (asleep && (a.state === 'UNKNOWN' || a.state === 'SUSPECTED')) {
				const knocks = [...a.sleepKnocks, 0];
				a = { ...a, sleepKnocks: knocks };
				if (knocks.length >= WAKE_KNOCKS) {
					events.push({ type: 'woken' });
					a = { ...a, sleepKnocks: [] };
					detect(true);
				} else {
					events.push({ type: 'stirred' });
				}
				break;
			}
			if (a.state === 'UNKNOWN' || a.state === 'SUSPECTED') {
				// Unmistakable when idle; absorbed in a game it may take a second knock.
				a = { ...a, suspicion: Math.min(1, a.suspicion + 0.5 + 0.5 * sensitivity) };
			} else if (a.state === 'DETECTED' && a.atWindow) {
				a = enter(a, 'INTERACTING');
				events.push({ type: 'interacting' });
			} else if (a.state === 'INTERACTING') {
				a = { ...a, elapsed: 0 };
				events.push({ type: 'interacting' });
			} else if (a.state === 'IGNORING') {
				const ignoredKnocks = a.ignoredKnocks + 1;
				a = { ...a, ignoredKnocks };
				// Fine, what do you want?
				if (ignoredKnocks >= ANNOYED_KNOCKS && !asleep) {
					a = enter({ ...a, ignoredKnocks: 0 }, 'DETECTED');
					events.push({ type: 'detected', response: 'approach' });
				}
			}
			break;
		}

		case 'tick': {
			const dt = Math.max(0, input.dt);
			a = {
				...a,
				elapsed: a.elapsed + dt,
				sinceInput: a.sinceInput + dt,
				watching: a.watching + dt,
				sleepKnocks: a.sleepKnocks.map((t) => t + dt).filter((t) => t <= SLEEP_KNOCK_WINDOW),
			};
			if (a.state === 'UNKNOWN' || a.state === 'SUSPECTED') {
				const decay = a.sinceInput > STILL_AFTER ? STILL_DECAY : 0;
				// Something felt off: it checks the window again much sooner.
				const curiosity = a.state === 'SUSPECTED' ? 3 : 1;
				const roll = rng();
				const looked =
					a.watching > GRACE_SECONDS &&
					roll < SPONTANEOUS_LOOK[ctx.activity] * curiosity * (ctx.absorbed ? 0.3 : 1) * dt
						? LOOK_GAIN
						: 0;
				a = {
					...a,
					suspicion: Math.min(
						1,
						Math.max(0, a.suspicion + looked + dt * (PRESENCE_GAIN * sensitivity - decay)),
					),
				};
			} else if (a.state === 'DETECTED' && a.atWindow && a.elapsed > WAIT_AT_WINDOW) {
				// Stared at, no reaction: shrug and go back.
				a = enter(a, 'IGNORING');
				events.push({ type: 'ignoring', reason: 'no_response' });
			} else if (a.state === 'INTERACTING' && a.sinceInput > INTERACTION_TIMEOUT) {
				a = enter(a, 'IGNORING');
				events.push({ type: 'ignoring', reason: 'no_response' });
			} else if (
				a.state === 'IGNORING' &&
				a.elapsed > FORGET_AFTER &&
				a.sinceInput > FORGET_AFTER
			) {
				a = { ...enter(a, 'UNKNOWN'), suspicion: SUSPECT_AT * 0.5, ignoredKnocks: 0 };
				events.push({ type: 'dismissed' });
			}
			break;
		}
	}

	// Threshold transitions shared by every input that moves suspicion.
	if (a.state === 'UNKNOWN' && a.suspicion >= SUSPECT_AT) {
		a = enter(a, 'SUSPECTED');
		events.push({ type: 'suspected' });
	}
	if (a.state === 'SUSPECTED' && a.suspicion >= DETECT_AT) {
		detect();
	} else if (a.state === 'SUSPECTED' && a.suspicion < DISMISS_BELOW) {
		a = enter(a, 'UNKNOWN');
		events.push({ type: 'dismissed' });
	}
	return { awareness: a, events };
}
