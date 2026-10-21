import type { Activity } from '@windowling/shared';

/**
 * Inner state of the character. Never shown as numbers (principle 9) - the
 * player reads it from behaviour. All values are 0..1.
 */
export interface Needs {
	/** 0 = full, 1 = starving. */
	hunger: number;
	/** 0 = exhausted, 1 = rested. */
	energy: number;
	/** 0 = miserable, 1 = great. */
	mood: number;
}

export const INITIAL_NEEDS: Needs = { hunger: 0.3, energy: 0.8, mood: 0.7 };

interface Rates {
	hunger: number;
	energy: number;
	mood: number;
}

/** Change per hour while doing an activity. */
const RATES: Record<Activity, Rates> = {
	sleep: { hunger: 0.025, energy: 0.14, mood: 0 },
	eat: { hunger: -1.6, energy: -0.01, mood: 0.08 },
	work: { hunger: 0.08, energy: -0.05, mood: -0.05 },
	gaming: { hunger: 0.07, energy: -0.045, mood: 0.08 },
	idle: { hunger: 0.075, energy: -0.035, mood: 0 },
	cook: { hunger: -1.0, energy: -0.03, mood: 0.06 },
	clean: { hunger: 0.09, energy: -0.06, mood: 0.03 },
	exercise: { hunger: 0.12, energy: -0.12, mood: 0.1 },
	tv: { hunger: 0.06, energy: -0.03, mood: 0.06 },
	music: { hunger: 0.06, energy: -0.02, mood: 0.1 },
	read: { hunger: 0.05, energy: -0.02, mood: 0.05 },
	phone: { hunger: 0.06, energy: -0.03, mood: 0.12 },
	shower: { hunger: 0.05, energy: 0.05, mood: 0.1 },
	out: { hunger: 0.05, energy: -0.06, mood: 0.08 },
	// Something new! (Iteration 10)
	unpack: { hunger: 0.06, energy: -0.03, mood: 0.35 },
};

/** Mood slowly returns to this baseline when nothing pushes it. */
const MOOD_BASELINE = 0.6;
const MOOD_DRIFT_PER_HOUR = 0.05;
const HUNGRY = 0.75;
const HUNGRY_MOOD_PER_HOUR = -0.12;
const TIRED = 0.15;
const TIRED_MOOD_PER_HOUR = -0.1;
/** Needs feed back into each other, so long spans are integrated in slices. */
const SLICE_HOURS = 0.25;

function clamp01(value: number): number {
	return Math.min(1, Math.max(0, value));
}

export function clampNeeds(needs: Needs): Needs {
	return {
		hunger: clamp01(needs.hunger),
		energy: clamp01(needs.energy),
		mood: clamp01(needs.mood),
	};
}

/**
 * Needs after spending `hours` on `activity`. `extra` adds per hour on top of
 * the activity (money worries, home comforts).
 */
export function applyNeeds(
	needs: Needs,
	activity: Activity,
	hours: number,
	extra: { mood?: number; energy?: number } = {},
): Needs {
	let current = clampNeeds(needs);
	let remaining = Math.max(0, hours);
	const rates = RATES[activity];
	while (remaining > 1e-9) {
		const h = Math.min(SLICE_HOURS, remaining);
		remaining -= h;
		// Drift towards the baseline without overshooting it.
		const drift = Math.min(
			MOOD_DRIFT_PER_HOUR * h,
			Math.max(-MOOD_DRIFT_PER_HOUR * h, MOOD_BASELINE - current.mood),
		);
		let moodRate = rates.mood + (extra.mood ?? 0);
		if (current.hunger > HUNGRY) moodRate += HUNGRY_MOOD_PER_HOUR;
		if (current.energy < TIRED && activity !== 'sleep') moodRate += TIRED_MOOD_PER_HOUR;
		current = clampNeeds({
			hunger: current.hunger + rates.hunger * h,
			energy: current.energy + (rates.energy + (extra.energy ?? 0)) * h,
			mood: current.mood + drift + moodRate * h,
		});
	}
	return current;
}
