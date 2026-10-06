import { z } from 'zod';

/**
 * How the character feels about someone (for now: the player). Inner state,
 * shown only through behaviour - never as numbers in the UI.
 */
export const relationshipSchema = z.object({
	/** -1 dislikes .. 0 neutral .. 1 fond of. */
	affinity: z.number().min(-1).max(1),
	/** 0 wary .. 1 trusts completely. */
	trust: z.number().min(0).max(1),
	/** 0 stranger .. 1 knows them well. */
	familiarity: z.number().min(0).max(1),
});

export type Relationship = z.infer<typeof relationshipSchema>;

export const NEW_ACQUAINTANCE: Relationship = { affinity: 0, trust: 0.3, familiarity: 0 };

/** What kind of memory: something that happened, or something known. */
export const memoryKindSchema = z.enum(['moment', 'fact']);
export type MemoryKind = z.infer<typeof memoryKindSchema>;
