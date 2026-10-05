import { ACTIVITIES, type Activity, type CharacterAction } from '@windowling/shared';
import { HOUR_MS, MINUTE_MS } from './catch-up.ts';
import type { Needs } from './needs.ts';
import { hoursUntil, isWeekend, type LocalTime } from './time.ts';

/**
 * The basic scheduler: utility scores from needs x local time x weekday, with
 * a little deterministic randomness so days are not identical. Personality,
 * money and memories will weigh in here in later iterations.
 */
export interface DecisionContext {
	needs: Needs;
	local: LocalTime;
	/** What the character was doing until now (null for a brand-new life). */
	previous: Activity | null;
}

export interface Decision {
	activity: Activity;
	durationMs: number;
}

const WORK_START = 9;
const WORK_END = 17;
const WAKE_WEEKDAY = 7;
const WAKE_WEEKEND = 9;
const BEDTIME = 23;
const MEALS: ReadonlyArray<[from: number, to: number]> = [
	[7, 9],
	[12, 13.5],
	[18, 20],
];

function between(hour: number, from: number, to: number): boolean {
	return from <= to ? hour >= from && hour < to : hour >= from || hour < to;
}

function wakeHour(local: LocalTime, hour: number): number {
	// After midnight the morning belongs to the current day; before it, to the next.
	const morningWeekday = hour >= 12 ? (local.weekday + 1) % 7 : local.weekday;
	return isWeekend(morningWeekday) ? WAKE_WEEKEND : WAKE_WEEKDAY;
}

function isNight(local: LocalTime): boolean {
	return between(local.hour, BEDTIME, wakeHour(local, local.hour) - 0.5);
}

function isWorkTime(local: LocalTime): boolean {
	return !isWeekend(local.weekday) && between(local.hour, WORK_START, WORK_END - 0.25);
}

/** How much the character wants each activity right now (0 = not at all). */
export function scoreActivities({
	needs,
	local,
	previous,
}: DecisionContext): Record<Activity, number> {
	const { hour } = local;
	const night = isNight(local);
	const lateEvening = between(hour, 21.5, BEDTIME);

	let sleep = 0;
	if (night) sleep = 3 + (1 - needs.energy);
	else if (lateEvening) sleep = (1 - needs.energy) * 2;
	else if (needs.energy < 0.15) sleep = 2.5;
	// Just woke up rested: get up.
	if (previous === 'sleep' && needs.energy > 0.6 && !night) sleep = 0;

	let eat = 0;
	if (needs.hunger >= 0.25 && previous !== 'eat') {
		eat = needs.hunger * 3 + (MEALS.some(([from, to]) => between(hour, from, to)) ? 1.5 : 0);
		if (night) eat *= needs.hunger > 0.8 ? 0.6 : 0.1;
	}

	let work = 0;
	if (isWorkTime(local) && needs.energy > 0.2 && needs.hunger < 0.75) work = 2.2;

	let gaming = 0.6;
	if (between(hour, 18, BEDTIME)) gaming += 0.9;
	if (isWeekend(local.weekday) && between(hour, 10, BEDTIME)) gaming += 0.6;
	if (needs.mood < 0.5) gaming += 0.5;
	if (needs.energy < 0.2) gaming *= 0.3;
	if (night) gaming *= 0.15;
	if (previous === 'gaming') gaming *= 0.5;

	const idle = night ? 0.2 : 0.7;

	return { sleep, eat, work, gaming, idle };
}

function randomBetween(rng: () => number, min: number, max: number): number {
	return min + rng() * (max - min);
}

export function chooseActivity(context: DecisionContext, rng: () => number): Decision {
	const scores = scoreActivities(context);
	let best: Activity = 'idle';
	let bestScore = -Infinity;
	for (const activity of ACTIVITIES) {
		const score = scores[activity] * (0.75 + 0.5 * rng());
		if (score > bestScore) {
			best = activity;
			bestScore = score;
		}
	}
	return { activity: best, durationMs: durationOf(best, context, rng) };
}

function durationOf(
	activity: Activity,
	{ local, needs }: DecisionContext,
	rng: () => number,
): number {
	const { hour } = local;
	switch (activity) {
		case 'sleep': {
			if (isNight(local) || between(hour, 21.5, BEDTIME)) {
				const hours = hoursUntil(hour, wakeHour(local, hour)) + randomBetween(rng, -0.3, 0.3);
				return Math.max(30 * MINUTE_MS, hours * HOUR_MS);
			}
			// Daytime nap, longer when exhausted.
			return randomBetween(rng, 40, 70 + (1 - needs.energy) * 50) * MINUTE_MS;
		}
		case 'eat':
			return randomBetween(rng, 20, 35) * MINUTE_MS;
		case 'work': {
			const untilEnd = hoursUntil(hour, WORK_END) * HOUR_MS;
			return Math.min(untilEnd, randomBetween(rng, 60, 120) * MINUTE_MS);
		}
		case 'gaming':
			return randomBetween(rng, 40, 120) * MINUTE_MS;
		case 'idle':
			return randomBetween(rng, 10, 30) * MINUTE_MS;
	}
}

/**
 * The action that shows an activity. `null` means "no fixed place" - the
 * character wanders (see `nextAmbientAction`).
 */
export function actionForActivity(activity: Activity): CharacterAction | null {
	switch (activity) {
		case 'sleep':
			return { type: 'sleep', target: 'bed' };
		case 'eat':
			return { type: 'eat', target: 'kitchen.counter' };
		case 'work':
			return { type: 'work', target: 'desk.chair' };
		case 'gaming':
			return { type: 'play', target: 'sofa' };
		case 'idle':
			return null;
	}
}
