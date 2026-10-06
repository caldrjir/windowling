import { error, json } from '@sveltejs/kit';
import { conversationRequestSchema } from '$lib/conversation-request';
import { buildServerContext } from '$lib/server/brain-context';
import type { RequestHandler } from './$types';

/**
 * For brains running on the player's device: the same context the cloud brain
 * gets (relationship, relevant memories), without calling any model.
 */
export const POST: RequestHandler = async ({ locals, request, url }) => {
	if (!locals.user) error(401, 'No session');
	const origin = request.headers.get('origin');
	if (origin && origin !== url.origin) error(403, 'Cross-origin request');
	const parsed = conversationRequestSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) error(400, 'Invalid conversation request');

	const built = await buildServerContext(locals.db, locals.user.id, parsed.data, new Date());
	if (!built) error(404, 'No world');
	return json(
		{ memories: built.context.memories ?? [], relationship: built.context.relationship },
		{ headers: { 'cache-control': 'no-store' } },
	);
};
