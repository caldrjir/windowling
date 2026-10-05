import type { ChatModel } from './chat-model.ts';
import {
	parseCharacterDecision,
	type CharacterAI,
	type CharacterAIContext,
	type CharacterDecision,
} from './decision.ts';
import { MockCharacterAI } from './mock.ts';
import { buildMessages, DECISION_JSON_SCHEMA, extractJson } from './prompt.ts';

export interface LlmCharacterAIOptions {
	maxTokens?: number;
	temperature?: number;
	/** Used when the model fails or produces something outside the schema. */
	fallback?: CharacterAI;
	onError?: (error: unknown) => void;
}

/**
 * A language model as the character's brain. The model only proposes a
 * decision in a closed schema; anything else is discarded in favour of the
 * fallback, and the simulation still reviews the action afterwards.
 */
export class LlmCharacterAI implements CharacterAI {
	private readonly fallback: CharacterAI;

	constructor(
		private readonly model: ChatModel,
		private readonly options: LlmCharacterAIOptions = {},
	) {
		this.fallback = options.fallback ?? new MockCharacterAI();
	}

	async decide(context: CharacterAIContext): Promise<CharacterDecision> {
		try {
			const answer = await this.model.complete(buildMessages(context), {
				jsonSchema: DECISION_JSON_SCHEMA,
				maxTokens: this.options.maxTokens ?? 160,
				temperature: this.options.temperature ?? 0.8,
			});
			const decision = parseCharacterDecision(extractJson(answer));
			if (decision) return tidy(decision);
			this.options.onError?.(new Error('model answer did not match the decision schema'));
		} catch (error) {
			this.options.onError?.(error);
		}
		return this.fallback.decide(context);
	}
}

/** Small models overshoot: keep speech short (a few sentences), without stage directions. */
function tidy(decision: CharacterDecision): CharacterDecision {
	if (!decision.speech) return decision;
	const speech = decision.speech
		.replace(/\*[^*]*\*/g, '')
		.replace(/\s+/g, ' ')
		.trim();
	const sentences = speech.match(/[^.!?]+[.!?]*/g) ?? [speech];
	const short = sentences.slice(0, 3).join('').trim().slice(0, 220);
	return short ? { ...decision, speech: short } : { ...decision, speech: undefined };
}
