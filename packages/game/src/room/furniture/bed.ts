import {
	BoxGeometry,
	CylinderGeometry,
	Group,
	LatheGeometry,
	Mesh,
	MeshStandardMaterial,
	DoubleSide,
	Vector2,
	type BufferAttribute,
	type BufferGeometry,
	type Material,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { Box, Spot } from '../layout.ts';
import { ceramic, fabric, oak } from '../materials.ts';
import { keepSeparate } from '../merge-static.ts';

function part(geometry: BufferGeometry, material: Material, x = 0, y = 0, z = 0): Mesh {
	const mesh = new Mesh(geometry, material);
	mesh.position.set(x, y, z);
	mesh.castShadow = true;
	mesh.receiveShadow = true;
	return mesh;
}

/** Top of the side rails; the mattress sits in the frame and rises above it. */
const RAIL_TOP = 0.32;
const MATTRESS = 0.22;
const HEADBOARD = 1.0;
const DUVET = 0.05;
/** How far the duvet hangs over the mattress at the sides and the foot. */
const OVERHANG = 0.12;

export interface Bed {
	group: Group;
	/** 0 the duvet lies flat on the made bed .. 1 it covers someone lying in it. */
	setCover(cover: number): void;
}

/**
 * The duvet is one soft sheet: flat on the bed, draping over the sides,
 * and - with someone in bed - raised over their body (shoulders to feet).
 * Its shape is computed per vertex, so it hugs the body instead of being a
 * box on top of it.
 */
function duvet(mattress: { width: number; depth: number }, lie: Spot | undefined) {
	const width = mattress.width + OVERHANG * 2;
	const start = (lie?.z ?? 0) - 0.58; // just below the shoulders
	// Over the foot end it hangs down, like the sides.
	const end = mattress.depth / 2 + OVERHANG;
	const length = end - start;
	const geometry = new BoxGeometry(width, DUVET, length, 28, 1, 36);
	geometry.translate(0, DUVET / 2, start + length / 2);
	const position = geometry.getAttribute('position') as BufferAttribute;
	const base = Float32Array.from(position.array);
	const bodyX = lie?.x ?? 0;
	const half = mattress.width / 2;

	function shape(cover: number): void {
		for (let i = 0; i < position.count; i++) {
			const x = base[i * 3] ?? 0;
			const y = base[i * 3 + 1] ?? 0;
			const z = base[i * 3 + 2] ?? 0;
			// Over the edges it falls down along the mattress.
			const outX = Math.max(0, Math.abs(x) - half);
			const outZ = Math.max(0, z - mattress.depth / 2);
			const drop = Math.min(0.16, (outX + outZ) * 1.6);
			// The body under it, measured from where it lies: chest, legs, toes tenting it up.
			const fromHips = z - (lie?.z ?? 0);
			// Smooth steps between chest (0.28), legs (0.22) and toes tenting it (0.34), then off the end.
			const smooth = (a: number, b: number) => {
				const t = Math.min(1, Math.max(0, (fromHips - a) / (b - a)));
				return t * t * (3 - 2 * t);
			};
			const height =
				0.28 - 0.06 * smooth(0.0, 0.35) + 0.12 * smooth(0.6, 0.85) - 0.34 * smooth(0.95, 1.08);
			// Wide enough for arms lying alongside the body.
			const across = Math.exp(-(((x - bodyX) / 0.36) ** 2));
			const hump = cover * Math.max(0, height) * across;
			position.setY(i, y + hump - drop);
		}
		position.needsUpdate = true;
		geometry.computeVertexNormals();
		// Bounds move with the shape (culling, picking).
		geometry.computeBoundingBox();
		geometry.computeBoundingSphere();
	}
	shape(0);
	return { geometry, shape };
}

/**
 * A double bed: oak frame on short legs, an upholstered headboard, a
 * mattress in white linen, two pillows and a duvet that covers whoever
 * sleeps in it; a nightstand with a little lamp on the free side. Built
 * around the bed's footprint (`box`, head towards -z); mattress top at
 * `box.height`. `lie` is where the sleeper lies (for the duvet).
 */
export function buildBed(box: Box, lie?: Spot, nightstand?: Box): Bed {
	const group = new Group();
	group.position.set(box.x, 0, box.z);
	const w = box.width;
	const d = box.depth;
	const wood = oak([0.4, 1.5], 31);

	// Frame: side and foot rails on four legs.
	for (const sx of [-1, 1]) {
		for (const sz of [-1, 1]) {
			g(
				part(
					new BoxGeometry(0.06, 0.12, 0.06),
					wood,
					sx * (w / 2 - 0.03),
					0.06,
					sz * (d / 2 - 0.03),
				),
			);
		}
		g(
			part(
				new RoundedBoxGeometry(0.04, RAIL_TOP - 0.1, d, 2, 0.01),
				wood,
				sx * (w / 2 - 0.02),
				(RAIL_TOP + 0.1) / 2,
				0,
			),
		);
	}
	g(
		part(
			new RoundedBoxGeometry(w, RAIL_TOP - 0.1, 0.04, 2, 0.01),
			wood,
			0,
			(RAIL_TOP + 0.1) / 2,
			d / 2 - 0.02,
		),
	);

	// Headboard: an upholstered panel in an oak frame against the wall.
	g(
		part(
			new RoundedBoxGeometry(w, HEADBOARD, 0.06, 2, 0.015),
			wood,
			0,
			HEADBOARD / 2,
			-d / 2 + 0.03,
		),
	);
	g(
		part(
			new RoundedBoxGeometry(w - 0.1, HEADBOARD - 0.42, 0.06, 4, 0.03),
			fabric('#a7a091', [5, 4]),
			0,
			box.height + (HEADBOARD - box.height) / 2 + 0.03,
			-d / 2 + 0.075,
		),
	);

	// Mattress in a fitted white sheet.
	const mattress = { width: w - 0.06, depth: d - 0.1 };
	const linen = fabric('#ece7de', [10, 10]);
	g(
		part(
			new RoundedBoxGeometry(mattress.width, MATTRESS, mattress.depth, 4, 0.04),
			linen,
			0,
			box.height - MATTRESS / 2,
			0.02,
		),
	);

	// Two pillows, plump in the middle.
	for (const side of [-1, 1]) {
		const pillow = part(
			new RoundedBoxGeometry(0.6, 0.18, 0.4, 5, 0.08),
			linen,
			side * 0.32,
			box.height + 0.09,
			-d / 2 + 0.3,
		);
		pillow.rotation.x = -0.08;
		g(pillow);
	}

	// The duvet (sage green cover).
	const { geometry, shape } = duvet(
		mattress,
		lie ? { ...lie, x: lie.x - box.x, z: lie.z - box.z } : undefined,
	);
	const cover = part(geometry, fabric('#7f9583', [8, 10]), 0, box.height, 0);
	keepSeparate(cover); // reshaped as the sleeper lies down
	g(cover);

	// Nightstand with a small lamp and a book, on the free side of the bed.
	if (nightstand) {
		const stand = new Group();
		stand.position.set(nightstand.x - box.x, 0, nightstand.z - box.z);
		const nw = nightstand.width;
		const nd = nightstand.depth;
		const nh = nightstand.height;
		stand.add(
			part(
				new RoundedBoxGeometry(nw, nh - 0.1, nd, 2, 0.01),
				oak([0.3, 0.3], 41),
				0,
				0.1 + (nh - 0.1) / 2,
				0,
			),
		);
		for (const sx of [-1, 1]) {
			for (const sz of [-1, 1]) {
				stand.add(
					part(
						new CylinderGeometry(0.012, 0.01, 0.1, 8),
						wood,
						sx * (nw / 2 - 0.04),
						0.05,
						sz * (nd / 2 - 0.04),
					),
				);
			}
		}
		stand.add(
			part(
				new BoxGeometry(nw * 0.5, 0.012, 0.012),
				new MeshStandardMaterial({ color: '#2a2a2a', roughness: 0.4 }),
				0,
				nh - 0.12,
				nd / 2 + 0.006,
			),
		);
		// Lamp: ceramic base, linen shade, warm light.
		const lamp = new Group();
		lamp.position.set(-nw / 2 + 0.13, nh, -0.03);
		const base = [
			new Vector2(0, 0),
			new Vector2(0.06, 0),
			new Vector2(0.07, 0.06),
			new Vector2(0.045, 0.16),
			new Vector2(0.012, 0.18),
			new Vector2(0, 0.18),
		];
		lamp.add(part(new LatheGeometry(base, 20), ceramic('#5f7f8a')));
		const shade = part(
			new CylinderGeometry(0.07, 0.1, 0.13, 20, 1, true),
			new MeshStandardMaterial({
				color: '#f3ead9',
				emissive: '#ffd9a0',
				emissiveIntensity: 0.6,
				side: DoubleSide,
			}),
			0,
			0.24,
			0,
		);
		shade.castShadow = false;
		lamp.add(shade);
		stand.add(lamp);
		const book = part(
			new BoxGeometry(0.15, 0.03, 0.21),
			new MeshStandardMaterial({ color: '#7a3b2e', roughness: 0.7 }),
			0.08,
			nh + 0.015,
			0.02,
		);
		book.rotation.y = 0.25;
		stand.add(book);
		g(stand);
	}

	function g(object: Mesh | Group): void {
		group.add(object);
	}

	let current = -1;
	return {
		group,
		setCover(value: number) {
			const c = Math.round(Math.min(1, Math.max(0, value)) * 50) / 50;
			if (c === current) return;
			current = c;
			shape(c);
		},
	};
}
