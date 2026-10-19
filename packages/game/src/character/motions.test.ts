import { Quaternion, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { isMotions, sampleHips, sampleRotation, type MotionClip } from './motions.ts';

const turn = (angle: number) =>
	new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), angle).toArray();

/** Two frames: no turn, then a quarter turn about x; hips rise by a tenth of a leg. */
const clip = (loop: boolean): MotionClip => ({
	duration: 1,
	loop,
	frames: 2,
	restDirections: { thigh_l: [0, -1, 0] },
	rotations: { thigh_l: [...turn(0), ...turn(Math.PI / 2)] },
	hips: [0, 0, 0, 0, 0.1, 0],
});

const angle = (q: Quaternion | null) => (q ? 2 * Math.acos(Math.min(1, Math.abs(q.w))) : NaN);

describe('motion clips', () => {
	it('interpolates between frames', () => {
		const once = clip(false);
		expect(angle(sampleRotation(once, 'thigh_l', 0, new Quaternion()))).toBeCloseTo(0);
		expect(angle(sampleRotation(once, 'thigh_l', 0.5, new Quaternion()))).toBeCloseTo(Math.PI / 4);
		expect(angle(sampleRotation(once, 'thigh_l', 5, new Quaternion()))).toBeCloseTo(Math.PI / 2);
		expect(sampleHips(once, 0.5, new Vector3()).y).toBeCloseTo(0.05);
	});

	it('wraps a loop back to its start', () => {
		const loop = clip(true);
		// Halfway through the last frame it is on its way back to the first.
		expect(angle(sampleRotation(loop, 'thigh_l', 0.75, new Quaternion()))).toBeCloseTo(Math.PI / 4);
		expect(angle(sampleRotation(loop, 'thigh_l', 1, new Quaternion()))).toBeCloseTo(0);
		expect(angle(sampleRotation(loop, 'thigh_l', -0.5, new Quaternion()))).toBeCloseTo(Math.PI / 2);
	});

	it('leaves bones the clip does not move alone', () => {
		expect(sampleRotation(clip(true), 'head', 0, new Quaternion())).toBeNull();
	});

	it('only accepts motions that have walking and standing', () => {
		expect(isMotions({ fps: 30, clips: { walk: clip(true), idle: clip(true) } })).toBe(true);
		expect(isMotions({ fps: 30, clips: { walk: clip(true) } })).toBe(false);
		expect(isMotions('<html>')).toBe(false);
	});
});
