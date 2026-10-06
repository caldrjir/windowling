import { CONVERSATION_EVENTS } from '@windowling/ai';
import { awarenessStateSchema } from '@windowling/shared';
import { MOMENT_KINDS } from '@windowling/simulation';
import { z } from 'zod';

/**
 * What the browser may send to the cloud brain. The character's state (time,
 * activity, needs) is never taken from the client - the server reads it from
 * the database - so this endpoint is no open LLM proxy.
 */
export const conversationRequestSchema = z.object({
	event: z.enum(CONVERSATION_EVENTS),
	awareness: awarenessStateSchema,
	playerUtterance: z.string().trim().min(1).max(300).optional(),
	recent: z
		.array(z.object({ speaker: z.enum(['character', 'player']), text: z.string().max(300) }))
		.max(6)
		.default([]),
	/** With event `caught`: the private moment it was caught in. */
	caughtDoing: z.enum(MOMENT_KINDS).optional(),
});

export type ConversationRequest = z.infer<typeof conversationRequestSchema>;
