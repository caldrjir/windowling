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

/** A place for the character's root, facing `yaw`, at height `y`. */
export interface Spot {
	x: number;
	z: number;
	y: number;
	yaw: number;
}

export interface TargetPlacement {
	/** Where the character stands before using the target. */
	approach: Vec2;
	/** Yaw (radians) the character faces at the approach point. 0 = facing +z. */
	approachYaw: number;
	/**
	 * Seats (and beds): back turned, it steps from `approach` to `edge` and only
	 * then sits down onto `at` - like a person, not lowering itself mid-air.
	 */
	seat?: {
		/** Standing right in front of the seat, feet where they will stay. */
		edge: Vec2;
		/** Where the root goes while seated. */
		at: Spot;
		/** A swivel chair: once seated, it turns (with the chair) to face this way. */
		turnTo?: number;
		/** How far it leans back once seated (radians): deep into a sofa, upright on a chair. */
		recline?: number;
	};
	/** Beds: from the seat on the edge, it lies back to here (head on the pillow). */
	lie?: Spot;
}

export const FURNITURE = {
	bed: { x: -2.2, z: -1.15, width: 1.4, height: 0.5, depth: 2.1 },
	sofa: { x: -0.1, z: -1.82, width: 1.8, height: 0.45, depth: 0.85 },
	// Between the bed and the sofa, at the head of the bed.
	nightstand: { x: -1.26, z: -2.04, width: 0.4, height: 0.5, depth: 0.36 },
	desk: { x: 2.05, z: -1.88, width: 1.3, height: 0.75, depth: 0.65 },
	deskChair: { x: 2.05, z: -1.15, width: 0.5, height: 0.47, depth: 0.5 },
	rug: { x: 0, z: 0.1, width: 2.6, height: 0.01, depth: 1.7 },
	lamp: { x: 1.1, z: -1.95, width: 0.4, height: 1.6, depth: 0.4 },
	// Kitchenette along the right wall (Iteration 2): somewhere to eat.
	fridge: { x: 2.66, z: -0.25, width: 0.62, height: 1.7, depth: 0.6 },
	counter: { x: 2.7, z: 0.68, width: 0.55, height: 0.9, depth: 1.05 },
} as const satisfies Record<string, Box>;

/** Where the frying pan stands on the hob (the cooking spot faces it). */
export const KITCHEN_PAN = {
	x: FURNITURE.counter.x - 0.08,
	z: FURNITURE.counter.z - FURNITURE.counter.depth / 2 + 0.38,
} as const;

/** Door in the left wall, near the front: to the bathroom and the rest of the world. */
export const DOOR = { z: 1.15, width: 0.9, height: 2.05 } as const;
/** Where the character is when it has left the flat (behind the door, out of sight). */
export const OUTSIDE: Vec2 = { x: -ROOM.width / 2 - 0.7, z: DOOR.z };

/** Window in the back wall (to the outside world of the flat). */
export const BACK_WINDOW = { x: -0.1, y: 1.65, width: 1.5, height: 1.0 } as const;

/** Seated well back on the sofa, against the back cushions. */
const SEAT_DEPTH_OFFSET = 0.05;
/** How far in front of a seat the feet are once seated (thigh length). */
const THIGH_REACH = 0.42;

export const TARGETS: Record<StarterRoomTargetId, TargetPlacement> = {
	'room.center': { approach: { x: 0, z: 0.3 }, approachYaw: 0 },
	// Right behind the glass the player looks through.
	window: { approach: { x: 0, z: ROOM.depth / 2 - 0.45 }, approachYaw: 0 },
	sofa: {
		approach: { x: FURNITURE.sofa.x, z: FURNITURE.sofa.z + 1.0 },
		approachYaw: 0,
		seat: {
			edge: { x: FURNITURE.sofa.x, z: FURNITURE.sofa.z + FURNITURE.sofa.depth / 2 + 0.12 },
			at: {
				x: FURNITURE.sofa.x,
				z: FURNITURE.sofa.z + SEAT_DEPTH_OFFSET,
				// Sinks into the cushion a little.
				y: FURNITURE.sofa.height - 0.03,
				yaw: 0,
			},
			recline: 0.32,
		},
	},
	// The desk chair is a swivel chair with its back to the room: it is reached from
	// the side, sat on sideways, then turned to the desk (chair and all).
	'desk.chair': {
		approach: { x: FURNITURE.deskChair.x - 0.75, z: FURNITURE.deskChair.z },
		approachYaw: -Math.PI / 2,
		seat: {
			edge: { x: FURNITURE.deskChair.x - THIGH_REACH, z: FURNITURE.deskChair.z },
			at: {
				x: FURNITURE.deskChair.x,
				z: FURNITURE.deskChair.z,
				y: FURNITURE.deskChair.height,
				yaw: -Math.PI / 2,
			},
			turnTo: Math.PI,
			recline: 0.06,
		},
	},
	// Into bed like a person: sit on the edge, then swing the legs up and lie back.
	bed: {
		approach: { x: FURNITURE.bed.x + FURNITURE.bed.width / 2 + 0.45, z: FURNITURE.bed.z + 0.3 },
		approachYaw: Math.PI / 2,
		seat: {
			edge: {
				x: FURNITURE.bed.x + FURNITURE.bed.width / 2 - 0.25 + THIGH_REACH,
				z: FURNITURE.bed.z + 0.3,
			},
			at: {
				x: FURNITURE.bed.x + FURNITURE.bed.width / 2 - 0.25,
				z: FURNITURE.bed.z + 0.3,
				y: FURNITURE.bed.height,
				yaw: Math.PI / 2,
			},
		},
		lie: {
			// On the right half of the double bed, the side it gets in from.
			x: FURNITURE.bed.x + 0.32,
			// Head on the pillow (towards the back wall), feet towards the foot end.
			z: FURNITURE.bed.z + 0.08,
			// On the mattress (sinking in a little), not in it.
			y: FURNITURE.bed.height + 0.1,
			yaw: 0,
		},
	},
	door: {
		approach: { x: -ROOM.width / 2 + 0.55, z: DOOR.z },
		approachYaw: -Math.PI / 2,
	},
	// In front of the hob, turned to the pan - three-quarters to the window, so the player
	// sees the cooking (and the eating) rather than a back.
	'kitchen.counter': {
		approach: {
			x: FURNITURE.counter.x - FURNITURE.counter.width / 2 - 0.38,
			z: KITCHEN_PAN.z - 0.13,
		},
		approachYaw: Math.atan2(
			KITCHEN_PAN.x - (FURNITURE.counter.x - FURNITURE.counter.width / 2 - 0.38),
			0.13,
		),
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
