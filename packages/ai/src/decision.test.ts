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
		now: new Date('2026-01-01T12:00:00Z'),
		awareness: 'UNKNOWN',
		situation: 'gaming',
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
});
