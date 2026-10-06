import { describe, expect, it } from 'vitest';
import { EARTH, ShakeDetector, smoothGravity, tiltToGravity } from './motion';

const rest = { beta: 60, gamma: 0 };

describe('tiltToGravity', () => {
	it('points straight down when held as at the start', () => {
		const g = tiltToGravity(rest, rest);
		expect(g.x).toBeCloseTo(0, 6);
		expect(g.z).toBeCloseTo(0, 6);
		expect(g.y).toBeCloseTo(-EARTH, 6);
	});

	it('rolling the right edge down sends things right', () => {
		expect(tiltToGravity({ beta: 60, gamma: 20 }, rest).x).toBeGreaterThan(3);
		expect(tiltToGravity({ beta: 60, gamma: -20 }, rest).x).toBeLessThan(-3);
	});

	it('tipping the top away sends things to the back wall', () => {
		expect(tiltToGravity({ beta: 40, gamma: 0 }, rest).z).toBeLessThan(-3);
	});

	it('keeps the full strength of gravity and clamps extreme tilts', () => {
		const g = tiltToGravity({ beta: -120, gamma: 89 }, rest);
		expect(Math.hypot(g.x, g.y, g.z)).toBeCloseTo(EARTH, 5);
		expect(g.y).toBeLessThan(-EARTH * 0.55);
	});

	it('follows the screen into landscape', () => {
		// Landscape (90°): tilting "right" on screen is a change in beta.
		expect(tiltToGravity({ beta: 80, gamma: 0 }, rest, 90).x).toBeGreaterThan(3);
		expect(tiltToGravity({ beta: 60, gamma: 20 }, rest, 90).x).toBeCloseTo(0, 6);
	});
});

describe('smoothGravity', () => {
	it('moves part of the way towards the new reading', () => {
		const s = smoothGravity({ x: 0, y: -10, z: 0 }, { x: 10, y: -10, z: 0 }, 0.5);
		expect(s.x).toBe(5);
	});
});

describe('ShakeDetector', () => {
	const jolt = (m: number) => ({ x: m, y: 0, z: 0 });

	it('ignores a single bump and gentle movement', () => {
		const d = new ShakeDetector();
		expect(d.sample(jolt(20), 0)).toBeNull();
		for (let t = 20; t < 2000; t += 20) expect(d.sample(jolt(3), t)).toBeNull();
	});

	it('detects several jolts within a second, once', () => {
		const d = new ShakeDetector();
		const results: Array<number | null> = [];
		for (let i = 0; i < 6; i++) {
			results.push(d.sample(jolt(25), i * 150));
			results.push(d.sample(jolt(1), i * 150 + 75));
		}
		const shakes = results.filter((r) => r !== null);
		expect(shakes).toHaveLength(1);
		expect(shakes[0]).toBeGreaterThan(0.5);
	});

	it('rates harder shakes as more intense', () => {
		const rate = (m: number) => {
			const d = new ShakeDetector();
			let found: number | null = null;
			for (let i = 0; i < 4 && found === null; i++) {
				found = d.sample(jolt(m), i * 150) ?? d.sample(jolt(0), i * 150 + 75);
			}
			return found ?? 0;
		};
		expect(rate(30)).toBeGreaterThan(rate(14));
	});
});
