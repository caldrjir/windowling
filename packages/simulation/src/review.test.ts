import { describe, expect, it } from 'vitest';
import { reviewAction } from './review.ts';

const day = { activity: 'idle' as const, energy: 0.9, hour: 13 };

describe('reviewAction', () => {
	it('keeps plausible actions', () => {
		expect(reviewAction({ type: 'wave' }, day)).toEqual({ type: 'wave' });
		expect(reviewAction({ type: 'sit', target: 'sofa' }, day)).toEqual({
			type: 'sit',
			target: 'sofa',
		});
	});

	it('replaces impossible actions with looking at the player', () => {
		expect(reviewAction({ type: 'sleep', target: 'sofa' }, day)).toEqual({ type: 'lookAtPlayer' });
		expect(reviewAction({ type: 'walkTo', target: 'balcony' }, day)).toEqual({
			type: 'lookAtPlayer',
		});
	});

	it('only goes back to bed when it makes sense', () => {
		const bed = { type: 'sleep', target: 'bed' } as const;
		expect(reviewAction(bed, day)).toEqual({ type: 'lookAtPlayer' });
		expect(reviewAction(bed, { ...day, hour: 3 })).toEqual(bed);
		expect(reviewAction(bed, { ...day, energy: 0.2 })).toEqual(bed);
	});
});
