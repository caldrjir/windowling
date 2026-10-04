import { obstacles, TARGETS, type Box, type Vec2 } from '../room/layout.ts';

/** Body radius used when checking whether a straight walk would clip furniture. */
export const BODY_RADIUS = 0.22;

/** The open spot every approach point can see; used as a single routing hub. */
export const HUB: Vec2 = TARGETS['room.center'].approach;

function segmentHitsBox(a: Vec2, b: Vec2, box: Box, margin: number): boolean {
	// Slab test against the box expanded by `margin` on the x/z plane.
	const minX = box.x - box.width / 2 - margin;
	const maxX = box.x + box.width / 2 + margin;
	const minZ = box.z - box.depth / 2 - margin;
	const maxZ = box.z + box.depth / 2 + margin;
	let t0 = 0;
	let t1 = 1;
	const d = { x: b.x - a.x, z: b.z - a.z };
	for (const [p, dp, lo, hi] of [
		[a.x, d.x, minX, maxX],
		[a.z, d.z, minZ, maxZ],
	] as const) {
		if (Math.abs(dp) < 1e-9) {
			if (p < lo || p > hi) return false;
			continue;
		}
		let ta = (lo - p) / dp;
		let tb = (hi - p) / dp;
		if (ta > tb) [ta, tb] = [tb, ta];
		t0 = Math.max(t0, ta);
		t1 = Math.min(t1, tb);
		if (t0 > t1) return false;
	}
	return true;
}

export function isClear(a: Vec2, b: Vec2, margin = BODY_RADIUS): boolean {
	return !obstacles().some((box) => segmentHitsBox(a, b, box, margin));
}

/**
 * Waypoints from `from` to `to`. The flat is small and open, so a straight line
 * or a detour through the hub is enough - no general path finding yet.
 */
export function planPath(from: Vec2, to: Vec2): Vec2[] {
	if (isClear(from, to)) return [to];
	return [HUB, to];
}
