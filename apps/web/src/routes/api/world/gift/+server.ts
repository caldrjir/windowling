import { error, json } from '@sveltejs/kit';
import { buyGiftFor } from '@windowling/database';
import { itemIdSchema } from '@windowling/shared';
import { z } from 'zod';
import type { RequestHandler } from './$types';

const giftSchema = z.object({ item: itemIdSchema });

/**
 * The player buys something for the character from the envelope (#74). The
 * client names only the thing: the price is the catalogue's, the money comes
 * out of the envelope, and the character decides whether it likes it.
 */
export const POST: RequestHandler = async ({ locals, request, url }) => {
	if (!locals.user) error(401, 'No session');
	const origin = request.headers.get('origin');
	if (origin && origin !== url.origin) error(403, 'Cross-origin request');
	const parsed = giftSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) error(400, 'Invalid gift');

	const result = await buyGiftFor(locals.db, locals.user.id, parsed.data.item);
	if (!result) error(404, 'No world');
	const headers = { 'cache-control': 'no-store' };
	return json(result, { status: result.ok ? 200 : 409, headers });
};
