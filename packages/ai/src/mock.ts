import type { CharacterAI, CharacterAIContext, CharacterDecision } from './decision.ts';

/**
 * Deterministic stand-in used until a local LLM (Ollama) is wired in.
 * Keeps the rest of the system honest about going through the interface.
 */
export class MockCharacterAI implements CharacterAI {
	async decide(context: CharacterAIContext): Promise<CharacterDecision> {
		if (context.awareness === 'UNKNOWN') {
			return { emotion: 'neutral', intensity: 0, action: { type: 'idle' } };
		}
		if (context.playerUtterance) {
			return {
				speech: 'Hm?',
				emotion: 'surprised',
				intensity: 0.3,
				action: { type: 'lookAtPlayer' },
			};
		}
		return { emotion: 'neutral', intensity: 0.1, action: { type: 'idle' } };
	}
}
