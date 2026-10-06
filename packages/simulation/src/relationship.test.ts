import { NEW_ACQUAINTANCE } from '@windowling/shared';
import { describe, expect, it } from 'vitest';
import { createRng } from './ambient.ts';
import { chooseResponse } from './awareness.ts';
import { applyRelationshipEvent, emotionValence } from './relationship.ts';

describe('applyRelationshipEvent', () => {
	it('grows familiarity with every visit and conversation', () => {
		const visited = applyRelationshipEvent(NEW_ACQUAINTANCE, { type: 'visit' });
		expect(visited.familiarity).toBeGreaterThan(0);
		const talked = applyRelationshipEvent(visited, {
			type: 'conversation',
			valence: 0,
			intensity: 0.5,
		});
		expect(talked.familiarity).toBeGreaterThan(visited.familiarity);
	});

	it('pleasant talks build affinity slowly, unpleasant ones cost it', () => {
		const nice = applyRelationshipEvent(NEW_ACQUAINTANCE, {
			type: 'conversation',
			valence: 1,
			intensity: 1,
		});
		expect(nice.affinity).toBeCloseTo(0.05, 5);
		const rude = applyRelationshipEvent(NEW_ACQUAINTANCE, {
			type: 'conversation',
			valence: -1,
			intensity: 1,
		});
		expect(rude.affinity).toBeLessThan(0);
		expect(rude.trust).toBeLessThan(NEW_ACQUAINTANCE.trust);
	});

	it('being woken up hurts', () => {
		const woken = applyRelationshipEvent(NEW_ACQUAINTANCE, { type: 'woken' });
		expect(woken.affinity).toBeLessThan(-0.1);
		expect(woken.trust).toBeLessThan(NEW_ACQUAINTANCE.trust);
	});

	it('shaking the flat is not appreciated - the harder, the worse', () => {
		const light = applyRelationshipEvent(NEW_ACQUAINTANCE, { type: 'shaken', intensity: 0.2 });
		const hard = applyRelationshipEvent(NEW_ACQUAINTANCE, { type: 'shaken', intensity: 1 });
		expect(hard.affinity).toBeLessThan(light.affinity);
		expect(hard.trust).toBeLessThan(NEW_ACQUAINTANCE.trust);
	});

	it('stays within bounds no matter how often it happens', () => {
		let rel = NEW_ACQUAINTANCE;
		for (let i = 0; i < 100; i++) rel = applyRelationshipEvent(rel, { type: 'woken' });
		expect(rel.affinity).toBe(-1);
		expect(rel.trust).toBe(0);
		for (let i = 0; i < 100; i++) rel = applyRelationshipEvent(rel, { type: 'visit' });
		expect(rel.familiarity).toBe(1);
	});

	it('maps emotions to how they felt', () => {
		expect(emotionValence('happy')).toBeGreaterThan(0);
		expect(emotionValence('angry')).toBeLessThan(0);
		expect(emotionValence('whatever')).toBe(0);
	});
});

describe('relationship in behaviour', () => {
	const share = (affinity: number) => {
		const rng = createRng(5);
		let approaches = 0;
		for (let i = 0; i < 1000; i++) {
			if (chooseResponse({ activity: 'idle', mood: 0.5, affinity }, rng) === 'approach')
				approaches++;
		}
		return approaches / 1000;
	};

	it('comes over to someone it likes, avoids someone who annoyed it', () => {
		expect(share(0.8)).toBeGreaterThan(share(0) + 0.15);
		expect(share(-0.8)).toBeLessThan(share(0) - 0.15);
	});
});
