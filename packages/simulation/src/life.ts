import type { Activity } from '@windowling/shared';
import { createRng } from './ambient.ts';
import { HOUR_MS } from './catch-up.ts';
import { hashString } from './character.ts';
import {
	activityCost,
	earn,
	INITIAL_MONEY,
	justPaid,
	moneyFeeling,
	moneyWorry,
	payday,
	PAYDAY_MOOD,
	payRent,
	payWeek,
	rentMonth,
	spend,
	type Money,
} from './money.ts';
import { applyNeeds, clampNeeds, INITIAL_NEEDS, type Needs } from './needs.ts';
import { chooseActivity } from './scheduler.ts';
import { localTime } from './time.ts';

/** Everything the simulation needs to continue a character's life. */
export interface LifeState {
	needs: Needs;
	money: Money;
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

/** Decides what to do next; whatever it costs is paid when it starts. */
function decide(
	at: Date,
	needs: Needs,
	money: Money,
	previous: Activity | null,
	ctx: LifeContext,
): LifeState {
	const rng = createRng(hashString(`${ctx.seed}:${at.getTime()}`));
	const { activity, durationMs } = chooseActivity(
		{
			needs,
			previous,
			local: localTime(at, ctx.timeZone),
			money: moneyFeeling(money),
			justPaid: justPaid(money, at),
		},
		rng,
	);
	const duration = Math.max(60_000, Math.round(durationMs));
	return {
		needs,
		money: spend(money, activityCost(activity, duration)),
		activity,
		activityStartedAt: at,
		activityEndsAt: new Date(at.getTime() + duration),
	};
}

/** A brand-new life starting at `now`. */
export function startLife(
	now: Date,
	ctx: LifeContext,
	needs: Needs = INITIAL_NEEDS,
	money: Money = INITIAL_MONEY,
): LifeState {
	return decide(now, needs, money, null, ctx);
}

/** Time passing over one stretch of an activity: needs change (money worries included). */
function live(state: LifeState, from: number, to: number): LifeState {
	const worry = moneyWorry(moneyFeeling(state.money));
	return { ...state, needs: applyNeeds(state.needs, state.activity, (to - from) / HOUR_MS, worry) };
}

/**
 * An activity ended: work is paid for, and the calendar comes round - payday
 * on Friday evening, rent on the 1st. Settled per whole activity, so the
 * result never depends on how the time was split into visits.
 */
function settle(state: LifeState, ctx: LifeContext): LifeState {
	const { activityStartedAt: start, activityEndsAt: end } = state;
	let money =
		state.activity === 'work'
			? earn(state.money, (end.getTime() - start.getTime()) / HOUR_MS)
			: state.money;
	let needs = state.needs;
	if (payWeek(start, ctx.timeZone) !== payWeek(end, ctx.timeZone) && money.unpaid > 0) {
		money = payday(money, end);
		needs = clampNeeds({ ...needs, mood: needs.mood + PAYDAY_MOOD });
	}
	if (rentMonth(start, ctx.timeZone) !== rentMonth(end, ctx.timeZone)) money = payRent(money);
	return { ...state, needs, money };
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
		current = decide(new Date(clock), current.needs, current.money, current.activity, ctx);
	}

	for (let i = 0; i < MAX_DECISIONS; i++) {
		const boundary = Math.min(current.activityEndsAt.getTime(), end);
		const lived = live(current, clock, boundary);
		clock = boundary;
		if (current.activityEndsAt.getTime() > end) return lived;
		const settled = settle(lived, ctx);
		current = decide(current.activityEndsAt, settled.needs, settled.money, current.activity, ctx);
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
		...state,
		needs: { ...state.needs, mood: Math.max(0, state.needs.mood - penalty) },
		activity: 'idle',
		activityStartedAt: at,
		activityEndsAt: new Date(at.getTime() + GRUMPY_AWAKE_MS),
	};
}
