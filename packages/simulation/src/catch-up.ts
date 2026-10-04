/**
 * The world is not simulated frame-by-frame while nobody is watching.
 * When a world is loaded we catch up from `lastSimulatedAt` to "now" in
 * coarse steps. Iteration 0 only provides the time bookkeeping; later
 * iterations plug needs, activities and events into each step.
 */

export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

export interface CatchUpOptions {
	/** Length of one simulation step. */
	stepMs?: number;
	/**
	 * Longest absence we simulate in detail. Anything older is skipped
	 * (the character "just lived" during that time).
	 */
	maxCatchUpMs?: number;
}

export interface CatchUpPlan {
	/** Simulation time the catch-up starts from (after skipping). */
	from: Date;
	/** End time of every step, in order. The last one equals `to`. */
	stepEnds: Date[];
	/** Time the new `lastSimulatedAt` should be set to. */
	to: Date;
	/** Time that was skipped because the gap exceeded `maxCatchUpMs`. */
	skippedMs: number;
}

export const DEFAULT_STEP_MS = 15 * MINUTE_MS;
export const DEFAULT_MAX_CATCH_UP_MS = 14 * DAY_MS;

export function planCatchUp(
	lastSimulatedAt: Date,
	now: Date,
	{ stepMs = DEFAULT_STEP_MS, maxCatchUpMs = DEFAULT_MAX_CATCH_UP_MS }: CatchUpOptions = {},
): CatchUpPlan {
	if (!(stepMs > 0)) throw new RangeError('stepMs must be positive');
	if (!(maxCatchUpMs >= 0)) throw new RangeError('maxCatchUpMs must not be negative');

	const last = lastSimulatedAt.getTime();
	const target = now.getTime();

	// Clocks can go backwards (client skew, DST bugs, manual changes).
	// Time never rewinds in the world - we just do nothing.
	if (target <= last) {
		return { from: new Date(last), stepEnds: [], to: new Date(last), skippedMs: 0 };
	}

	const gap = target - last;
	const skippedMs = Math.max(0, gap - maxCatchUpMs);
	const start = last + skippedMs;

	const stepEnds: Date[] = [];
	for (let t = start + stepMs; t < target; t += stepMs) {
		stepEnds.push(new Date(t));
	}
	stepEnds.push(new Date(target));

	return { from: new Date(start), stepEnds, to: new Date(target), skippedMs };
}
