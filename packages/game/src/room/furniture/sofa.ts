import { CylinderGeometry, Group, Mesh, type BufferGeometry, type Material } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { Box } from '../layout.ts';
import { fabric, oak } from '../materials.ts';

function part(geometry: BufferGeometry, material: Material, x = 0, y = 0, z = 0): Mesh {
	const mesh = new Mesh(geometry, material);
	mesh.position.set(x, y, z);
	mesh.castShadow = true;
	mesh.receiveShadow = true;
	return mesh;
}

/** Height of the oak legs: the sofa floats a little, like Scandinavian ones do. */
const LEGS = 0.13;
/** Upholstered base under the seat cushions. */
const BASE_TOP = 0.3;
const ARM = 0.17;
const ARM_TOP = 0.6;
const BACK_FRAME = 0.17;
const BACK_TOP = 0.66;

/**
 * A three-seater with two deep seat cushions and loose back cushions on
 * slim oak legs, a throw pillow and a knitted throw. Built around the
 * sofa's footprint (`box`); seat cushions' top at `box.height`, front
 * towards +z.
 */
export function buildSofa(box: Box): Group {
	const g = new Group();
	g.position.set(box.x, 0, box.z);
	const w = box.width;
	const d = box.depth;
	const front = d / 2;
	const back = -d / 2;
	const upholstery = fabric('#7d8578', [6, 6]);
	const wood = oak([0.2, 0.2], 21);

	// Tapered legs, inset a little from the corners.
	for (const sx of [-1, 1]) {
		for (const sz of [-1, 1]) {
			const leg = part(
				new CylinderGeometry(0.022, 0.014, LEGS, 12),
				wood,
				sx * (w / 2 - 0.09),
				LEGS / 2,
				sz * (d / 2 - 0.09),
			);
			leg.rotation.z = sx * 0.06;
			leg.rotation.x = -sz * 0.06;
			g.add(leg);
		}
	}

	// Base, arms and back frame: one upholstered shell.
	g.add(
		part(
			new RoundedBoxGeometry(w, BASE_TOP - LEGS, d, 3, 0.03),
			upholstery,
			0,
			(LEGS + BASE_TOP) / 2,
			0,
		),
	);
	for (const side of [-1, 1]) {
		g.add(
			part(
				new RoundedBoxGeometry(ARM, ARM_TOP - LEGS, d, 4, 0.06),
				upholstery,
				side * (w / 2 - ARM / 2),
				(LEGS + ARM_TOP) / 2,
				0,
			),
		);
	}
	g.add(
		part(
			new RoundedBoxGeometry(w - 2 * ARM + 0.02, BACK_TOP - BASE_TOP, BACK_FRAME, 3, 0.05),
			upholstery,
			0,
			(BASE_TOP + BACK_TOP) / 2,
			back + BACK_FRAME / 2,
		),
	);

	// Two seat cushions between the arms, from the back frame to the front edge.
	const inner = w - 2 * ARM;
	const seatDepth = d - BACK_FRAME;
	const seatH = box.height - BASE_TOP;
	for (const side of [-1, 1]) {
		g.add(
			part(
				new RoundedBoxGeometry(inner / 2 - 0.005, seatH, seatDepth, 4, 0.05),
				upholstery,
				(side * inner) / 4,
				BASE_TOP + seatH / 2,
				back + BACK_FRAME + seatDepth / 2,
			),
		);
	}

	// Back cushions leaning on the frame.
	for (const side of [-1, 1]) {
		const cushion = part(
			new RoundedBoxGeometry(inner / 2 - 0.02, 0.44, 0.17, 4, 0.07),
			upholstery,
			(side * inner) / 4,
			box.height + 0.2,
			back + BACK_FRAME + 0.06,
		);
		cushion.rotation.x = -0.2;
		g.add(cushion);
	}

	// A throw pillow in the corner and a knitted throw over the other arm.
	const pillow = part(
		new RoundedBoxGeometry(0.4, 0.4, 0.13, 5, 0.06),
		fabric('#c9a66b', [3, 3]),
		-inner / 2 + 0.22,
		box.height + 0.2,
		back + BACK_FRAME + 0.2,
	);
	pillow.rotation.set(-0.3, 0.35, 0.12);
	g.add(pillow);
	const throwMat = fabric('#d8d0c2', [8, 8]);
	const drape = part(
		new RoundedBoxGeometry(ARM + 0.03, 0.03, 0.5, 2, 0.012),
		throwMat,
		w / 2 - ARM / 2,
		ARM_TOP + 0.01,
		front - 0.35,
	);
	g.add(drape);
	const fall = part(
		new RoundedBoxGeometry(0.03, 0.34, 0.5, 2, 0.012),
		throwMat,
		w / 2 + 0.012,
		ARM_TOP - 0.16,
		front - 0.35,
	);
	g.add(fall);
	return g;
}
