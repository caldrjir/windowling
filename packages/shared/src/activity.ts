import { z } from 'zod';

/**
 * What the character is doing with its life right now - the unit the
 * simulation schedules. Each activity is carried out through one or more
 * `CharacterAction`s; the renderer never sees activities' rules.
 */
export const activitySchema = z.enum(['sleep', 'eat', 'work', 'gaming', 'idle']);

export type Activity = z.infer<typeof activitySchema>;

export const ACTIVITIES: readonly Activity[] = activitySchema.options;
