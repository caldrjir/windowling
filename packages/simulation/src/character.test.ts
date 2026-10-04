import { describe, expect, it } from 'vitest';
import { createInitialCharacter, hashString } from './character.ts';

describe('createInitialCharacter', () => {
	it('is deterministic for the same seed', () => {
		expect(createInitialCharacter('world-1')).toEqual(createInitialCharacter('world-1'));
	});

	it('always produces a non-empty name', () => {
		for (let i = 0; i < 100; i++) {
			expect(createInitialCharacter(`seed-${i}`).name.length).toBeGreaterThan(0);
		}
	});
});

describe('hashString', () => {
	it('returns an unsigned 32-bit integer', () => {
		const h = hashString('windowling');
		expect(Number.isInteger(h)).toBe(true);
		expect(h).toBeGreaterThanOrEqual(0);
		expect(h).toBeLessThan(2 ** 32);
	});
});
