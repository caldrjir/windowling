import { z } from 'zod';

/**
 * What the character is doing with its life right now - the unit the
 * simulation schedules. Each activity is carried out through one or more
 * `CharacterAction`s; the renderer never sees activities' rules.
 */
export const activitySchema = z.enum([
	'sleep',
	'eat',
	'work',
	'gaming',
	'idle',
	// Iteration 7 - a richer day
	'cook',
	'clean',
	'exercise',
	'tv',
	'music',
	'read',
	'phone',
	'shower',
	'out',
]);

export type Activity = z.infer<typeof activitySchema>;

export const ACTIVITIES: readonly Activity[] = activitySchema.options;

/** Activities that happen outside the room: the flat is empty meanwhile. */
export const AWAY_ACTIVITIES: readonly Activity[] = ['shower', 'out'];

export function isAway(activity: Activity): boolean {
	return AWAY_ACTIVITIES.includes(activity);
}
