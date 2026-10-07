import {
	BoxGeometry,
	CapsuleGeometry,
	CylinderGeometry,
	Group,
	Mesh,
	MeshStandardMaterial,
	SphereGeometry,
	type BufferGeometry,
} from 'three';
import type { Pose } from './animation.ts';
import type { CharacterSnapshot } from './controller.ts';

const COLORS = {
	skin: '#e0ac8a',
	shirt: '#e9c46a',
	pants: '#264653',
	shoes: '#2b2b2b',
	hair: '#3b2a20',
	bowl: '#f4f1ea',
	food: '#e76f51',
	handheld: '#2b2d42',
	handheldScreen: '#8ecae6',
	broomStick: '#b08968',
	broomBrush: '#e9c46a',
	book: '#9d4edd',
	phone: '#1d1d1f',
} as const;

const THIGH = 0.44;
const SHIN = 0.44;
const HIP_HEIGHT = THIGH + SHIN + 0.05;
const TORSO = 0.52;
const UPPER_ARM = 0.3;
const FOREARM = 0.28;

/**
 * Placeholder character built from primitives (no production assets yet).
 * Pure visualisation: it receives a pose and a transform and applies them.
 */
export class CharacterRig {
	readonly root = new Group();
	private readonly body = new Group();
	private readonly hips = new Group();
	private readonly chest = new Group();
	private readonly head = new Group();
	private readonly thighs: [Group, Group] = [new Group(), new Group()];
	private readonly shins: [Group, Group] = [new Group(), new Group()];
	private readonly arms: [Group, Group] = [new Group(), new Group()];
	private readonly forearms: [Group, Group] = [new Group(), new Group()];
	private readonly materials: MeshStandardMaterial[] = [];
	/** Props live in front of the chest; they are shown only while the activity needs them. */
	private readonly bowl = new Group();
	private readonly handheld = new Group();
	private readonly broom = new Group();
	private readonly book = new Group();
	private readonly phone = new Group();
	private readonly mouth: Mesh;

	constructor() {
		this.root.name = 'character';
		const mat = (color: string) => {
			const m = new MeshStandardMaterial({ color, roughness: 0.75 });
			this.materials.push(m);
			return m;
		};
		const part = (geometry: BufferGeometry, color: string, y: number) => {
			const mesh = new Mesh(geometry, mat(color));
			mesh.position.y = y;
			mesh.castShadow = true;
			mesh.receiveShadow = true;
			return mesh;
		};

		this.root.add(this.body);
		this.body.add(this.hips);

		// Pelvis + torso
		this.hips.add(part(new BoxGeometry(0.32, 0.16, 0.2), COLORS.pants, 0.02));
		this.hips.add(this.chest);
		this.chest.position.y = 0.08;
		this.chest.add(part(new CapsuleGeometry(0.16, TORSO - 0.3, 4, 12), COLORS.shirt, TORSO / 2));

		// Head with hair cap and a nose so you can tell where it faces
		this.chest.add(this.head);
		this.head.position.y = TORSO + 0.06;
		this.head.add(part(new SphereGeometry(0.11, 20, 14), COLORS.skin, 0.1));
		const hair = part(
			new SphereGeometry(0.115, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2),
			COLORS.hair,
			0.12,
		);
		hair.rotation.x = -0.25;
		this.head.add(hair);
		const nose = part(new BoxGeometry(0.03, 0.04, 0.04), COLORS.skin, 0.09);
		nose.position.z = 0.11;
		this.head.add(nose);
		// Mouth: a dark slit that opens while talking (basic lip sync).
		this.mouth = part(new BoxGeometry(0.045, 0.012, 0.01), '#4a2420', 0.045);
		this.mouth.position.z = 0.103;
		this.mouth.castShadow = false;
		this.head.add(this.mouth);

		// Legs: thigh pivot at the hip, shin pivot at the knee
		for (const [i, side] of [-1, 1].entries()) {
			const thigh = this.thighs[i as 0 | 1];
			const shin = this.shins[i as 0 | 1];
			thigh.position.set(side * 0.09, 0, 0);
			thigh.add(part(new CapsuleGeometry(0.07, THIGH - 0.14, 4, 10), COLORS.pants, -THIGH / 2));
			shin.position.y = -THIGH;
			shin.add(part(new CapsuleGeometry(0.06, SHIN - 0.12, 4, 10), COLORS.pants, -SHIN / 2));
			const shoe = part(new BoxGeometry(0.1, 0.06, 0.2), COLORS.shoes, -SHIN - 0.02);
			shoe.position.z = 0.04;
			shin.add(shoe);
			thigh.add(shin);
			this.hips.add(thigh);

			const arm = this.arms[i as 0 | 1];
			const forearm = this.forearms[i as 0 | 1];
			arm.position.set(side * 0.22, TORSO - 0.06, 0);
			arm.add(part(new CapsuleGeometry(0.05, UPPER_ARM - 0.1, 4, 8), COLORS.shirt, -UPPER_ARM / 2));
			forearm.position.y = -UPPER_ARM;
			forearm.add(
				part(new CapsuleGeometry(0.045, FOREARM - 0.09, 4, 8), COLORS.skin, -FOREARM / 2),
			);
			arm.add(forearm);
			this.chest.add(arm);
		}

		// Bowl held at belly height; the right hand brings bites up to the mouth.
		const bowlMesh = part(
			new SphereGeometry(0.09, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
			COLORS.bowl,
			0,
		);
		const food = part(new CylinderGeometry(0.075, 0.075, 0.02, 16), COLORS.food, -0.01);
		this.bowl.add(bowlMesh, food);
		this.bowl.position.set(-0.08, 0.2, 0.3);
		this.bowl.visible = false;
		this.chest.add(this.bowl);

		// Handheld console held with both hands in front of the chest.
		this.handheld.add(part(new BoxGeometry(0.22, 0.03, 0.1), COLORS.handheld, 0));
		const handheldScreen = new Mesh(
			new BoxGeometry(0.1, 0.005, 0.07),
			new MeshStandardMaterial({
				color: COLORS.handheldScreen,
				emissive: COLORS.handheldScreen,
				emissiveIntensity: 0.8,
			}),
		);
		this.materials.push(handheldScreen.material);
		handheldScreen.position.y = 0.018;
		this.handheld.add(handheldScreen);
		this.handheld.position.set(0, 0.22, 0.32);
		this.handheld.rotation.x = -0.9;
		this.handheld.visible = false;
		this.chest.add(this.handheld);

		// Broom: held in front, brushing the floor ahead of the feet.
		const stick = part(new CylinderGeometry(0.015, 0.015, 1.25, 8), COLORS.broomStick, 0);
		const brush = part(new BoxGeometry(0.28, 0.08, 0.06), COLORS.broomBrush, -0.62);
		this.broom.add(stick, brush);
		this.broom.position.set(0.05, -0.2, 0.42);
		this.broom.rotation.x = 0.45;
		this.broom.visible = false;
		this.chest.add(this.broom);

		// Book: open in both hands, tilted towards the face.
		this.book.add(part(new BoxGeometry(0.24, 0.02, 0.17), COLORS.book, 0));
		this.book.position.set(0, 0.2, 0.3);
		this.book.rotation.x = -0.75;
		this.book.visible = false;
		this.chest.add(this.book);

		// Phone: at the right ear.
		this.phone.add(part(new BoxGeometry(0.02, 0.13, 0.065), COLORS.phone, 0));
		this.phone.position.set(0.12, 0.1, 0.02);
		this.phone.visible = false;
		this.head.add(this.phone);
	}

	/** Applies a world transform and a pose. Called once per rendered frame. */
	apply(state: Pick<CharacterSnapshot, 'x' | 'y' | 'z' | 'yaw'>, pose: Pose): void {
		this.root.position.set(state.x, state.y, state.z);
		this.root.rotation.y = state.yaw;

		const sit = Math.min(1, pose.hipFlex / (Math.PI / 2));
		const standingHip = HIP_HEIGHT + pose.bob;
		// Seated or lying, the hips rest just above the surface the root is placed on.
		const restingHip = 0.1;
		this.hips.position.y =
			standingHip * (1 - Math.max(sit, pose.lie)) + restingHip * Math.max(sit, pose.lie);
		// Lying: rotate the whole body back so the head points to the pillow (-z).
		this.body.rotation.x = (-Math.PI / 2) * pose.lie;

		for (const [i, side] of [1, -1].entries()) {
			const thigh = this.thighs[i as 0 | 1];
			const shin = this.shins[i as 0 | 1];
			thigh.rotation.x = -side * pose.legSwing - pose.hipFlex;
			shin.rotation.x = pose.knee;
			const arm = this.arms[i as 0 | 1];
			// arms[1] is the right hand (the one that eats).
			const mouth = i === 1 ? pose.handToMouth : 0;
			const busy = Math.min(1, pose.armForward / 0.6);
			const wave = i === 1 ? pose.wave : 0;
			arm.rotation.x =
				(side * pose.armSwing - sit * 0.5 * (1 - busy) - pose.armForward - mouth * 0.35) *
					(1 - wave) -
				wave * 2.7;
			// Off balance: both arms fling out to the sides.
			arm.rotation.x -= pose.startle * 0.4;
			// Busy hands come together in front of the body; a waving arm swings out to the side.
			arm.rotation.z =
				-side * (0.08 - busy * 0.3) * (1 - wave) - side * wave * (0.25 + pose.waveSwing * 0.35);
			arm.rotation.z -= side * pose.startle * 1.1;
			this.forearms[i as 0 | 1].rotation.x =
				(-0.15 - sit * 0.6 * (1 - busy) - pose.elbow - mouth * 1.4) * (1 - wave) - wave * 0.5;
		}

		// Relaxed lean back while seated reads as "sitting" even from the front.
		// Lying: the head and shoulders rest propped up on the pillow.
		this.chest.rotation.x = -0.18 * sit + pose.slump + 0.3 * pose.lie;
		this.body.rotation.z = pose.sway;
		this.chest.scale.set(1 + pose.breath * 0.015, 1, 1 + pose.breath * 0.025);
		this.head.rotation.y = pose.headYaw;
		this.head.rotation.x = pose.headPitch;
		this.mouth.scale.set(1 - pose.mouth * 0.2, 1 + pose.mouth * 2.2, 1);
		this.bowl.visible = pose.bowl > 0.5;
		this.handheld.visible = pose.handheld > 0.5;
		this.broom.visible = pose.broom > 0.5;
		this.book.visible = pose.book > 0.5;
		this.phone.visible = pose.phone > 0.5;
	}

	dispose(): void {
		this.root.traverse((o) => {
			if (o instanceof Mesh) o.geometry.dispose();
		});
		for (const m of this.materials) m.dispose();
	}
}
