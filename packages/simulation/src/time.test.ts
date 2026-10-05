import { describe, expect, it } from 'vitest';
import { hoursUntil, isValidTimeZone, isWeekend, localClock, localTime } from './time.ts';

describe('localTime', () => {
	it('converts to the local clock of a time zone', () => {
		// Monday 2026-10-05 12:30 UTC = 14:30 in Prague (CEST)
		const at = new Date('2026-10-05T12:30:00Z');
		expect(localTime(at, 'UTC')).toEqual({ hour: 12.5, weekday: 1 });
		expect(localTime(at, 'Europe/Prague')).toEqual({ hour: 14.5, weekday: 1 });
	});

	it('handles the local date being a different day', () => {
		// Monday 02:00 UTC is still Sunday evening in New York
		const local = localTime(new Date('2026-10-05T02:00:00Z'), 'America/New_York');
		expect(local.weekday).toBe(0);
		expect(local.hour).toBe(22);
	});
});

describe('isValidTimeZone', () => {
	it('accepts IANA zones and rejects garbage', () => {
		expect(isValidTimeZone('Europe/Prague')).toBe(true);
		expect(isValidTimeZone('UTC')).toBe(true);
		expect(isValidTimeZone('Mars/Olympus')).toBe(false);
		expect(isValidTimeZone('')).toBe(false);
		expect(isValidTimeZone('x'.repeat(100))).toBe(false);
	});
});

describe('time helpers', () => {
	it('knows weekends', () => {
		expect([0, 1, 2, 3, 4, 5, 6].map(isWeekend)).toEqual([
			true,
			false,
			false,
			false,
			false,
			false,
			true,
		]);
	});

	it('counts hours until a clock time, wrapping midnight', () => {
		expect(hoursUntil(23, 7)).toBe(8);
		expect(hoursUntil(6, 7)).toBe(1);
		expect(hoursUntil(7, 7)).toBe(24);
	});
});

describe('localClock', () => {
	it('formats the local wall clock for speech', () => {
		expect(localClock(new Date('2026-10-06T01:12:00Z'), 'Europe/Prague')).toEqual({
			time: '03:12',
			weekday: 'Tuesday',
		});
	});
});
