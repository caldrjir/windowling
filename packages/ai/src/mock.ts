import type { MoneyOutcome } from '@windowling/shared';
import type { CharacterAI, CharacterAIContext, CharacterDecision } from './decision.ts';

const MONEY_REACTIONS: Record<MoneyOutcome, CharacterDecision> = {
	entrusted: {
		speech: "Thanks. Seriously. Don't let me talk you into giving it back for pizza.",
		emotion: 'happy',
		intensity: 0.6,
		action: { type: 'lookAtPlayer' },
	},
	declined: {
		speech: "Yeah, okay. Fair enough. I'll just... try not to spend it.",
		emotion: 'embarrassed',
		intensity: 0.4,
		action: { type: 'lookAtPlayer' },
	},
	returned: {
		speech: 'You have no idea how much that helps. Thank you.',
		emotion: 'happy',
		intensity: 0.8,
		action: { type: 'lookAtPlayer' },
	},
	withheld: {
		speech: "That's MY money. I can't believe you.",
		emotion: 'angry',
		intensity: 0.9,
		action: { type: 'idle' },
	},
	returned_unasked: {
		speech: 'Oh! All of it? I... thanks. I guess I can manage it myself now.',
		emotion: 'surprised',
		intensity: 0.6,
		action: { type: 'lookAtPlayer' },
	},
};

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
		if (context.event === 'caught') {
			const doing = context.caughtDoing ?? '';
			const speech = /dancing|singing/.test(doing)
				? '...how long have you been standing there?'
				: /raging/.test(doing)
					? "The game cheated. Don't look at me like that."
					: /dozing/.test(doing)
						? "I wasn't sleeping. I was resting my eyes."
						: /talking/.test(doing)
							? 'I was... thinking out loud. Normal people do that.'
							: 'Oh. Uh. Hi.';
			return {
				speech,
				emotion: 'embarrassed',
				intensity: 0.5 + 0.5 * (context.shyness ?? 0.5),
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
		if (context.event === 'money_entrust') {
			return {
				speech: `Hey... could you keep $${String(context.moneyAsk?.dollars ?? 0)} for me? I'd only blow it.`,
				emotion: 'nervous',
				intensity: 0.4,
				action: { type: 'lookAtPlayer' },
			};
		}
		if (context.event === 'money_return') {
			const cold = (rel?.affinity ?? 0) < 0;
			return {
				speech: cold
					? `I need my $${String(context.moneyAsk?.dollars ?? 0)} back. Now, please.`
					: `Um, about my money... could I get $${String(context.moneyAsk?.dollars ?? 0)} back? Rent's coming.`,
				emotion: 'nervous',
				intensity: cold ? 0.7 : 0.5,
				action: { type: 'lookAtPlayer' },
			};
		}
		if (context.event === 'money_answered') {
			return MONEY_REACTIONS[context.moneyOutcome ?? 'declined'];
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
		// Some things are not up for discussion.
		const awkward = context.memories?.find((m) => /caught me/i.test(m.note));
		if (
			context.playerUtterance &&
			awkward &&
			/danc|sing|rage|angry|game|sleep|doz|talk/i.test(context.playerUtterance)
		) {
			return {
				speech: "We're not talking about that.",
				emotion: 'embarrassed',
				intensity: 0.6,
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
