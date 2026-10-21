import {
	Bone,
	DoubleSide,
	Euler,
	Group,
	Mesh,
	MeshStandardMaterial,
	Quaternion,
	SkinnedMesh,
	Vector3,
	type Material,
	type Object3D,
} from 'three';
import type { Pose } from './animation.ts';
import type { CharacterSnapshot } from './controller.ts';
import { HeldProps } from './held-props.ts';
import {
	sampleHips,
	sampleRotation,
	type MotionClip,
	type MotionName,
	type Motions,
} from './motions.ts';

/**
 * A realistic person: a MakeHuman model (tools/character) skinned to the
 * "game_engine" skeleton, driven by the same poses as the placeholder rig.
 *
 * Two sources move it, blended bone by bone:
 * - motion capture (`motions.ts`) while it stands, walks, waves, sweeps or
 *   dances: real people's movement - weight shifts, heel-to-toe steps, swinging hips;
 * - procedural poses for what has to fit the flat exactly (sitting on its
 *   chair, lying in its bed, hands on a keyboard), and for looking around.
 *
 * Procedural poses are rotations in the character's own space (it faces +z,
 * +x is its left, y is up), applied at the joints: a thigh swings about x at
 * the hip, a knee bends about x. The model is authored in an A-pose, so arms
 * and legs are first brought to hang naturally; the pose moves them from there.
 */

const X = new Vector3(1, 0, 0);

/** Model space directions the limbs hang in when relaxed (left side; mirrored for right). */
const HANG = {
	upperarm: new Vector3(0.1, -1, -0.02),
	lowerarm: new Vector3(0.04, -1, 0.12),
	thigh: new Vector3(0.03, -1, 0.02),
	calf: new Vector3(0.03, -1, -0.02),
} as const;

/** Relaxed fingers bend this much at each joint (radians). */
const FINGER_CURL = 0.35;

/** How long a blink takes (seconds). */
const BLINK_SECONDS = 0.15;

/** Thigh joints sit this far above the seat when sitting (the buttocks). */
const SEATED_HIP = 0.1;

/** The bones the rig moves, each after its parent. */
const CHAIN: readonly (readonly [string, string | null])[] = [
	['pelvis', null],
	['spine_01', 'pelvis'],
	['spine_02', 'spine_01'],
	['spine_03', 'spine_02'],
	['neck_01', 'spine_03'],
	['head', 'neck_01'],
	...(['l', 'r'] as const).flatMap(
		(s) =>
			[
				[`clavicle_${s}`, 'spine_03'],
				[`upperarm_${s}`, `clavicle_${s}`],
				[`lowerarm_${s}`, `upperarm_${s}`],
				[`hand_${s}`, `lowerarm_${s}`],
				[`thigh_${s}`, 'pelvis'],
				[`calf_${s}`, `thigh_${s}`],
				[`foot_${s}`, `calf_${s}`],
				[`ball_${s}`, `foot_${s}`],
			] as const,
	),
];

const ARMS = /^(clavicle|upperarm|lowerarm|hand)_/;
const AXIAL = new Set(['pelvis', 'spine_01', 'spine_02', 'spine_03', 'neck_01', 'head']);
const LEGS = /^(thigh|calf|foot|ball)_/;

interface Joint {
	bone: Bone;
	/** Direction from the joint to its child at rest (model space), if it has one. */
	direction: Vector3 | null;
	/** Rest rotation of the bone in model space. */
	rest: Quaternion;
	/** Rest rotation of its parent in model space. */
	parentRest: Quaternion;
	/** Brings the bone from the A-pose to hanging (model space). */
	fix: Quaternion;
}

const q = (axis: Vector3, angle: number) => new Quaternion().setFromAxisAngle(axis, angle);

/** Material names (from MakeHuman's assets) that are cut-outs: hair cards, brows, lashes. */
const CUT_OUT = /hair|brow|lash|short|bob|long|ponytail|braid|afro/i;
const EYES = /high-poly|low-poly|eye/i;

/**
 * Wraps a loaded character model (e.g. a glTF scene). Pure visualisation: it
 * receives a pose and a transform and applies them.
 */
export class HumanRig {
	readonly root = new Group();
	/** Pivots the whole body: lying down, swaying. */
	private readonly body = new Group();
	private readonly joints = new Map<string, Joint>();
	/** Per motion and bone: lines the bone up with the motion's T-pose. */
	private readonly motionFixes = new Map<MotionName, Map<string, Quaternion>>();
	private readonly motions: Motions | null;
	/** Hip joint to ankle, to scale the motions' hip movement to this body. */
	private readonly legLength: number;
	/** The pelvis's parent's rest rotation, inverted (to move the hips in model space). */
	private readonly pelvisParentInverse: Quaternion;
	private readonly pelvis: Bone;
	private readonly pelvisRest: Vector3;
	private readonly restHip: number;
	private readonly props = new HeldProps();
	private readonly morphs: { mesh: Mesh; index: Record<string, number> }[] = [];
	private readonly owned: Material[] = [];
	private nextBlink = 0;

	constructor(model: Object3D, motions: Motions | null = null) {
		this.motions = motions;
		this.root.name = 'character';
		this.root.add(this.body);
		this.body.add(model);
		model.updateMatrixWorld(true);

		const bones = new Map<string, Bone>();
		model.traverse((o) => {
			if (o instanceof Bone) bones.set(o.name, o);
			if (o instanceof SkinnedMesh) this.prepareMesh(o);
		});
		const bone = (name: string): Bone => {
			const found = bones.get(name);
			if (!found) throw new Error(`Character model has no bone "${name}"`);
			return found;
		};

		const pelvis = bone('pelvis');
		this.pelvis = pelvis;
		this.pelvisRest = pelvis.position.clone();
		const parentRest = pelvis.parent
			? pelvis.parent.getWorldQuaternion(new Quaternion())
			: new Quaternion();
		this.pelvisParentInverse = parentRest.clone().invert();
		this.restHip = pelvis.getWorldPosition(new Vector3()).y;

		const at = (name: string) => bone(name).getWorldPosition(new Vector3());
		const restDirection = (b: Bone): Vector3 | null => {
			// A hand points along its middle finger.
			const child =
				b.children.find((c): c is Bone => c instanceof Bone && c.name.startsWith('middle_')) ??
				b.children.find((c): c is Bone => c instanceof Bone);
			if (!child) return null;
			return child
				.getWorldPosition(new Vector3())
				.sub(b.getWorldPosition(new Vector3()))
				.normalize();
		};
		const hang: Record<string, Vector3> = {};
		for (const side of ['l', 'r'] as const) {
			const mirror = (v: Vector3) => (side === 'l' ? v.clone() : new Vector3(-v.x, v.y, v.z));
			hang[`upperarm_${side}`] = mirror(HANG.upperarm);
			hang[`lowerarm_${side}`] = mirror(HANG.lowerarm);
			hang[`thigh_${side}`] = mirror(HANG.thigh);
			hang[`calf_${side}`] = mirror(HANG.calf);
		}
		for (const [name] of CHAIN) {
			const b = bone(name);
			const rest = b.getWorldQuaternion(new Quaternion());
			const parentRestQ = b.parent
				? b.parent.getWorldQuaternion(new Quaternion())
				: new Quaternion();
			const direction = restDirection(b);
			const target = hang[name];
			const fix =
				target && direction
					? new Quaternion().setFromUnitVectors(direction, target.clone().normalize())
					: new Quaternion();
			this.joints.set(name, { bone: b, direction, rest, parentRest: parentRestQ, fix });
		}
		this.legLength = at('thigh_l').distanceTo(at('calf_l')) + at('calf_l').distanceTo(at('foot_l'));

		for (const [clipName, clip] of Object.entries(motions?.clips ?? {})) {
			// Down each chain: a bone first turns with its parent (so the twist of an arm
			// carries on to the hand), then swings onto the motion's T-pose direction.
			const fixes = new Map<string, Quaternion>();
			for (const [name, parentName] of CHAIN) {
				const joint = this.joints.get(name);
				if (!joint) continue;
				const inherited = (parentName && fixes.get(parentName)?.clone()) || new Quaternion();
				const source = clip.restDirections[name];
				// The trunk stands upright in both rest poses: its bones correspond as they
				// are (their directions differ by anatomy, not by pose). Limbs line up.
				const fix =
					joint.direction && source && !AXIAL.has(name)
						? new Quaternion()
								.setFromUnitVectors(
									joint.direction.clone().applyQuaternion(inherited),
									new Vector3(...source).normalize(),
								)
								.multiply(inherited)
						: inherited;
				fixes.set(name, fix);
			}
			this.motionFixes.set(clipName as MotionName, fixes);
		}

		// Relaxed hands: fingers curl a little (the model's rest pose has them straight).
		for (const [name, b] of bones) {
			const finger = /^(index|middle|ring|pinky)_0\d_[lr]$/.exec(name);
			const thumb = /^thumb_0[23]_[lr]$/.exec(name);
			if (finger || thumb) b.quaternion.multiply(q(X, finger ? FINGER_CURL : FINGER_CURL / 2));
		}

		// Props move with the chest and the head, placed where the placeholder had them.
		this.attach(this.props.chest, bone('spine_03'), new Vector3(0, 1.01, 0));
		this.attach(this.props.head, bone('head'), new Vector3(0, 1.59, 0));
	}

	/** Puts `group` on `bone` so that at rest it sits at `at` (model space), axes aligned with the model. */
	private attach(group: Group, bone: Bone, at: Vector3): void {
		const boneRest = bone.getWorldQuaternion(new Quaternion());
		const bonePosition = bone.getWorldPosition(new Vector3());
		const inverse = boneRest.clone().invert();
		group.quaternion.copy(inverse);
		group.position.copy(at.clone().sub(bonePosition).applyQuaternion(inverse));
		bone.add(group);
	}

	/** Opaque skin and clothes, cut-out hair, shadows; morph targets for the face. */
	private prepareMesh(mesh: SkinnedMesh): void {
		mesh.castShadow = true;
		mesh.receiveShadow = true;
		// The body bends far from its rest bounds (lying, sitting): never cull it.
		mesh.frustumCulled = false;
		const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
		for (const material of materials) {
			if (!(material instanceof MeshStandardMaterial)) continue;
			material.transparent = false;
			material.depthWrite = true;
			material.metalness = 0;
			if (EYES.test(mesh.name)) {
				// The cornea is a glossy shell around the iris.
				material.transparent = true;
				material.depthWrite = false;
				material.roughness = 0.15;
			} else if (CUT_OUT.test(mesh.name)) {
				material.alphaTest = 0.35;
				material.side = DoubleSide;
				material.roughness = 0.8;
			} else {
				material.alphaTest = 0;
				material.opacity = 1;
				material.roughness = Math.max(material.roughness, 0.55);
			}
			this.owned.push(material);
		}
		if (mesh.morphTargetDictionary && mesh.morphTargetInfluences) {
			this.morphs.push({ mesh, index: mesh.morphTargetDictionary });
		}
	}

	/** Sets a face morph (e.g. "jawOpen", "blink") on every mesh that has it. */
	private morph(name: string, value: number): void {
		for (const { mesh, index } of this.morphs) {
			const i = index[name];
			if (i !== undefined && mesh.morphTargetInfluences) mesh.morphTargetInfluences[i] = value;
		}
	}

	/** Procedural: model-space `delta` at joint `name`, on top of its A-pose fix (into `out`). */
	private pose(
		out: Map<string, Quaternion>,
		name: string,
		delta: Quaternion,
		parent: Quaternion,
	): Quaternion {
		const joint = this.joints.get(name);
		if (!joint) return parent;
		const world = delta.clone().multiply(joint.fix);
		out.set(name, world);
		return world;
	}

	/** Motion capture: the clip's rotation of every bone at `time`, blended into `out` by `weight`. */
	private play(
		out: Map<string, Quaternion>,
		name: MotionName,
		time: number,
		weight: number,
		only?: RegExp,
	): void {
		const clip = this.motions?.clips[name];
		const fixes = this.motionFixes.get(name);
		if (!clip || !fixes || weight <= 0) return;
		const delta = new Quaternion();
		for (const [bone, fix] of fixes) {
			if (only && !only.test(bone)) continue;
			if (!sampleRotation(clip, bone, time, delta)) continue;
			const world = delta.clone().multiply(fix);
			const current = out.get(bone);
			out.set(bone, current && weight < 1 ? current.slerp(world, weight) : world);
		}
	}

	private hips(clip: MotionClip | undefined, time: number, weight: number, into: Vector3): void {
		if (!clip || weight <= 0) return;
		const offset = sampleHips(clip, time, new Vector3()).multiplyScalar(this.legLength);
		into.lerp(offset, weight);
	}

	/** Applies a world transform and a pose. Called once per rendered frame. */
	apply(
		state: Pick<CharacterSnapshot, 'x' | 'y' | 'z' | 'yaw'>,
		pose: Pose,
		now = performance.now() / 1000,
	): void {
		this.root.position.set(state.x, state.y, state.z);
		this.root.rotation.y = state.yaw;

		const sit = Math.min(1, pose.hipFlex / (Math.PI / 2));
		// Off its feet: sitting, lying, or between the two (leaning back, the hips flex less).
		const down = Math.min(1, sit + pose.lie);
		// Lying: the whole body turns back so the head points to the pillow (-z).
		this.body.rotation.set((-Math.PI / 2) * pose.lie, 0, pose.sway);

		// --- Procedural pose (fits furniture; hands at work; looking around).
		const proc = new Map<string, Quaternion>();
		// Spine: leaning back while seated, slumping, propped up in bed - spread over three joints.
		const lean = (-0.18 * sit + pose.slump + 0.3 * pose.lie) / 3;
		const breath = pose.breath * 0.012;
		let chest = new Quaternion();
		chest = this.pose(proc, 'spine_01', chest.clone().multiply(q(X, lean)), chest);
		chest = this.pose(proc, 'spine_02', chest.clone().multiply(q(X, lean - breath)), chest);
		chest = this.pose(proc, 'spine_03', chest.clone().multiply(q(X, lean + breath)), chest);
		const look = (share: number) =>
			new Quaternion().setFromEuler(new Euler(pose.headPitch * share, pose.headYaw * share, 0));
		const neck = this.pose(proc, 'neck_01', chest.clone().multiply(look(0.4)), chest);
		this.pose(proc, 'head', neck.clone().multiply(look(0.6)), neck);

		const busy = Math.min(1, pose.armForward / 0.6);
		for (const side of ['r', 'l'] as const) {
			// The placeholder's sides: +1 for the right (x < 0), -1 for the left.
			const s = side === 'r' ? 1 : -1;
			const mouth = side === 'l' ? pose.handToMouth : 0;
			const wave = side === 'l' ? pose.wave : 0;
			const thigh = this.pose(
				proc,
				`thigh_${side}`,
				q(X, -s * pose.legSwing - pose.hipFlex),
				new Quaternion(),
			);
			this.pose(
				proc,
				`calf_${side}`,
				thigh
					.clone()
					.multiply(this.unfix(`thigh_${side}`))
					.multiply(q(X, pose.knee)),
				thigh,
			);

			const armX =
				(s * pose.armSwing - sit * 0.3 * (1 - busy) - pose.armForward - mouth * 0.35) * (1 - wave) -
				wave * 2.7 -
				pose.startle * 0.4;
			// Seated, the hands come in to rest on the thighs.
			const armZ =
				-s * (-busy * 0.3 - sit * 0.12) * (1 - wave) -
				s * wave * (0.25 + pose.waveSwing * 0.35) -
				s * pose.startle * 1.1;
			const arm = new Quaternion().setFromEuler(new Euler(armX, 0, armZ));
			const upper = this.pose(proc, `upperarm_${side}`, chest.clone().multiply(arm), chest);
			const elbow =
				(-0.15 - sit * 0.6 * (1 - busy) - pose.elbow - mouth * 1.4) * (1 - wave) - wave * 0.5;
			this.pose(
				proc,
				`lowerarm_${side}`,
				upper
					.clone()
					.multiply(this.unfix(`upperarm_${side}`))
					.multiply(q(X, elbow)),
				upper,
			);
		}

		// --- Motion capture, standing: idle, walking, sweeping, dancing, waving.
		const mocap = new Map<string, Quaternion>();
		const hip = new Vector3();
		const clips = this.motions?.clips;
		const standing = this.motions ? 1 - down : 0;
		if (standing > 0 && clips) {
			const walk = clips.walk;
			const gaitTime = pose.gait * (walk?.duration ?? 1);
			this.play(mocap, 'idle', now, 1);
			this.hips(clips.idle, now, 1, hip);
			this.play(mocap, 'sweep', now, pose.broom);
			this.hips(clips.sweep, now, pose.broom, hip);
			this.play(mocap, 'dance', now, pose.dancing);
			this.hips(clips.dance, now, pose.dancing, hip);
			this.play(mocap, 'walk', gaitTime, pose.walking);
			this.hips(walk, gaitTime, pose.walking, hip);
			this.play(mocap, 'wave', now, pose.wave, ARMS);
		}

		// How much each part follows the motion capture rather than the procedural pose.
		const handsBusy = Math.min(
			1,
			(pose.armForward / 0.3) * (1 - pose.broom) * (1 - pose.dancing) +
				pose.handToMouth +
				pose.startle * 2,
		);
		const looking = Math.min(1, (Math.abs(pose.headYaw) + Math.abs(pose.headPitch)) * 3);
		// Standing still, the captured fidgeting is toned down (half of it reads as alive,
		// all of it as restless); the head is its own, looking around.
		const moving = Math.min(1, pose.walking + pose.dancing + pose.broom + pose.wave);
		const calm = 0.55 + 0.45 * moving;
		// Crouching (squats, unpacking a parcel): the legs are the pose's, not the captured stance.
		const crouch = Math.min(1, Math.max(0, (pose.knee - 0.4) / 0.6)) * (1 - pose.walking);
		const follow = (name: string): number => {
			if (LEGS.test(name) || name === 'pelvis') return standing * calm * (1 - crouch);
			if (ARMS.test(name)) return standing * calm * (1 - handsBusy * (1 - pose.wave));
			if (name === 'neck_01' || name === 'head') return standing * moving * (1 - looking);
			return standing * calm * (1 - handsBusy * 0.5);
		};

		// --- Blend and pose the skeleton, parents first.
		const world = new Map<string, Quaternion>();
		for (const [name, parentName] of CHAIN) {
			const joint = this.joints.get(name);
			if (!joint) continue;
			const parent = parentName ? (world.get(parentName) ?? new Quaternion()) : new Quaternion();
			const a = proc.get(name) ?? parent;
			const b = mocap.get(name) ?? parent;
			const w = mocap.has(name) ? follow(name) : 0;
			const blended = w <= 0 ? a.clone() : w >= 1 ? b.clone() : a.clone().slerp(b, w);
			world.set(name, blended);
			// local = (parentWorld * parentRest)^-1 * (world * rest)
			joint.bone.quaternion.copy(
				parent
					.clone()
					.multiply(joint.parentRest)
					.invert()
					.multiply(blended.clone().multiply(joint.rest)),
			);
		}

		// Hips: seated or lying they rest just above the surface the root is placed on;
		// standing they move as captured.
		const procHip = new Vector3(
			0,
			(this.restHip + pose.bob) * (1 - down) + SEATED_HIP * down - this.restHip,
			0,
		);
		const offset = procHip.lerp(hip, standing * calm * (1 - crouch));
		this.pelvis.position
			.copy(this.pelvisRest)
			.add(offset.applyQuaternion(this.pelvisParentInverse));

		// Face: talking opens the jaw; the eyes blink every few seconds, and close in bed.
		this.morph('jawOpen', pose.mouth * 0.7);
		this.morph(
			'blink',
			Math.max(this.blink(now), Math.min(1, Math.max(0, (pose.lie - 0.6) / 0.3))),
		);
		this.props.update(pose);
	}

	/** 0 open .. 1 closed: a quick blink (about 0.15 s) every 2-6 seconds. */
	private blink(now: number): number {
		if (now >= this.nextBlink + BLINK_SECONDS) this.nextBlink = now + 2 + Math.random() * 4;
		const t = (now - this.nextBlink) / BLINK_SECONDS;
		return t < 0 || t > 1 ? 0 : Math.sin(t * Math.PI);
	}

	/** The inverse of a joint's A-pose fix (so a child's pose is relative to the hanging limb). */
	private unfix(name: string): Quaternion {
		return this.joints.get(name)?.fix.clone().invert() ?? new Quaternion();
	}

	dispose(): void {
		this.props.dispose();
		this.root.traverse((o) => {
			if (o instanceof Mesh) o.geometry.dispose();
		});
		for (const material of this.owned) {
			if (material instanceof MeshStandardMaterial) {
				material.map?.dispose();
				material.normalMap?.dispose();
				material.roughnessMap?.dispose();
			}
			material.dispose();
		}
	}
}
