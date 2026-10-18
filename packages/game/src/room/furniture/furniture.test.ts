import { Box3 } from 'three';
import { describe, expect, it } from 'vitest';
import { buildDoor, buildWindow } from '../architecture.ts';
import { DOOR, FURNITURE, KITCHEN_PAN, ROOM, TARGETS } from '../layout.ts';
import { buildFridge, buildKitchenLine } from './kitchen.ts';
import { buildBed } from './bed.ts';
import { buildDesk } from './desk.ts';
import { buildFloorLamp } from './floor-lamp.ts';
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

	it('builds the kitchen line and the fridge inside their footprints', () => {
		const counter = FURNITURE.counter;
		const line = new Box3().setFromObject(buildKitchenLine(counter, { pan: KITCHEN_PAN }));
		// The worktop overhangs the fronts by a couple of centimetres, like a real one.
		expect(line.min.x).toBeGreaterThanOrEqual(counter.x - counter.width / 2 - 0.03);
		expect(line.max.x).toBeLessThanOrEqual(counter.x + counter.width / 2 + 0.01);
		expect(line.min.z).toBeGreaterThanOrEqual(counter.z - counter.depth / 2 - 0.01);
		expect(line.max.z).toBeLessThanOrEqual(counter.z + counter.depth / 2 + 0.01);
		// Wall cabinets hang above it, below the ceiling.
		expect(line.max.y).toBeLessThan(2.3);
		const fridge = FURNITURE.fridge;
		const box = new Box3().setFromObject(buildFridge(fridge));
		// Handles stand off the door a few centimetres.
		expect(box.min.x).toBeGreaterThanOrEqual(fridge.x - fridge.width / 2 - 0.05);
		expect(box.max.x).toBeLessThanOrEqual(fridge.x + fridge.width / 2 + 0.01);
		expect(box.max.y).toBeLessThanOrEqual(fridge.height + 0.01);
	});

	it('cooks facing the pan on the hob', () => {
		const spot = TARGETS['kitchen.counter'];
		const towards = Math.atan2(KITCHEN_PAN.x - spot.approach.x, KITCHEN_PAN.z - spot.approach.z);
		expect(spot.approachYaw).toBeCloseTo(towards, 2);
		// Close enough to reach it.
		expect(
			Math.hypot(KITCHEN_PAN.x - spot.approach.x, KITCHEN_PAN.z - spot.approach.z),
		).toBeLessThan(0.65);
	});

	it('builds the floor lamp inside its footprint, with the bulb in the shade', () => {
		const lamp = FURNITURE.lamp;
		const { group, bulb } = buildFloorLamp(lamp);
		const bounds = new Box3().setFromObject(group);
		expect(bounds.min.x).toBeGreaterThanOrEqual(lamp.x - lamp.width / 2 - 0.01);
		expect(bounds.max.x).toBeLessThanOrEqual(lamp.x + lamp.width / 2 + 0.01);
		expect(bounds.min.z).toBeGreaterThanOrEqual(lamp.z - lamp.depth / 2 - 0.01);
		expect(bounds.max.z).toBeLessThanOrEqual(lamp.z + lamp.depth / 2 + 0.01);
		expect(bounds.max.y).toBeCloseTo(lamp.height, 2);
		expect(bulb.x).toBeCloseTo(lamp.x);
		expect(bulb.y).toBeGreaterThan(lamp.height - 0.3);
	});

	it('hangs the door leaf inside the doorway, so it swings clear of the frame', () => {
		const { hinge } = buildDoor();
		const leaf = new Box3().setFromObject(hinge);
		expect(leaf.min.z).toBeGreaterThanOrEqual(DOOR.z - DOOR.width / 2);
		expect(leaf.max.z).toBeLessThanOrEqual(DOOR.z + DOOR.width / 2 + 0.01);
		expect(leaf.max.y).toBeLessThan(DOOR.height);
	});

	it('keeps the window, its curtains and the sill clear of the sofa and the lamp', () => {
		const { group } = buildWindow(null);
		group.updateMatrixWorld(true);
		const lamp = FURNITURE.lamp;
		const sofa = FURNITURE.sofa;
		group.traverse((object) => {
			// The street outside is far behind the wall; everything else hangs on it.
			if (object.position.z < -ROOM.depth / 2 - 1) return;
			if (!('geometry' in object)) return;
			const box = new Box3().setFromObject(object);
			if (box.isEmpty() || box.min.z < -ROOM.depth / 2 - 1) return;
			expect(box.max.x).toBeLessThan(lamp.x - lamp.width / 2);
			expect(box.min.y).toBeGreaterThan(0.75); // above the sofa's back
			expect(box.max.z).toBeLessThan(sofa.z + sofa.depth / 2);
		});
	});
});
