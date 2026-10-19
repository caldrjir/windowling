/**
 * Converts motion capture (BVH, CMU Graphics Lab Motion Capture Database via
 * the 2010 MotionBuilder-friendly conversion; free for any use) into the
 * motions the characters play: `apps/web/static/characters/motions.json`.
 *
 *   node packages/game/scripts/mocap.mjs <bvh dir> [out file]
 *
 * Every BVH starts in a T-pose. For each bone the output holds its T-pose
 * direction and, per frame, its rotation away from the T-pose in the
 * character's own space (facing +z, +x its left, y up). `HumanRig` lines its
 * own bones up with those directions and plays the rotations - one set of
 * motions for every body. The hips' height is kept relative to leg length.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AnimationMixer, Group, Quaternion, Vector3 } from 'three';
import { BVHLoader } from 'three/examples/jsm/loaders/BVHLoader.js';

const FPS = 30;

/** CMU joint -> the characters' (MPFB "game_engine") bone. */
const BONES = {
	Hips: 'pelvis',
	LowerBack: 'spine_01',
	Spine: 'spine_02',
	Spine1: 'spine_03',
	Neck: 'neck_01',
	Head: 'head',
	LeftShoulder: 'clavicle_l',
	LeftArm: 'upperarm_l',
	LeftForeArm: 'lowerarm_l',
	LeftHand: 'hand_l',
	RightShoulder: 'clavicle_r',
	RightArm: 'upperarm_r',
	RightForeArm: 'lowerarm_r',
	RightHand: 'hand_r',
	LeftUpLeg: 'thigh_l',
	LeftLeg: 'calf_l',
	LeftFoot: 'foot_l',
	LeftToeBase: 'ball_l',
	RightUpLeg: 'thigh_r',
	RightLeg: 'calf_r',
	RightFoot: 'foot_r',
	RightToeBase: 'ball_r',
};

/** Which way each joint points (its direction in the T-pose): from one joint to another. */
const POINTS_AT = {
	Hips: ['Hips', 'LowerBack'],
	LowerBack: ['LowerBack', 'Spine'],
	Spine: ['Spine', 'Spine1'],
	Spine1: ['Spine1', 'Head'],
	Neck: ['Neck', 'Head'],
	Head: ['Neck', 'Head'],
	LeftShoulder: ['LeftShoulder', 'LeftArm'],
	LeftArm: ['LeftArm', 'LeftForeArm'],
	LeftForeArm: ['LeftForeArm', 'LeftHand'],
	LeftHand: ['LeftHand', 'LeftHandIndex1'],
	RightShoulder: ['RightShoulder', 'RightArm'],
	RightArm: ['RightArm', 'RightForeArm'],
	RightForeArm: ['RightForeArm', 'RightHand'],
	RightHand: ['RightHand', 'RightHandIndex1'],
	LeftUpLeg: ['LeftUpLeg', 'LeftLeg'],
	LeftLeg: ['LeftLeg', 'LeftFoot'],
	LeftFoot: ['LeftFoot', 'LeftToeBase'],
	LeftToeBase: ['LeftFoot', 'LeftToeBase'],
	RightUpLeg: ['RightUpLeg', 'RightLeg'],
	RightLeg: ['RightLeg', 'RightFoot'],
	RightFoot: ['RightFoot', 'RightToeBase'],
	RightToeBase: ['RightFoot', 'RightToeBase'],
};

/**
 * The motions: which take, which part (seconds; `cycle` finds one gait cycle),
 * whether it loops.
 */
const CLIPS = {
	walk: { file: '16_15.bvh', cycle: true },
	idle: { file: '113_21.bvh', from: 1, to: 11, loop: true },
	wave: { file: '113_27.bvh', from: 0.6, to: 2.6, loop: true },
	sweep: { file: '143_28.bvh', from: 1.0, to: 4.6, loop: true },
	dance: { file: '143_35.bvh', from: 2, to: 10, loop: true },
	yawn: { file: '143_30.bvh', from: 0.3, to: 3.0, loop: false },
};

const round = (n) => Math.round(n * 10000) / 10000;

function load(file) {
	const { skeleton, clip } = new BVHLoader().parse(readFileSync(file, 'utf8'));
	const root = new Group();
	root.add(skeleton.bones[0]);
	const mixer = new AnimationMixer(root);
	mixer.clipAction(clip).play();
	const byName = new Map(skeleton.bones.map((b) => [b.name, b]));
	/** World rotations and positions of every joint at time `t`. */
	const at = (t) => {
		mixer.setTime(t);
		root.updateMatrixWorld(true);
		const out = new Map();
		for (const [name, bone] of byName) {
			out.set(name, {
				q: bone.getWorldQuaternion(new Quaternion()),
				p: bone.getWorldPosition(new Vector3()),
			});
		}
		return out;
	};
	const child = (name) => byName.get(name)?.children.find((c) => c.isBone)?.name ?? null;
	return { at, child, duration: clip.duration };
}

function convert(dir, spec) {
	const take = load(join(dir, spec.file));
	const rest = take.at(0);
	const p = (frame, name) => frame.get(name)?.p.clone() ?? new Vector3();
	// Turn the take so its T-pose faces +z with its left arm along +x.
	const left = p(rest, 'LeftForeArm').sub(p(rest, 'LeftArm')).setY(0).normalize();
	const G = new Quaternion().setFromUnitVectors(left, new Vector3(1, 0, 0));
	const legLength =
		p(rest, 'LeftUpLeg').distanceTo(p(rest, 'LeftLeg')) +
		p(rest, 'LeftLeg').distanceTo(p(rest, 'LeftFoot'));
	const restHip = p(rest, 'Hips').y;

	// The part to keep.
	let from = spec.from ?? 0;
	let to = spec.to ?? take.duration;
	if (spec.cycle) [from, to] = gaitCycle(take, G);
	const frames = Math.max(2, Math.round((to - from) * FPS));

	// Heading: walking goes along +z; anything else faces +z at its start.
	const start = take.at(from);
	const end = take.at(to);
	let heading;
	if (spec.cycle) {
		const travel = p(end, 'Hips').sub(p(start, 'Hips')).applyQuaternion(G);
		heading = Math.atan2(travel.x, travel.z);
	} else {
		const facing = new Vector3(0, 0, 1).applyQuaternion(
			G.clone()
				.multiply(start.get('Hips').q)
				.multiply(rest.get('Hips').q.clone().invert())
				.multiply(G.clone().invert()),
		);
		heading = Math.atan2(facing.x, facing.z);
	}
	const H = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), -heading);
	const turn = H.clone().multiply(G);

	const restDirections = {};
	for (const [joint, bone] of Object.entries(BONES)) {
		const [from, to] = POINTS_AT[joint] ?? [joint, take.child(joint) ?? joint];
		const d = p(rest, to).sub(p(rest, from));
		if (d.length() < 1e-6) d.set(0, 1, 0);
		d.normalize().applyQuaternion(G);
		restDirections[bone] = d.toArray().map(round);
	}

	const rotations = Object.fromEntries(Object.values(BONES).map((b) => [b, []]));
	const hips = [];
	// In the T-pose the hips are right above the middle of the feet (or nearly).
	const restOver = p(rest, 'Hips')
		.sub(p(rest, 'LeftFoot').add(p(rest, 'RightFoot')).multiplyScalar(0.5))
		.applyQuaternion(G);
	for (let i = 0; i < frames; i++) {
		const t = from + ((to - from) * i) / (spec.loop || spec.cycle ? frames : frames - 1);
		const frame = take.at(t);
		for (const [joint, bone] of Object.entries(BONES)) {
			// Away from the T-pose, in the character's space: turn * (W * W0^-1) * G^-1.
			const delta = frame.get(joint).q.clone().multiply(rest.get(joint).q.clone().invert());
			const q = turn.clone().multiply(delta).multiply(G.clone().invert());
			rotations[bone].push(...[q.x, q.y, q.z, q.w].map(round));
		}
		// Hips: height above the T-pose stance; over the feet sideways and forward
		// (where the weight is), without the travel.
		const hip = p(frame, 'Hips').applyQuaternion(turn);
		const feet = p(frame, 'LeftFoot')
			.add(p(frame, 'RightFoot'))
			.multiplyScalar(0.5)
			.applyQuaternion(turn);
		hips.push(
			round((hip.x - feet.x - restOver.x) / legLength),
			round((hip.y - restHip) / legLength),
			round(spec.cycle ? 0 : (hip.z - feet.z - restOver.z) / legLength),
		);
	}
	return {
		duration: round(to - from),
		loop: Boolean(spec.loop || spec.cycle),
		frames,
		restDirections,
		rotations,
		hips,
	};
}

/** One full gait cycle in the middle of a walk: between two strikes of the left heel. */
function gaitCycle(take, G) {
	const strikes = [];
	let previous = null;
	let rising = false;
	const step = 1 / 120;
	for (let t = take.duration * 0.25; t < take.duration * 0.9; t += step) {
		const f = take.at(t);
		const ahead = f.get('LeftFoot').p.clone().sub(f.get('Hips').p).applyQuaternion(G);
		const travel = take
			.at(t + 0.05)
			.get('Hips')
			.p.clone()
			.sub(f.get('Hips').p)
			.applyQuaternion(G)
			.setY(0)
			.normalize();
		const lead = ahead.dot(travel);
		if (previous !== null) {
			if (lead < previous && rising) strikes.push(t - step);
			rising = lead > previous;
		}
		previous = lead;
		if (strikes.length === 2) break;
	}
	if (strikes.length < 2) throw new Error('No gait cycle found');
	return strikes;
}

const [dir, out = 'apps/web/static/characters/motions.json'] = process.argv.slice(2);
if (!dir) throw new Error('Usage: node packages/game/scripts/mocap.mjs <bvh dir> [out]');
const motions = { fps: FPS, clips: {} };
for (const [name, spec] of Object.entries(CLIPS)) {
	motions.clips[name] = convert(dir, spec);
	console.log(name, motions.clips[name].duration, 's', motions.clips[name].frames, 'frames');
}
writeFileSync(out, JSON.stringify(motions));
console.log('wrote', out, Math.round(JSON.stringify(motions).length / 1024), 'KiB');
