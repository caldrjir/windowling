import { characterActionSchema, type AwarenessState } from '@windowling/shared';
import { z } from 'zod';

export const EMOTIONS = [
	'neutral',
	'happy',
	'sad',
	'angry',
	'annoyed',
	'surprised',
	'embarrassed',
	'tired',
	'nervous',
] as const;

/**
 * The only thing a reasoning model is allowed to produce. It is a request,
 * not a command: the simulation validates it against the current state
 * before anything happens.
 */
export const characterDecisionSchema = z.object({
	speech: z.string().max(500).optional(),
	emotion: z.enum(EMOTIONS),
	intensity: z.number().min(0).max(1),
	action: characterActionSchema,
	goal: z
		.string()
		.max(64)
		.regex(/^[a-z][a-z0-9_]*$/)
		.optional(),
});

export type CharacterDecision = z.infer<typeof characterDecisionSchema>;

/** What the reasoning layer gets to see. Only relevant context - never full history. */
export interface CharacterAIContext {
	characterName: string;
	now: Date;
	awareness: AwarenessState;
	/** Short natural-language description of what is happening right now. */
	situation: string;
	/** What the player just said, if anything. */
	playerUtterance?: string;
}

export interface CharacterAI {
	decide(context: CharacterAIContext): Promise<CharacterDecision>;
}

/** Parses untrusted model output. Returns null instead of throwing so callers can fall back. */
export function parseCharacterDecision(raw: unknown): CharacterDecision | null {
	const result = characterDecisionSchema.safeParse(raw);
	return result.success ? result.data : null;
}
