import { ACTIVITIES } from '@windowling/shared';
import { describe, expect, it } from 'vitest';
import { applyNeeds, INITIAL_NEEDS } from './needs.ts';

describe('applyNeeds', () => {
	it('keeps every need within 0..1, whatever happens', () => {
		for (const activity of ACTIVITIES) {
			for (const hours of [0, 0.5, 3, 48, 500]) {
				const needs = applyNeeds({ hunger: 0.9, energy: 0.1, mood: 0.05 }, activity, hours);
				for (const value of Object.values(needs)) {
					expect(value).toBeGreaterThanOrEqual(0);
					expect(value).toBeLessThanOrEqual(1);
				}
			}
		}
	});

	it('sleep restores energy, eating removes hunger', () => {
		expect(applyNeeds({ ...INITIAL_NEEDS, energy: 0.1 }, 'sleep', 7).energy).toBeGreaterThan(0.9);
		expect(applyNeeds({ ...INITIAL_NEEDS, hunger: 0.7 }, 'eat', 0.5).hunger).toBeLessThan(0.1);
	});

	it('being awake makes the character hungry and tired', () => {
		const after = applyNeeds(INITIAL_NEEDS, 'work', 4);
		expect(after.hunger).toBeGreaterThan(INITIAL_NEEDS.hunger);
		expect(after.energy).toBeLessThan(INITIAL_NEEDS.energy);
	});

	it('hunger spoils the mood, gaming lifts it', () => {
		const starving = applyNeeds({ hunger: 0.9, energy: 0.8, mood: 0.6 }, 'idle', 3);
		expect(starving.mood).toBeLessThan(0.4);
		const playing = applyNeeds({ hunger: 0.2, energy: 0.8, mood: 0.4 }, 'gaming', 1);
		expect(playing.mood).toBeGreaterThan(0.5);
	});

	it('mood settles on its baseline without overshooting', () => {
		expect(applyNeeds({ hunger: 0.2, energy: 0.8, mood: 0.59 }, 'idle', 3).mood).toBeCloseTo(
			0.6,
			5,
		);
	});

	it('does nothing for zero or negative time', () => {
		expect(applyNeeds(INITIAL_NEEDS, 'work', 0)).toEqual(INITIAL_NEEDS);
		expect(applyNeeds(INITIAL_NEEDS, 'work', -5)).toEqual(INITIAL_NEEDS);
	});
});
