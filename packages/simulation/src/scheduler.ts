import {
	ACTIVITIES,
	type Activity,
	type CharacterAction,
	type ItemId,
	type MoneyFeeling,
} from '@windowling/shared';
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
	/** How money feels (never the amount). */
	money?: MoneyFeeling;
	/** Payday was today or yesterday. */
	justPaid?: boolean;
	/** A parcel is waiting by the door (Iteration 10). */
	parcelWaiting?: boolean;
	/** Things in the flat that make some activities nicer (Iteration 10). */
	owns?: readonly ItemId[];
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
	money = 'fine',
	justPaid = false,
	parcelWaiting = false,
	owns = [],
}: DecisionContext): Record<Activity, number> {
	const short = money === 'broke' || money === 'tight';
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
	if (isWorkTime(local) && needs.energy > 0.2 && needs.hunger < 0.75) work = short ? 2.8 : 2.2;

	const evening = between(hour, 18, BEDTIME);
	const weekendDay = isWeekend(local.weekday) && between(hour, 10, 20);
	const workTime = isWorkTime(local);

	let gaming = 0.6;
	if (evening) gaming += 0.7;
	if (isWeekend(local.weekday) && between(hour, 10, BEDTIME)) gaming += 0.6;
	if (needs.mood < 0.5) gaming += 0.5;
	if (needs.energy < 0.2) gaming *= 0.3;
	if (night) gaming *= 0.15;
	if (previous === 'gaming') gaming *= 0.5;

	const idle = night ? 0.2 : 0.7;

	// --- Iteration 7: a richer day. Leisure competes with gaming; chores happen sometimes.
	const awake = !night;
	let cook = 0;
	if (awake && needs.hunger >= 0.2 && previous !== 'eat' && previous !== 'cook') {
		// Proper cooking for dinner and weekend lunches; quick bites otherwise.
		const proper =
			between(hour, 17.5, 20.5) || (isWeekend(local.weekday) && between(hour, 11.5, 14));
		if (proper && needs.energy > 0.3) {
			cook = needs.hunger * 3 + 1.4;
			eat *= 0.5; // dinner gets cooked, not grabbed
		}
	}

	let clean = awake && needs.energy > 0.3 && previous !== 'clean' ? 0.3 : 0;
	if (clean && isWeekend(local.weekday) && between(hour, 9, 18)) clean += 0.5;

	let exercise = 0;
	if (
		awake &&
		needs.energy > 0.5 &&
		needs.hunger < 0.6 &&
		previous !== 'eat' &&
		previous !== 'cook'
	) {
		if (between(hour, 7, 9) || between(hour, 17, 20)) exercise = 0.7;
		if (isWeekend(local.weekday) && between(hour, 9, 12)) exercise = 0.8;
	}

	let tv = evening ? 1.1 : weekendDay ? 0.55 : 0.3;
	if (needs.energy < 0.35) tv += 0.3;
	if (owns.includes('blanket') && evening) tv += 0.1;
	if (night) tv *= 0.15;
	if (previous === 'tv') tv *= 0.5;

	let music = awake ? 0.65 : 0.05;
	if (needs.mood < 0.5) music += 0.3;
	if (owns.includes('headphones')) music += 0.15;
	if (workTime) music *= 0.5;
	if (previous === 'music') music *= 0.4;

	let read = awake ? 0.5 : 0.1;
	if (between(hour, 21, BEDTIME)) read += 1; // a book in bed before sleep
	if (previous === 'read') read *= 0.4;

	let phone = awake && !workTime ? 0.65 : 0;
	if (isWeekend(local.weekday)) phone += 0.15;
	// Short of money: calling around (an extra shift, a friend who owes it).
	if (short && awake) phone += 0.35;
	if (previous === 'phone') phone = 0;

	// Mornings start in the bathroom; a workout ends there.
	let shower = awake ? 0.1 : 0;
	if (previous === 'sleep' && awake) shower = 2.6;
	if (previous === 'exercise') shower = 3;
	if (previous === 'shower') shower = 0;

	let out = 0;
	if (awake && needs.energy > 0.35 && needs.hunger < 0.6 && previous !== 'out') {
		if (weekendDay) out = 1;
		else if (!isWeekend(local.weekday) && between(hour, 17, 20)) out = 0.6;
		// Going out costs money: none when broke, rarely when tight, a treat after payday.
		if (money === 'broke') out = 0;
		else if (money === 'tight') out *= 0.35;
		else if (justPaid) out *= 1.8;
	}

	// A parcel by the door: who could wait? (Not in the middle of work, though.)
	const unpack = parcelWaiting && awake && !workTime && previous !== 'unpack' ? 2.4 : 0;

	return {
		unpack,
		sleep,
		eat,
		work,
		gaming,
		idle,
		cook,
		clean,
		exercise,
		tv,
		music,
		read,
		phone,
		shower,
		out,
	};
}

function randomBetween(rng: () => number, min: number, max: number): number {
	return min + rng() * (max - min);
}

export function chooseActivity(context: DecisionContext, rng: () => number): Decision {
	const scores = scoreActivities(context);
	let best: Activity = 'idle';
	let bestScore = -Infinity;
	for (const activity of ACTIVITIES) {
		// Wide enough that the same hour doesn't always look the same (opening the app is a surprise).
		const score = scores[activity] * (0.65 + 0.7 * rng());
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
		case 'cook':
			return randomBetween(rng, 30, 45) * MINUTE_MS;
		case 'clean':
		case 'exercise':
			return randomBetween(rng, 20, 40) * MINUTE_MS;
		case 'tv':
			return randomBetween(rng, 30, 90) * MINUTE_MS;
		case 'music':
		case 'read':
			return randomBetween(rng, 20, 60) * MINUTE_MS;
		case 'phone':
			return randomBetween(rng, 5, 20) * MINUTE_MS;
		case 'shower':
			return randomBetween(rng, 10, 20) * MINUTE_MS;
		case 'out':
			return randomBetween(rng, 40, 150) * MINUTE_MS;
		case 'unpack':
			return randomBetween(rng, 8, 15) * MINUTE_MS;
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
		case 'cook':
			return { type: 'cook', target: 'kitchen.counter' };
		case 'clean':
			return { type: 'clean' };
		case 'exercise':
			return { type: 'exercise', target: 'room.center' };
		case 'tv':
			return { type: 'watch', target: 'sofa' };
		case 'music':
			return { type: 'listen', target: 'sofa' };
		case 'read':
			return { type: 'read', target: 'bed' };
		case 'phone':
			return { type: 'call', target: 'window' };
		case 'shower':
		case 'out':
			return { type: 'leave', target: 'door' };
		case 'unpack':
			return { type: 'unpack', target: 'door' };
	}
}
