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
} from 'three';
import type { PhysicsWorld } from '../physics.ts';
import { BACK_WINDOW, FURNITURE, ROOM, type Box } from './layout.ts';
import { daylight, skyColor } from './sky.ts';

const PALETTE = {
	floor: '#8a6448',
	backWall: '#d8c8b2',
	sideWall: '#cbb9a2',
	rug: '#5f7397',
	bedFrame: '#6d4c3d',
	blanket: '#7c9a8a',
	pillow: '#efe6d8',
	sofa: '#4f6d7a',
	cushion: '#5d7f8d',
	desk: '#b08968',
	chair: '#3d405b',
	laptop: '#2b2d35',
	screen: '#9cc3ff',
	lampPole: '#2f2f33',
	lampShade: '#ffe2b8',
	windowFrame: '#f1ece4',
	fridge: '#e8ecef',
	handle: '#9aa3ab',
	counter: '#6b8f71',
	worktop: '#d9d2c5',
	bowl: '#f4a261',
} as const;

export interface Room {
	group: Group;
	/** Updates outside light for the given local time (hours, 0-24). */
	setTimeOfDay(hours: number): void;
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

/** Builds the starter flat (meshes + static colliders). No game logic. */
export function buildRoom(physics: PhysicsWorld): Room {
	const group = new Group();
	group.name = 'room';
	const { width, depth, height } = ROOM;

	// Floor
	const floor = new Mesh(new PlaneGeometry(width, depth), mat(PALETTE.floor, { roughness: 0.7 }));
	floor.rotation.x = -Math.PI / 2;
	floor.receiveShadow = true;
	group.add(floor);
	physics.addStaticBox({ x: width / 2, y: 0.1, z: depth / 2 }, { x: 0, y: -0.1, z: 0 });

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
		const mesh = box(b, sideWall);
		mesh.castShadow = false;
		group.add(mesh);
		addStatic(physics, b);
	}

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

	// Bed: frame, mattress/blanket, pillow (head towards the back wall)
	const bed = FURNITURE.bed;
	group.add(box({ ...bed, height: 0.3 }, mat(PALETTE.bedFrame)));
	group.add(
		box(
			{ ...bed, width: bed.width - 0.08, depth: bed.depth - 0.08, height: 0.2, y: 0.3 },
			mat(PALETTE.blanket),
		),
	);
	group.add(
		box(
			{
				x: bed.x,
				z: bed.z - bed.depth / 2 + 0.3,
				y: bed.height,
				width: bed.width - 0.3,
				height: 0.12,
				depth: 0.35,
			},
			mat(PALETTE.pillow),
		),
	);
	group.add(
		box(
			{ x: bed.x, z: bed.z - bed.depth / 2 + 0.04, width: bed.width, height: 0.9, depth: 0.08 },
			mat(PALETTE.bedFrame),
		),
	);
	addStatic(physics, bed);

	// Sofa: base, back rest, arm rests
	const sofa = FURNITURE.sofa;
	const sofaMat = mat(PALETTE.sofa);
	group.add(box({ ...sofa, height: sofa.height }, sofaMat));
	group.add(
		box(
			{ x: sofa.x, z: sofa.z - sofa.depth / 2 + 0.12, width: sofa.width, height: 0.9, depth: 0.24 },
			sofaMat,
		),
	);
	for (const side of [-1, 1]) {
		group.add(
			box(
				{
					x: sofa.x + side * (sofa.width / 2 - 0.1),
					z: sofa.z,
					width: 0.2,
					height: 0.62,
					depth: sofa.depth,
				},
				sofaMat,
			),
		);
	}
	group.add(
		box(
			{
				x: sofa.x,
				z: sofa.z + 0.05,
				y: sofa.height,
				width: sofa.width - 0.45,
				height: 0.08,
				depth: sofa.depth - 0.3,
			},
			mat(PALETTE.cushion),
		),
	);
	addStatic(physics, sofa);

	// Desk with laptop
	const desk = FURNITURE.desk;
	const deskMat = mat(PALETTE.desk, { roughness: 0.6 });
	group.add(box({ ...desk, y: desk.height - 0.05, height: 0.05 }, deskMat));
	for (const sx of [-1, 1]) {
		for (const sz of [-1, 1]) {
			group.add(
				box(
					{
						x: desk.x + sx * (desk.width / 2 - 0.05),
						z: desk.z + sz * (desk.depth / 2 - 0.05),
						width: 0.05,
						height: desk.height - 0.05,
						depth: 0.05,
					},
					deskMat,
				),
			);
		}
	}
	group.add(
		box(
			{ x: desk.x, z: desk.z + 0.05, y: desk.height, width: 0.36, height: 0.02, depth: 0.25 },
			mat(PALETTE.laptop),
		),
	);
	const screen = new Mesh(
		new BoxGeometry(0.36, 0.24, 0.015),
		mat(PALETTE.laptop, { emissive: new Color(PALETTE.screen), emissiveIntensity: 0.6 }),
	);
	screen.position.set(desk.x, desk.height + 0.13, desk.z - 0.08);
	screen.rotation.x = -0.25;
	group.add(screen);
	addStatic(physics, desk);

	// Desk chair: seat + back rest (back rest towards the camera, chair faces the desk)
	const chair = FURNITURE.deskChair;
	const chairMat = mat(PALETTE.chair);
	group.add(box({ ...chair, y: chair.height - 0.06, height: 0.06 }, chairMat));
	group.add(
		box(
			{ x: chair.x, z: chair.z, width: 0.08, height: chair.height - 0.06, depth: 0.08 },
			chairMat,
		),
	);
	group.add(
		box(
			{
				x: chair.x,
				z: chair.z + chair.depth / 2 - 0.03,
				y: chair.height,
				width: chair.width,
				height: 0.45,
				depth: 0.05,
			},
			chairMat,
		),
	);
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

	return {
		group,
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
