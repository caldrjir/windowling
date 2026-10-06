import { error, json } from '@sveltejs/kit';
import {
	LlmCharacterAI,
	MockCharacterAI,
	OpenAICompatibleChatModel,
	type CharacterAI,
} from '@windowling/ai';
import { consumeAiQuota, recordConversation } from '@windowling/database';
import { localTime, reviewAction } from '@windowling/simulation';
import { conversationRequestSchema } from '$lib/conversation-request';
import { buildServerContext } from '$lib/server/brain-context';
import { getServerEnv } from '$lib/server/config';
import type { RequestHandler } from './$types';

/**
 * The cloud brain. The client says what happened (event, what the player
 * said); the server knows who the character is, how it is doing, how it feels
 * about the player and what it remembers, asks the model, lets the simulation
 * review the proposed action, and keeps the traces (memories, relationship).
 */
export const POST: RequestHandler = async ({ locals, request, url }) => {
	if (!locals.user) error(401, 'No session');
	const origin = request.headers.get('origin');
	if (origin && origin !== url.origin) error(403, 'Cross-origin request');

	const parsed = conversationRequestSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) error(400, 'Invalid conversation request');
	const body = parsed.data;

	const now = new Date();
	const built = await buildServerContext(locals.db, locals.user.id, body, now);
	if (!built) error(404, 'No world');
	const { world, context } = built;
	const { life } = world.character;

	const ai = getServerEnv().ai;
	let brain: CharacterAI = new MockCharacterAI();
	let source: 'llm' | 'canned' = 'canned';
	if (ai && (await consumeAiQuota(locals.db, locals.user.id, ai.dailyLimit, now))) {
		brain = new LlmCharacterAI(
			new OpenAICompatibleChatModel({ baseUrl: ai.baseUrl, apiKey: ai.apiKey, model: ai.model }),
			{ onError: (e) => console.warn('Character brain fell back to canned reactions', String(e)) },
		);
		source = 'llm';
	}

	const decision = await brain.decide(context);
	const action = reviewAction(decision.action, {
		activity: life.activity,
		energy: life.needs.energy,
		hour: localTime(now, world.timeZone).hour,
	});
	await recordConversation(
		locals.db,
		world.id,
		{
			event: body.event,
			playerUtterance: body.playerUtterance,
			caughtDoing: body.caughtDoing,
			emotion: decision.emotion,
			intensity: decision.intensity,
			remember: decision.remember,
		},
		now,
	);
	return json(
		{ decision: { ...decision, action }, source },
		{ headers: { 'cache-control': 'no-store' } },
	);
};
