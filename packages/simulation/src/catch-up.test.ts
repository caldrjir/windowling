import { describe, expect, it } from 'vitest';
import { DAY_MS, HOUR_MS, MINUTE_MS, planCatchUp } from './catch-up.ts';

const t0 = new Date('2026-03-01T18:00:00.000Z');
const at = (ms: number) => new Date(t0.getTime() + ms);

describe('planCatchUp', () => {
	it('does nothing when no time has passed', () => {
		const plan = planCatchUp(t0, t0);
		expect(plan.stepEnds).toEqual([]);
		expect(plan.to).toEqual(t0);
	});

	it('never rewinds time when the clock goes backwards', () => {
		const plan = planCatchUp(t0, at(-HOUR_MS));
		expect(plan.stepEnds).toEqual([]);
		expect(plan.to).toEqual(t0);
	});

	it('splits the gap into fixed steps ending exactly at now', () => {
		const plan = planCatchUp(t0, at(HOUR_MS + 5 * MINUTE_MS), { stepMs: 15 * MINUTE_MS });
		expect(plan.stepEnds.map((d) => d.getTime() - t0.getTime())).toEqual([
			15 * MINUTE_MS,
			30 * MINUTE_MS,
			45 * MINUTE_MS,
			60 * MINUTE_MS,
			65 * MINUTE_MS,
		]);
		expect(plan.to).toEqual(at(HOUR_MS + 5 * MINUTE_MS));
		expect(plan.skippedMs).toBe(0);
	});

	it('does not emit a duplicate step when the gap is a multiple of the step', () => {
		const plan = planCatchUp(t0, at(HOUR_MS), { stepMs: 30 * MINUTE_MS });
		expect(plan.stepEnds).toHaveLength(2);
	});

	it('skips time beyond the maximum catch-up window', () => {
		const plan = planCatchUp(t0, at(30 * DAY_MS), { stepMs: HOUR_MS, maxCatchUpMs: DAY_MS });
		expect(plan.skippedMs).toBe(29 * DAY_MS);
		expect(plan.from).toEqual(at(29 * DAY_MS));
		expect(plan.stepEnds).toHaveLength(24);
	});

	it('rejects invalid step sizes', () => {
		expect(() => planCatchUp(t0, at(HOUR_MS), { stepMs: 0 })).toThrow(RangeError);
	});
});
