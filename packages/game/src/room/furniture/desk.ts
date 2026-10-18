import {
	BoxGeometry,
	CanvasTexture,
	Color,
	CylinderGeometry,
	Group,
	LatheGeometry,
	Mesh,
	MeshStandardMaterial,
	SphereGeometry,
	SRGBColorSpace,
	Vector2,
	type BufferGeometry,
	type Material,
	type Texture,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { Box } from '../layout.ts';
import { aluminium, blackPlastic, blackSteel, ceramic, oak } from '../materials.ts';

/** Thickness of the desk top (its top surface is at `desk.height`). */
const TOP = 0.03;
/** Square steel tube of the frame. */
const TUBE = 0.025;

function part(geometry: BufferGeometry, material: Material, x = 0, y = 0, z = 0): Mesh {
	const mesh = new Mesh(geometry, material);
	mesh.position.set(x, y, z);
	mesh.castShadow = true;
	mesh.receiveShadow = true;
	return mesh;
}

/** A dim code editor on the laptop - something to look at when it works. */
function screenTexture(): CanvasTexture | null {
	if (typeof document === 'undefined') return null;
	const canvas = document.createElement('canvas');
	canvas.width = 256;
	canvas.height = 160;
	const ctx = canvas.getContext('2d');
	if (!ctx) return null;
	ctx.fillStyle = '#1b1f2a';
	ctx.fillRect(0, 0, 256, 160);
	ctx.fillStyle = '#232838';
	ctx.fillRect(0, 0, 46, 160);
	const colors = ['#7aa2f7', '#9ece6a', '#e0af68', '#bb9af7', '#c0caf5', '#7dcfff'];
	let seed = 11;
	const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
	for (let line = 0; line < 17; line++) {
		let x = 54 + Math.floor(rnd() * 4) * 10;
		const y = 8 + line * 9;
		for (let word = 0; word < 1 + Math.floor(rnd() * 5); word++) {
			const w = 8 + rnd() * 34;
			ctx.fillStyle = colors[Math.floor(rnd() * colors.length)] ?? '#c0caf5';
			ctx.fillRect(x, y, w, 4);
			x += w + 5;
		}
		ctx.fillStyle = '#3b4261';
		ctx.fillRect(8, y, 26, 3);
	}
	const map = new CanvasTexture(canvas);
	map.colorSpace = SRGBColorSpace;
	return map;
}

function laptop(reflections: Texture | null): Group {
	const g = new Group();
	const shell = aluminium(reflections);
	// Base with keyboard well and trackpad.
	g.add(part(new RoundedBoxGeometry(0.32, 0.016, 0.22, 2, 0.006), shell, 0, 0.008, 0));
	const keys = new MeshStandardMaterial({ color: '#202226', roughness: 0.7 });
	g.add(part(new BoxGeometry(0.27, 0.002, 0.1), keys, 0, 0.0165, -0.025));
	g.add(
		part(
			new BoxGeometry(0.1, 0.001, 0.065),
			new MeshStandardMaterial({ color: '#b7bbc2', metalness: 0.6, roughness: 0.25 }),
			0,
			0.0165,
			0.065,
		),
	);
	// Lid, open at ~105 degrees, hinged at the back edge.
	const lid = new Group();
	lid.position.set(0, 0.016, -0.108);
	lid.rotation.x = -0.26;
	lid.add(part(new RoundedBoxGeometry(0.32, 0.21, 0.008, 2, 0.004), shell, 0, 0.105, -0.004));
	const map = screenTexture();
	const display = new MeshStandardMaterial({
		color: '#000000',
		roughness: 0.2,
		emissive: new Color(map ? '#ffffff' : '#9cc3ff'),
		emissiveIntensity: map ? 0.9 : 0.5,
		emissiveMap: map,
	});
	const panel = part(new BoxGeometry(0.296, 0.185, 0.001), display, 0, 0.108, 0.0005);
	panel.castShadow = false;
	lid.add(panel);
	g.add(lid);
	return g;
}

export function buildPlant(): Group {
	const g = new Group();
	const pot = [
		new Vector2(0, 0),
		new Vector2(0.045, 0),
		new Vector2(0.058, 0.11),
		new Vector2(0.052, 0.11),
		new Vector2(0.05, 0.1),
		new Vector2(0, 0.1),
	];
	g.add(part(new LatheGeometry(pot, 24), ceramic('#c46a4a')));
	g.add(
		part(
			new CylinderGeometry(0.05, 0.05, 0.004, 20),
			new MeshStandardMaterial({ color: '#3a2a1e', roughness: 1 }),
			0,
			0.1,
			0,
		),
	);
	// Leaves: flattened ellipsoids fanning out from the soil.
	const leaf = new MeshStandardMaterial({ color: '#4f7a3a', roughness: 0.55 });
	const shape = new SphereGeometry(1, 12, 8);
	for (let i = 0; i < 9; i++) {
		const angle = (i / 9) * Math.PI * 2 + (i % 2) * 0.3;
		const tilt = 0.5 + (i % 3) * 0.25;
		const l = part(shape, leaf);
		l.scale.set(0.022, 0.085 + (i % 3) * 0.015, 0.006);
		l.position.set(Math.sin(angle) * 0.03, 0.17, Math.cos(angle) * 0.03);
		l.rotation.set(Math.cos(angle) * tilt, angle, -Math.sin(angle) * tilt * 0.2);
		g.add(l);
	}
	return g;
}

function notebook(): Group {
	const g = new Group();
	g.add(
		part(
			new BoxGeometry(0.15, 0.012, 0.21),
			new MeshStandardMaterial({ color: '#2f4858', roughness: 0.8 }),
			0,
			0.006,
			0,
		),
	);
	g.add(
		part(
			new BoxGeometry(0.144, 0.01, 0.205),
			new MeshStandardMaterial({ color: '#f1ece2', roughness: 0.9 }),
			0.004,
			0.006,
			0,
		),
	);
	const pen = part(
		new CylinderGeometry(0.004, 0.004, 0.14, 8),
		new MeshStandardMaterial({ color: '#1f1f1f', metalness: 0.4, roughness: 0.3 }),
		0.03,
		0.016,
		0,
	);
	pen.rotation.set(Math.PI / 2, 0, 0.2);
	g.add(pen);
	return g;
}

/**
 * A Scandinavian work desk: solid oak top on a slim black steel frame, a
 * shallow drawer, and the things that live on it - laptop, coffee, a plant,
 * a notebook (the coffee mug is a loose prop, see
 * `props.ts`). Built around the desk's footprint (`box`); the front faces +z.
 */
export function buildDesk(box: Box, reflections: Texture | null = null): Group {
	const g = new Group();
	g.position.set(box.x, 0, box.z);
	const w = box.width;
	const d = box.depth;
	const h = box.height;

	const wood = oak([1, 1]);
	const top = part(new RoundedBoxGeometry(w, TOP, d, 3, 0.008), wood, 0, h - TOP / 2, 0);
	g.add(top);

	// Frame: two side frames (legs + feet + top rail) and a back stretcher.
	const steel = blackSteel(reflections);
	const legH = h - TOP;
	for (const side of [-1, 1]) {
		const x = side * (w / 2 - 0.06);
		for (const z of [-d / 2 + 0.05, d / 2 - 0.05]) {
			g.add(part(new BoxGeometry(TUBE, legH, TUBE), steel, x, legH / 2, z));
			// Felt glides under the feet.
			g.add(part(new CylinderGeometry(0.012, 0.012, 0.006, 10), blackPlastic(), x, 0.003, z));
		}
		g.add(part(new BoxGeometry(TUBE, TUBE, d - 0.1 + TUBE), steel, x, legH - TUBE / 2, 0));
		g.add(part(new BoxGeometry(TUBE, TUBE, d - 0.1 + TUBE), steel, x, 0.12, 0));
	}
	g.add(
		part(new BoxGeometry(w - 0.12, TUBE * 1.6, TUBE / 2), steel, 0, legH - 0.05, -d / 2 + 0.05),
	);

	// A shallow drawer under the top, off to the right (front edge, oak face).
	const drawer = new Group();
	drawer.position.set(w * 0.22, legH - 0.045, d / 2 - 0.2);
	drawer.add(part(new BoxGeometry(0.42, 0.07, 0.38), oak([0.5, 0.3], 9), 0, 0, 0));
	drawer.add(part(new BoxGeometry(0.12, 0.012, 0.012), aluminium(reflections), 0, 0, 0.196));
	g.add(drawer);

	// Things on the desk.
	const surface = h;
	const pc = laptop(reflections);
	pc.position.set(0, surface, 0.04);
	g.add(pc);
	const green = buildPlant();
	green.position.set(-w / 2 + 0.12, surface, -d / 2 + 0.13);
	g.add(green);
	const notes = notebook();
	notes.position.set(-0.36, surface, 0.06);
	notes.rotation.y = 0.18;
	g.add(notes);
	return g;
}
