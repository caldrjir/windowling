import { error, json } from '@sveltejs/kit';
import { characterDecisionSchema } from '@windowling/ai';
import { findWorldByUserId, recordConversation } from '@windowling/database';
import { conversationRequestSchema } from '$lib/conversation-request';
import type { RequestHandler } from './$types';

const outcomeSchema = conversationRequestSchema.extend({ decision: characterDecisionSchema });

/**
 * An on-device brain reports what happened, so memories and the relationship
 * stay on the server (one source of truth, whichever brain was used).
 */
export const POST: RequestHandler = async ({ locals, request, url }) => {
	if (!locals.user) error(401, 'No session');
	const origin = request.headers.get('origin');
	if (origin && origin !== url.origin) error(403, 'Cross-origin request');
	const parsed = outcomeSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) error(400, 'Invalid outcome');

	const world = await findWorldByUserId(locals.db, locals.user.id);
	if (!world) error(404, 'No world');
	const { event, playerUtterance, caughtDoing, decision } = parsed.data;
	await recordConversation(locals.db, world.id, {
		event,
		playerUtterance,
		caughtDoing,
		emotion: decision.emotion,
		intensity: decision.intensity,
		remember: decision.remember,
	});
	return json({ ok: true }, { headers: { 'cache-control': 'no-store' } });
};
