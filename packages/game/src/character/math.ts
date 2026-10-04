/** Wraps an angle to (-PI, PI]. */
export function wrapAngle(angle: number): number {
	const twoPi = Math.PI * 2;
	let a = angle % twoPi;
	if (a <= -Math.PI) a += twoPi;
	if (a > Math.PI) a -= twoPi;
	return a;
}

/** Turns `current` towards `target` along the shorter way, by at most `maxStep`. */
export function turnTowards(current: number, target: number, maxStep: number): number {
	const delta = wrapAngle(target - current);
	if (Math.abs(delta) <= maxStep) return wrapAngle(target);
	return wrapAngle(current + Math.sign(delta) * maxStep);
}

/** Yaw that faces from (x0,z0) towards (x1,z1). Yaw 0 faces +z (the player). */
export function yawTowards(x0: number, z0: number, x1: number, z1: number): number {
	return Math.atan2(x1 - x0, z1 - z0);
}

/** Moves a value towards a target by at most `maxStep`. */
export function approach(current: number, target: number, maxStep: number): number {
	if (Math.abs(target - current) <= maxStep) return target;
	return current + Math.sign(target - current) * maxStep;
}

/** Smoothstep easing for 0..1. */
export function ease(t: number): number {
	const c = Math.min(1, Math.max(0, t));
	return c * c * (3 - 2 * c);
}
