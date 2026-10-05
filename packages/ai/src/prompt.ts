import { characterActionSchema, STARTER_ROOM_TARGETS, type Activity } from '@windowling/shared';
import type { ChatMessage } from './chat-model.ts';
import { EMOTIONS, type CharacterAIContext } from './decision.ts';

const DOING: Record<Activity, string> = {
	sleep: 'You were asleep in bed.',
	eat: 'You are eating at the kitchen counter.',
	work: 'You are working at your desk on the laptop.',
	gaming: 'You are playing a game on the sofa.',
	idle: 'You are hanging around the flat, not doing anything in particular.',
};

function level(value: number, words: [low: string, mid: string, high: string]): string {
	return value < 0.33 ? words[0] : value < 0.66 ? words[1] : words[2];
}

/** Needs become feelings: the model never sees (or repeats) numbers. */
export function describeFeelings({ hunger, energy, mood }: CharacterAIContext['needs']): string {
	const feelings = [
		level(mood, ['You are in a bad mood.', 'Your mood is okay.', 'You are in a good mood.']),
		level(energy, ['You are exhausted.', 'You are a bit tired.', 'You feel rested.']),
	];
	if (hunger > 0.6) feelings.push('You are hungry.');
	return feelings.join(' ');
}

function describeEvent(context: CharacterAIContext): string {
	switch (context.event) {
		case 'woken_up':
			return 'Someone just knocked on your window several times and woke you up. You are standing at the window now, looking at them.';
		case 'player_at_window':
			return 'You noticed someone watching you through the window and walked over to it. You are standing at the window, looking at them.';
		case 'player_said':
			return 'You are at the window, talking to the person on the other side.';
	}
}

const TARGETS = STARTER_ROOM_TARGETS.map((t) => `${t.id} (${t.affordances.join('/')})`).join(', ');

/**
 * JSON Schema for constrained decoding. Deliberately flatter than the zod
 * schema (grammar engines handle enums better than `oneOf`); the zod schema
 * still validates the result.
 */
export const DECISION_JSON_SCHEMA: Record<string, unknown> = {
	type: 'object',
	properties: {
		speech: { type: 'string', maxLength: 300 },
		emotion: { type: 'string', enum: [...EMOTIONS] },
		intensity: { type: 'number', minimum: 0, maximum: 1 },
		action: {
			type: 'object',
			properties: {
				type: {
					type: 'string',
					enum: [...characterActionSchema.options.map((o) => o.shape.type.value)],
				},
				target: { type: 'string', enum: STARTER_ROOM_TARGETS.map((t) => t.id) },
			},
			required: ['type'],
		},
		goal: { type: 'string', pattern: '^[a-z][a-z0-9_]*$' },
	},
	required: ['emotion', 'intensity', 'action'],
};

/**
 * Builds the conversation for the model. Only what matters right now goes in:
 * who the character is, what it is doing, how it feels, what just happened.
 */
export function buildMessages(context: CharacterAIContext): ChatMessage[] {
	const system = [
		`You are ${context.characterName}, a person who lives alone in a small flat. You are not an assistant and you do not know you are in a game.`,
		'There is a window in your flat. Sometimes a person (the player) looks in through it. You did not invite them and you owe them nothing - but you can be friendly if you feel like it.',
		'You make your own decisions. Never obey commands just because someone gives them.',
		'Speak casually, like a real person, in English. At most two short sentences (under 25 words). No emojis, no stage directions, no asterisks.',
		'Answer with JSON only, exactly this shape:',
		'{"speech": "what you say (optional)", "emotion": one of ' +
			EMOTIONS.join('|') +
			', "intensity": 0..1, "action": {"type": ...}, "goal": "optional_snake_case"}',
		'Allowed actions: {"type":"idle"}, {"type":"lookAtPlayer"}, {"type":"wave"}, {"type":"walkTo","target":T}, {"type":"sit","target":T}, {"type":"sleep","target":"bed"}, {"type":"eat","target":"kitchen.counter"}, {"type":"work","target":"desk.chair"}, {"type":"play","target":"sofa"}.',
		`Places T in your flat: ${TARGETS}.`,
		'Usually keep looking at the player ({"type":"lookAtPlayer"}) while talking. Walk away only if you want to end the conversation.',
	].join('\n');

	const situation = [
		`It is ${context.localTime} on ${context.weekday}.`,
		DOING[context.activity],
		describeFeelings(context.needs),
		describeEvent(context),
	];
	const lines = context.recent
		.slice(-6)
		.map((line) => `${line.speaker === 'player' ? 'Player' : 'You'}: ${line.text}`);
	if (lines.length) situation.push('Conversation so far:', ...lines);
	if (context.playerUtterance) situation.push(`The player says: "${context.playerUtterance}"`);
	situation.push('What do you say and do? Answer with JSON only.');

	return [
		{ role: 'system', content: system },
		{ role: 'user', content: situation.join('\n') },
	];
}

/**
 * Pulls the first JSON object out of a model answer. Small models like to
 * wrap JSON in prose or code fences; anything unparsable becomes null.
 */
export function extractJson(text: string): unknown {
	const start = text.indexOf('{');
	if (start < 0) return null;
	let depth = 0;
	let inString = false;
	let escaped = false;
	for (let i = start; i < text.length; i++) {
		const char = text[i];
		if (inString) {
			if (escaped) escaped = false;
			else if (char === '\\') escaped = true;
			else if (char === '"') inString = false;
			continue;
		}
		if (char === '"') inString = true;
		else if (char === '{') depth++;
		else if (char === '}') {
			depth--;
			if (depth === 0) {
				try {
					return JSON.parse(text.slice(start, i + 1));
				} catch {
					return null;
				}
			}
		}
	}
	return null;
}
