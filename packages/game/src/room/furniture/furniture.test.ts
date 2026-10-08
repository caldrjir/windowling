import { Box3 } from 'three';
import { describe, expect, it } from 'vitest';
import { FURNITURE } from '../layout.ts';
import { buildDesk } from './desk.ts';
import { buildOfficeChair } from './office-chair.ts';

// The models are visual only; walking and physics use the footprints in layout.ts.
// They must stay within them (give or take a drawer handle), or the character
// would walk through table legs.
describe('furniture models', () => {
	it('builds the desk inside its footprint, with the top at desk height', () => {
		const desk = FURNITURE.desk;
		const bounds = new Box3().setFromObject(buildDesk(desk));
		expect(bounds.min.x).toBeGreaterThanOrEqual(desk.x - desk.width / 2 - 0.01);
		expect(bounds.max.x).toBeLessThanOrEqual(desk.x + desk.width / 2 + 0.01);
		expect(bounds.min.z).toBeGreaterThanOrEqual(desk.z - desk.depth / 2 - 0.01);
		expect(bounds.max.z).toBeLessThanOrEqual(desk.z + desk.depth / 2 + 0.01);
		expect(bounds.min.y).toBeGreaterThanOrEqual(-1e-6);
		// Things stand on it (a laptop lid, a plant), nothing floats far above.
		expect(bounds.max.y).toBeGreaterThan(desk.height);
		expect(bounds.max.y).toBeLessThan(desk.height + 0.4);
	});

	it('builds an office chair whose seat is where the character sits', () => {
		const chair = FURNITURE.deskChair;
		const { group, swivel } = buildOfficeChair(chair);
		const all = new Box3().setFromObject(group);
		expect(all.min.y).toBeGreaterThanOrEqual(-1e-6);
		// The five-star base may reach a little past the seat, like a real one.
		expect(all.max.x - all.min.x).toBeLessThan(chair.width + 0.25);
		expect(all.max.z - all.min.z).toBeLessThan(chair.depth + 0.25);
		// The cushion's top is the seat height the controller uses.
		group.updateMatrixWorld(true);
		const cushion = swivel.children
			.map((child) => new Box3().setFromObject(child))
			.filter((b) => b.max.y <= chair.height + 1e-3 && b.max.y > chair.height - 0.02);
		expect(cushion.length).toBeGreaterThan(0);
	});

	it('turns only the top half of the chair', () => {
		const { group, swivel } = buildOfficeChair(FURNITURE.deskChair);
		expect(swivel.parent).toBe(group);
		expect(group.children.length).toBeGreaterThan(1); // the base stays outside the swivel
	});
});
