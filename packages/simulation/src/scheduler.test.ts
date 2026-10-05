import {
	characterActionSchema,
	targetSupports,
	ACTIVITIES,
	type Activity,
} from '@windowling/shared';
import { describe, expect, it } from 'vitest';
import { createRng } from './ambient.ts';
import { HOUR_MS } from './catch-up.ts';
import type { Needs } from './needs.ts';
import { actionForActivity, chooseActivity, scoreActivities } from './scheduler.ts';

const RESTED: Needs = { hunger: 0.15, energy: 0.8, mood: 0.6 };
const MONDAY = 1;
const SATURDAY = 6;

function top(hour: number, weekday: number, needs: Needs, previous: Activity | null = 'idle') {
	const scores = scoreActivities({ needs, local: { hour, weekday }, previous });
	return (Object.entries(scores) as Array<[Activity, number]>).sort((a, b) => b[1] - a[1])[0]?.[0];
}

/** How often each activity wins across many random seeds. */
function distribution(hour: number, weekday: number, needs: Needs) {
	const counts: Partial<Record<Activity, number>> = {};
	for (let seed = 0; seed < 300; seed++) {
		const { activity } = chooseActivity(
			{ needs, local: { hour, weekday }, previous: 'idle' },
			createRng(seed),
		);
		counts[activity] = (counts[activity] ?? 0) + 1;
	}
	return counts;
}

describe('scoreActivities', () => {
	it('sleeps at night', () => {
		expect(top(2, MONDAY, RESTED)).toBe('sleep');
		expect(top(23.5, SATURDAY, RESTED)).toBe('sleep');
	});

	it('works on weekday mornings but not at weekends', () => {
		expect(top(10, MONDAY, RESTED)).toBe('work');
		expect(top(10, SATURDAY, RESTED)).not.toBe('work');
		expect(
			scoreActivities({ needs: RESTED, local: { hour: 10, weekday: 0 }, previous: null }).work,
		).toBe(0);
	});

	it('eats when hungry, especially around meal times', () => {
		const hungry = { ...RESTED, hunger: 0.7 };
		expect(top(12.5, MONDAY, hungry)).toBe('eat');
		expect(top(15, SATURDAY, hungry)).toBe('eat');
	});

	it('does not eat twice in a row', () => {
		const scores = scoreActivities({
			needs: { ...RESTED, hunger: 0.9 },
			local: { hour: 12.5, weekday: MONDAY },
			previous: 'eat',
		});
		expect(scores.eat).toBe(0);
	});

	it('takes a nap when exhausted during the day', () => {
		expect(top(15, SATURDAY, { ...RESTED, energy: 0.05 })).toBe('sleep');
	});

	it('gets up after a full night', () => {
		expect(
			scoreActivities({
				needs: { ...RESTED, energy: 0.95 },
				local: { hour: 7.2, weekday: MONDAY },
				previous: 'sleep',
			}).sleep,
		).toBe(0);
	});

	it('mostly plays games in the evening', () => {
		const counts = distribution(20, MONDAY, RESTED);
		expect(counts.gaming ?? 0).toBeGreaterThan(150);
	});
});

describe('chooseActivity', () => {
	it('is deterministic for the same rng seed', () => {
		const context = { needs: RESTED, local: { hour: 19, weekday: 5 }, previous: 'idle' as const };
		expect(chooseActivity(context, createRng(3))).toEqual(chooseActivity(context, createRng(3)));
	});

	it('sleeps until the morning and longer at weekends', () => {
		const weekday = chooseActivity(
			{ needs: RESTED, local: { hour: 23.5, weekday: 2 }, previous: 'idle' },
			createRng(1),
		);
		const weekend = chooseActivity(
			{ needs: RESTED, local: { hour: 23.5, weekday: 5 }, previous: 'idle' },
			createRng(1),
		);
		expect(weekday.activity).toBe('sleep');
		expect(weekday.durationMs / HOUR_MS).toBeCloseTo(7.5, 0);
		expect(weekend.durationMs / HOUR_MS).toBeCloseTo(9.5, 0);
	});

	it('never works past the end of the working day', () => {
		const { activity, durationMs } = chooseActivity(
			{ needs: RESTED, local: { hour: 16.5, weekday: MONDAY }, previous: 'idle' },
			createRng(5),
		);
		if (activity === 'work') expect(durationMs).toBeLessThanOrEqual(0.5 * HOUR_MS + 1);
	});
});

describe('actionForActivity', () => {
	it('maps every activity to a valid action (or free wandering for idle)', () => {
		for (const activity of ACTIVITIES) {
			const action = actionForActivity(activity);
			if (activity === 'idle') {
				expect(action).toBeNull();
				continue;
			}
			expect(action).not.toBeNull();
			if (!action) continue;
			expect(characterActionSchema.parse(action)).toEqual(action);
			if ('target' in action) expect(targetSupports(action.target, action.type)).toBe(true);
		}
	});
});
