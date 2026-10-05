import type { StarterRoomTargetId } from '@windowling/shared';

/**
 * Geometry of the starter flat. Units are metres; origin is the floor centre,
 * +x right, +y up, +z towards the player's window (the camera side).
 */
export const ROOM = { width: 6, depth: 4.5, height: 2.8 } as const;

export interface Vec2 {
	x: number;
	z: number;
}

export interface Box {
	/** Centre on the floor plane plus height of the bottom face. */
	x: number;
	z: number;
	y?: number;
	width: number;
	height: number;
	depth: number;
}

export interface TargetPlacement {
	/** Where the character stands before using the target. */
	approach: Vec2;
	/** Yaw (radians) the character faces at the approach point. 0 = facing +z. */
	approachYaw: number;
	/** Where the character's root goes while using it (sitting / lying). */
	use?: { x: number; z: number; y: number; yaw: number };
}

export const FURNITURE = {
	bed: { x: -2.2, z: -1.15, width: 1.4, height: 0.5, depth: 2.1 },
	sofa: { x: -0.1, z: -1.82, width: 1.8, height: 0.45, depth: 0.85 },
	desk: { x: 2.05, z: -1.88, width: 1.3, height: 0.75, depth: 0.65 },
	deskChair: { x: 2.05, z: -1.15, width: 0.5, height: 0.47, depth: 0.5 },
	rug: { x: 0, z: 0.1, width: 2.6, height: 0.01, depth: 1.7 },
	lamp: { x: 1.1, z: -1.95, width: 0.3, height: 1.6, depth: 0.3 },
	// Kitchenette along the right wall (Iteration 2): somewhere to eat.
	fridge: { x: 2.66, z: -0.25, width: 0.62, height: 1.7, depth: 0.6 },
	counter: { x: 2.7, z: 0.68, width: 0.55, height: 0.9, depth: 1.05 },
} as const satisfies Record<string, Box>;

/** Window in the back wall (to the outside world of the flat). */
export const BACK_WINDOW = { x: -0.1, y: 1.65, width: 1.5, height: 1.0 } as const;

const SEAT_DEPTH_OFFSET = 0.15;

export const TARGETS: Record<StarterRoomTargetId, TargetPlacement> = {
	'room.center': { approach: { x: 0, z: 0.3 }, approachYaw: 0 },
	// Right behind the glass the player looks through.
	window: { approach: { x: 0, z: ROOM.depth / 2 - 0.45 }, approachYaw: 0 },
	sofa: {
		approach: { x: FURNITURE.sofa.x, z: FURNITURE.sofa.z + 1.0 },
		approachYaw: 0,
		use: {
			x: FURNITURE.sofa.x,
			z: FURNITURE.sofa.z + SEAT_DEPTH_OFFSET,
			y: FURNITURE.sofa.height,
			yaw: 0,
		},
	},
	'desk.chair': {
		approach: { x: FURNITURE.deskChair.x, z: FURNITURE.deskChair.z + 0.75 },
		approachYaw: Math.PI,
		use: {
			x: FURNITURE.deskChair.x,
			z: FURNITURE.deskChair.z,
			y: FURNITURE.deskChair.height,
			yaw: Math.PI,
		},
	},
	bed: {
		approach: { x: FURNITURE.bed.x + FURNITURE.bed.width / 2 + 0.45, z: FURNITURE.bed.z + 0.3 },
		approachYaw: -Math.PI / 2,
		use: {
			x: FURNITURE.bed.x,
			z: FURNITURE.bed.z + 0.2,
			y: FURNITURE.bed.height,
			yaw: 0,
		},
	},
	'kitchen.counter': {
		approach: {
			x: FURNITURE.counter.x - FURNITURE.counter.width / 2 - 0.4,
			z: FURNITURE.counter.z,
		},
		// Half-turned towards the room, so the player sees what is being eaten.
		approachYaw: Math.PI / 3,
	},
};

/** Axis-aligned footprints the character must not walk through. */
export function obstacles(): Box[] {
	const { rug: _rug, ...solid } = FURNITURE;
	return Object.values(solid);
}

export function insideRoom(p: Vec2, margin = 0): boolean {
	return Math.abs(p.x) <= ROOM.width / 2 - margin && Math.abs(p.z) <= ROOM.depth / 2 - margin;
}

export function insideBox(p: Vec2, box: Box, margin = 0): boolean {
	return (
		Math.abs(p.x - box.x) <= box.width / 2 + margin &&
		Math.abs(p.z - box.z) <= box.depth / 2 + margin
	);
}
