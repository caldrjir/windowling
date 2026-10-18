import {
	BoxGeometry,
	DirectionalLight,
	Group,
	HemisphereLight,
	Mesh,
	MeshStandardMaterial,
	PlaneGeometry,
	Path,
	PointLight,
	Shape,
	ExtrudeGeometry,
	type Material,
	type Texture,
} from 'three';
import type { PhysicsWorld } from '../physics.ts';
import { BACK_WINDOW, DOOR, FURNITURE, KITCHEN_PAN, ROOM, TARGETS, type Box } from './layout.ts';
import {
	buildDoor,
	buildPrint,
	buildRug,
	buildSkirting,
	buildWindow,
	WALL,
} from './architecture.ts';
import { buildBed } from './furniture/bed.ts';
import { buildFloorLamp } from './furniture/floor-lamp.ts';
import { buildDesk } from './furniture/desk.ts';
import { buildFridge, buildKitchenLine } from './furniture/kitchen.ts';
import { buildOfficeChair } from './furniture/office-chair.ts';
import { buildSofa } from './furniture/sofa.ts';
import { keepSeparate, mergeStatic } from './merge-static.ts';
import { floorboards, plaster } from './materials.ts';
import { daylight, skyColor } from './sky.ts';

const PALETTE = {
	backWall: '#ece5d9',
	sideWall: '#e4dccf',
	hallway: '#2a2622',
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

	// Oak floorboards.
	const floor = new Mesh(new PlaneGeometry(width, depth), floorboards([width / 2.4, depth / 2.4]));
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
	const wallThickness = WALL;
	const backWall = plaster(PALETTE.backWall);
	const sideWall = plaster(PALETTE.sideWall);
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
			const mesh = box(b, plaster(PALETTE.sideWall, 2.7));
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
	// A panelled door that swings out into the hallway, in a lined frame.
	const door = buildDoor();
	keepSeparate(door.hinge); // it swings
	group.add(door.frame, door.hinge);
	const doorHinge = door.hinge;

	// Back window: casement, sill, curtains - and the street outside.
	const backWindow = buildWindow(reflections);
	group.add(backWindow.group);
	group.add(buildSkirting());

	// Prints: one above the desk, one on the wall beside the bed.
	const deskPrint = buildPrint('arches', 0.5, 0.7);
	deskPrint.position.set(FURNITURE.desk.x, 1.55, -depth / 2);
	group.add(deskPrint);
	const bedPrint = buildPrint('hills', 0.8, 0.58);
	bedPrint.rotation.y = Math.PI / 2;
	bedPrint.position.set(-width / 2, 1.45, FURNITURE.bed.z + 0.1);
	group.add(bedPrint);

	// A wool rug.
	group.add(buildRug(FURNITURE.rug));

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

	// Kitchenette: a fridge-freezer and a kitchen line with hob, sink and wall cabinets.
	const fridge = FURNITURE.fridge;
	group.add(buildFridge(fridge, reflections));
	addStatic(physics, fridge);
	const counter = FURNITURE.counter;
	group.add(buildKitchenLine(counter, { pan: KITCHEN_PAN }, reflections));
	addStatic(physics, counter);

	// Tripod floor lamp with a linen shade.
	const lamp = FURNITURE.lamp;
	const floorLamp = buildFloorLamp(lamp);
	group.add(floorLamp.group);
	addStatic(physics, lamp);

	// Lights
	const ambient = new HemisphereLight('#c9d6ff', '#4a3a2e', 0.6);
	group.add(ambient);

	const lampLight = new PointLight('#ffcf94', 6, 7, 1.6);
	lampLight.position.copy(floorLamp.bulb);
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

	// Hundreds of furniture parts, a few dozen draw calls.
	mergeStatic(group);

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
			const day = daylight(hours);
			backWindow.setOutside(day, skyColor(hours));
			windowLight.intensity = day * 1.6;
			ambient.intensity = 0.35 + day * 0.5;
			// Ambience only: until the simulation owns the lamp, it glows brighter at night.
			lampLight.intensity = (1 - day) * 7 + 1;
		},
	};
}
