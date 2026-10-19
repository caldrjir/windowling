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

/**
 * A realistic person: a MakeHuman model (tools/character) skinned to the
 * "game_engine" skeleton, driven by the same poses as the placeholder rig.
 *
 * Poses are rotations in the character's own space (it faces +z, +x is its
 * left, y is up), applied at the joints: a thigh swings about x at the hip,
 * a knee bends about x. The model is authored in an A-pose, so arms and legs
 * are first brought to hang naturally; the pose then moves them from there.
 */

const X = new Vector3(1, 0, 0);
const Y = new Vector3(0, 1, 0);

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

interface Joint {
	bone: Bone;
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
	private readonly pelvis: Bone;
	private readonly pelvisRest: Vector3;
	/** Model space up, expressed in the pelvis's parent space (for moving the hips). */
	private readonly pelvisUp: Vector3;
	private readonly restHip: number;
	private readonly props = new HeldProps();
	private readonly morphs: { mesh: Mesh; index: Record<string, number> }[] = [];
	private readonly owned: Material[] = [];
	private nextBlink = 0;
	/** Nobody sleeps in their shoes. */
	private readonly shoes: Mesh[] = [];

	constructor(model: Object3D) {
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
		this.pelvisUp = Y.clone().applyQuaternion(parentRest.invert());
		this.restHip = pelvis.getWorldPosition(new Vector3()).y;

		const restDirection = (b: Bone): Vector3 => {
			const child = b.children.find((c): c is Bone => c instanceof Bone);
			const from = b.getWorldPosition(new Vector3());
			if (!child) return new Vector3(0, 1, 0);
			return child.getWorldPosition(new Vector3()).sub(from).normalize();
		};
		const addJoint = (name: string, hang?: Vector3) => {
			const b = bone(name);
			const rest = b.getWorldQuaternion(new Quaternion());
			const parentRestQ = b.parent
				? b.parent.getWorldQuaternion(new Quaternion())
				: new Quaternion();
			const fix = hang
				? new Quaternion().setFromUnitVectors(restDirection(b), hang.clone().normalize())
				: new Quaternion();
			this.joints.set(name, { bone: b, rest, parentRest: parentRestQ, fix });
		};
		for (const name of ['spine_01', 'spine_02', 'spine_03', 'neck_01', 'head']) addJoint(name);
		for (const side of ['l', 'r'] as const) {
			const mirror = (v: Vector3) => (side === 'l' ? v.clone() : new Vector3(-v.x, v.y, v.z));
			addJoint(`upperarm_${side}`, mirror(HANG.upperarm));
			addJoint(`lowerarm_${side}`, mirror(HANG.lowerarm));
			addJoint(`thigh_${side}`, mirror(HANG.thigh));
			addJoint(`calf_${side}`, mirror(HANG.calf));
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
		if (/shoe/i.test(mesh.name)) this.shoes.push(mesh);
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

	/** Model-space delta `delta` applied at joint `name`, on top of its A-pose fix. */
	private pose(name: string, delta: Quaternion, parentDelta: Quaternion): Quaternion {
		const joint = this.joints.get(name);
		if (!joint) return parentDelta;
		const world = delta.clone().multiply(joint.fix);
		// local = (parentDelta * parentRest)^-1 * (world * rest)
		const parent = parentDelta.clone().multiply(joint.parentRest).invert();
		joint.bone.quaternion.copy(parent.multiply(world.clone().multiply(joint.rest)));
		return world;
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
		const down = Math.max(sit, pose.lie);
		// Seated or lying, the hips rest just above the surface the root is placed on.
		const hip = (this.restHip + pose.bob) * (1 - down) + SEATED_HIP * down;
		this.pelvis.position.copy(this.pelvisRest).addScaledVector(this.pelvisUp, hip - this.restHip);
		// Lying: the whole body turns back so the head points to the pillow (-z).
		this.body.rotation.set((-Math.PI / 2) * pose.lie, 0, pose.sway);

		// Spine: leaning back while seated, slumping, propped up in bed - spread over three joints.
		const lean = (-0.18 * sit + pose.slump + 0.3 * pose.lie) / 3;
		const breath = pose.breath * 0.012;
		let chest = new Quaternion();
		chest = this.pose('spine_01', chest.clone().multiply(q(X, lean)), chest);
		chest = this.pose('spine_02', chest.clone().multiply(q(X, lean - breath)), chest);
		chest = this.pose('spine_03', chest.clone().multiply(q(X, lean + breath)), chest);
		const look = (share: number) =>
			new Quaternion().setFromEuler(new Euler(pose.headPitch * share, pose.headYaw * share, 0));
		const neck = this.pose('neck_01', chest.clone().multiply(look(0.4)), chest);
		this.pose('head', neck.clone().multiply(look(0.6)), neck);

		const busy = Math.min(1, pose.armForward / 0.6);
		for (const side of ['r', 'l'] as const) {
			// The placeholder's sides: +1 for the right (x < 0), -1 for the left.
			const s = side === 'r' ? 1 : -1;
			const mouth = side === 'l' ? pose.handToMouth : 0;
			const wave = side === 'l' ? pose.wave : 0;
			const legs = new Quaternion();
			const thigh = this.pose(`thigh_${side}`, q(X, -s * pose.legSwing - pose.hipFlex), legs);
			this.pose(
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
			const upper = this.pose(`upperarm_${side}`, chest.clone().multiply(arm), chest);
			const elbow =
				(-0.15 - sit * 0.6 * (1 - busy) - pose.elbow - mouth * 1.4) * (1 - wave) - wave * 0.5;
			this.pose(
				`lowerarm_${side}`,
				upper
					.clone()
					.multiply(this.unfix(`upperarm_${side}`))
					.multiply(q(X, elbow)),
				upper,
			);
		}

		// Face: talking opens the jaw; the eyes blink every few seconds, and close in bed.
		this.morph('jawOpen', pose.mouth * 0.7);
		this.morph(
			'blink',
			Math.max(this.blink(now), Math.min(1, Math.max(0, (pose.lie - 0.6) / 0.3))),
		);
		for (const shoe of this.shoes) shoe.visible = pose.lie < 0.5;
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
