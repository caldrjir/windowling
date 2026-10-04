import { ROOM } from './layout.ts';

export interface CameraFrame {
	position: { x: number; y: number; z: number };
	target: { x: number; y: number; z: number };
	/** Vertical field of view in degrees. */
	fov: number;
}

const FOV = 40;
const MARGIN = 1.08;

/**
 * Frames the whole room for any aspect ratio.
 * Desktop (landscape): eye-level-ish view, like looking through a window.
 * Phone (portrait): higher, more top-down view - the room as a box in your hand.
 */
export function frameRoom(aspect: number): CameraFrame {
	const safeAspect = Math.min(Math.max(aspect, 0.3), 4);
	const vHalf = (FOV * Math.PI) / 360;
	const hHalf = Math.atan(Math.tan(vHalf) * safeAspect);

	// 0 for landscape, 1 for narrow portrait.
	const portrait = Math.min(Math.max((1.3 - safeAspect) / 0.85, 0), 1);
	const pitch = 0.32 + portrait * 0.5; // radians below horizontal

	const halfWidth = (ROOM.width / 2) * MARGIN;
	const halfHeight = ((ROOM.height + ROOM.depth * Math.sin(pitch)) / 2) * MARGIN;
	const distance =
		Math.max(halfWidth / Math.tan(hHalf), halfHeight / Math.tan(vHalf)) + ROOM.depth / 2;

	const target = { x: 0, y: 1.0 - portrait * 0.4, z: -0.2 };
	return {
		position: {
			x: target.x,
			y: target.y + Math.sin(pitch) * distance,
			z: target.z + Math.cos(pitch) * distance,
		},
		target,
		fov: FOV,
	};
}
