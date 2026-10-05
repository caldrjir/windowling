import { describe, expect, it } from 'vitest';
import type { ChatMessage, ChatModel, CompletionOptions } from './chat-model.ts';
import { OpenAICompatibleChatModel } from './chat-model.ts';
import type { CharacterAIContext } from './decision.ts';
import { LlmCharacterAI } from './llm.ts';
import { buildMessages, DECISION_JSON_SCHEMA, describeFeelings, extractJson } from './prompt.ts';

const context: CharacterAIContext = {
	characterName: 'Riley',
	localTime: '03:12',
	weekday: 'Tuesday',
	activity: 'sleep',
	needs: { hunger: 0.7, energy: 0.2, mood: 0.3 },
	awareness: 'DETECTED',
	event: 'woken_up',
	recent: [],
};

class ScriptedModel implements ChatModel {
	calls: Array<{ messages: ChatMessage[]; options: CompletionOptions }> = [];
	constructor(private readonly answer: string | Error) {}
	async complete(messages: ChatMessage[], options: CompletionOptions): Promise<string> {
		this.calls.push({ messages, options });
		if (this.answer instanceof Error) throw this.answer;
		return this.answer;
	}
}

describe('buildMessages', () => {
	it('describes the moment in words, never numbers', () => {
		const [system, user] = buildMessages(context);
		expect(system?.content).toContain('You are Riley');
		expect(user?.content).toContain('03:12 on Tuesday');
		expect(user?.content).toContain('woke you up');
		expect(user?.content).toContain('You are hungry.');
		expect(user?.content).not.toMatch(/0\.\d/);
	});

	it('includes only the last few lines of the conversation and what the player said', () => {
		const recent = Array.from({ length: 10 }, (_, i) => ({
			speaker: i % 2 ? ('player' as const) : ('character' as const),
			text: `line ${i}`,
		}));
		const [, user] = buildMessages({
			...context,
			event: 'player_said',
			recent,
			playerUtterance: 'Sorry!',
		});
		expect(user?.content).not.toContain('line 3');
		expect(user?.content).toContain('line 9');
		expect(user?.content).toContain('The player says: "Sorry!"');
	});

	it('turns needs into feelings', () => {
		expect(describeFeelings({ hunger: 0.1, energy: 0.9, mood: 0.9 })).toBe(
			'You are in a good mood. You feel rested.',
		);
	});
});

describe('extractJson', () => {
	it('finds the JSON in chatty output', () => {
		expect(extractJson('Sure! ```json\n{"a": {"b": "}"}}\n``` hope that helps')).toEqual({
			a: { b: '}' },
		});
	});

	it('returns null for garbage', () => {
		expect(extractJson('no json here')).toBeNull();
		expect(extractJson('{"broken": ')).toBeNull();
	});
});

describe('LlmCharacterAI', () => {
	it('returns a valid decision from the model, asking for the schema', async () => {
		const model = new ScriptedModel(
			'{"speech":"Seriously? It is three in the morning. *yawns* Go away. Please. Now.","emotion":"annoyed","intensity":0.8,"action":{"type":"lookAtPlayer"}}',
		);
		const decision = await new LlmCharacterAI(model).decide(context);
		expect(decision.emotion).toBe('annoyed');
		expect(decision.action).toEqual({ type: 'lookAtPlayer' });
		// Stage directions removed, at most three sentences.
		expect(decision.speech).toBe('Seriously? It is three in the morning. Go away.');
		expect(model.calls[0]?.options.jsonSchema).toBe(DECISION_JSON_SCHEMA);
	});

	it('falls back when the model invents actions or fails', async () => {
		const errors: unknown[] = [];
		const invented = new ScriptedModel(
			'{"emotion":"happy","intensity":1,"action":{"type":"openPortal"}}',
		);
		const fromInvented = await new LlmCharacterAI(invented, {
			onError: (e) => errors.push(e),
		}).decide(context);
		expect(fromInvented.speech).toContain('03:12');

		const broken = new ScriptedModel(new Error('HTTP 500'));
		const fromBroken = await new LlmCharacterAI(broken, { onError: (e) => errors.push(e) }).decide(
			context,
		);
		expect(fromBroken.action).toEqual({ type: 'lookAtPlayer' });
		expect(errors).toHaveLength(2);
	});
});

describe('OpenAICompatibleChatModel', () => {
	it('posts a chat completion with constrained output', async () => {
		const requests: Array<{ url: string; init: RequestInit }> = [];
		const fakeFetch = (async (url: string, init: RequestInit) => {
			requests.push({ url, init });
			return new Response(JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] }));
		}) as unknown as typeof fetch;
		const model = new OpenAICompatibleChatModel({
			baseUrl: 'https://example.test/v1/',
			model: 'some-model',
			apiKey: 'k',
			fetch: fakeFetch,
		});
		const answer = await model.complete([{ role: 'user', content: 'hi' }], {
			jsonSchema: { type: 'object' },
			maxTokens: 10,
			temperature: 0.5,
		});
		expect(answer).toBe('{"ok":true}');
		expect(requests[0]?.url).toBe('https://example.test/v1/chat/completions');
		const body = JSON.parse(String(requests[0]?.init.body));
		expect(body).toMatchObject({ model: 'some-model', max_tokens: 10 });
		expect(body.response_format.type).toBe('json_schema');
		expect((requests[0]?.init.headers as Record<string, string>).authorization).toBe('Bearer k');
	});

	it('throws on HTTP errors', async () => {
		const model = new OpenAICompatibleChatModel({
			baseUrl: 'https://example.test/v1',
			model: 'm',
			fetch: (async () => new Response('nope', { status: 429 })) as unknown as typeof fetch,
		});
		await expect(model.complete([], { maxTokens: 1, temperature: 0 })).rejects.toThrow('HTTP 429');
	});
});
