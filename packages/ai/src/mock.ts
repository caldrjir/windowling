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
		const rel = context.relationship;
		const remembersWaking = context.memories?.some((m) => /woke me up/i.test(m.note)) ?? false;
		if (context.event === 'woken_up') {
			return {
				speech: remembersWaking
					? `Again?! It's ${context.localTime}. Seriously.`
					: `What the hell? It's ${context.localTime}.`,
				emotion: 'annoyed',
				intensity: 0.8,
				action: { type: 'lookAtPlayer' },
			};
		}
		if (context.event === 'shaken') {
			// The shake that just happened is already remembered - "again" needs an earlier one.
			const again = (context.memories?.filter((m) => /shook my/i.test(m.note)).length ?? 0) >= 2;
			const known = (rel?.familiarity ?? 0) >= 0.1;
			return {
				speech: again
					? 'Stop shaking my flat!'
					: known
						? 'Hey! Was that you?!'
						: 'Whoa! What was that?!',
				emotion: again ? 'angry' : 'surprised',
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
			const grumpy = context.needs.mood < 0.35 || (rel?.affinity ?? 0) < -0.2;
			const known = (rel?.familiarity ?? 0) >= 0.1;
			const speech = remembersWaking
				? 'You again? You woke me up, you know.'
				: grumpy
					? 'What do you want?'
					: known
						? (rel?.affinity ?? 0) > 0.3
							? 'Hey, you! Good to see you.'
							: "Oh, it's you again."
						: 'Oh. Hi there.';
			return {
				speech,
				emotion: grumpy || remembersWaking ? 'annoyed' : known ? 'happy' : 'surprised',
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
