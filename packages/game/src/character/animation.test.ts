import { describe, expect, it } from 'vitest';
import { Animator } from './animation.ts';

function settle(a: Animator, seconds: number, speed = 0) {
	for (let t = 0; t < seconds; t += 1 / 60) a.update(1 / 60, speed);
}

describe('Animator', () => {
	it('crossfades instead of popping', () => {
		const a = new Animator();
		a.setState('sit');
		a.update(1 / 60);
		expect(a.weight('sit')).toBeGreaterThan(0);
		expect(a.weight('sit')).toBeLessThan(0.2);
		settle(a, 1);
		expect(a.weight('sit')).toBe(1);
		expect(a.weight('idle')).toBe(0);
	});

	it('bends knees and hips when sitting', () => {
		const a = new Animator();
		a.setState('sit');
		settle(a, 1);
		const pose = a.pose();
		expect(pose.knee).toBeCloseTo(Math.PI / 2, 2);
		expect(pose.hipFlex).toBeCloseTo(Math.PI / 2, 2);
	});

	it('swings legs only while walking', () => {
		const a = new Animator();
		settle(a, 1);
		expect(Math.abs(a.pose().legSwing)).toBeLessThan(1e-6);
		a.setState('walk');
		let maxSwing = 0;
		for (let i = 0; i < 120; i++) {
			a.update(1 / 60, 1.1);
			maxSwing = Math.max(maxSwing, Math.abs(a.pose().legSwing));
		}
		expect(maxSwing).toBeGreaterThan(0.3);
	});

	it('lies fully when in the lie state', () => {
		const a = new Animator();
		a.setState('lie');
		settle(a, 1);
		expect(a.pose().lie).toBe(1);
	});
});
