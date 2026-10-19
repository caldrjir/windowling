import { Bone, Group, Quaternion, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { Animator, type Pose } from './animation.ts';
import { HumanRig } from './human-rig.ts';
import { CHARACTER_LOOKS, characterModelUrl, lookFor } from './looks.ts';
import type { MotionClip, Motions } from './motions.ts';

/**
 * A skeleton shaped like the exported characters (bone names of MPFB's
 * "game_engine" rig): standing in an A-pose, arms 45 degrees out, facing +z.
 */
function skeleton(): Group {
	const model = new Group();
	const bone = (name: string, parent: Bone | Group, at: [number, number, number]) => {
		const b = new Bone();
		b.name = name;
		// Positions are given in model space; bones here have no rotation, so subtract the parent's.
		const parentAt =
			parent instanceof Bone ? parent.getWorldPosition(new Vector3()) : new Vector3();
		b.position.set(at[0] - parentAt.x, at[1] - parentAt.y, at[2] - parentAt.z);
		parent.add(b);
		b.updateMatrixWorld(true);
		return b;
	};
	const root = bone('Root', model, [0, 0, 0]);
	const pelvis = bone('pelvis', root, [0, 0.97, 0]);
	const s1 = bone('spine_01', pelvis, [0, 1.05, 0]);
	const s2 = bone('spine_02', s1, [0, 1.12, 0]);
	const s3 = bone('spine_03', s2, [0, 1.19, 0]);
	const neck = bone('neck_01', s3, [0, 1.54, 0]);
	const head = bone('head', neck, [0, 1.64, 0.04]);
	bone('head_end', head, [0, 1.8, 0.04]);
	for (const [side, x] of [
		['l', 1],
		['r', -1],
	] as const) {
		const clavicle = bone(`clavicle_${side}`, s3, [x * 0.02, 1.46, 0.03]);
		const upper = bone(`upperarm_${side}`, clavicle, [x * 0.2, 1.43, 0.02]);
		const lower = bone(`lowerarm_${side}`, upper, [x * 0.37, 1.24, 0.02]);
		const hand = bone(`hand_${side}`, lower, [x * 0.5, 1.11, 0.21]);
		bone(`index_01_${side}`, hand, [x * 0.53, 1.07, 0.32]);
		const thigh = bone(`thigh_${side}`, pelvis, [x * 0.11, 0.96, 0]);
		const calf = bone(`calf_${side}`, thigh, [x * 0.15, 0.52, 0.03]);
		const foot = bone(`foot_${side}`, calf, [x * 0.2, 0.07, 0.02]);
		bone(`ball_${side}`, foot, [x * 0.2, 0.01, 0.15]);
	}
	return model;
}

function pose(overrides: Partial<Pose> = {}): Pose {
	const animator = new Animator();
	return { ...animator.pose(), breath: 0, bob: 0, legSwing: 0, armSwing: 0, ...overrides };
}

const at = (rig: HumanRig, name: string): Vector3 => {
	let found: Vector3 | null = null;
	rig.root.updateMatrixWorld(true);
	rig.root.traverse((o) => {
		if (o.name === name) found = o.getWorldPosition(new Vector3());
	});
	if (!found) throw new Error(`no ${name}`);
	return found;
};
const direction = (rig: HumanRig, from: string, to: string) =>
	at(rig, to).sub(at(rig, from)).normalize();

describe('HumanRig', () => {
	const place = { x: 0, y: 0, z: 0, yaw: 0 };

	it('lets the arms hang at its sides instead of the model A-pose', () => {
		const rig = new HumanRig(skeleton());
		rig.apply(place, pose(), 0);
		for (const side of ['l', 'r']) {
			const upper = direction(rig, `upperarm_${side}`, `lowerarm_${side}`);
			expect(upper.y).toBeLessThan(-0.95); // down, not 45 degrees out
			const lower = direction(rig, `lowerarm_${side}`, `hand_${side}`);
			expect(lower.y).toBeLessThan(-0.9);
		}
		// Feet stay on the floor.
		expect(at(rig, 'ball_l').y).toBeCloseTo(0.01, 1);
	});

	it('sits: thighs forward, shins down, hips at the seat', () => {
		const rig = new HumanRig(skeleton());
		rig.apply({ ...place, y: 0.45 }, pose({ hipFlex: Math.PI / 2, knee: Math.PI / 2 }), 0);
		const thigh = direction(rig, 'thigh_l', 'calf_l');
		expect(thigh.z).toBeGreaterThan(0.95);
		const shin = direction(rig, 'calf_l', 'foot_l');
		expect(shin.y).toBeLessThan(-0.95);
		// The hips rest just above the seat.
		expect(at(rig, 'thigh_l').y - 0.45).toBeGreaterThan(0.05);
		expect(at(rig, 'thigh_l').y - 0.45).toBeLessThan(0.15);
		// Hands come down onto the lap, in front of the body.
		const hand = at(rig, 'hand_l');
		expect(hand.z).toBeGreaterThan(0.1);
		expect(hand.y).toBeLessThan(0.45 + 0.4);
	});

	it('lies on its back with the head towards the pillow (-z)', () => {
		const rig = new HumanRig(skeleton());
		rig.apply({ ...place, y: 0.6 }, pose({ lie: 1 }), 0);
		const head = at(rig, 'head');
		const foot = at(rig, 'foot_l');
		expect(head.z).toBeLessThan(foot.z - 1);
		expect(Math.abs(head.y - foot.y)).toBeLessThan(0.3);
	});

	it('turns its head to look around', () => {
		const rig = new HumanRig(skeleton());
		rig.apply(place, pose({ headYaw: 0.8 }), 0);
		const facing = direction(rig, 'head', 'head_end');
		expect(facing.y).toBeGreaterThan(0.9); // still upright
		const neutral = new HumanRig(skeleton());
		neutral.apply(place, pose(), 0);
		expect(at(rig, 'head').distanceTo(at(neutral, 'head'))).toBeLessThan(0.02);
	});

	it('raises an arm to wave', () => {
		const rig = new HumanRig(skeleton());
		rig.apply(place, pose({ wave: 1 }), 0);
		expect(at(rig, 'hand_l').y).toBeGreaterThan(at(rig, 'head').y);
		expect(at(rig, 'hand_r').y).toBeLessThan(1.2);
	});

	/**
	 * Motion capture: a T-pose take whose every frame holds the left arm straight
	 * down (a quarter turn about z from the T-pose) - played while it stands.
	 */
	const armDown = (): Motions => {
		const down = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), -Math.PI / 2).toArray();
		const still = (): MotionClip => ({
			duration: 1,
			loop: true,
			frames: 1,
			restDirections: { upperarm_l: [1, 0, 0], lowerarm_l: [1, 0, 0] },
			rotations: { upperarm_l: down, lowerarm_l: down },
			hips: [0, 0, 0],
		});
		return { fps: 30, clips: { idle: still(), walk: still() } };
	};

	it('plays motion capture while standing, lined up from its T-pose', () => {
		const rig = new HumanRig(skeleton(), armDown());
		rig.apply(place, pose({ walking: 1 }), 0);
		expect(direction(rig, 'upperarm_l', 'lowerarm_l').y).toBeLessThan(-0.99);
		expect(direction(rig, 'lowerarm_l', 'hand_l').y).toBeLessThan(-0.99);
	});

	it('sits procedurally (the furniture decides), even with motion capture', () => {
		const rig = new HumanRig(skeleton(), armDown());
		rig.apply({ ...place, y: 0.45 }, pose({ hipFlex: Math.PI / 2, knee: Math.PI / 2 }), 0);
		expect(direction(rig, 'thigh_l', 'calf_l').z).toBeGreaterThan(0.95);
		expect(at(rig, 'thigh_l').y - 0.45).toBeLessThan(0.15);
	});
});

describe('character looks', () => {
	it('gives every world one person, the same one every visit', () => {
		expect(lookFor('world-1')).toBe(lookFor('world-1'));
		const seen = new Set(Array.from({ length: 200 }, (_, i) => lookFor(`world-${String(i)}`).id));
		expect(seen.size).toBe(CHARACTER_LOOKS.length);
		expect(characterModelUrl(lookFor('world-1'))).toMatch(/^\/characters\/[a-z]+\.glb$/);
	});
});
