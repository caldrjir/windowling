import { describe, expect, it } from 'vitest';
import { ITEM_IDS } from '@windowling/shared';
import { Box3 } from 'three';
import { buildBelongings } from './belongings.ts';
import { ROOM } from './layout.ts';

describe('belongings', () => {
	it('shows only what it owns, and the parcels by the door', () => {
		const b = buildBelongings();
		const visible = () => b.group.children.filter((c) => c.visible).length;
		expect(visible()).toBe(0);
		b.set(['plant', 'headphones'], 0);
		expect(visible()).toBe(2);
		b.set([], 2);
		expect(visible()).toBe(2);
		b.set([...ITEM_IDS], 5); // more parcels than the stack shows: three at most
		expect(visible()).toBe(ITEM_IDS.length + 3);
	});

	it('keeps everything inside the flat', () => {
		const b = buildBelongings();
		b.set([...ITEM_IDS], 3);
		b.group.updateMatrixWorld(true);
		const box = new Box3().setFromObject(b.group);
		expect(box.min.x).toBeGreaterThanOrEqual(-ROOM.width / 2 - 0.01);
		expect(box.max.x).toBeLessThanOrEqual(ROOM.width / 2 + 0.01);
		expect(box.min.z).toBeGreaterThanOrEqual(-ROOM.depth / 2 - 0.01);
		expect(box.max.z).toBeLessThanOrEqual(ROOM.depth / 2 + 0.01);
		expect(box.min.y).toBeGreaterThanOrEqual(-0.01);
		expect(box.max.y).toBeLessThanOrEqual(ROOM.height);
	});
});
