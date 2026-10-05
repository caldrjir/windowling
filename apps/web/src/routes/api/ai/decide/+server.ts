import { error, json } from '@sveltejs/kit';
import {
	LlmCharacterAI,
	MockCharacterAI,
	OpenAICompatibleChatModel,
	type CharacterAI,
	type CharacterAIContext,
} from '@windowling/ai';
import { catchUpWorld, consumeAiQuota, findWorldByUserId } from '@windowling/database';
import { localClock, localTime, reviewAction } from '@windowling/simulation';
import { conversationRequestSchema } from '$lib/conversation-request';
import { getServerEnv } from '$lib/server/config';
import type { RequestHandler } from './$types';

/**
 * The cloud brain. The client says what happened (event, what the player
 * said); the server knows who the character is and how it is doing, asks the
 * model, and lets the simulation review the proposed action.
 */
export const POST: RequestHandler = async ({ locals, request, url }) => {
	if (!locals.user) error(401, 'No session');
	const origin = request.headers.get('origin');
	if (origin && origin !== url.origin) error(403, 'Cross-origin request');

	const parsed = conversationRequestSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) error(400, 'Invalid conversation request');
	const body = parsed.data;

	const found = await findWorldByUserId(locals.db, locals.user.id);
	if (!found) error(404, 'No world');
	const now = new Date();
	const world = await catchUpWorld(locals.db, found, now);
	const { life } = world.character;
	const clock = localClock(now, world.timeZone);

	const context: CharacterAIContext = {
		characterName: world.character.name,
		localTime: clock.time,
		weekday: clock.weekday,
		activity: body.event === 'woken_up' ? 'sleep' : life.activity,
		needs: life.needs,
		awareness: body.awareness,
		event: body.event,
		playerUtterance: body.playerUtterance,
		recent: body.recent,
	};

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
	return json(
		{ decision: { ...decision, action }, source },
		{ headers: { 'cache-control': 'no-store' } },
	);
};
