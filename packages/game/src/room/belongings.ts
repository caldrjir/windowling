import type { ItemId } from '@windowling/shared';
import {
	BoxGeometry,
	CatmullRomCurve3,
	CylinderGeometry,
	Group,
	Mesh,
	MeshStandardMaterial,
	SphereGeometry,
	TorusGeometry,
	TubeGeometry,
	Vector3,
	type BufferGeometry,
	type Material,
	type MeshStandardMaterialParameters,
	type Object3D,
} from 'three';
import { buildPrint } from './architecture.ts';
import { DOOR, FURNITURE, PARCEL, ROOM } from './layout.ts';

/**
 * Things the character bought (Iteration 10): each has its own place in the
 * flat and stays there once unpacked. Parcels wait by the door. The renderer
 * only shows what the simulation says it owns.
 */
export interface Belongings {
	group: Group;
	set(items: readonly ItemId[], parcels: number): void;
}

function part(geometry: BufferGeometry, material: Material, x = 0, y = 0, z = 0): Mesh {
	const mesh = new Mesh(geometry, material);
	mesh.position.set(x, y, z);
	mesh.castShadow = true;
	mesh.receiveShadow = true;
	return mesh;
}

const mat = (color: string, extra: MeshStandardMaterialParameters = {}) =>
	new MeshStandardMaterial({ color, roughness: 0.8, ...extra });

/** A floor plant in a terracotta pot, ~1.1 m. */
function buildPlant(): Group {
	const g = new Group();
	g.add(part(new CylinderGeometry(0.17, 0.13, 0.34, 20), mat('#b4643f'), 0, 0.17, 0));
	g.add(part(new CylinderGeometry(0.16, 0.16, 0.02, 20), mat('#3b2a1f'), 0, 0.33, 0));
	const leaf = mat('#3f7a3a', { roughness: 0.6 });
	const dark = mat('#2f5f2d', { roughness: 0.6 });
	for (let i = 0; i < 9; i++) {
		const angle = (i / 9) * Math.PI * 2;
		const tilt = 0.35 + (i % 3) * 0.15;
		const length = 0.42 + (i % 4) * 0.08;
		const blade = part(new SphereGeometry(0.07, 10, 8), i % 2 ? leaf : dark);
		blade.scale.set(0.9, length / 0.14, 0.35);
		blade.position.set(
			Math.sin(angle) * Math.sin(tilt) * length * 0.5,
			0.36 + Math.cos(tilt) * length * 0.5,
			Math.cos(angle) * Math.sin(tilt) * length * 0.5,
		);
		blade.rotation.set(Math.cos(angle) * tilt, angle, -Math.sin(angle) * tilt * 0.2);
		g.add(blade);
	}
	return g;
}

/** Warm fairy lights hanging in a sag along the wall above the bed. */
function buildStringLights(): Group {
	const g = new Group();
	const from = -ROOM.width / 2 + 0.15;
	const to = FURNITURE.bed.x + FURNITURE.bed.width / 2 + 0.2;
	const points: Vector3[] = [];
	for (let i = 0; i <= 16; i++) {
		const t = i / 16;
		const sag = Math.sin(t * Math.PI * 2) ** 2 * 0.12;
		points.push(new Vector3(from + (to - from) * t, 2.25 - sag, 0));
	}
	const curve = new CatmullRomCurve3(points);
	g.add(part(new TubeGeometry(curve, 64, 0.004, 4), mat('#2b2b2b')));
	const bulb = mat('#ffd9a0', { emissive: '#ffb45e', emissiveIntensity: 2.2, roughness: 0.3 });
	for (let i = 1; i < 20; i++) {
		const p = curve.getPoint(i / 20);
		const b = part(new SphereGeometry(0.018, 8, 6), bulb, p.x, p.y - 0.02, 0.01);
		b.castShadow = false;
		g.add(b);
	}
	return g;
}

/** Over-ear headphones lying on the desk. */
function buildHeadphones(): Group {
	const g = new Group();
	const black = mat('#1d1d20', { roughness: 0.4 });
	const band = part(new TorusGeometry(0.08, 0.008, 8, 24, Math.PI), black);
	band.rotation.x = -Math.PI / 2;
	g.add(band);
	for (const x of [-0.08, 0.08]) {
		const cup = part(new CylinderGeometry(0.045, 0.045, 0.03, 18), black, x, 0.015, 0);
		g.add(cup);
	}
	return g;
}

/** A knitted blanket folded over the sofa's arm. */
function buildBlanket(): Group {
	const g = new Group();
	const knit = mat('#c8734a', { roughness: 0.95 });
	g.add(part(new BoxGeometry(0.22, 0.03, 0.55), knit, 0, 0.0, 0));
	g.add(part(new BoxGeometry(0.03, 0.26, 0.55), knit, 0.11, -0.13, 0));
	g.add(part(new BoxGeometry(0.2, 0.05, 0.5), knit, -0.05, -0.2, 0.02));
	return g;
}

/** A small espresso machine with a cup. */
function buildCoffeeMachine(): Group {
	const g = new Group();
	const body = mat('#2a2a2e', { roughness: 0.35, metalness: 0.4 });
	const steel = mat('#c7c9cc', { roughness: 0.25, metalness: 0.9 });
	g.add(part(new BoxGeometry(0.22, 0.3, 0.26), body, 0, 0.15, 0));
	g.add(part(new BoxGeometry(0.22, 0.03, 0.12), steel, 0, 0.015, -0.12));
	g.add(part(new CylinderGeometry(0.03, 0.03, 0.05, 12), mat('#f2efe8'), 0, 0.055, -0.13));
	return g;
}

/** A cardboard box with tape across. */
function buildParcel(size: [number, number, number]): Group {
	const g = new Group();
	const [w, h, d] = size;
	g.add(part(new BoxGeometry(w, h, d), mat('#b98b56', { roughness: 0.95 }), 0, h / 2, 0));
	g.add(
		part(
			new BoxGeometry(w + 0.002, 0.004, 0.06),
			mat('#d8c39a', { roughness: 0.4 }),
			0,
			h + 0.001,
			0,
		),
	);
	return g;
}

const PARCEL_SIZES: Array<[number, number, number]> = [
	[0.42, 0.3, 0.34],
	[0.32, 0.22, 0.28],
	[0.26, 0.18, 0.22],
];

export function buildBelongings(): Belongings {
	const group = new Group();
	const items: Record<ItemId, Object3D> = {
		plant: buildPlant(),
		art_print: buildPrint('arches', 0.42, 0.56),
		string_lights: buildStringLights(),
		headphones: buildHeadphones(),
		blanket: buildBlanket(),
		coffee_machine: buildCoffeeMachine(),
	};
	// The front-right corner, past the kitchen counter.
	items.plant.position.set(ROOM.width / 2 - 0.3, 0, ROOM.depth / 2 - 0.45);
	// The left wall between the bed and the door.
	items.art_print.rotation.y = Math.PI / 2;
	items.art_print.position.set(-ROOM.width / 2, 1.5, DOOR.z - DOOR.width / 2 - 0.6);
	// The back wall above the bed.
	items.string_lights.position.set(0, 0, -ROOM.depth / 2 + 0.03);
	items.headphones.position.set(
		FURNITURE.desk.x + 0.42,
		FURNITURE.desk.height + 0.01,
		FURNITURE.desk.z + 0.12,
	);
	items.blanket.position.set(
		FURNITURE.sofa.x + FURNITURE.sofa.width / 2 - 0.12,
		0.66,
		FURNITURE.sofa.z + 0.05,
	);
	items.coffee_machine.rotation.y = -Math.PI / 2;
	items.coffee_machine.position.set(
		FURNITURE.counter.x + 0.08,
		FURNITURE.counter.height,
		FURNITURE.counter.z + FURNITURE.counter.depth / 2 - 0.2,
	);
	for (const object of Object.values(items)) {
		object.visible = false;
		group.add(object);
	}

	const parcels = PARCEL_SIZES.map((size, i) => {
		const box = buildParcel(size);
		// Stacked by the door, the biggest at the bottom.
		const below = PARCEL_SIZES.slice(0, i).reduce((h, s) => h + s[1], 0);
		box.position.set(PARCEL.x, below, PARCEL.z);
		box.rotation.y = i * 0.35;
		box.visible = false;
		group.add(box);
		return box;
	});

	return {
		group,
		set(owned, waiting) {
			for (const [id, object] of Object.entries(items)) {
				object.visible = owned.includes(id as ItemId);
			}
			parcels.forEach((box, i) => (box.visible = i < waiting));
		},
	};
}
