import { z } from 'zod';
import { activitySchema } from './activity.ts';
import { relationshipSchema } from './relationship.ts';

/** Public shape of a world as returned by the web API. */
export const worldSummarySchema = z.object({
	id: z.string().min(1),
	createdAt: z.iso.datetime(),
	lastSimulatedAt: z.iso.datetime(),
	/** IANA zone the character's day follows (the player's device). */
	timeZone: z.string().min(1),
	character: z.object({
		id: z.string().min(1),
		name: z.string().min(1),
		/** What the character is doing and until when (simulation time). */
		activity: z.object({
			type: activitySchema,
			startedAt: z.iso.datetime(),
			endsAt: z.iso.datetime(),
		}),
		/** 0..1, only for body language - never rendered as a number. */
		mood: z.number().min(0).max(1),
		/** 0..1, inner state for an on-device brain's context - never rendered as numbers. */
		needs: z.object({
			hunger: z.number().min(0).max(1),
			energy: z.number().min(0).max(1),
		}),
		/** How it feels about the player - drives behaviour, never shown as numbers. */
		relationship: relationshipSchema,
	}),
});

export type WorldSummary = z.infer<typeof worldSummarySchema>;
