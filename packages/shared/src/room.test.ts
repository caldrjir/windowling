import { describe, expect, it } from 'vitest';
import { knownTargetIdSchema, STARTER_ROOM_TARGETS, targetSupports } from './index.ts';

describe('starter room targets', () => {
	it('uses valid, unique target ids', () => {
		const ids = STARTER_ROOM_TARGETS.map((t) => t.id);
		expect(new Set(ids).size).toBe(ids.length);
		for (const id of ids) expect(knownTargetIdSchema.safeParse(id).success).toBe(true);
	});

	it('allows sitting on seats only', () => {
		expect(targetSupports('sofa', 'sit')).toBe(true);
		expect(targetSupports('desk.chair', 'sit')).toBe(true);
		expect(targetSupports('window', 'sit')).toBe(false);
	});

	it('allows sleeping in bed only', () => {
		expect(targetSupports('bed', 'sleep')).toBe(true);
		expect(targetSupports('sofa', 'sleep')).toBe(false);
	});

	it('knows where to eat, work and play', () => {
		expect(targetSupports('kitchen.counter', 'eat')).toBe(true);
		expect(targetSupports('desk.chair', 'work')).toBe(true);
		expect(targetSupports('sofa', 'play')).toBe(true);
		expect(targetSupports('sofa', 'work')).toBe(false);
		expect(targetSupports('bed', 'eat')).toBe(false);
	});

	it('knows where the richer day happens', () => {
		expect(targetSupports('kitchen.counter', 'cook')).toBe(true);
		expect(targetSupports('sofa', 'watch')).toBe(true);
		expect(targetSupports('bed', 'read')).toBe(true);
		expect(targetSupports('window', 'call')).toBe(true);
		expect(targetSupports('room.center', 'exercise')).toBe(true);
		expect(targetSupports('door', 'leave')).toBe(true);
		expect(targetSupports('bed', 'leave')).toBe(false);
		expect(targetSupports('sofa', 'clean')).toBe(false);
	});

	it('allows walking to any known target but not unknown ones', () => {
		expect(targetSupports('bed', 'walkTo')).toBe(true);
		expect(targetSupports('fridge', 'walkTo')).toBe(false);
	});

	it('does not treat target-less actions as target actions', () => {
		expect(targetSupports('sofa', 'idle')).toBe(false);
	});
});
