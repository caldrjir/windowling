import { describe, expect, it } from 'vitest';
import { MockCharacterAI, parseCharacterDecision, type CharacterAIContext } from './index.ts';

describe('parseCharacterDecision', () => {
	it('accepts a well-formed decision', () => {
		const decision = {
			speech: 'You scared the hell out of me.',
			emotion: 'surprised',
			intensity: 0.7,
			action: { type: 'lookAtPlayer' },
			goal: 'continue_gaming',
		};
		expect(parseCharacterDecision(decision)).toEqual(decision);
	});

	it('rejects actions outside the controlled union', () => {
		expect(
			parseCharacterDecision({
				emotion: 'happy',
				intensity: 0.5,
				action: { type: 'runScript', code: 'renderer.dispose()' },
			}),
		).toBeNull();
	});

	it('rejects out-of-range intensity', () => {
		expect(
			parseCharacterDecision({ emotion: 'happy', intensity: 3, action: { type: 'idle' } }),
		).toBeNull();
	});

	it('rejects non-objects', () => {
		expect(parseCharacterDecision('do a backflip')).toBeNull();
	});
});

describe('MockCharacterAI', () => {
	const base: CharacterAIContext = {
		characterName: 'Alex',
		localTime: '12:00',
		weekday: 'Monday',
		activity: 'gaming',
		needs: { hunger: 0.2, energy: 0.7, mood: 0.6 },
		awareness: 'UNKNOWN',
		event: 'player_said',
		recent: [],
	};

	it('does not react to a player it has not noticed', async () => {
		const decision = await new MockCharacterAI().decide({ ...base, playerUtterance: 'hello' });
		expect(decision.action).toEqual({ type: 'idle' });
		expect(decision.speech).toBeUndefined();
	});

	it('always returns schema-valid decisions', async () => {
		const ai = new MockCharacterAI();
		for (const awareness of ['UNKNOWN', 'DETECTED', 'INTERACTING'] as const) {
			const decision = await ai.decide({ ...base, awareness, playerUtterance: 'hi' });
			expect(parseCharacterDecision(decision)).toEqual(decision);
		}
	});

	it('complains when woken up', async () => {
		const decision = await new MockCharacterAI().decide({
			...base,
			awareness: 'DETECTED',
			event: 'woken_up',
			localTime: '03:12',
		});
		expect(decision.speech).toContain('03:12');
		expect(decision.emotion).toBe('annoyed');
	});

	it('brushes the player off when it does not want to come over', async () => {
		const decision = await new MockCharacterAI().decide({
			...base,
			activity: 'work',
			awareness: 'IGNORING',
			event: 'ignoring_player',
		});
		expect(decision.speech).toBe("Not now, I'm working.");
		expect(decision.action).toEqual({ type: 'idle' });
	});

	it('says something when the player stays silent', async () => {
		const decision = await new MockCharacterAI().decide({
			...base,
			awareness: 'IGNORING',
			event: 'player_silent',
		});
		expect(decision.speech).toBe('Okay... never mind.');
	});

	it('remembers being woken up and treats familiar players differently', async () => {
		const ai = new MockCharacterAI();
		const again = await ai.decide({
			...base,
			awareness: 'DETECTED',
			event: 'player_at_window',
			memories: [{ note: 'Someone woke me up at 03:12 by knocking.', when: 'yesterday' }],
		});
		expect(again.speech).toBe('You again? You woke me up, you know.');
		const friend = await ai.decide({
			...base,
			awareness: 'DETECTED',
			event: 'player_at_window',
			relationship: { affinity: 0.6, trust: 0.6, familiarity: 0.5 },
		});
		expect(friend.speech).toBe('Hey, you! Good to see you.');
	});

	it('rejects oversized memories', () => {
		expect(
			parseCharacterDecision({
				emotion: 'happy',
				intensity: 0.5,
				action: { type: 'idle' },
				remember: { kind: 'fact', note: 'x'.repeat(500) },
			}),
		).toBeNull();
	});

	it('reacts to the flat being shaken, and to it happening again', async () => {
		const ai = new MockCharacterAI();
		const justNow = { note: 'Someone shook my whole flat.', when: 'earlier today' };
		const first = await ai.decide({
			...base,
			awareness: 'DETECTED',
			event: 'shaken',
			memories: [justNow],
		});
		expect(first.speech).toBe('Whoa! What was that?!');
		const again = await ai.decide({
			...base,
			awareness: 'DETECTED',
			event: 'shaken',
			memories: [
				justNow,
				{ note: 'Someone shook my flat. Things slid around.', when: 'yesterday' },
			],
		});
		expect(again.speech).toBe('Stop shaking my flat!');
	});
});
