import { describe, expect, it } from 'vitest';
import {
	AWARENESS_STATES,
	awarenessStateSchema,
	characterActionSchema,
	worldSummarySchema,
} from './index.ts';

describe('awareness', () => {
	it('starts from UNKNOWN', () => {
		expect(AWARENESS_STATES[0]).toBe('UNKNOWN');
	});

	it('rejects unknown states', () => {
		expect(awarenessStateSchema.safeParse('WATCHING').success).toBe(false);
	});
});

describe('characterActionSchema', () => {
	it('accepts every known action shape', () => {
		const actions = [
			{ type: 'idle' },
			{ type: 'lookAtPlayer' },
			{ type: 'walkTo', target: 'window' },
			{ type: 'sit', target: 'sofa.left' },
			{ type: 'sleep', target: 'bed' },
		];
		for (const action of actions) {
			expect(characterActionSchema.parse(action)).toEqual(action);
		}
	});

	it('rejects arbitrary commands', () => {
		expect(characterActionSchema.safeParse({ type: 'eval', code: 'alert(1)' }).success).toBe(false);
	});

	it('rejects actions without their required target', () => {
		expect(characterActionSchema.safeParse({ type: 'walkTo' }).success).toBe(false);
	});

	it('rejects malformed target ids', () => {
		expect(
			characterActionSchema.safeParse({ type: 'sit', target: '../../etc/passwd' }).success,
		).toBe(false);
	});
});

describe('worldSummarySchema', () => {
	it('parses a valid summary', () => {
		const summary = {
			id: 'w1',
			createdAt: '2026-01-01T00:00:00.000Z',
			lastSimulatedAt: '2026-01-01T00:00:00.000Z',
			character: { id: 'c1', name: 'Alex' },
		};
		expect(worldSummarySchema.parse(summary)).toEqual(summary);
	});
});
