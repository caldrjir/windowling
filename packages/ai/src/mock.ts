import type { CharacterAI, CharacterAIContext, CharacterDecision } from './decision.ts';

/**
 * Deterministic stand-in when no language model is available (not
 * configured, quota used up, model failed). Keeps the character believable
 * with a few canned reactions and the rest of the system honest about going
 * through the interface.
 */
export class MockCharacterAI implements CharacterAI {
	async decide(context: CharacterAIContext): Promise<CharacterDecision> {
		if (context.awareness === 'UNKNOWN') {
			return { emotion: 'neutral', intensity: 0, action: { type: 'idle' } };
		}
		if (context.event === 'woken_up') {
			return {
				speech: `What the hell? It's ${context.localTime}.`,
				emotion: 'annoyed',
				intensity: 0.8,
				action: { type: 'lookAtPlayer' },
			};
		}
		if (context.event === 'player_silent') {
			return {
				speech: context.needs.mood < 0.35 ? 'Fine. Be like that.' : 'Okay... never mind.',
				emotion: context.needs.mood < 0.35 ? 'annoyed' : 'embarrassed',
				intensity: 0.3,
				action: { type: 'idle' },
			};
		}
		if (context.event === 'ignoring_player') {
			const busy = context.activity === 'work' ? "Not now, I'm working." : 'Not now.';
			return {
				speech: context.needs.mood < 0.35 ? 'Go away.' : busy,
				emotion: 'annoyed',
				intensity: 0.3,
				action: { type: 'idle' },
			};
		}
		if (context.event === 'player_at_window') {
			return {
				speech: context.needs.mood < 0.35 ? 'What do you want?' : 'Oh. Hi there.',
				emotion: context.needs.mood < 0.35 ? 'annoyed' : 'surprised',
				intensity: 0.4,
				action: { type: 'lookAtPlayer' },
			};
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
