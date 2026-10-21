import { describe, expect, it } from 'vitest';
import type { ChatMessage, ChatModel, CompletionOptions } from './chat-model.ts';
import { OpenAICompatibleChatModel } from './chat-model.ts';
import type { CharacterAIContext } from './decision.ts';
import { LlmCharacterAI } from './llm.ts';
import {
	buildMessages,
	DECISION_JSON_SCHEMA,
	describeFeelings,
	describeHome,
	describeMoney,
	extractJson,
} from './prompt.ts';

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

	it('brings in memories and the relationship, in words', () => {
		const [system, user] = buildMessages({
			...context,
			memories: [{ note: 'Someone woke me up at 03:12.', when: 'yesterday' }],
			relationship: { affinity: -0.3, trust: 0.1, familiarity: 0.2 },
		});
		expect(user?.content).toContain('- (yesterday) Someone woke me up at 03:12.');
		expect(user?.content).toContain('They have annoyed you before.');
		expect(user?.content).toContain('You do not trust them.');
		expect(user?.content).not.toMatch(/0\.\d/);
		expect(system?.content).toContain('"remember"');
	});

	it('knows its things: in the flat, by the door, on the way', () => {
		expect(
			describeHome({ items: ['plant', 'headphones'], parcels: ['blanket'], ordered: [] }),
		).toBe(
			'Things you bought for your flat: a floor plant and a pair of good headphones. A parcel with a soft blanket for the sofa is waiting by your door.',
		);
		expect(describeHome({ items: [], parcels: [], ordered: ['coffee_machine'] })).toBe(
			'You ordered a coffee machine online; it has not come yet.',
		);
		expect(describeHome({ items: [], parcels: [], ordered: [] })).toBe('');
	});

	it('turns money into feelings, never amounts', () => {
		expect(describeMoney({ feeling: 'broke', justPaid: false, rentWorry: true })).toBe(
			'You are broke and worried about money. Rent is due in a few days and you are not sure you can cover it.',
		);
		expect(describeMoney({ feeling: 'fine', justPaid: true, rentWorry: false })).toBe(
			'You just got paid.',
		);
		expect(describeMoney({ feeling: 'fine', justPaid: false, rentWorry: false })).toBe('');
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

	it('passes on what the model wants to remember', async () => {
		const model = new ScriptedModel(
			'{"speech":"Nice to meet you, Jiri.","emotion":"happy","intensity":0.6,"action":{"type":"lookAtPlayer"},"remember":{"kind":"fact","note":"The player told me their name is Jiri."}}',
		);
		const decision = await new LlmCharacterAI(model).decide({ ...context, event: 'player_said' });
		expect(decision.remember).toEqual({
			kind: 'fact',
			note: 'The player told me their name is Jiri.',
		});
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
