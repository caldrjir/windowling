import { error, json } from '@sveltejs/kit';
import { answerMoney, bringUpMoney, giveBackMoney } from '@windowling/database';
import { z } from 'zod';
import type { RequestHandler } from './$types';

const moneyRequestSchema = z.discriminatedUnion('type', [
	/** It came to the window: does it bring money up? */
	z.object({ type: z.literal('moment') }),
	/** The player's answer to its question. */
	z.object({ type: z.literal('answer'), yes: z.boolean() }),
	/** The player hands back everything, unasked. */
	z.object({ type: z.literal('give_back') }),
]);

/**
 * Entrusted money (#70). The client never names an amount: the server decides
 * what the character asks, keeps the open question, and only an answer to that
 * question (or handing everything back) moves money.
 */
export const POST: RequestHandler = async ({ locals, request, url }) => {
	if (!locals.user) error(401, 'No session');
	const origin = request.headers.get('origin');
	if (origin && origin !== url.origin) error(403, 'Cross-origin request');
	const parsed = moneyRequestSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) error(400, 'Invalid money request');
	const body = parsed.data;
	const headers = { 'cache-control': 'no-store' };

	if (body.type === 'moment') {
		const moment = await bringUpMoney(locals.db, locals.user.id);
		if (!moment) error(404, 'No world');
		return json(moment, { headers });
	}
	const result =
		body.type === 'answer'
			? await answerMoney(locals.db, locals.user.id, body.yes)
			: await giveBackMoney(locals.db, locals.user.id);
	// Nothing to answer (expired, already answered) or nothing to give back.
	if (!result) return json({ outcome: null }, { status: 409, headers });
	return json(result, { headers });
};
