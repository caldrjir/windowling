import { describe, expect, it } from 'vitest';
import { FixedStepAccumulator } from './fixed-step.ts';

describe('FixedStepAccumulator', () => {
	it('runs one step per full step of elapsed time', () => {
		const acc = new FixedStepAccumulator({ step: 0.125, maxFrameTime: 1 });
		expect(acc.advance(0.4).steps).toBe(3);
	});

	it('carries the remainder into the next frame', () => {
		const acc = new FixedStepAccumulator({ step: 0.25, maxFrameTime: 1 });
		const first = acc.advance(0.375);
		expect(first.steps).toBe(1);
		expect(first.alpha).toBeCloseTo(0.5);
		expect(acc.advance(0.125).steps).toBe(1);
	});

	it('clamps huge frame gaps', () => {
		const acc = new FixedStepAccumulator({ step: 0.125, maxFrameTime: 0.5 });
		expect(acc.advance(10).steps).toBe(4);
	});

	it('ignores negative frame times', () => {
		const acc = new FixedStepAccumulator({ step: 0.01, maxFrameTime: 1 });
		expect(acc.advance(-1)).toEqual({ steps: 0, alpha: 0 });
	});
});
