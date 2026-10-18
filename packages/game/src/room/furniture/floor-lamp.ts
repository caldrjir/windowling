import {
	CylinderGeometry,
	DoubleSide,
	Group,
	Mesh,
	MeshStandardMaterial,
	Quaternion,
	SphereGeometry,
	Vector3,
	type BufferGeometry,
	type Material,
} from 'three';
import type { Box } from '../layout.ts';
import { blackSteel, oak } from '../materials.ts';

function part(geometry: BufferGeometry, material: Material, x = 0, y = 0, z = 0): Mesh {
	const mesh = new Mesh(geometry, material);
	mesh.position.set(x, y, z);
	mesh.castShadow = true;
	mesh.receiveShadow = true;
	return mesh;
}

/** A round rod from `a` to `b`. */
function rod(a: Vector3, b: Vector3, radius: number, material: Material): Mesh {
	const length = a.distanceTo(b);
	const mesh = part(new CylinderGeometry(radius, radius * 0.8, length, 10), material);
	mesh.position.copy(a).add(b).multiplyScalar(0.5);
	mesh.quaternion.copy(
		new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), b.clone().sub(a).normalize()),
	);
	return mesh;
}

export interface FloorLamp {
	group: Group;
	/** Where the bulb is (room coordinates), for the light. */
	bulb: Vector3;
}

/**
 * A tripod floor lamp: three oak legs meeting under a short black stem and a
 * big linen drum shade. Built around the lamp's footprint (`box`, the shade
 * is as wide as the footprint); top of the shade at `box.height`.
 */
export function buildFloorLamp(box: Box): FloorLamp {
	const group = new Group();
	group.position.set(box.x, 0, box.z);
	const radius = Math.min(box.width, box.depth) / 2;
	const shadeH = 0.3;
	const shadeBottom = box.height - shadeH;
	const joint = new Vector3(0, shadeBottom - 0.18, 0);
	const wood = oak([0.2, 1], 7);
	const steel = blackSteel();
	for (let i = 0; i < 3; i++) {
		const angle = (i / 3) * Math.PI * 2 + Math.PI / 2;
		const foot = new Vector3(Math.cos(angle) * radius * 0.8, 0.012, Math.sin(angle) * radius * 0.8);
		group.add(rod(foot, joint, 0.014, wood));
		// A small black cap where each leg meets the floor.
		group.add(part(new SphereGeometry(0.014, 8, 6), steel, foot.x, 0.01, foot.z));
	}
	// The joint and the stem up into the shade.
	group.add(part(new CylinderGeometry(0.03, 0.025, 0.06, 14), steel, joint.x, joint.y, joint.z));
	group.add(rod(joint, new Vector3(0, shadeBottom + 0.1, 0), 0.008, steel));

	// Linen drum shade, glowing faintly when lit, open at top and bottom.
	const linen = new MeshStandardMaterial({
		color: '#efe6d6',
		emissive: '#ffd6a0',
		emissiveIntensity: 0.55,
		roughness: 1,
		side: DoubleSide,
	});
	const shade = part(
		new CylinderGeometry(radius * 0.9, radius, shadeH, 32, 1, true),
		linen,
		0,
		shadeBottom + shadeH / 2,
		0,
	);
	shade.castShadow = false;
	group.add(shade);
	// The bulb, seen from below.
	const bulb = new Vector3(0, shadeBottom + 0.12, 0);
	group.add(
		part(
			new SphereGeometry(0.035, 12, 8),
			new MeshStandardMaterial({ color: '#fff3dc', emissive: '#ffe2b0', emissiveIntensity: 2 }),
			bulb.x,
			bulb.y,
			bulb.z,
		),
	);
	return { group, bulb: bulb.clone().add(group.position) };
}
