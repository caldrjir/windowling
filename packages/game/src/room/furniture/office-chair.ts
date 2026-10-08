import {
	BoxGeometry,
	CylinderGeometry,
	Group,
	Mesh,
	SphereGeometry,
	type BufferGeometry,
	type Material,
	type Texture,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { Box } from '../layout.ts';
import { aluminium, blackPlastic, chairMesh, chrome, fabric } from '../materials.ts';

function part(geometry: BufferGeometry, material: Material, x = 0, y = 0, z = 0): Mesh {
	const mesh = new Mesh(geometry, material);
	mesh.position.set(x, y, z);
	mesh.castShadow = true;
	mesh.receiveShadow = true;
	return mesh;
}

/** Bends a flat panel around the vertical axis (a backrest that hugs the back). */
function curved(geometry: BufferGeometry, depth: number): BufferGeometry {
	const position = geometry.getAttribute('position');
	let maxX = 0;
	for (let i = 0; i < position.count; i++) maxX = Math.max(maxX, Math.abs(position.getX(i)));
	for (let i = 0; i < position.count; i++) {
		const x = position.getX(i) / (maxX || 1);
		position.setZ(i, position.getZ(i) + depth * x * x);
	}
	geometry.computeVertexNormals();
	return geometry;
}

export interface OfficeChair {
	group: Group;
	/** The part that swivels (seat, back, arms) - the five-star base stays put. */
	swivel: Group;
}

/**
 * An ergonomic office chair: five-star aluminium base on casters, chrome gas
 * lift, upholstered seat, curved mesh back and armrests. Built around the
 * chair's footprint (`box`); seat top at `box.height`. At rest it faces -z
 * (the desk), back rest towards +z.
 */
export function buildOfficeChair(box: Box, reflections: Texture | null = null): OfficeChair {
	const group = new Group();
	group.position.set(box.x, 0, box.z);
	const seatTop = box.height;

	// Base: five spokes, each ending in a twin-wheel caster.
	const alu = aluminium(reflections);
	const plastic = blackPlastic();
	const reach = Math.min(box.width, box.depth) / 2 + 0.06;
	for (let i = 0; i < 5; i++) {
		const angle = (i / 5) * Math.PI * 2 + Math.PI / 10;
		const spoke = new Group();
		spoke.rotation.y = angle;
		const arm = part(new BoxGeometry(0.035, 0.03, reach), alu, 0, 0.085, reach / 2);
		arm.rotation.x = 0.06; // dips slightly towards the caster
		spoke.add(arm);
		const housing = part(new BoxGeometry(0.03, 0.03, 0.035), plastic, 0, 0.06, reach - 0.01);
		spoke.add(housing);
		for (const side of [-1, 1]) {
			const wheel = part(
				new CylinderGeometry(0.025, 0.025, 0.012, 16),
				plastic,
				side * 0.012,
				0.025,
				reach - 0.01,
			);
			wheel.rotation.z = Math.PI / 2;
			spoke.add(wheel);
		}
		group.add(spoke);
	}
	group.add(part(new CylinderGeometry(0.04, 0.05, 0.05, 20), alu, 0, 0.1, 0));
	// Gas lift: black sleeve with the chrome piston above it.
	group.add(part(new CylinderGeometry(0.03, 0.03, 0.14, 20), plastic, 0, 0.19, 0));
	group.add(
		part(
			new CylinderGeometry(0.02, 0.02, seatTop - 0.33, 16),
			chrome(reflections),
			0,
			(seatTop + 0.18) / 2,
			0,
		),
	);

	// Everything above the piston turns with the person sitting on it.
	const swivel = new Group();
	group.add(swivel);
	const cushion = fabric('#3b3f47', [5, 5]);
	// Mechanism plate under the seat.
	swivel.add(part(new BoxGeometry(0.2, 0.03, 0.22), plastic, 0, seatTop - 0.1, 0));
	// Seat: a plastic shell with a thick cushion on top.
	swivel.add(
		part(
			new RoundedBoxGeometry(box.width, 0.03, box.depth, 3, 0.012),
			plastic,
			0,
			seatTop - 0.075,
			0,
		),
	);
	swivel.add(
		part(
			new RoundedBoxGeometry(box.width - 0.01, 0.065, box.depth - 0.02, 4, 0.03),
			cushion,
			0,
			seatTop - 0.032,
			-0.005,
		),
	);

	// Back: a spine from under the seat up behind it, holding a curved mesh panel.
	const backZ = box.depth / 2 + 0.02;
	const spine = part(
		new BoxGeometry(0.06, 0.025, 0.12),
		plastic,
		0,
		seatTop - 0.085,
		box.depth / 2 - 0.03,
	);
	swivel.add(spine);
	swivel.add(part(new BoxGeometry(0.05, 0.3, 0.025), plastic, 0, seatTop + 0.06, backZ + 0.01));
	// A frame around the mesh, both bent to hug the back.
	const backW = box.width - 0.02;
	const backH = 0.5;
	const bend = 0.05;
	const backY = seatTop + 0.34;
	for (const y of [-backH / 2, backH / 2]) {
		swivel.add(
			part(
				curved(new RoundedBoxGeometry(backW, 0.03, 0.03, 2, 0.01), bend),
				plastic,
				0,
				backY + y,
				backZ,
			),
		);
	}
	for (const side of [-1, 1]) {
		swivel.add(
			part(
				new RoundedBoxGeometry(0.03, backH, 0.03, 2, 0.01),
				plastic,
				side * (backW / 2 - 0.015),
				backY,
				backZ + bend,
			),
		);
	}
	const net = part(
		curved(new BoxGeometry(backW - 0.03, backH - 0.02, 0.004, 16, 1, 1), bend),
		chairMesh(),
		0,
		backY,
		backZ,
	);
	net.castShadow = false;
	swivel.add(net);
	// A lumbar pad.
	swivel.add(
		part(
			curved(new RoundedBoxGeometry(box.width - 0.12, 0.07, 0.02, 2, 0.008), 0.04),
			plastic,
			0,
			seatTop + 0.2,
			backZ - 0.025,
		),
	);

	// Armrests: posts from under the seat, padded tops.
	for (const side of [-1, 1]) {
		const x = side * (box.width / 2 + 0.03);
		swivel.add(
			part(
				new BoxGeometry(0.025, 0.08, 0.06),
				plastic,
				side * (box.width / 2 - 0.02),
				seatTop - 0.075,
				0.03,
			),
		);
		swivel.add(part(new BoxGeometry(0.03, 0.2, 0.04), plastic, x, seatTop + 0.06, 0.04));
		swivel.add(
			part(new RoundedBoxGeometry(0.06, 0.025, 0.24, 2, 0.01), plastic, x, seatTop + 0.17, 0.0),
		);
	}
	// Seat height lever.
	const lever = part(
		new CylinderGeometry(0.006, 0.006, 0.09, 8),
		plastic,
		box.width / 2 - 0.05,
		seatTop - 0.1,
		-0.05,
	);
	lever.rotation.z = Math.PI / 2;
	swivel.add(lever);
	swivel.add(
		part(new SphereGeometry(0.012, 10, 8), plastic, box.width / 2 - 0.005, seatTop - 0.1, -0.05),
	);

	return { group, swivel };
}
