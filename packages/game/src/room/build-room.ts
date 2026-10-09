import {
	BoxGeometry,
	Color,
	CylinderGeometry,
	DirectionalLight,
	Group,
	HemisphereLight,
	Mesh,
	MeshBasicMaterial,
	MeshStandardMaterial,
	PlaneGeometry,
	Path,
	PointLight,
	Shape,
	ExtrudeGeometry,
	SphereGeometry,
	type Material,
	type Texture,
} from 'three';
import type { PhysicsWorld } from '../physics.ts';
import { BACK_WINDOW, DOOR, FURNITURE, ROOM, TARGETS, type Box } from './layout.ts';
import { buildBed } from './furniture/bed.ts';
import { buildDesk } from './furniture/desk.ts';
import { buildOfficeChair } from './furniture/office-chair.ts';
import { buildSofa } from './furniture/sofa.ts';
import { daylight, skyColor } from './sky.ts';

const PALETTE = {
	floor: '#8a6448',
	backWall: '#d8c8b2',
	sideWall: '#cbb9a2',
	rug: '#5f7397',
	lampPole: '#2f2f33',
	lampShade: '#ffe2b8',
	windowFrame: '#f1ece4',
	fridge: '#e8ecef',
	handle: '#9aa3ab',
	counter: '#6b8f71',
	worktop: '#d9d2c5',
	bowl: '#f4a261',
	door: '#a47551',
	hallway: '#2a2622',
	pan: '#3a3a3a',
	tvGlow: '#7fb4ff',
} as const;

export interface Room {
	group: Group;
	/** Updates outside light for the given local time (hours, 0-24). */
	setTimeOfDay(hours: number): void;
	/** 0 closed .. 1 open. */
	setDoor(openness: number): void;
	/** The TV "on our side of the glass": its flicker on the room, 0 = off. */
	setTvGlow(intensity: number, hue: number): void;
	/** The swivel chair turned this far from facing the desk (radians). */
	setChairSwivel(angle: number): void;
	/** 0 the duvet lies flat .. 1 it covers someone lying in bed. */
	setDuvet(cover: number): void;
}

function mat(color: string, extra: Partial<MeshStandardMaterial> = {}): MeshStandardMaterial {
	return new MeshStandardMaterial({ color, roughness: 0.85, ...extra });
}

function box(box: Box, material: Material, yOffset = 0): Mesh {
	const mesh = new Mesh(new BoxGeometry(box.width, box.height, box.depth), material);
	mesh.position.set(box.x, (box.y ?? 0) + yOffset + box.height / 2, box.z);
	mesh.castShadow = true;
	mesh.receiveShadow = true;
	return mesh;
}

function addStatic(physics: PhysicsWorld, b: Box): void {
	physics.addStaticBox(
		{ x: b.width / 2, y: b.height / 2, z: b.depth / 2 },
		{ x: b.x, y: (b.y ?? 0) + b.height / 2, z: b.z },
	);
}

/**
 * Builds the starter flat (meshes + static colliders). No game logic.
 * `reflections` is an environment map for metal parts (none in tests).
 */
export function buildRoom(physics: PhysicsWorld, reflections: Texture | null = null): Room {
	const group = new Group();
	group.name = 'room';
	const { width, depth, height } = ROOM;

	// Floor
	const floor = new Mesh(new PlaneGeometry(width, depth), mat(PALETTE.floor, { roughness: 0.7 }));
	floor.rotation.x = -Math.PI / 2;
	floor.receiveShadow = true;
	group.add(floor);
	physics.addStaticBox({ x: width / 2, y: 0.1, z: depth / 2 }, { x: 0, y: -0.1, z: 0 });

	// The glass the player looks through, and a ceiling: invisible, but when the phone is
	// tilted or shaken, loose things bump into them instead of falling out of the world.
	physics.addStaticBox(
		{ x: width / 2, y: height / 2, z: 0.05 },
		{ x: 0, y: height / 2, z: depth / 2 + 0.05 },
	);
	physics.addStaticBox({ x: width / 2, y: 0.05, z: depth / 2 }, { x: 0, y: height + 0.05, z: 0 });

	// Walls: back + sides. The front is open - that is the player's window.
	const wallThickness = 0.1;
	const backWall = mat(PALETTE.backWall);
	const sideWall = mat(PALETTE.sideWall);
	const win = BACK_WINDOW;
	const backZ = -depth / 2 - wallThickness / 2;
	// One solid wall with a hole for the window - no seams between pieces.
	const outline = new Shape();
	outline.moveTo(-width / 2, 0);
	outline.lineTo(width / 2, 0);
	outline.lineTo(width / 2, height);
	outline.lineTo(-width / 2, height);
	outline.closePath();
	const hole = new Path();
	hole.moveTo(win.x - win.width / 2, win.y - win.height / 2);
	hole.lineTo(win.x + win.width / 2, win.y - win.height / 2);
	hole.lineTo(win.x + win.width / 2, win.y + win.height / 2);
	hole.lineTo(win.x - win.width / 2, win.y + win.height / 2);
	hole.closePath();
	outline.holes.push(hole);
	const backWallMesh = new Mesh(
		new ExtrudeGeometry(outline, { depth: wallThickness, bevelEnabled: false }),
		backWall,
	);
	backWallMesh.position.z = -depth / 2 - wallThickness;
	backWallMesh.receiveShadow = true;
	group.add(backWallMesh);
	physics.addStaticBox(
		{ x: width / 2, y: height / 2, z: wallThickness / 2 },
		{ x: 0, y: height / 2, z: backZ },
	);
	for (const side of [-1, 1]) {
		const b: Box = {
			x: side * (width / 2 + wallThickness / 2),
			z: 0,
			width: wallThickness,
			height,
			depth,
		};
		// The collider is solid on both sides (loose things never leave through the door).
		addStatic(physics, b);
		if (side === 1) {
			const mesh = box(b, sideWall);
			mesh.castShadow = false;
			group.add(mesh);
		}
	}

	// Left wall with a doorway (one extruded shape, like the back wall). Shape x = room z.
	const leftOutline = new Shape();
	leftOutline.moveTo(-depth / 2, 0);
	leftOutline.lineTo(depth / 2, 0);
	leftOutline.lineTo(depth / 2, height);
	leftOutline.lineTo(-depth / 2, height);
	leftOutline.closePath();
	const doorway = new Path();
	doorway.moveTo(DOOR.z - DOOR.width / 2, 0);
	doorway.lineTo(DOOR.z + DOOR.width / 2, 0);
	doorway.lineTo(DOOR.z + DOOR.width / 2, DOOR.height);
	doorway.lineTo(DOOR.z - DOOR.width / 2, DOOR.height);
	doorway.closePath();
	leftOutline.holes.push(doorway);
	const leftWall = new Mesh(
		new ExtrudeGeometry(leftOutline, { depth: wallThickness, bevelEnabled: false }),
		sideWall,
	);
	leftWall.rotation.y = -Math.PI / 2;
	leftWall.position.x = -width / 2;
	leftWall.receiveShadow = true;
	group.add(leftWall);
	// A dim hallway behind the doorway.
	const hallway = new Mesh(
		new PlaneGeometry(DOOR.width + 0.4, DOOR.height + 0.2),
		mat(PALETTE.hallway, { roughness: 1 }),
	);
	hallway.rotation.y = Math.PI / 2;
	hallway.position.set(-width / 2 - 1, DOOR.height / 2, DOOR.z);
	group.add(hallway);
	// The door swings out into the hallway around its hinge.
	const doorHinge = new Group();
	doorHinge.position.set(-width / 2 - wallThickness / 2, 0, DOOR.z - DOOR.width / 2);
	const doorPanel = new Mesh(
		new BoxGeometry(0.04, DOOR.height, DOOR.width),
		mat(PALETTE.door, { roughness: 0.6 }),
	);
	doorPanel.position.set(0, DOOR.height / 2, DOOR.width / 2);
	doorPanel.castShadow = true;
	const knob = new Mesh(new SphereGeometry(0.035, 12, 8), mat(PALETTE.handle, { metalness: 0.6 }));
	knob.position.set(0.05, 1.0, DOOR.width - 0.12);
	doorPanel.add(knob);
	doorHinge.add(doorPanel);
	group.add(doorHinge);

	// Back window: frame + sky
	const skyMaterial = new MeshBasicMaterial({ color: '#000000' });
	const sky = new Mesh(new PlaneGeometry(win.width, win.height), skyMaterial);
	sky.position.set(win.x, win.y, -depth / 2 - wallThickness);
	group.add(sky);
	const frame = mat(PALETTE.windowFrame, { roughness: 0.5 });
	const bar = 0.05;
	for (const [w, h, x, y] of [
		[win.width + bar * 2, bar, win.x, win.y + win.height / 2],
		[win.width + bar * 2, bar, win.x, win.y - win.height / 2],
		[bar, win.height, win.x - win.width / 2, win.y],
		[bar, win.height, win.x + win.width / 2, win.y],
		[bar, win.height, win.x, win.y],
	] as const) {
		const piece = new Mesh(new BoxGeometry(w, h, 0.08), frame);
		piece.position.set(x, y, -depth / 2 - 0.02);
		group.add(piece);
	}

	// Rug
	const rug = new Mesh(
		new PlaneGeometry(FURNITURE.rug.width, FURNITURE.rug.depth),
		mat(PALETTE.rug, { roughness: 1 }),
	);
	rug.rotation.x = -Math.PI / 2;
	rug.position.set(FURNITURE.rug.x, 0.005, FURNITURE.rug.z);
	rug.receiveShadow = true;
	group.add(rug);

	// Bed (oak frame, upholstered headboard, linen, a duvet that covers the sleeper) and nightstand.
	const bed = FURNITURE.bed;
	const realBed = buildBed(bed, TARGETS.bed.lie, FURNITURE.nightstand);
	group.add(realBed.group);
	addStatic(physics, bed);
	addStatic(physics, FURNITURE.nightstand);

	// Sofa: oak legs, deep cushions, a throw pillow and a knitted throw.
	const sofa = FURNITURE.sofa;
	group.add(buildSofa(sofa));
	addStatic(physics, sofa);

	// Desk: oak top on a steel frame, with a laptop, coffee, a plant and a notebook.
	const desk = FURNITURE.desk;
	group.add(buildDesk(desk, reflections));
	addStatic(physics, desk);

	// Desk chair: an office chair whose top half swivels (back rest towards the camera at rest).
	const chair = FURNITURE.deskChair;
	const officeChair = buildOfficeChair(chair, reflections);
	group.add(officeChair.group);
	const swivel = officeChair.swivel;
	addStatic(physics, chair);

	// Kitchenette: fridge + counter with a fruit bowl
	const fridge = FURNITURE.fridge;
	group.add(box(fridge, mat(PALETTE.fridge, { roughness: 0.4 })));
	for (const [y, h] of [
		[1.15, 0.35],
		[0.55, 0.45],
	] as const) {
		group.add(
			box(
				{
					x: fridge.x - fridge.width / 2 - 0.015,
					z: fridge.z + 0.18,
					y,
					width: 0.03,
					height: h,
					depth: 0.03,
				},
				mat(PALETTE.handle, { roughness: 0.3, metalness: 0.6 }),
			),
		);
	}
	addStatic(physics, fridge);
	const counter = FURNITURE.counter;
	group.add(box({ ...counter, height: counter.height - 0.04 }, mat(PALETTE.counter)));
	group.add(
		box(
			{
				...counter,
				x: counter.x - 0.02,
				y: counter.height - 0.04,
				height: 0.04,
				width: counter.width + 0.04,
			},
			mat(PALETTE.worktop, { roughness: 0.5 }),
		),
	);
	const fruitBowl = new Mesh(
		new SphereGeometry(0.12, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
		mat(PALETTE.bowl, { roughness: 0.5 }),
	);
	fruitBowl.position.set(counter.x + 0.05, counter.height + 0.12, counter.z + 0.3);
	fruitBowl.castShadow = true;
	group.add(fruitBowl);
	addStatic(physics, counter);
	const pan = new Mesh(
		new CylinderGeometry(0.13, 0.11, 0.06, 18),
		mat(PALETTE.pan, { roughness: 0.4 }),
	);
	pan.position.set(counter.x + 0.02, counter.height + 0.03, counter.z - 0.25);
	pan.castShadow = true;
	group.add(pan);

	// Floor lamp
	const lamp = FURNITURE.lamp;
	const pole = new Mesh(new CylinderGeometry(0.02, 0.02, lamp.height, 8), mat(PALETTE.lampPole));
	pole.position.set(lamp.x, lamp.height / 2, lamp.z);
	group.add(pole);
	const shade = new Mesh(
		new CylinderGeometry(0.12, 0.2, 0.25, 16, 1, true),
		mat(PALETTE.lampShade, { emissive: new Color(PALETTE.lampShade), emissiveIntensity: 0.9 }),
	);
	shade.position.set(lamp.x, lamp.height, lamp.z);
	group.add(shade);
	addStatic(physics, lamp);

	// Lights
	const ambient = new HemisphereLight('#c9d6ff', '#4a3a2e', 0.6);
	group.add(ambient);

	const lampLight = new PointLight('#ffcf94', 6, 7, 1.6);
	lampLight.position.set(lamp.x, lamp.height - 0.05, lamp.z + 0.1);
	group.add(lampLight);

	const key = new DirectionalLight('#fff1dc', 1.4);
	key.position.set(2.5, 6, 6);
	key.target.position.set(0, 0, -0.5);
	key.castShadow = true;
	key.shadow.mapSize.set(1024, 1024);
	key.shadow.camera.left = -4;
	key.shadow.camera.right = 4;
	key.shadow.camera.top = 4;
	key.shadow.camera.bottom = -4;
	key.shadow.bias = -0.0005;
	group.add(key, key.target);

	const windowLight = new DirectionalLight('#bcd4ff', 0);
	windowLight.position.set(win.x, win.y + 1, -depth / 2 - 2);
	windowLight.target.position.set(0, 0, 1);
	group.add(windowLight, windowLight.target);

	// The TV stands on our side of the glass, facing the sofa: only its light gets in.
	const tvLight = new PointLight(PALETTE.tvGlow, 0, 4, 1.5);
	tvLight.position.set(FURNITURE.sofa.x, 0.9, FURNITURE.sofa.z + 1.9);
	group.add(tvLight);

	return {
		group,
		setDoor(openness: number) {
			doorHinge.rotation.y = -Math.min(1, Math.max(0, openness)) * 1.4;
		},
		setChairSwivel(angle: number) {
			swivel.rotation.y = angle;
		},
		setDuvet(cover: number) {
			realBed.setCover(cover);
		},
		setTvGlow(intensity: number, hue: number) {
			tvLight.intensity = intensity;
			tvLight.color.setHSL(hue, 0.5, 0.65);
		},
		setTimeOfDay(hours: number) {
			const [r, g, b] = skyColor(hours);
			skyMaterial.color.setRGB(r, g, b);
			const day = daylight(hours);
			windowLight.intensity = day * 1.6;
			ambient.intensity = 0.35 + day * 0.5;
			// Ambience only: until the simulation owns the lamp, it glows brighter at night.
			lampLight.intensity = (1 - day) * 7 + 1;
		},
	};
}
