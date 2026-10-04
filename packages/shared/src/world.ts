import { z } from 'zod';

/** Public shape of a world as returned by the web API. */
export const worldSummarySchema = z.object({
	id: z.string().min(1),
	createdAt: z.iso.datetime(),
	lastSimulatedAt: z.iso.datetime(),
	character: z.object({
		id: z.string().min(1),
		name: z.string().min(1),
	}),
});

export type WorldSummary = z.infer<typeof worldSummarySchema>;
