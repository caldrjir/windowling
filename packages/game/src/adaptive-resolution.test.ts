import { describe, expect, it } from 'vitest';
import { AdaptiveResolution } from './adaptive-resolution.ts';

function frames(r: AdaptiveResolution, seconds: number, frame: number): number[] {
	const changes: number[] = [];
	for (let t = 0; t < seconds; t += frame) {
		const next = r.update(frame);
		if (next !== null) changes.push(next);
	}
	return changes;
}

describe('AdaptiveResolution', () => {
	it('keeps full resolution on a device that keeps up', () => {
		const r = new AdaptiveResolution(2);
		expect(frames(r, 30, 1 / 60)).toEqual([]);
		expect(r.ratio).toBe(2);
	});

	it('draws fewer pixels, step by step, when frames are slow', () => {
		const r = new AdaptiveResolution(2);
		expect(frames(r, 2, 1 / 20)).toEqual([1.75]);
		frames(r, 20, 1 / 15);
		expect(r.ratio).toBe(0.75); // never below the floor
	});

	it('ignores a single hiccup', () => {
		const r = new AdaptiveResolution(2);
		frames(r, 3, 1 / 60);
		r.update(2); // the tab was in the background
		expect(frames(r, 3, 1 / 60)).toEqual([]);
		expect(r.ratio).toBe(2);
	});

	it('goes back up when there is headroom again', () => {
		const r = new AdaptiveResolution(2);
		frames(r, 4, 1 / 15); // a heavy moment: 2 -> 1.75 -> 1.5
		expect(r.ratio).toBe(1.5);
		frames(r, 30, 1 / 60);
		expect(r.ratio).toBe(2);
	});

	it('does not keep trying a ratio that was too slow', () => {
		const r = new AdaptiveResolution(2);
		frames(r, 2, 1 / 15); // 2 -> 1.75
		frames(r, 9, 1 / 60); // fast: back up to 2...
		expect(r.ratio).toBe(2);
		frames(r, 2, 1 / 15); // ...and slow again: 2 is too much for this device
		expect(r.ratio).toBe(1.75);
		frames(r, 60, 1 / 60);
		expect(r.ratio).toBe(1.75);
	});

	it('drops faster when frames crawl (a weak phone, software rendering)', () => {
		const r = new AdaptiveResolution(2);
		const changes = frames(r, 3, 1 / 6);
		expect(changes[0]).toBe(1.5);
		expect(r.ratio).toBe(0.75);
	});
});
