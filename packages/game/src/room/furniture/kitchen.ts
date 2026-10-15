import {
	BoxGeometry,
	CanvasTexture,
	CatmullRomCurve3,
	CylinderGeometry,
	Group,
	LatheGeometry,
	Mesh,
	MeshStandardMaterial,
	RepeatWrapping,
	SphereGeometry,
	SRGBColorSpace,
	TorusGeometry,
	TubeGeometry,
	Vector2,
	Vector3,
	type BufferGeometry,
	type Material,
	type Texture,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { Box } from '../layout.ts';
import { aluminium, blackPlastic, ceramic, chrome, oak } from '../materials.ts';

function part(geometry: BufferGeometry, material: Material, x = 0, y = 0, z = 0): Mesh {
	const mesh = new Mesh(geometry, material);
	mesh.position.set(x, y, z);
	mesh.castShadow = true;
	mesh.receiveShadow = true;
	return mesh;
}

/** Plinth (kick board) height under the cabinets. */
const PLINTH = 0.1;
const WORKTOP = 0.04;
const FRONT = 0.018;
/** Sage green lacquered fronts, matching the duvet and sofa. */
const fronts = () => new MeshStandardMaterial({ color: '#8fa391', roughness: 0.45 });
const carcass = () => new MeshStandardMaterial({ color: '#f1eee8', roughness: 0.6 });

/** White square tiles with grey grout for the backsplash (procedural, no download). */
function tileTexture(): Texture | null {
	if (typeof document === 'undefined') return null;
	const canvas = document.createElement('canvas');
	canvas.width = 128;
	canvas.height = 128;
	const ctx = canvas.getContext('2d');
	if (!ctx) return null;
	ctx.fillStyle = '#b9b4ab';
	ctx.fillRect(0, 0, 128, 128);
	for (let row = 0; row < 2; row++) {
		for (let col = 0; col < 2; col++) {
			const shade = 236 + ((row * 2 + col) % 3) * 4;
			ctx.fillStyle = `rgb(${shade}, ${shade - 2}, ${shade - 6})`;
			ctx.fillRect(col * 64 + 2, row * 64 + 2, 60, 60);
		}
	}
	const map = new CanvasTexture(canvas);
	map.wrapS = RepeatWrapping;
	map.wrapT = RepeatWrapping;
	map.colorSpace = SRGBColorSpace;
	return map;
}

/** Black ceramic glass with two printed cooking zones. */
function hobTexture(): Texture | null {
	if (typeof document === 'undefined') return null;
	const canvas = document.createElement('canvas');
	canvas.width = 128;
	canvas.height = 160;
	const ctx = canvas.getContext('2d');
	if (!ctx) return null;
	ctx.fillStyle = '#0c0c0e';
	ctx.fillRect(0, 0, 128, 160);
	ctx.strokeStyle = '#4a4a50';
	ctx.lineWidth = 2;
	for (const [x, y, r] of [
		[64, 44, 30],
		[64, 116, 36],
	] as const) {
		ctx.beginPath();
		ctx.arc(x, y, r, 0, Math.PI * 2);
		ctx.stroke();
	}
	ctx.fillStyle = '#5a5a60';
	ctx.fillRect(104, 150, 18, 4);
	const map = new CanvasTexture(canvas);
	map.colorSpace = SRGBColorSpace;
	return map;
}

function pull(length: number, vertical: boolean): Mesh {
	const bar = part(
		new BoxGeometry(0.012, vertical ? length : 0.012, vertical ? 0.012 : length),
		new MeshStandardMaterial({ color: '#1c1c1e', metalness: 0.5, roughness: 0.35 }),
	);
	return bar;
}

function kettle(reflections: Texture | null): Group {
	const g = new Group();
	const body = [
		new Vector2(0, 0),
		new Vector2(0.075, 0),
		new Vector2(0.085, 0.04),
		new Vector2(0.08, 0.15),
		new Vector2(0.05, 0.2),
		new Vector2(0, 0.205),
	];
	const steel = chrome(reflections);
	g.add(part(new LatheGeometry(body, 28), steel));
	g.add(part(new CylinderGeometry(0.09, 0.09, 0.02, 28), blackPlastic(), 0, -0.01, 0));
	const handle = part(
		new TorusGeometry(0.07, 0.012, 8, 20, Math.PI),
		blackPlastic(),
		-0.06,
		0.12,
		0,
	);
	handle.rotation.z = Math.PI / 2;
	g.add(handle);
	const spout = part(new CylinderGeometry(0.012, 0.02, 0.08, 10), steel, 0.09, 0.12, 0);
	spout.rotation.z = -0.9;
	g.add(spout);
	return g;
}

/** The frying pan on the hob, where the character cooks. */
function pan(): Group {
	const g = new Group();
	const iron = new MeshStandardMaterial({ color: '#2b2b2d', metalness: 0.6, roughness: 0.45 });
	const profile = [
		new Vector2(0, 0),
		new Vector2(0.11, 0),
		new Vector2(0.13, 0.045),
		new Vector2(0.125, 0.045),
		new Vector2(0.105, 0.006),
		new Vector2(0, 0.006),
	];
	g.add(part(new LatheGeometry(profile, 32), iron));
	const handle = part(new BoxGeometry(0.2, 0.014, 0.028), oak([0.1, 0.1], 51), -0.22, 0.035, 0);
	handle.rotation.z = 0.12;
	g.add(handle);
	return g;
}

export interface KitchenPlacement {
	/** Where the pan stands (world x/z): the cooking spot faces it. */
	pan: { x: number; z: number };
}

/**
 * A small kitchen line along the wall (fronts face -x): base cabinets with
 * sage fronts and black pulls on a plinth, an oak worktop with an induction
 * hob and a stainless sink with an arched tap, a tiled backsplash and wall
 * cabinets with a warm light under them. Built around the counter's
 * footprint (`box`); the worktop's top is at `box.height`.
 */
export function buildKitchenLine(
	box: Box,
	place: KitchenPlacement,
	reflections: Texture | null = null,
): Group {
	const g = new Group();
	const w = box.width; // depth from the wall
	const d = box.depth; // length along the wall
	const front = box.x - w / 2;
	const wall = box.x + w / 2;
	const top = box.height;
	const zStart = box.z - d / 2;

	// Fronts: a stack of three drawers under the hob, two doors under the sink.
	const lacquer = fronts();
	const frontH = top - WORKTOP - PLINTH - 0.006;
	const split = place.pan.z + 0.2 - zStart; // drawers end just past the hob
	const doors = d - split;
	const sinkZ = zStart + split + doors / 2;
	const SINK = { x: 0.32, z: 0.38, depth: 0.16 };
	const sinkX = box.x - 0.02;

	// Carcass and plinth; under the sink the carcass stops below the basin.
	g.add(
		part(new BoxGeometry(w - 0.05, PLINTH, d), blackPlastic(), box.x + 0.025, PLINTH / 2, box.z),
	);
	const body = carcass();
	const fullH = top - WORKTOP - PLINTH;
	g.add(
		part(
			new BoxGeometry(w - FRONT, fullH, split),
			body,
			box.x + FRONT / 2,
			PLINTH + fullH / 2,
			zStart + split / 2,
		),
	);
	const lowH = top - SINK.depth - 0.01 - PLINTH;
	g.add(
		part(
			new BoxGeometry(w - FRONT, lowH, doors),
			body,
			box.x + FRONT / 2,
			PLINTH + lowH / 2,
			zStart + split + doors / 2,
		),
	);
	const drawerHeights = [0.2, 0.25, frontH - 0.45];
	let y = top - WORKTOP - 0.003;
	for (const h of drawerHeights) {
		const drawer = part(
			new BoxGeometry(FRONT, h - 0.004, split - 0.006),
			lacquer,
			front + FRONT / 2,
			y - h / 2,
			zStart + split / 2,
		);
		g.add(drawer);
		const handle = pull(Math.min(0.3, split - 0.12), false);
		handle.position.set(front - 0.008, y - 0.05, zStart + split / 2);
		g.add(handle);
		y -= h;
	}
	for (const i of [0, 1]) {
		const z0 = zStart + split + (i * doors) / 2;
		g.add(
			part(
				new BoxGeometry(FRONT, frontH, doors / 2 - 0.006),
				lacquer,
				front + FRONT / 2,
				PLINTH + 0.003 + frontH / 2,
				z0 + doors / 4,
			),
		);
		const handle = pull(0.16, true);
		handle.position.set(
			front - 0.008,
			top - WORKTOP - 0.13,
			i === 0 ? z0 + doors / 2 - 0.05 : z0 + 0.05,
		);
		g.add(handle);
	}

	// Worktop: solid oak, a little overhang at the front, cut out for the sink.
	const worktop = oak([1.2, 0.5], 61);
	const wx = box.x - 0.01;
	const ww = w + 0.02;
	const slab = (x0: number, x1: number, z0: number, z1: number) =>
		g.add(
			part(
				new BoxGeometry(x1 - x0, WORKTOP, z1 - z0),
				worktop,
				(x0 + x1) / 2,
				top - WORKTOP / 2,
				(z0 + z1) / 2,
			),
		);
	const hole = {
		x0: sinkX - SINK.x / 2,
		x1: sinkX + SINK.x / 2,
		z0: sinkZ - SINK.z / 2,
		z1: sinkZ + SINK.z / 2,
	};
	slab(wx - ww / 2, wx + ww / 2, zStart, hole.z0);
	slab(wx - ww / 2, wx + ww / 2, hole.z1, zStart + d);
	slab(wx - ww / 2, hole.x0, hole.z0, hole.z1);
	slab(hole.x1, wx + ww / 2, hole.z0, hole.z1);

	// Induction hob under the pan.
	const glass = new MeshStandardMaterial({ color: '#ffffff', roughness: 0.08, metalness: 0.1 });
	const hobMap = hobTexture();
	if (hobMap) glass.map = hobMap;
	else glass.color.set('#0c0c0e');
	g.add(
		part(
			new RoundedBoxGeometry(0.36, 0.006, 0.46, 2, 0.002),
			glass,
			place.pan.x + 0.06,
			top + 0.003,
			place.pan.z - 0.11,
		),
	);
	const panModel = pan();
	panModel.position.set(place.pan.x, top + 0.006, place.pan.z);
	panModel.rotation.y = Math.PI * 0.85;
	g.add(panModel);

	// Sink: a stainless rim around a recessed basin, and an arched tap.
	const steel = aluminium(reflections);
	const rim = [
		[0.38, 0.03, 0, -0.205],
		[0.38, 0.03, 0, 0.205],
		[0.03, 0.44, -0.175, 0],
		[0.03, 0.44, 0.175, 0],
	] as const;
	for (const [sx, sz, ox, oz] of rim) {
		g.add(part(new BoxGeometry(sx, 0.006, sz), steel, sinkX + ox, top + 0.003, sinkZ + oz));
	}
	g.add(
		part(
			new BoxGeometry(0.32, 0.004, 0.38),
			new MeshStandardMaterial({ color: '#7d8188', metalness: 0.7, roughness: 0.35 }),
			sinkX,
			top - SINK.depth,
			sinkZ,
		),
	);
	for (const [sx, sz, ox, oz] of [
		[0.32, 0.004, 0, -0.19],
		[0.32, 0.004, 0, 0.19],
		[0.004, 0.38, -0.16, 0],
		[0.004, 0.38, 0.16, 0],
	] as const) {
		g.add(
			part(
				new BoxGeometry(sx, SINK.depth, sz),
				steel,
				sinkX + ox,
				top - SINK.depth / 2,
				sinkZ + oz,
			),
		);
	}
	const tapCurve = new CatmullRomCurve3([
		new Vector3(wall - 0.06, top, sinkZ),
		new Vector3(wall - 0.06, top + 0.26, sinkZ),
		new Vector3(wall - 0.12, top + 0.33, sinkZ),
		new Vector3(wall - 0.2, top + 0.28, sinkZ),
		new Vector3(wall - 0.2, top + 0.22, sinkZ),
	]);
	g.add(part(new TubeGeometry(tapCurve, 24, 0.012, 10), chrome(reflections)));
	const lever = part(
		new CylinderGeometry(0.006, 0.006, 0.08, 8),
		chrome(reflections),
		wall - 0.06,
		top + 0.12,
		sinkZ + 0.03,
	);
	lever.rotation.x = Math.PI / 2.4;
	g.add(lever);

	// Backsplash tiles between worktop and wall cabinets.
	const UPPER_BOTTOM = 1.45;
	const tiles = new MeshStandardMaterial({ color: '#ffffff', roughness: 0.25 });
	const tileMap = tileTexture();
	if (tileMap) {
		tileMap.repeat.set(d / 0.2, (UPPER_BOTTOM - top) / 0.2);
		tiles.map = tileMap;
	} else tiles.color.set('#ece8e1');
	const splash = part(
		new BoxGeometry(0.01, UPPER_BOTTOM - top, d),
		tiles,
		wall - 0.005,
		(top + UPPER_BOTTOM) / 2,
		box.z,
	);
	splash.castShadow = false;
	g.add(splash);

	// Wall cabinets with a warm light strip under them.
	const upperDepth = 0.33;
	const upperH = 0.62;
	const ux = wall - upperDepth / 2;
	g.add(
		part(new BoxGeometry(upperDepth, upperH, d), carcass(), ux, UPPER_BOTTOM + upperH / 2, box.z),
	);
	for (const i of [0, 1]) {
		const z0 = zStart + (i * d) / 2;
		g.add(
			part(
				new BoxGeometry(FRONT, upperH - 0.006, d / 2 - 0.006),
				carcass(),
				ux - upperDepth / 2 - FRONT / 2,
				UPPER_BOTTOM + upperH / 2,
				z0 + d / 4,
			),
		);
		const handle = pull(0.14, true);
		handle.position.set(
			ux - upperDepth / 2 - FRONT - 0.008,
			UPPER_BOTTOM + 0.12,
			i === 0 ? z0 + d / 2 - 0.05 : z0 + 0.05,
		);
		g.add(handle);
	}
	const strip = part(
		new BoxGeometry(0.03, 0.008, d - 0.1),
		new MeshStandardMaterial({ color: '#fff4dd', emissive: '#ffd9a0', emissiveIntensity: 1.2 }),
		ux - upperDepth / 2 + 0.06,
		UPPER_BOTTOM - 0.004,
		box.z,
	);
	strip.castShadow = false;
	g.add(strip);

	// What lives on the worktop: a kettle, a cutting board, olive oil, herbs.
	const k = kettle(reflections);
	k.position.set(wall - 0.15, top, zStart + split + 0.02);
	k.rotation.y = Math.PI; // spout towards the room, handle to the wall
	g.add(k);
	const board = part(
		new RoundedBoxGeometry(0.22, 0.02, 0.32, 2, 0.006),
		oak([0.4, 0.4], 71),
		box.x - 0.06,
		top + 0.01,
		zStart + split - 0.02,
	);
	board.rotation.y = 0.15;
	g.add(board);
	const oil = new Group();
	oil.position.set(wall - 0.07, top, zStart + 0.08);
	oil.add(
		part(
			new LatheGeometry(
				[
					new Vector2(0, 0),
					new Vector2(0.03, 0),
					new Vector2(0.03, 0.2),
					new Vector2(0.012, 0.24),
					new Vector2(0.012, 0.27),
					new Vector2(0, 0.27),
				],
				16,
			),
			new MeshStandardMaterial({
				color: '#6b6b1f',
				roughness: 0.15,
				transparent: true,
				opacity: 0.85,
			}),
		),
	);
	g.add(oil);
	const herbs = new Group();
	herbs.position.set(wall - 0.09, top, box.z + d / 2 - 0.08);
	herbs.add(part(new CylinderGeometry(0.06, 0.05, 0.1, 16), ceramic('#e9e4da'), 0, 0.05, 0));
	const leaf = new MeshStandardMaterial({ color: '#4d7a3a', roughness: 0.6 });
	for (let i = 0; i < 7; i++) {
		const a = (i / 7) * Math.PI * 2;
		const l = part(
			new SphereGeometry(1, 8, 6),
			leaf,
			Math.sin(a) * 0.03,
			0.14 + (i % 2) * 0.03,
			Math.cos(a) * 0.03,
		);
		l.scale.set(0.025, 0.035, 0.025);
		herbs.add(l);
	}
	g.add(herbs);
	return g;
}

/**
 * A freestanding fridge-freezer (front faces -x): satin white body, freezer
 * drawer at the bottom, long bar handles, magnets, a photo and a note on
 * the door. Built around the fridge's footprint (`box`).
 */
export function buildFridge(box: Box, reflections: Texture | null = null): Group {
	const g = new Group();
	const front = box.x - box.width / 2;
	const enamel = new MeshStandardMaterial({ color: '#eef0f1', roughness: 0.32, metalness: 0.05 });
	g.add(
		part(
			new RoundedBoxGeometry(box.width - 0.02, box.height - 0.04, box.depth, 3, 0.02),
			enamel,
			box.x + 0.01,
			0.04 + (box.height - 0.04) / 2,
			box.z,
		),
	);
	g.add(
		part(
			new BoxGeometry(box.width - 0.04, 0.04, box.depth - 0.04),
			blackPlastic(),
			box.x + 0.02,
			0.02,
			box.z,
		),
	);
	// Doors: freezer drawer below, fridge door above, a dark gap between.
	const freezerTop = 0.6;
	g.add(
		part(
			new BoxGeometry(0.004, 0.012, box.depth - 0.02),
			blackPlastic(),
			front + 0.006,
			freezerTop,
			box.z,
		),
	);
	const handleZ = box.z + box.depth / 2 - 0.07;
	const steel = aluminium(reflections);
	for (const [y0, y1] of [
		[0.42, freezerTop - 0.06],
		[freezerTop + 0.08, box.height - 0.12],
	] as const) {
		const length = y1 - y0;
		g.add(
			part(
				new RoundedBoxGeometry(0.025, length, 0.025, 2, 0.008),
				steel,
				front - 0.03,
				(y0 + y1) / 2,
				handleZ,
			),
		);
		for (const yy of [y0 + 0.02, y1 - 0.02]) {
			g.add(part(new BoxGeometry(0.03, 0.02, 0.02), steel, front - 0.015, yy, handleZ));
		}
	}
	// Life on the door: a photo, a shopping list, a few magnets.
	const photo = part(
		new BoxGeometry(0.003, 0.12, 0.09),
		new MeshStandardMaterial({ color: '#7fa6c9', roughness: 0.4 }),
		front - 0.002,
		1.3,
		box.z - 0.08,
	);
	photo.rotation.x = 0.06;
	g.add(photo);
	g.add(
		part(
			new BoxGeometry(0.002, 0.16, 0.1),
			new MeshStandardMaterial({ color: '#f6f1df', roughness: 0.9 }),
			front - 0.002,
			1.05,
			box.z + 0.05,
		),
	);
	for (const [yy, zz, color] of [
		[1.36, -0.08, '#d1495b'],
		[1.12, 0.05, '#edae49'],
		[0.95, -0.12, '#00798c'],
	] as const) {
		g.add(
			part(
				new CylinderGeometry(0.012, 0.012, 0.008, 12).rotateZ(Math.PI / 2),
				new MeshStandardMaterial({ color, roughness: 0.4 }),
				front - 0.006,
				yy,
				box.z + zz,
			),
		);
	}
	return g;
}
