import { z } from 'zod';

/**
 * How aware the character is of the player watching.
 * Opening the app never implies DETECTED - the character has to notice.
 */
export const AWARENESS_STATES = [
	'UNKNOWN',
	'SUSPECTED',
	'DETECTED',
	'INTERACTING',
	'IGNORING',
] as const;

export const awarenessStateSchema = z.enum(AWARENESS_STATES);

export type AwarenessState = z.infer<typeof awarenessStateSchema>;
