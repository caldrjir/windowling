import type { Activity } from '@windowling/shared';
import { createRng } from './ambient.ts';
import { HOUR_MS } from './catch-up.ts';
import { hashString } from './character.ts';
import { applyNeeds, INITIAL_NEEDS, type Needs } from './needs.ts';
import { chooseActivity } from './scheduler.ts';
import { localTime } from './time.ts';

/** Everything the simulation needs to continue a character's life. */
export interface LifeState {
	needs: Needs;
	activity: Activity;
	activityStartedAt: Date;
	activityEndsAt: Date;
}

export interface LifeContext {
	/** Stable per world (the world id): same seed + same inputs = same life. */
	seed: string;
	/** IANA zone of the player's device. */
	timeZone: string;
}

/** Hard stop for pathological inputs; 14 days of 10-minute activities is ~2000. */
const MAX_DECISIONS = 10_000;

function decide(
	at: Date,
	needs: Needs,
	previous: Activity | null,
	ctx: LifeContext,
): Pick<LifeState, 'activity' | 'activityStartedAt' | 'activityEndsAt'> {
	const rng = createRng(hashString(`${ctx.seed}:${at.getTime()}`));
	const { activity, durationMs } = chooseActivity(
		{ needs, previous, local: localTime(at, ctx.timeZone) },
		rng,
	);
	return {
		activity,
		activityStartedAt: at,
		activityEndsAt: new Date(at.getTime() + Math.max(60_000, Math.round(durationMs))),
	};
}

/** A brand-new life starting at `now`. */
export function startLife(now: Date, ctx: LifeContext, needs: Needs = INITIAL_NEEDS): LifeState {
	return { needs, ...decide(now, needs, null, ctx) };
}

/**
 * Lives from `from` to `to`: applies needs for whatever the character was
 * doing and makes a new decision each time an activity ends. Event-driven,
 * deterministic and never rewinds (`to <= from` returns the state unchanged).
 */
export function advanceLife(state: LifeState, from: Date, to: Date, ctx: LifeContext): LifeState {
	if (to.getTime() <= from.getTime()) return state;
	let current = state;
	let clock = from.getTime();
	const end = to.getTime();

	// The stored activity ended before we resume (e.g. part of a long absence was skipped).
	if (current.activityEndsAt.getTime() <= clock) {
		current = {
			needs: current.needs,
			...decide(new Date(clock), current.needs, current.activity, ctx),
		};
	}

	for (let i = 0; i < MAX_DECISIONS; i++) {
		const boundary = Math.min(current.activityEndsAt.getTime(), end);
		const needs = applyNeeds(current.needs, current.activity, (boundary - clock) / HOUR_MS);
		clock = boundary;
		if (current.activityEndsAt.getTime() > end) return { ...current, needs };
		current = { needs, ...decide(current.activityEndsAt, needs, current.activity, ctx) };
	}
	return current;
}

/** Mood cost of being knocked awake; worse when it hasn't slept enough. */
const WOKEN_MOOD_PENALTY = 0.25;
const GRUMPY_AWAKE_MS = 15 * 60_000;

/**
 * Someone woke the character up (knocking on the glass). It stays up, grumpy,
 * for a while, then the scheduler decides again - usually back to bed at night.
 * Returns null when it wasn't asleep: you can't wake someone who is awake.
 */
export function wakeUp(state: LifeState, at: Date): LifeState | null {
	if (state.activity !== 'sleep' || at.getTime() >= state.activityEndsAt.getTime()) return null;
	const penalty = WOKEN_MOOD_PENALTY * (1.5 - state.needs.energy);
	return {
		needs: { ...state.needs, mood: Math.max(0, state.needs.mood - penalty) },
		activity: 'idle',
		activityStartedAt: at,
		activityEndsAt: new Date(at.getTime() + GRUMPY_AWAKE_MS),
	};
}
