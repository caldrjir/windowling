import { STARTER_ROOM_TARGETS } from '@windowling/shared';
import { describe, expect, it } from 'vitest';
import { FURNITURE, insideBox, insideRoom, obstacles, ROOM, TARGETS } from './layout.ts';

describe('room layout', () => {
	it('places every shared target and nothing else', () => {
		expect(Object.keys(TARGETS).sort()).toEqual(STARTER_ROOM_TARGETS.map((t) => t.id).sort());
	});

	it('keeps approach points inside the room and outside furniture', () => {
		for (const [id, target] of Object.entries(TARGETS)) {
			expect(insideRoom(target.approach, 0.25), id).toBe(true);
			for (const box of obstacles()) {
				expect(insideBox(target.approach, box, 0.2), `${id} approach hits furniture`).toBe(false);
			}
		}
	});

	it('gives seats and beds a place to sit or lie', () => {
		for (const id of ['sofa', 'desk.chair', 'bed'] as const) {
			expect(TARGETS[id].seat, id).toBeDefined();
		}
		expect(TARGETS.bed.lie).toBeDefined();
	});

	it('turns the back to a seat before sitting down on it', () => {
		for (const id of ['sofa', 'desk.chair', 'bed'] as const) {
			const { approach, approachYaw, seat } = TARGETS[id];
			if (!seat) throw new Error(id);
			expect(approachYaw, id).toBeCloseTo(seat.at.yaw, 6);
			// Backing up from the approach towards the seat: the seat is behind the character.
			const back = { x: -Math.sin(approachYaw), z: -Math.cos(approachYaw) };
			const towards = { x: seat.at.x - approach.x, z: seat.at.z - approach.z };
			expect(back.x * towards.x + back.z * towards.z, id).toBeGreaterThan(0.3);
		}
	});

	it('keeps furniture inside the room', () => {
		for (const [name, box] of Object.entries(FURNITURE)) {
			expect(Math.abs(box.x) + box.width / 2, name).toBeLessThanOrEqual(ROOM.width / 2);
			expect(Math.abs(box.z) + box.depth / 2, name).toBeLessThanOrEqual(ROOM.depth / 2);
		}
	});

	it('does not overlap furniture footprints', () => {
		const boxes = obstacles();
		for (let i = 0; i < boxes.length; i++) {
			for (let j = i + 1; j < boxes.length; j++) {
				const a = boxes[i]!;
				const b = boxes[j]!;
				const overlapX = Math.abs(a.x - b.x) < (a.width + b.width) / 2;
				const overlapZ = Math.abs(a.z - b.z) < (a.depth + b.depth) / 2;
				expect(overlapX && overlapZ, `${i} overlaps ${j}`).toBe(false);
			}
		}
	});
});
