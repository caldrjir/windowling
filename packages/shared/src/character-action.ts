import { z } from 'zod';

/**
 * Identifier of something in the world the character can interact with
 * (a seat, a bed, the window...). The simulation decides whether a given
 * id actually exists and is reachable - the schema only checks the shape.
 */
export const knownTargetIdSchema = z
	.string()
	.min(1)
	.max(64)
	.regex(/^[a-z][a-z0-9_.-]*$/, 'target ids are lowercase slugs');

export type KnownTargetId = z.infer<typeof knownTargetIdSchema>;

/**
 * The closed set of high-level actions anything outside the simulation
 * (e.g. the LLM) may request. Never extend this with free-form commands.
 */
export const characterActionSchema = z.discriminatedUnion('type', [
	z.object({ type: z.literal('idle') }),
	z.object({ type: z.literal('lookAtPlayer') }),
	/** Turn to the player and wave (from wherever the character is). */
	z.object({ type: z.literal('wave') }),
	z.object({ type: z.literal('walkTo'), target: knownTargetIdSchema }),
	z.object({ type: z.literal('sit'), target: knownTargetIdSchema }),
	z.object({ type: z.literal('sleep'), target: knownTargetIdSchema }),
	z.object({ type: z.literal('eat'), target: knownTargetIdSchema }),
	z.object({ type: z.literal('work'), target: knownTargetIdSchema }),
	z.object({ type: z.literal('play'), target: knownTargetIdSchema }),
]);

export type CharacterAction = z.infer<typeof characterActionSchema>;
export type CharacterActionType = CharacterAction['type'];
