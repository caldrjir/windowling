import { describe, expect, it } from 'vitest';
import { TARGETS } from '../room/layout.ts';
import { HUB, isClear, planPath } from './path.ts';

describe('planPath', () => {
	it('can reach every approach point from the hub in a straight line', () => {
		for (const [id, t] of Object.entries(TARGETS)) {
			expect(isClear(HUB, t.approach), id).toBe(true);
		}
	});

	it('goes straight when nothing is in the way', () => {
		expect(planPath({ x: 0, z: 0.3 }, { x: 0.5, z: 1 })).toEqual([{ x: 0.5, z: 1 }]);
	});

	it('detours through the hub when furniture blocks the way', () => {
		const from = { x: -2.2, z: 0.5 }; // in front of the bed
		const to = { x: -2.2, z: -2.0 }; // behind it
		expect(isClear(from, to)).toBe(false);
		expect(planPath(from, to)[0]).toEqual(HUB);
	});
});
