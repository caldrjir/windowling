import type { Activity, AwarenessState } from '@windowling/shared';

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
}

export interface AwarenessContext {
	activity: Activity;
	/** 0..1 */
	mood: number;
}

export type AwarenessInput =
	/** Time passes while the window is open (seconds). */
	| { type: 'tick'; dt: number }
	/** The player moves behind the glass; `amount` ~ fraction of the screen crossed. */
	| { type: 'movement'; amount: number }
	| { type: 'knock' }
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
	/** Turns its back and carries on with its life. */
	| { type: 'ignoring' }
	/** Knocked while asleep: rolls over. */
	| { type: 'stirred' }
	/** Knocked awake. Persistent consequences are applied by the server. */
	| { type: 'woken' };

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
};
const PRESENCE_GAIN = 0.006; // per second, just from someone being there
const MOVEMENT_GAIN = 0.5; // per screen-width of movement
const STILL_DECAY = 0.004; // per second once the player keeps still
const STILL_AFTER = 5;
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
	let chance = 0.6 + (ctx.mood - 0.5) * 0.8;
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
	const sensitivity = SENSITIVITY[ctx.activity];

	const detect = (woken = false) => {
		const response = chooseResponse(ctx, rng, woken);
		a = enter(
			{ ...a, suspicion: 1, ignoredKnocks: 0 },
			response === 'approach' ? 'DETECTED' : 'IGNORING',
		);
		events.push({ type: 'detected', response });
		if (response === 'ignore') events.push({ type: 'ignoring' });
	};

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

		case 'knock': {
			a = { ...a, sinceInput: 0 };
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
				sleepKnocks: a.sleepKnocks.map((t) => t + dt).filter((t) => t <= SLEEP_KNOCK_WINDOW),
			};
			if (a.state === 'UNKNOWN' || a.state === 'SUSPECTED') {
				const decay = a.sinceInput > STILL_AFTER ? STILL_DECAY : 0;
				a = {
					...a,
					suspicion: Math.min(
						1,
						Math.max(0, a.suspicion + dt * (PRESENCE_GAIN * sensitivity - decay)),
					),
				};
			} else if (a.state === 'DETECTED' && a.atWindow && a.elapsed > WAIT_AT_WINDOW) {
				// Stared at, no reaction: shrug and go back.
				a = enter(a, 'IGNORING');
				events.push({ type: 'ignoring' });
			} else if (a.state === 'INTERACTING' && a.sinceInput > INTERACTION_TIMEOUT) {
				a = enter(a, 'IGNORING');
				events.push({ type: 'ignoring' });
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
