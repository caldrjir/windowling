/**
 * Real time matters: the character lives on the local clock of the player's
 * device (decision in #10). Only Intl is used, so this runs the same in
 * Cloudflare Workers, Node and browsers.
 */
export interface LocalTime {
	/** Fractional hour of the local day, 0 <= hour < 24. */
	hour: number;
	/** 0 = Sunday ... 6 = Saturday. */
	weekday: number;
}

export const DEFAULT_TIME_ZONE = 'UTC';

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

// Formatters are pure, expensive to build and safe to share across requests.
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
	let cached = formatters.get(timeZone);
	if (!cached) {
		cached = new Intl.DateTimeFormat('en-US', {
			timeZone,
			hourCycle: 'h23',
			weekday: 'short',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
		});
		formatters.set(timeZone, cached);
	}
	return cached;
}

export function isValidTimeZone(timeZone: string): boolean {
	if (timeZone.length === 0 || timeZone.length > 64) return false;
	try {
		formatter(timeZone);
		return true;
	} catch {
		return false;
	}
}

export function localTime(at: Date, timeZone: string): LocalTime {
	let hour = 0;
	let minute = 0;
	let second = 0;
	let weekday = 0;
	for (const part of formatter(timeZone).formatToParts(at)) {
		if (part.type === 'hour') hour = Number(part.value);
		else if (part.type === 'minute') minute = Number(part.value);
		else if (part.type === 'second') second = Number(part.value);
		else if (part.type === 'weekday') weekday = WEEKDAYS[part.value] ?? 0;
	}
	return { hour: hour + minute / 60 + second / 3600, weekday };
}

export function isWeekend(weekday: number): boolean {
	return weekday === 0 || weekday === 6;
}

/** Hours from `hour` until the local clock next shows `targetHour` (0 < result <= 24). */
export function hoursUntil(hour: number, targetHour: number): number {
	const diff = (((targetHour - hour) % 24) + 24) % 24;
	return diff === 0 ? 24 : diff;
}
