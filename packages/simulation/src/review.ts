import { targetSupports, type Activity, type CharacterAction } from '@windowling/shared';

export interface ReviewContext {
	/** What the simulation says the character is doing. */
	activity: Activity;
	/** 0..1 */
	energy: number;
	/** Local hour, 0..24. */
	hour: number;
}

/**
 * The simulation has the last word on what a decision (LLM or otherwise) may
 * make the character do (principle 6). Impossible or implausible actions are
 * replaced by simply looking at the player.
 */
export function reviewAction(action: CharacterAction, ctx: ReviewContext): CharacterAction {
	const fallback: CharacterAction = { type: 'lookAtPlayer' };
	if ('target' in action && !targetSupports(action.target, action.type)) return fallback;
	if (action.type === 'sleep') {
		const night = ctx.hour >= 22 || ctx.hour < 7;
		// "I'm going back to bed" is fine when tired or at night - not at noon, fully rested.
		if (!night && ctx.energy > 0.5) return fallback;
	}
	return action;
}
