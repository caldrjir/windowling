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

	it('gets into bed like a person: leans back first, legs up later, then stretches out', () => {
		const a = new Animator();
		a.setState('sit');
		settle(a, 1);
		a.setState('lie', 1);
		// A quarter of the way: leaning back, the legs still hanging off the edge.
		settle(a, 0.25);
		const early = a.pose();
		expect(early.lie).toBeGreaterThan(0.2); // reclining
		expect(early.knee).toBeCloseTo(Math.PI / 2, 1); // feet still down
		// Halfway through the swing: knees bent, thighs raised to clear the bed.
		settle(a, 0.35);
		const swinging = a.pose();
		expect(swinging.knee).toBeGreaterThan(0.6);
		expect(swinging.knee).toBeLessThan(Math.PI / 2);
		// In bed: flat, legs (almost) straight.
		settle(a, 1);
		expect(a.pose().lie).toBe(1);
		expect(a.pose().knee).toBeLessThan(0.1);
	});

	it('layers activities on top of the body and fades them in', () => {
		const a = new Animator();
		a.setState('sit');
		a.setActivity('play');
		a.update(1 / 60);
		expect(a.activityWeight('play')).toBeLessThan(0.2);
		settle(a, 1);
		const pose = a.pose();
		expect(a.activityWeight('play')).toBe(1);
		expect(pose.handheld).toBe(1);
		expect(pose.bowl).toBe(0);
		expect(pose.armForward).toBeGreaterThan(0.5);
		expect(pose.hipFlex).toBeCloseTo(Math.PI / 2, 2);
	});

	it('brings food to the mouth now and then while eating', () => {
		const a = new Animator();
		a.setActivity('eat');
		let maxLift = 0;
		let minLift = 1;
		for (let i = 0; i < 60 * 8; i++) {
			a.update(1 / 60);
			if (i > 60) {
				maxLift = Math.max(maxLift, a.pose().handToMouth);
				minLift = Math.min(minLift, a.pose().handToMouth);
			}
		}
		expect(maxLift).toBeGreaterThan(0.9);
		expect(minLift).toBeLessThan(0.05);
	});

	it('slumps and looks down when sad', () => {
		const happy = new Animator();
		const sad = new Animator();
		happy.setMood(0.9);
		sad.setMood(0.1);
		expect(sad.pose().slump).toBeGreaterThan(happy.pose().slump);
		expect(sad.pose().headPitch).toBeGreaterThan(happy.pose().headPitch);
	});

	it('moves the mouth only while speaking', () => {
		const a = new Animator();
		settle(a, 0.5);
		expect(a.pose().mouth).toBe(0);
		a.setSpeaking(true);
		let max = 0;
		for (let i = 0; i < 60; i++) {
			a.update(1 / 60);
			max = Math.max(max, a.pose().mouth);
		}
		expect(max).toBeGreaterThan(0.4);
		a.setSpeaking(false);
		settle(a, 1);
		expect(a.pose().mouth).toBe(0);
	});

	it('shows an emotion for a while, then lets it fade', () => {
		const a = new Animator();
		const calm = a.pose().headPitch;
		a.showEmotion('sad', 1);
		settle(a, 1);
		expect(a.pose().headPitch).toBeGreaterThan(calm + 0.2);
		settle(a, 8);
		expect(a.pose().headPitch).toBeCloseTo(calm, 2);
	});

	it('dances: bouncing and swaying, then stops cleanly', () => {
		const a = new Animator();
		a.setActivity('dance');
		let sway = 0;
		let bob = 0;
		for (let i = 0; i < 120; i++) {
			a.update(1 / 60);
			sway = Math.max(sway, Math.abs(a.pose().sway));
			bob = Math.max(bob, a.pose().bob);
		}
		expect(sway).toBeGreaterThan(0.05);
		expect(bob).toBeGreaterThan(0.03);
		a.setActivity('none');
		settle(a, 1);
		expect(Math.abs(a.pose().sway)).toBeLessThan(1e-6);
	});

	it('plays moments over the activity: singing moves the lips, cheering raises an arm', () => {
		const a = new Animator();
		a.setActivity('cook');
		a.setMoment('sing');
		let mouth = 0;
		for (let i = 0; i < 120; i++) {
			a.update(1 / 60);
			mouth = Math.max(mouth, a.pose().mouth);
		}
		expect(mouth).toBeGreaterThan(0.3);
		expect(a.activityWeight('cook')).toBe(1);
		a.setMoment('cheer');
		settle(a, 1);
		expect(a.pose().wave).toBe(1);
		a.setMoment(null);
		settle(a, 1);
		expect(a.momentWeight('cheer')).toBe(0);
		expect(a.pose().wave).toBe(0);
	});

	it('nods off while dozing', () => {
		const a = new Animator();
		a.setState('sit');
		settle(a, 1);
		a.setMoment('doze');
		let pitch = 0;
		for (let i = 0; i < 6 * 60; i++) {
			a.update(1 / 60);
			pitch = Math.max(pitch, a.pose().headPitch);
		}
		expect(pitch).toBeGreaterThan(0.4);
	});
});
