import {
	AdditiveBlending,
	AlwaysStencilFunc,
	EqualStencilFunc,
	ReplaceStencilOp,
	BoxGeometry,
	CylinderGeometry,
	DoubleSide,
	Group,
	Mesh,
	MeshBasicMaterial,
	MeshStandardMaterial,
	PlaneGeometry,
	SphereGeometry,
	type BufferGeometry,
	type Material,
	type Texture,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { Box } from './layout.ts';
import { BACK_WINDOW, DOOR, ROOM } from './layout.ts';
import {
	artPrint,
	blackSteel,
	facadeTextures,
	fabric,
	oak,
	paintedWood,
	woolRug,
} from './materials.ts';
import { buildPlant } from './furniture/desk.ts';
import { keepSeparate } from './merge-static.ts';

/** The walls are this thick; their inner faces are the room's bounds. */
export const WALL = 0.1;

function part(geometry: BufferGeometry, material: Material, x = 0, y = 0, z = 0): Mesh {
	const mesh = new Mesh(geometry, material);
	mesh.position.set(x, y, z);
	mesh.castShadow = true;
	mesh.receiveShadow = true;
	return mesh;
}

/**
 * Skirting boards along the three walls (white satin paint), interrupted by
 * the doorway's architrave.
 */
export function buildSkirting(): Group {
	const group = new Group();
	const paint = paintedWood();
	const h = 0.08;
	const t = 0.016;
	const { width, depth } = ROOM;
	group.add(part(new BoxGeometry(width, h, t), paint, 0, h / 2, -depth / 2 + t / 2));
	group.add(part(new BoxGeometry(t, h, depth), paint, width / 2 - t / 2, h / 2, 0));
	const doorFrom = DOOR.z - DOOR.width / 2 - ARCHITRAVE;
	const doorTo = DOOR.z + DOOR.width / 2 + ARCHITRAVE;
	for (const [a, b] of [
		[-depth / 2, doorFrom],
		[doorTo, depth / 2],
	] as const) {
		group.add(part(new BoxGeometry(t, h, b - a), paint, -width / 2 + t / 2, h / 2, (a + b) / 2));
	}
	return group;
}

const ARCHITRAVE = 0.07;
const JAMB = 0.02;

export interface Door {
	/** The leaf on its hinge; rotate around y to open it (into the hallway). */
	hinge: Group;
	/** The frame around the doorway (static). */
	frame: Group;
}

/**
 * A panelled interior door: a white satin leaf with two raised panels on
 * each side, a black lever handle with rosettes, set in a lined frame with
 * an architrave on the room side.
 */
export function buildDoor(): Door {
	const paint = paintedWood('#f4f1ec');
	const steel = blackSteel();
	const x = -ROOM.width / 2;
	const frame = new Group();
	// Lining: boards covering the doorway's reveal (top and both sides).
	for (const side of [-1, 1]) {
		frame.add(
			part(
				new BoxGeometry(WALL, DOOR.height, JAMB),
				paint,
				x - WALL / 2,
				DOOR.height / 2,
				DOOR.z + side * (DOOR.width / 2 - JAMB / 2),
			),
		);
	}
	frame.add(
		part(
			new BoxGeometry(WALL, JAMB, DOOR.width),
			paint,
			x - WALL / 2,
			DOOR.height - JAMB / 2,
			DOOR.z,
		),
	);
	// Architrave on the room side.
	for (const side of [-1, 1]) {
		frame.add(
			part(
				new RoundedBoxGeometry(0.018, DOOR.height + ARCHITRAVE, ARCHITRAVE, 2, 0.006),
				paint,
				x + 0.009,
				(DOOR.height + ARCHITRAVE) / 2,
				DOOR.z + side * (DOOR.width / 2 + ARCHITRAVE / 2),
			),
		);
	}
	frame.add(
		part(
			new RoundedBoxGeometry(0.018, ARCHITRAVE, DOOR.width + ARCHITRAVE * 2, 2, 0.006),
			paint,
			x + 0.009,
			DOOR.height + ARCHITRAVE / 2,
			DOOR.z,
		),
	);

	// The leaf, hinged at the back edge of the doorway, in the middle of the wall.
	const leafW = DOOR.width - JAMB * 2;
	const leafH = DOOR.height - JAMB - 0.01;
	const thick = 0.04;
	const hinge = new Group();
	hinge.position.set(x - WALL / 2, 0, DOOR.z - DOOR.width / 2 + JAMB);
	const leaf = new Group();
	leaf.position.set(0, 0.005, leafW / 2);
	hinge.add(leaf);
	leaf.add(part(new BoxGeometry(thick, leafH, leafW), paint, 0, leafH / 2, 0));
	// Raised panels (upper tall, lower short) on both faces.
	const panelW = leafW - 0.22;
	for (const face of [-1, 1]) {
		for (const [h, y] of [
			[leafH * 0.5, leafH * 0.67],
			[leafH * 0.3, leafH * 0.24],
		] as const) {
			leaf.add(
				part(
					new RoundedBoxGeometry(0.012, h, panelW, 2, 0.004),
					paint,
					face * (thick / 2 + 0.002),
					y,
					0,
				),
			);
		}
	}
	// Lever handles with rosettes on both sides, near the free edge.
	const handleZ = leafW / 2 - 0.08;
	for (const face of [-1, 1]) {
		const rosette = part(
			new CylinderGeometry(0.025, 0.025, 0.01, 20),
			steel,
			face * (thick / 2 + 0.005),
			1.0,
			handleZ,
		);
		rosette.rotation.z = Math.PI / 2;
		leaf.add(rosette);
		leaf.add(
			part(new BoxGeometry(0.05, 0.016, 0.016), steel, face * (thick / 2 + 0.03), 1.0, handleZ),
		);
		const lever = part(
			new RoundedBoxGeometry(0.018, 0.018, 0.13, 2, 0.007),
			steel,
			face * (thick / 2 + 0.055),
			1.0,
			handleZ - 0.055,
		);
		leaf.add(lever);
		// Key escutcheon below.
		const key = part(
			new CylinderGeometry(0.012, 0.012, 0.008, 14),
			steel,
			face * (thick / 2 + 0.004),
			0.88,
			handleZ,
		);
		key.rotation.z = Math.PI / 2;
		leaf.add(key);
	}
	return { hinge, frame };
}

export interface Window {
	group: Group;
	/** Outside, by daylight (0 night .. 1 day) and sky colour. */
	setOutside(daylight: number, sky: [number, number, number]): void;
}

/**
 * The back window: a white timber casement with two sashes and glass, an oak
 * sill with a plant on it, linen curtains on a black rod - and outside, the
 * tenement across the street under the sky (its windows light up at night).
 */
export function buildWindow(reflections: Texture | null): Window {
	const group = new Group();
	const win = BACK_WINDOW;
	const wallFace = -ROOM.depth / 2;
	const frameZ = wallFace - WALL / 2;
	const paint = paintedWood();
	const left = win.x - win.width / 2;
	const right = win.x + win.width / 2;
	const bottom = win.y - win.height / 2;
	const top = win.y + win.height / 2;

	// Outer frame, then two sashes (each with its own frame) meeting at the middle.
	const f = 0.06;
	const depthF = 0.07;
	for (const [w, h, x, y] of [
		[win.width, f, win.x, top - f / 2],
		[win.width, f, win.x, bottom + f / 2],
		[f, win.height, left + f / 2, win.y],
		[f, win.height, right - f / 2, win.y],
	] as const) {
		group.add(part(new BoxGeometry(w, h, depthF), paint, x, y, frameZ));
	}
	const sash = 0.045;
	const innerW = win.width - f * 2;
	const innerH = win.height - f * 2;
	const glass = new MeshStandardMaterial({
		color: '#a9bccb',
		metalness: 0.9,
		roughness: 0.05,
		transparent: true,
		opacity: 0.12,
		envMap: reflections,
		envMapIntensity: 0.6,
		depthWrite: false,
	});
	for (const s of [-1, 1]) {
		const cx = win.x + (s * innerW) / 4;
		const sw = innerW / 2;
		for (const [w, h, x, y] of [
			[sw, sash, cx, top - f - sash / 2],
			[sw, sash, cx, bottom + f + sash / 2],
			[sash, innerH, cx - sw / 2 + sash / 2, win.y],
			[sash, innerH, cx + sw / 2 - sash / 2, win.y],
		] as const) {
			group.add(part(new BoxGeometry(w, h, 0.05), paint, x, y, frameZ + 0.01));
		}
		const pane = new Mesh(new PlaneGeometry(sw - sash * 2, innerH - sash * 2), glass);
		pane.position.set(cx, win.y, frameZ + 0.01);
		pane.renderOrder = 1;
		group.add(pane);
		// A window handle on the right sash.
		if (s === 1) {
			const handle = part(
				new RoundedBoxGeometry(0.018, 0.1, 0.018, 2, 0.007),
				paintedWood('#e8e4dc'),
				cx - sw / 2 + sash / 2,
				win.y - 0.04,
				frameZ + 0.05,
			);
			group.add(handle);
		}
	}

	// Oak sill, standing a little proud of the wall, and a plant on it.
	const sillDepth = 0.17;
	group.add(
		part(
			new RoundedBoxGeometry(win.width + 0.12, 0.03, sillDepth, 2, 0.008),
			oak([1.2, 0.2], 13),
			win.x,
			bottom - 0.015,
			frameZ + WALL / 2 - sillDepth / 2 + 0.07,
		),
	);
	const plant = buildPlant();
	plant.position.set(right - 0.22, bottom, wallFace - 0.02);
	plant.scale.setScalar(1.2);
	group.add(plant);

	// Curtains: gathered linen on a black rod, pulled to the sides.
	const rodY = top + 0.14;
	const rodZ = wallFace + 0.15;
	const steel = blackSteel(reflections);
	const rodLeft = left - 0.36;
	const rodRight = right + 0.22;
	const rodPiece = part(
		new CylinderGeometry(0.012, 0.012, rodRight - rodLeft, 12),
		steel,
		(rodLeft + rodRight) / 2,
		rodY,
		rodZ,
	);
	rodPiece.rotation.z = Math.PI / 2;
	group.add(rodPiece);
	for (const x of [rodLeft, rodRight]) {
		group.add(part(new SphereGeometry(0.022, 12, 8), steel, x, rodY, rodZ));
		group.add(
			part(
				new BoxGeometry(0.015, 0.015, 0.15),
				steel,
				x + (x < win.x ? 0.06 : -0.06),
				rodY,
				rodZ - 0.075,
			),
		);
	}
	const linen = fabric('#e6dccb', [3, 6]);
	linen.side = DoubleSide;
	const curtainBottom = bottom - 0.12;
	for (const [from, to] of [
		[rodLeft + 0.02, left + 0.12],
		[right - 0.12, rodRight - 0.04],
	] as const) {
		const w = to - from;
		const h = rodY - curtainBottom;
		const geometry = new PlaneGeometry(w, h, 32, 6);
		const position = geometry.getAttribute('position');
		for (let i = 0; i < position.count; i++) {
			const x = position.getX(i);
			const y = position.getY(i);
			// Deep folds, a little looser towards the hem.
			const folds = Math.sin((x / w) * Math.PI * 7) * (0.014 + (0.5 - y / h) * 0.005);
			position.setZ(i, folds);
		}
		geometry.computeVertexNormals();
		const curtain = part(geometry, linen, (from + to) / 2, curtainBottom + h / 2, rodZ);
		group.add(curtain);
	}

	// Outside: the building across the street, the sky above it. Far enough
	// away that tilting the phone shows a little parallax.
	const outside = new Group();
	keepSeparate(outside);
	// Only seen through the window: the glass marks its pixels in the stencil
	// buffer first, and everything outside is drawn only there - so the street
	// never shows around the room when the camera looks into it from above.
	const portal = new Mesh(
		new PlaneGeometry(win.width, win.height),
		new MeshBasicMaterial({
			colorWrite: false,
			depthWrite: false,
			stencilWrite: true,
			stencilRef: 1,
			stencilFunc: AlwaysStencilFunc,
			stencilZPass: ReplaceStencilOp,
		}),
	);
	portal.position.set(win.x, win.y, wallFace - WALL);
	portal.renderOrder = -1;
	outside.add(portal);
	const throughWindow = {
		stencilWrite: true,
		stencilRef: 1,
		stencilFunc: EqualStencilFunc,
	} as const;
	const textures = facadeTextures();
	const skyMaterial = new MeshBasicMaterial({ color: '#000000', ...throughWindow });
	const sky = new Mesh(new PlaneGeometry(40, 24), skyMaterial);
	sky.position.set(win.x, 4, wallFace - 16);
	outside.add(sky);
	const facadeMaterial = new MeshBasicMaterial({
		...throughWindow,
		color: '#ffffff',
		map: textures?.facade ?? null,
	});
	if (!textures) facadeMaterial.color.set('#d9c9a8');
	const facadeW = 16;
	const facadeH = 16;
	const facadeTop = 2.9;
	const facadeZ = wallFace - 7;
	for (const texture of textures ? [textures.facade, textures.lit] : [])
		texture.repeat.set(facadeW / 12.8, facadeH / 12.8);
	const facade = new Mesh(new PlaneGeometry(facadeW, facadeH), facadeMaterial);
	facade.position.set(win.x, facadeTop - facadeH / 2, facadeZ);
	outside.add(facade);
	const litMaterial = new MeshBasicMaterial({
		...throughWindow,
		map: textures?.lit ?? null,
		transparent: true,
		blending: AdditiveBlending,
		depthWrite: false,
		opacity: 0,
	});
	const lit = new Mesh(new PlaneGeometry(facadeW, facadeH), litMaterial);
	lit.position.set(win.x, facadeTop - facadeH / 2, facadeZ + 0.01);
	outside.add(lit);
	// Roof edge: a dark cornice line against the sky.
	const corniceMaterial = new MeshBasicMaterial({ color: '#6d6152', ...throughWindow });
	outside.add(
		new Mesh(new PlaneGeometry(facadeW, 0.25), corniceMaterial)
			.translateX(win.x)
			.translateY(facadeTop)
			.translateZ(facadeZ + 0.02),
	);
	group.add(outside);

	return {
		group,
		setOutside(daylight, [r, g, b]) {
			skyMaterial.color.setRGB(r, g, b);
			// The facade is lit by the sky: bright by day, a dim blue at night.
			const lightness = 0.02 + daylight ** 1.5 * 0.98;
			facadeMaterial.color.setRGB(lightness * 0.92, lightness * 0.95, lightness);
			corniceMaterial.color.setRGB(lightness * 0.15, lightness * 0.12, lightness * 0.09);
			litMaterial.opacity = Math.max(0, 1 - daylight * 2);
		},
	};
}

/** The wool rug on the floor (a thin slab, so it has an edge). */
export function buildRug(box: Box): Mesh {
	const rug = part(
		new BoxGeometry(box.width, 0.012, box.depth),
		woolRug(box.width, box.depth),
		box.x,
		0.006,
		box.z,
	);
	rug.castShadow = false;
	return rug;
}

/** A framed print hanging on a wall: thin black frame, white mat, the print behind glass. */
export function buildPrint(kind: 'arches' | 'hills', width: number, height: number): Group {
	const group = new Group();
	const frame = new MeshStandardMaterial({ color: '#1b1b1d', roughness: 0.5 });
	const b = 0.022;
	const d = 0.025;
	for (const [w, h, x, y] of [
		[width, b, 0, height / 2 - b / 2],
		[width, b, 0, -height / 2 + b / 2],
		[b, height, -width / 2 + b / 2, 0],
		[b, height, width / 2 - b / 2, 0],
	] as const) {
		group.add(part(new BoxGeometry(w, h, d), frame, x, y, d / 2));
	}
	group.add(
		part(
			new PlaneGeometry(width - b * 2, height - b * 2),
			new MeshStandardMaterial({ color: '#f5f2ec', roughness: 0.9 }),
			0,
			0,
			0.004,
		),
	);
	const mat = 0.06;
	group.add(
		part(
			new PlaneGeometry(width - b * 2 - mat * 2, height - b * 2 - mat * 2),
			artPrint(kind),
			0,
			0,
			0.006,
		),
	);
	return group;
}
