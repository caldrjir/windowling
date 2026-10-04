import { PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { frameRoom } from './framing.ts';
import { ROOM } from './layout.ts';

function project(aspect: number, point: Vector3): Vector3 {
	const frame = frameRoom(aspect);
	const camera = new PerspectiveCamera(frame.fov, aspect, 0.1, 100);
	camera.position.set(frame.position.x, frame.position.y, frame.position.z);
	camera.lookAt(frame.target.x, frame.target.y, frame.target.z);
	camera.updateMatrixWorld();
	return point.clone().project(camera);
}

const w = ROOM.width / 2;
const d = ROOM.depth / 2;
const corners = [
	new Vector3(-w, 0, d), // front floor corners (the player's side)
	new Vector3(w, 0, d),
	new Vector3(-w, 0, -d), // back floor corners
	new Vector3(w, 0, -d),
	new Vector3(-w, ROOM.height, -d), // back wall top corners
	new Vector3(w, ROOM.height, -d),
];

describe('frameRoom', () => {
	for (const aspect of [0.45, 0.6, 0.75, 1, 1.33, 1.78, 2.4]) {
		it(`keeps the whole room in view at aspect ${aspect}`, () => {
			for (const corner of corners) {
				const p = project(aspect, corner);
				expect(Math.abs(p.x), `x of ${corner.toArray()}`).toBeLessThanOrEqual(1);
				expect(Math.abs(p.y), `y of ${corner.toArray()}`).toBeLessThanOrEqual(1);
			}
		});
	}

	it('looks down more steeply on portrait phones', () => {
		const pitch = (aspect: number) => {
			const f = frameRoom(aspect);
			return Math.atan2(f.position.y - f.target.y, f.position.z - f.target.z);
		};
		expect(pitch(0.5)).toBeGreaterThan(pitch(1.78));
	});
});
