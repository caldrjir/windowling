import { Box3 } from 'three';
import { describe, expect, it } from 'vitest';
import { FURNITURE, TARGETS } from '../layout.ts';
import { buildBed } from './bed.ts';
import { buildDesk } from './desk.ts';
import { buildOfficeChair } from './office-chair.ts';
import { buildSofa } from './sofa.ts';

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

	it('builds the sofa in its footprint, seat cushions at seat height', () => {
		const sofa = FURNITURE.sofa;
		const model = buildSofa(sofa);
		const bounds = new Box3().setFromObject(model);
		// The knitted throw hangs a little over the arm, like a real one.
		expect(bounds.min.x).toBeGreaterThanOrEqual(sofa.x - sofa.width / 2 - 0.03);
		expect(bounds.max.x).toBeLessThanOrEqual(sofa.x + sofa.width / 2 + 0.03);
		expect(bounds.min.z).toBeGreaterThanOrEqual(sofa.z - sofa.depth / 2 - 0.01);
		expect(bounds.max.z).toBeLessThanOrEqual(sofa.z + sofa.depth / 2 + 0.01);
		model.updateMatrixWorld(true);
		const seat = TARGETS.sofa.seat;
		const atSeat = model.children
			.map((child) => new Box3().setFromObject(child))
			.filter((b) => b.max.y > sofa.height - 0.01 && b.max.y <= sofa.height + 1e-3);
		expect(atSeat.length).toBe(2); // two seat cushions
		// Where it sits is on the cushions, not in front of or behind them.
		expect(seat?.at.y).toBeGreaterThan(sofa.height - 0.05);
	});

	it('builds the bed with the mattress at bed height and a duvet that covers the sleeper', () => {
		const bed = FURNITURE.bed;
		const lie = TARGETS.bed.lie;
		const model = buildBed(bed, lie, FURNITURE.nightstand);
		model.group.updateMatrixWorld(true);
		const flat = new Box3().setFromObject(model.group);
		expect(flat.min.y).toBeGreaterThanOrEqual(-1e-6);
		// The duvet hangs over the sides (no further than a hand's width).
		expect(flat.min.x).toBeGreaterThanOrEqual(bed.x - bed.width / 2 - 0.1);
		const duvetTop = () => {
			model.group.updateMatrixWorld(true);
			let top = 0;
			model.group.traverse((o) => {
				if ('geometry' in o && (o as { geometry: { attributes?: unknown } }).geometry) {
					const b = new Box3().setFromObject(o);
					// The duvet is the only part over the middle of the mattress.
					if (b.max.x - b.min.x > bed.width && b.max.y < 1) top = Math.max(top, b.max.y);
				}
			});
			return top;
		};
		const empty = duvetTop();
		model.setCover(1);
		const covering = duvetTop();
		// Raised over the body - higher than the body itself on the mattress.
		expect(covering - empty).toBeGreaterThan(0.15);
		model.setCover(0);
		expect(duvetTop()).toBeCloseTo(empty, 5);
	});
});
