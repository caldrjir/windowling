import { Quaternion, type Vector3 } from 'three';

/**
 * Motion capture the characters play (made by `scripts/mocap.mjs`, served as
 * `/characters/motions.json`). Rotations are per bone, away from a T-pose, in
 * the character's own space; any body with the same bone names can play them.
 */
export interface MotionClip {
	duration: number;
	loop: boolean;
	frames: number;
	/** Each bone's direction in the T-pose the rotations start from. */
	restDirections: Record<string, [number, number, number]>;
	/** Per bone: x, y, z, w per frame. */
	rotations: Record<string, number[]>;
	/** Hips offset per frame (x, y, z), in leg lengths. */
	hips: number[];
}

export interface Motions {
	fps: number;
	clips: Record<string, MotionClip>;
}

export type MotionName = 'walk' | 'idle' | 'wave' | 'sweep' | 'dance' | 'yawn';

/** Where in the clip `time` (seconds) falls: two frames and how far between them. */
function frameAt(clip: MotionClip, time: number): [number, number, number] {
	const span = clip.loop ? clip.frames : clip.frames - 1;
	let f = (time / clip.duration) * span;
	f = clip.loop ? ((f % span) + span) % span : Math.min(Math.max(f, 0), span);
	const a = Math.floor(f);
	const b = clip.loop ? (a + 1) % clip.frames : Math.min(a + 1, clip.frames - 1);
	return [a, b, f - a];
}

const qa = new Quaternion();
const qb = new Quaternion();

/** The bone's rotation away from the T-pose at `time`, or null when the clip doesn't move it. */
export function sampleRotation(
	clip: MotionClip,
	bone: string,
	time: number,
	out: Quaternion,
): Quaternion | null {
	const data = clip.rotations[bone];
	if (!data) return null;
	const [a, b, t] = frameAt(clip, time);
	qa.fromArray(data, a * 4);
	qb.fromArray(data, b * 4);
	return out.slerpQuaternions(qa, qb, t);
}

/** The hips' offset at `time`, in leg lengths. */
export function sampleHips(clip: MotionClip, time: number, out: Vector3): Vector3 {
	const [a, b, t] = frameAt(clip, time);
	const h = clip.hips;
	return out.set(
		(h[a * 3] ?? 0) * (1 - t) + (h[b * 3] ?? 0) * t,
		(h[a * 3 + 1] ?? 0) * (1 - t) + (h[b * 3 + 1] ?? 0) * t,
		(h[a * 3 + 2] ?? 0) * (1 - t) + (h[b * 3 + 2] ?? 0) * t,
	);
}

/** Basic shape check of fetched JSON (it comes over the network). */
export function isMotions(value: unknown): value is Motions {
	if (typeof value !== 'object' || value === null) return false;
	const clips = (value as { clips?: unknown }).clips;
	return typeof clips === 'object' && clips !== null && 'walk' in clips && 'idle' in clips;
}
