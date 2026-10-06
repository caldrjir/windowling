import {
	characterActionSchema,
	STARTER_ROOM_TARGETS,
	type Activity,
	type Relationship,
} from '@windowling/shared';
import type { ChatMessage } from './chat-model.ts';
import { EMOTIONS, type CharacterAIContext } from './decision.ts';

const DOING: Record<Activity, string> = {
	sleep: 'You were asleep in bed.',
	eat: 'You are eating at the kitchen counter.',
	work: 'You are working at your desk on the laptop.',
	gaming: 'You are playing a game on the sofa.',
	idle: 'You are hanging around the flat, not doing anything in particular.',
	cook: 'You are cooking at the kitchen counter.',
	clean: 'You are sweeping the flat.',
	exercise: 'You are working out on the rug.',
	tv: 'You are watching TV on the sofa.',
	music: 'You are listening to music on the sofa.',
	read: 'You are reading a book.',
	phone: 'You are on the phone with a friend.',
	shower: 'You are in the shower.',
	out: 'You are out of the flat.',
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

/** The relationship in words - the model never sees (or repeats) numbers. */
export function describeRelationship(rel: Relationship): string {
	const known =
		rel.familiarity < 0.05
			? 'You have never really met the person at the window.'
			: rel.familiarity < 0.3
				? 'You have seen the person at the window a few times.'
				: 'You know the person at the window quite well by now.';
	const feeling =
		rel.affinity <= -0.4
			? 'You dislike them.'
			: rel.affinity < -0.1
				? 'They have annoyed you before.'
				: rel.affinity < 0.15
					? 'You have no strong feelings about them.'
					: rel.affinity < 0.5
						? 'You like them.'
						: 'You are fond of them.';
	const trust =
		rel.trust < 0.2 ? ' You do not trust them.' : rel.trust > 0.7 ? ' You trust them.' : '';
	return `${known} ${feeling}${trust}`;
}

function describeEvent(context: CharacterAIContext): string {
	switch (context.event) {
		case 'woken_up':
			return 'Someone just knocked on your window several times and woke you up. You are standing at the window now, looking at them.';
		case 'player_at_window':
			return 'You noticed someone watching you through the window and walked over to it. You are standing at the window, looking at them.';
		case 'player_said':
			return 'You are at the window, talking to the person on the other side.';
		case 'shaken':
			return 'The whole flat just shook violently - things flew around and you nearly fell over. Whoever is at the window probably did it.';
		case 'player_silent':
			return 'You came to the window, but the person on the other side has not said or done anything for a while. Say something short as you turn away (or nothing at all) and go back to what you were doing.';
		case 'ignoring_player':
			return 'You noticed someone watching you through the window. You do not feel like going over - say something short without getting up, or nothing at all, and carry on with what you are doing.';
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
		remember: {
			type: 'object',
			properties: {
				kind: { type: 'string', enum: ['moment', 'fact'] },
				note: { type: 'string', maxLength: 160 },
			},
			required: ['kind', 'note'],
		},
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
		'Your memories are real: bring them up when they fit, and let them colour how you treat the player.',
		'If something is worth remembering (the player told you something about themselves, a promise, something that hurt or delighted you), add "remember": {"kind": "fact" or "moment", "note": "first-person sentence"}.',
	].join('\n');

	const situation = [
		`It is ${context.localTime} on ${context.weekday}.`,
		DOING[context.activity],
		describeFeelings(context.needs),
		describeEvent(context),
	];
	if (context.relationship) situation.push(describeRelationship(context.relationship));
	if (context.memories?.length) {
		situation.push(
			'Things you remember:',
			...context.memories.map((m) => `- (${m.when}) ${m.note}`),
		);
	}
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
