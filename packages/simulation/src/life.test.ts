import { ACTIVITIES, type Activity } from '@windowling/shared';
import { describe, expect, it } from 'vitest';
import { DAY_MS, HOUR_MS } from './catch-up.ts';
import { advanceLife, startLife, wakeUp, type LifeContext, type LifeState } from './life.ts';
import { INITIAL_MONEY } from './money.ts';
import { localTime } from './time.ts';

const CTX: LifeContext = { seed: 'world-1', timeZone: 'Europe/Prague' };
// Monday 2026-10-05 08:00 in Prague
const MONDAY_MORNING = new Date('2026-10-05T06:00:00Z');

/** Records every activity the character starts while living through a span. */
function liveThrough(start: Date, days: number, ctx = CTX) {
	let state = startLife(start, ctx);
	const log: Array<{ activity: Activity; at: Date; until: Date }> = [];
	const end = start.getTime() + days * DAY_MS;
	let clock = start.getTime();
	// Step in hour-sized chunks so we see every activity the character picked.
	while (clock < end) {
		const next = Math.min(end, clock + HOUR_MS / 4);
		const before = state.activityStartedAt.getTime();
		if (log.length === 0 || log.at(-1)?.at.getTime() !== before) {
			log.push({
				activity: state.activity,
				at: state.activityStartedAt,
				until: state.activityEndsAt,
			});
		}
		state = advanceLife(state, new Date(clock), new Date(next), ctx);
		clock = next;
	}
	return { state, log };
}

describe('startLife', () => {
	it('picks a first activity that has not ended yet', () => {
		const state = startLife(MONDAY_MORNING, CTX);
		expect(state.activityStartedAt).toEqual(MONDAY_MORNING);
		expect(state.activityEndsAt.getTime()).toBeGreaterThan(MONDAY_MORNING.getTime());
	});
});

describe('advanceLife', () => {
	it('never rewinds', () => {
		const state = startLife(MONDAY_MORNING, CTX);
		expect(
			advanceLife(state, MONDAY_MORNING, new Date(MONDAY_MORNING.getTime() - HOUR_MS), CTX),
		).toBe(state);
	});

	it('does not depend on how often the world is loaded', () => {
		expect(
			advanceLife(
				startLife(MONDAY_MORNING, CTX),
				MONDAY_MORNING,
				new Date(MONDAY_MORNING.getTime() + DAY_MS),
				CTX,
			),
		).toEqual(
			advanceLife(
				startLife(MONDAY_MORNING, CTX),
				MONDAY_MORNING,
				new Date(MONDAY_MORNING.getTime() + DAY_MS),
				CTX,
			),
		);
		const start = startLife(MONDAY_MORNING, CTX);
		const end = new Date(MONDAY_MORNING.getTime() + 3 * DAY_MS);
		const jumped = advanceLife(start, MONDAY_MORNING, end, CTX);
		const { state: stepped } = liveThrough(MONDAY_MORNING, 3);
		expect(stepped.activity).toBe(jumped.activity);
		expect(stepped.activityEndsAt).toEqual(jumped.activityEndsAt);
		// Needs feed back into each other, so slicing differently moves them a hair.
		expect(stepped.needs.hunger).toBeCloseTo(jumped.needs.hunger, 2);
		expect(stepped.needs.energy).toBeCloseTo(jumped.needs.energy, 2);
		expect(stepped.needs.mood).toBeCloseTo(jumped.needs.mood, 2);
	});

	it('lives a plausible week: sleeps at night, works on weekdays, eats, plays', () => {
		const { log } = liveThrough(MONDAY_MORNING, 7);
		const at = (entry: (typeof log)[number]) => localTime(entry.at, CTX.timeZone);

		const nightStarts = log.filter((e) => {
			const { hour } = at(e);
			return hour >= 0 && hour < 5;
		});
		expect(nightStarts.every((e) => e.activity === 'sleep')).toBe(true);

		const workDays = new Set(log.filter((e) => e.activity === 'work').map((e) => at(e).weekday));
		expect([...workDays].sort()).toEqual([1, 2, 3, 4, 5]);

		const meals = log.filter((e) => e.activity === 'eat').length;
		expect(meals).toBeGreaterThanOrEqual(14);
		expect(meals).toBeLessThanOrEqual(35);
		expect(log.some((e) => e.activity === 'gaming')).toBe(true);
	});

	it('lives a varied life: every kind of activity shows up within two weeks', () => {
		const { log } = liveThrough(MONDAY_MORNING, 14);
		const seen = new Set(log.map((e) => e.activity));
		for (const activity of ACTIVITIES) expect(seen, activity).toContain(activity);
		// Mornings start in the bathroom more often than not.
		const afterSleep = log.filter((e, i) => log[i - 1]?.activity === 'sleep');
		const showers = afterSleep.filter((e) => e.activity === 'shower').length;
		expect(showers / afterSleep.length).toBeGreaterThan(0.4);
	});

	it('keeps the character fed and rested over two weeks', () => {
		const { state, log } = liveThrough(MONDAY_MORNING, 14);
		expect(state.needs.hunger).toBeLessThan(0.9);
		expect(state.needs.energy).toBeGreaterThan(0.1);
		const sleeps = log.filter((e) => e.activity === 'sleep').length;
		expect(sleeps).toBeGreaterThanOrEqual(14);
	});

	it('follows the device time zone', () => {
		// 03:00 in Tokyo is the middle of the night; in Prague it is 20:00 the evening before.
		const at = new Date('2026-10-05T18:00:00Z');
		expect(startLife(at, { seed: 'a', timeZone: 'Asia/Tokyo' }).activity).toBe('sleep');
		expect(startLife(at, { seed: 'a', timeZone: 'Europe/Prague' }).activity).not.toBe('sleep');
	});

	it('resumes sensibly after a stored activity ended long ago', () => {
		const stale: LifeState = {
			needs: { hunger: 0.4, energy: 0.6, mood: 0.6 },
			money: INITIAL_MONEY,
			activity: 'gaming',
			activityStartedAt: new Date('2026-09-01T10:00:00Z'),
			activityEndsAt: new Date('2026-09-01T11:00:00Z'),
		};
		const from = MONDAY_MORNING;
		const after = advanceLife(stale, from, new Date(from.getTime() + HOUR_MS), CTX);
		expect(after.activityStartedAt.getTime()).toBeGreaterThanOrEqual(from.getTime());
	});

	it('catches up 14 days quickly', () => {
		const state = startLife(MONDAY_MORNING, CTX);
		const started = performance.now();
		advanceLife(state, MONDAY_MORNING, new Date(MONDAY_MORNING.getTime() + 14 * DAY_MS), CTX);
		expect(performance.now() - started).toBeLessThan(200);
	});
});

describe('wakeUp', () => {
	const night = new Date('2026-10-05T01:00:00Z'); // 03:00 in Prague
	const sleeping = startLife(night, CTX);

	it('interrupts sleep, spoils the mood and keeps the character up for a while', () => {
		expect(sleeping.activity).toBe('sleep');
		const at = new Date(night.getTime() + HOUR_MS);
		const woken = wakeUp(sleeping, at);
		expect(woken?.activity).toBe('idle');
		expect(woken?.activityStartedAt).toEqual(at);
		expect(woken?.needs.mood).toBeLessThan(sleeping.needs.mood - 0.1);
	});

	it('cannot wake someone who is awake', () => {
		const awake = startLife(MONDAY_MORNING, CTX);
		expect(awake.activity).not.toBe('sleep');
		expect(wakeUp(awake, MONDAY_MORNING)).toBeNull();
		expect(wakeUp(sleeping, sleeping.activityEndsAt)).toBeNull();
	});

	it('usually goes back to bed after being woken at night', () => {
		const woken = wakeUp(sleeping, night);
		if (!woken) throw new Error('expected to wake up');
		const later = advanceLife(woken, night, new Date(night.getTime() + HOUR_MS), CTX);
		expect(later.activity).toBe('sleep');
	});
});
