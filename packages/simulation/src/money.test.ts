import { describe, expect, it } from 'vitest';
import { DAY_MS, HOUR_MS } from './catch-up.ts';
import { advanceLife, startLife, type LifeContext, type LifeState } from './life.ts';
import {
	DOLLAR,
	HOURLY_WAGE,
	INITIAL_MONEY,
	RENT,
	daysUntilRent,
	moneyFeeling,
	payWeek,
	rentMonth,
	type Money,
} from './money.ts';
import { scoreActivities } from './scheduler.ts';

const CTX: LifeContext = { seed: 'world-1', timeZone: 'Europe/Prague' };
// Monday 2026-10-05 08:00 in Prague
const MONDAY = new Date('2026-10-05T06:00:00Z');

/** Lives in one-hour steps (like visits) and records what it did and what it had. */
function liveFor(days: number, money: Money = INITIAL_MONEY, start = MONDAY, ctx = CTX) {
	let life: LifeState = startLife(start, ctx, undefined, money);
	const outs: Date[] = [];
	let worked = 0;
	for (let t = start.getTime(); t < start.getTime() + days * DAY_MS; t += HOUR_MS) {
		const next = advanceLife(life, new Date(t), new Date(t + HOUR_MS), ctx);
		if (next.activity === 'out' && next.activityStartedAt !== life.activityStartedAt) {
			outs.push(next.activityStartedAt);
		}
		if (life.activity === 'work') worked += 1;
		life = next;
	}
	return { life, outs, worked };
}

describe('money', () => {
	it('pays the week’s wages on Friday evening', () => {
		const thursday = liveFor(3.5); // to Thursday evening
		expect(thursday.life.money.unpaid).toBeGreaterThan(20 * HOURLY_WAGE);
		expect(thursday.life.money.paidAt).toBeNull();
		const saturday = liveFor(5.2);
		expect(saturday.life.money.unpaid).toBe(0);
		expect(saturday.life.money.paidAt?.getTime()).toBeGreaterThan(MONDAY.getTime());
	});

	it('earns roughly a working week and spends some of it on food and evenings out', () => {
		const week = liveFor(7);
		const earned = week.life.money.balance + week.life.money.unpaid - INITIAL_MONEY.balance;
		// ~35-40 hours of work minus a week of groceries and evenings out (no rent this week).
		expect(earned).toBeGreaterThan(300 * DOLLAR);
		expect(earned).toBeLessThan(40 * HOURLY_WAGE);
	});

	it('pays rent when the month turns', () => {
		// From Wednesday 28 October across 1 November.
		const start = new Date('2026-10-28T07:00:00Z');
		const before = liveFor(1, INITIAL_MONEY, start).life.money;
		const after = liveFor(5, INITIAL_MONEY, start).life.money;
		// Five days of living can't explain a drop this big without the rent.
		expect(before.balance - after.balance).toBeGreaterThan(RENT - 400 * DOLLAR);
	});

	it('stays out of town when broke, goes out after payday', () => {
		const broke = liveFor(14, { balance: 20 * DOLLAR, unpaid: 0, paidAt: null });
		const flush = liveFor(14, { balance: 3_000 * DOLLAR, unpaid: 0, paidAt: null });
		expect(broke.outs.length).toBeLessThan(flush.outs.length);
		const local = { hour: 18, weekday: 2 };
		const needs = { hunger: 0.3, energy: 0.8, mood: 0.7 };
		const out = (money: 'broke' | 'tight' | 'fine', justPaid = false) =>
			scoreActivities({ needs, local, previous: 'idle', money, justPaid }).out;
		expect(out('broke')).toBe(0);
		expect(out('tight')).toBeLessThan(out('fine'));
		expect(out('fine', true)).toBeGreaterThan(out('fine'));
	});

	it('feels it: money worries wear the mood down', () => {
		const broke = liveFor(3, { balance: -200 * DOLLAR, unpaid: 0, paidAt: null });
		const fine = liveFor(3, { balance: 1_500 * DOLLAR, unpaid: 0, paidAt: null });
		expect(broke.life.needs.mood).toBeLessThan(fine.life.needs.mood);
	});

	it('is deterministic however the time is split into visits', () => {
		const once = advanceLife(
			startLife(MONDAY, CTX),
			MONDAY,
			new Date(MONDAY.getTime() + 9 * DAY_MS),
			CTX,
		);
		expect(liveFor(9).life.money).toEqual(once.money);
	});

	it('reads the calendar in the character’s time zone', () => {
		// Friday 2026-10-09 16:30 and 17:30 in Prague (UTC+2).
		expect(payWeek(new Date('2026-10-09T14:30:00Z'), 'Europe/Prague')).toBe(
			payWeek(new Date('2026-10-05T06:00:00Z'), 'Europe/Prague'),
		);
		expect(payWeek(new Date('2026-10-09T15:30:00Z'), 'Europe/Prague')).toBe(
			payWeek(new Date('2026-10-05T06:00:00Z'), 'Europe/Prague') + 1,
		);
		// 23:30 UTC on 31 October is already 1 November in Prague.
		const night = new Date('2026-10-31T23:30:00Z');
		expect(rentMonth(night, 'Europe/Prague')).toBe(rentMonth(night, 'UTC') + 1);
		expect(daysUntilRent(new Date('2026-10-29T12:00:00Z'), 'UTC')).toBeCloseTo(2.5, 5);
	});

	it('names the feeling, never the number', () => {
		expect(moneyFeeling({ balance: -5, unpaid: 0, paidAt: null })).toBe('broke');
		expect(moneyFeeling({ balance: 300 * DOLLAR, unpaid: 0, paidAt: null })).toBe('tight');
		expect(moneyFeeling({ balance: 1_000 * DOLLAR, unpaid: 0, paidAt: null })).toBe('fine');
		expect(moneyFeeling({ balance: 5_000 * DOLLAR, unpaid: 0, paidAt: null })).toBe('comfortable');
	});
});
