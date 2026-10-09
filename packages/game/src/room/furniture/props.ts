import {
	BoxGeometry,
	CylinderGeometry,
	Group,
	LatheGeometry,
	Mesh,
	MeshStandardMaterial,
	TorusGeometry,
	Vector2,
	type BufferGeometry,
	type Material,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { ceramic, fabric } from '../materials.ts';

/**
 * Loose things that physics moves (they fall over when the phone tilts,
 * fly when it shakes). Each model is centred on its origin, like the
 * physics body it follows, and fits the collider size it is built for.
 */

function part(geometry: BufferGeometry, material: Material, x = 0, y = 0, z = 0): Mesh {
	const mesh = new Mesh(geometry, material);
	mesh.position.set(x, y, z);
	mesh.castShadow = true;
	mesh.receiveShadow = true;
	return mesh;
}

/** A coffee mug, ~8 x 10 cm (its collider: a 0.08 x 0.1 x 0.08 box). */
export function buildMug(): Group {
	const g = new Group();
	const profile = [
		new Vector2(0, 0),
		new Vector2(0.037, 0),
		new Vector2(0.04, 0.005),
		new Vector2(0.041, 0.095),
		new Vector2(0.037, 0.095),
		new Vector2(0.036, 0.008),
		new Vector2(0, 0.008),
	];
	const glaze = ceramic('#eae4da');
	const body = new Group();
	body.position.y = -0.05;
	body.add(part(new LatheGeometry(profile, 28), glaze));
	const handle = part(new TorusGeometry(0.024, 0.006, 8, 16, Math.PI), glaze, 0.04, 0.05, 0);
	handle.rotation.z = -Math.PI / 2;
	body.add(handle);
	// Coffee, a little below the rim.
	body.add(
		part(
			new CylinderGeometry(0.036, 0.036, 0.002, 24),
			new MeshStandardMaterial({ color: '#3b2416', roughness: 0.15 }),
			0,
			0.08,
			0,
		),
	);
	g.add(body);
	return g;
}

/** A hardback book: cloth cover around a block of pages. */
export function buildBook(size: { x: number; y: number; z: number }, color: string): Group {
	const g = new Group();
	const cover = new MeshStandardMaterial({ color, roughness: 0.75 });
	const t = 0.004;
	g.add(part(new BoxGeometry(size.x, t, size.z), cover, 0, size.y / 2 - t / 2, 0));
	g.add(part(new BoxGeometry(size.x, t, size.z), cover, 0, -size.y / 2 + t / 2, 0));
	// Spine on the left edge.
	g.add(part(new BoxGeometry(t, size.y, size.z), cover, -size.x / 2 + t / 2, 0, 0));
	g.add(
		part(
			new BoxGeometry(size.x - 0.01, size.y - 2 * t, size.z - 0.008),
			new MeshStandardMaterial({ color: '#f2ece0', roughness: 0.9 }),
			0.002,
			0,
			0,
		),
	);
	return g;
}

/** A plump throw pillow. */
export function buildThrowPillow(size: { x: number; y: number; z: number }, color: string): Mesh {
	return part(
		new RoundedBoxGeometry(size.x, size.y, size.z, 5, Math.min(size.y / 2 - 0.001, 0.05)),
		fabric(color, [3, 3]),
	);
}
