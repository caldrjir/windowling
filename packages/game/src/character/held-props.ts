import {
	BoxGeometry,
	CylinderGeometry,
	Group,
	Mesh,
	MeshStandardMaterial,
	SphereGeometry,
	type BufferGeometry,
} from 'three';
import type { Pose } from './animation.ts';

const COLORS = {
	bowl: '#f4f1ea',
	food: '#e76f51',
	handheld: '#2b2d42',
	handheldScreen: '#8ecae6',
	broomStick: '#b08968',
	broomBrush: '#e9c46a',
	book: '#9d4edd',
	phone: '#1d1d1f',
} as const;

/**
 * The things the character holds: a bowl, a handheld console, a broom, a book
 * and a phone. `chest` is placed at the chest's pivot and turns with the upper
 * body, `head` at the head's pivot; each prop shows only while the pose needs it.
 */
export class HeldProps {
	readonly chest = new Group();
	readonly head = new Group();
	private readonly bowl = new Group();
	private readonly handheld = new Group();
	private readonly broom = new Group();
	private readonly book = new Group();
	private readonly phone = new Group();
	private readonly materials: MeshStandardMaterial[] = [];

	constructor() {
		const part = (geometry: BufferGeometry, color: string, y: number, emissive = false) => {
			const material = new MeshStandardMaterial({
				color,
				roughness: 0.75,
				...(emissive ? { emissive: color, emissiveIntensity: 0.8 } : {}),
			});
			this.materials.push(material);
			const mesh = new Mesh(geometry, material);
			mesh.position.y = y;
			mesh.castShadow = true;
			mesh.receiveShadow = true;
			return mesh;
		};

		// Bowl held at belly height; one hand brings bites up to the mouth.
		const bowlMesh = part(
			new SphereGeometry(0.09, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
			COLORS.bowl,
			0,
		);
		const food = part(new CylinderGeometry(0.075, 0.075, 0.02, 16), COLORS.food, -0.01);
		this.bowl.add(bowlMesh, food);
		this.bowl.position.set(-0.08, 0.2, 0.3);

		// Handheld console held with both hands in front of the chest.
		this.handheld.add(part(new BoxGeometry(0.22, 0.03, 0.1), COLORS.handheld, 0));
		const screen = part(new BoxGeometry(0.1, 0.005, 0.07), COLORS.handheldScreen, 0.018, true);
		screen.castShadow = false;
		this.handheld.add(screen);
		this.handheld.position.set(0, 0.22, 0.32);
		this.handheld.rotation.x = -0.9;

		// Broom: held in front, brushing the floor ahead of the feet.
		const stick = part(new CylinderGeometry(0.015, 0.015, 1.25, 8), COLORS.broomStick, 0);
		const brush = part(new BoxGeometry(0.28, 0.08, 0.06), COLORS.broomBrush, -0.62);
		this.broom.add(stick, brush);
		this.broom.position.set(0.05, -0.2, 0.42);
		this.broom.rotation.x = 0.45;

		// Book: open in both hands, tilted towards the face.
		this.book.add(part(new BoxGeometry(0.24, 0.02, 0.17), COLORS.book, 0));
		this.book.position.set(0, 0.2, 0.3);
		this.book.rotation.x = -0.75;

		// Phone: at the ear.
		this.phone.add(part(new BoxGeometry(0.02, 0.13, 0.065), COLORS.phone, 0));
		this.phone.position.set(0.12, 0.1, 0.02);

		this.chest.add(this.bowl, this.handheld, this.broom, this.book);
		this.head.add(this.phone);
		this.update(null);
	}

	/** Shows the props the pose asks for (above 0.5); none without a pose. */
	update(pose: Pose | null): void {
		this.bowl.visible = (pose?.bowl ?? 0) > 0.5;
		this.handheld.visible = (pose?.handheld ?? 0) > 0.5;
		this.broom.visible = (pose?.broom ?? 0) > 0.5;
		this.book.visible = (pose?.book ?? 0) > 0.5;
		this.phone.visible = (pose?.phone ?? 0) > 0.5;
	}

	dispose(): void {
		for (const group of [this.chest, this.head]) {
			group.traverse((o) => {
				if (o instanceof Mesh) o.geometry.dispose();
			});
		}
		for (const m of this.materials) m.dispose();
	}
}
