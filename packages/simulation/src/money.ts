import type { Activity, MoneyFeeling, MoneySense } from '@windowling/shared';
import { HOUR_MS } from './catch-up.ts';

/**
 * The character's money (Iteration 9). Integer cents; never shown as a number
 * (principle 9) - the player reads it from what the character does and says.
 */
export interface Money {
	/** On hand. Can go below zero (an overdraft) when rent takes more than there is. */
	balance: number;
	/** Wages earned since the last payday. */
	unpaid: number;
	/** The last payday, if any. */
	paidAt: Date | null;
}

export const DOLLAR = 100;
/** Per hour worked; paid weekly. */
export const HOURLY_WAGE = 18 * DOLLAR;
/** Due on the 1st of every month (local calendar). */
export const RENT = 1_800 * DOLLAR;
export const INITIAL_MONEY: Money = { balance: 900 * DOLLAR, unpaid: 0, paidAt: null };

/** What an activity costs when it starts. */
export function activityCost(activity: Activity, durationMs: number): number {
	switch (activity) {
		case 'cook':
			return 9 * DOLLAR; // groceries for a proper meal
		case 'eat':
			return 5 * DOLLAR; // a quick bite from the fridge
		case 'out':
			return Math.round((12 + 10 * (durationMs / HOUR_MS)) * DOLLAR);
		default:
			return 0;
	}
}

/** How money feels - the only thing behaviour and speech ever see. */
export function moneyFeeling(money: Money): MoneyFeeling {
	if (money.balance < 100 * DOLLAR) return 'broke';
	if (money.balance < 600 * DOLLAR) return 'tight';
	if (money.balance < 2_500 * DOLLAR) return 'fine';
	return 'comfortable';
}

const JUST_PAID_MS = 36 * HOUR_MS;

export function justPaid(money: Money, now: Date): boolean {
	return money.paidAt !== null && now.getTime() - money.paidAt.getTime() < JUST_PAID_MS;
}

/** Worrying about money wears the mood down (per hour). */
export function moneyWorry(feeling: MoneyFeeling): number {
	switch (feeling) {
		case 'broke':
			return -0.04;
		case 'tight':
			return -0.01;
		default:
			return 0;
	}
}

/** A good day: payday lifts the mood once. */
export const PAYDAY_MOOD = 0.1;

// --- the calendar --------------------------------------------------------------

const DAY = 24 * HOUR_MS;
const WEEK = 7 * DAY;
/** 1970-01-02 was a Friday; payday is Friday at 17:00 local time. */
const PAYDAY_OFFSET = DAY + 17 * HOUR_MS;

const formatters = new Map<string, Intl.DateTimeFormat>();

/** The local wall clock as if it were UTC: lets us count local days, weeks and months. */
function wallClock(at: Date, timeZone: string): { stamp: number; month: number } {
	let cached = formatters.get(timeZone);
	if (!cached) {
		cached = new Intl.DateTimeFormat('en-US', {
			timeZone,
			hourCycle: 'h23',
			year: 'numeric',
			month: 'numeric',
			day: 'numeric',
			hour: 'numeric',
			minute: 'numeric',
		});
		formatters.set(timeZone, cached);
	}
	const part: Record<string, number> = {};
	for (const p of cached.formatToParts(at)) part[p.type] = Number(p.value);
	const year = part.year ?? 1970;
	const month = (part.month ?? 1) - 1;
	const stamp = Date.UTC(year, month, part.day ?? 1, part.hour ?? 0, part.minute ?? 0);
	return { stamp, month: year * 12 + month };
}

/** Which pay week `at` falls in (a new one starts every Friday at 17:00 local time). */
export function payWeek(at: Date, timeZone: string): number {
	return Math.floor((wallClock(at, timeZone).stamp - PAYDAY_OFFSET) / WEEK);
}

/** Which month `at` falls in (rent is due when it changes). */
export function rentMonth(at: Date, timeZone: string): number {
	return wallClock(at, timeZone).month;
}

/** Days left until rent is due on the 1st (local calendar). */
export function daysUntilRent(at: Date, timeZone: string): number {
	const { stamp } = wallClock(at, timeZone);
	const now = new Date(stamp);
	const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
	return (next - stamp) / DAY;
}

// --- living ------------------------------------------------------------------

/** Everything the character knows about its money now, as feelings. */
export function moneySense(money: Money, now: Date, timeZone: string): MoneySense {
	return {
		feeling: moneyFeeling(money),
		justPaid: justPaid(money, now),
		rentWorry: daysUntilRent(now, timeZone) <= 4 && money.balance + money.unpaid < RENT,
	};
}

/** Wages for time spent working. */
export function earn(money: Money, hours: number): Money {
	return { ...money, unpaid: money.unpaid + Math.round(HOURLY_WAGE * Math.max(0, hours)) };
}

export function spend(money: Money, cents: number): Money {
	return { ...money, balance: money.balance - Math.max(0, cents) };
}

/** Payday: the week's wages land. */
export function payday(money: Money, at: Date): Money {
	if (money.unpaid <= 0) return money;
	return { balance: money.balance + money.unpaid, unpaid: 0, paidAt: at };
}

export function payRent(money: Money): Money {
	return spend(money, RENT);
}
