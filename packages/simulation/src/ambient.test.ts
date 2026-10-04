import { characterActionSchema, targetSupports } from '@windowling/shared';
import { describe, expect, it } from 'vitest';
import { createRng, nextAmbientAction } from './ambient.ts';

describe('createRng', () => {
	it('is deterministic and in [0, 1)', () => {
		const a = createRng(42);
		const b = createRng(42);
		for (let i = 0; i < 100; i++) {
			const x = a();
			expect(x).toBe(b());
			expect(x).toBeGreaterThanOrEqual(0);
			expect(x).toBeLessThan(1);
		}
	});
});

describe('nextAmbientAction', () => {
	it('only produces valid, possible actions', () => {
		const rng = createRng(1);
		let previous = null;
		for (let i = 0; i < 200; i++) {
			const { action, dwellSeconds } = nextAmbientAction(rng, previous);
			expect(characterActionSchema.parse(action)).toEqual(action);
			if ('target' in action) expect(targetSupports(action.target, action.type)).toBe(true);
			expect(dwellSeconds).toBeGreaterThan(0);
			previous = action;
		}
	});

	it('never repeats the same action twice in a row', () => {
		const rng = createRng(7);
		let previous = nextAmbientAction(rng, null).action;
		for (let i = 0; i < 200; i++) {
			const next = nextAmbientAction(rng, previous).action;
			expect(next).not.toEqual(previous);
			previous = next;
		}
	});

	it('visits every kind of place over time', () => {
		const rng = createRng(3);
		const seen = new Set<string>();
		let previous = null;
		for (let i = 0; i < 300; i++) {
			const { action } = nextAmbientAction(rng, previous);
			seen.add('target' in action ? action.target : action.type);
			previous = action;
		}
		expect(seen).toEqual(new Set(['sofa', 'desk.chair', 'bed', 'window', 'room.center', 'idle']));
	});
});
