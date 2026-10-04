import { describe, expect, it } from 'vitest';
import { TARGETS } from '../room/layout.ts';
import { CharacterController, type ControllerEvent } from './controller.ts';
import { wrapAngle } from './math.ts';

function run(controller: CharacterController, seconds: number, dt = 1 / 60): ControllerEvent[] {
	const events: ControllerEvent[] = [];
	for (let t = 0; t < seconds; t += dt) events.push(...controller.update(dt));
	return events;
}

describe('CharacterController', () => {
	it('starts standing in the middle of the room, idle', () => {
		const c = new CharacterController();
		expect(c.snapshot()).toMatchObject({ posture: 'standing', busy: false, animation: 'idle' });
	});

	it('walks to a target and ends facing the configured direction', () => {
		const c = new CharacterController();
		c.perform({ type: 'walkTo', target: 'window' });
		const events = run(c, 10);
		const s = c.snapshot();
		expect(s.x).toBeCloseTo(TARGETS.window.approach.x, 3);
		expect(s.z).toBeCloseTo(TARGETS.window.approach.z, 3);
		expect(wrapAngle(s.yaw - TARGETS.window.approachYaw)).toBeCloseTo(0, 2);
		expect(events).toEqual([{ type: 'completed', action: { type: 'walkTo', target: 'window' } }]);
		expect(s.busy).toBe(false);
	});

	it('sits down on the sofa and reports the seat height', () => {
		const c = new CharacterController();
		c.perform({ type: 'sit', target: 'sofa' });
		run(c, 10);
		const s = c.snapshot();
		const use = TARGETS.sofa.use!;
		expect(s).toMatchObject({ posture: 'sitting', occupying: 'sofa', animation: 'sit' });
		expect(s.y).toBeCloseTo(use.y, 3);
		expect(s.x).toBeCloseTo(use.x, 3);
		expect(s.z).toBeCloseTo(use.z, 3);
	});

	it('uses the walk animation while moving', () => {
		const c = new CharacterController();
		c.perform({ type: 'walkTo', target: 'window' });
		run(c, 0.6);
		expect(c.snapshot().animation).toBe('walk');
	});

	it('stands up before walking somewhere else', () => {
		const c = new CharacterController();
		c.perform({ type: 'sit', target: 'desk.chair' });
		run(c, 10);
		c.perform({ type: 'walkTo', target: 'room.center' });
		run(c, 0.3);
		expect(c.snapshot().posture).toBe('sitting'); // still getting up
		run(c, 10);
		expect(c.snapshot()).toMatchObject({ posture: 'standing', occupying: null, y: 0 });
	});

	it('goes to bed and lies down', () => {
		const c = new CharacterController();
		c.perform({ type: 'sleep', target: 'bed' });
		run(c, 12);
		expect(c.snapshot()).toMatchObject({ posture: 'lying', occupying: 'bed', animation: 'lie' });
	});

	it('finishes sitting down before switching to a new action', () => {
		const c = new CharacterController();
		c.perform({ type: 'sit', target: 'sofa' });
		// Run until it is in the middle of sitting down.
		for (let i = 0; i < 2000 && c.snapshot().animation !== 'sit'; i++) c.update(1 / 60);
		c.perform({ type: 'walkTo', target: 'window' });
		const events = run(c, 15);
		const s = c.snapshot();
		expect(s.posture).toBe('standing');
		expect(s.z).toBeCloseTo(TARGETS.window.approach.z, 3);
		expect(events).toContainEqual({
			type: 'completed',
			action: { type: 'walkTo', target: 'window' },
		});
		expect(events.some((e) => e.type === 'completed' && e.action.type === 'sit')).toBe(false);
	});

	it('rejects impossible actions instead of improvising', () => {
		const c = new CharacterController();
		expect(c.perform({ type: 'sleep', target: 'sofa' })).toBe(false);
		expect(c.perform({ type: 'sit', target: 'fridge' })).toBe(false);
		const events = run(c, 0.1);
		expect(events.map((e) => e.type)).toEqual(['rejected', 'rejected']);
		expect(c.snapshot().busy).toBe(false);
	});

	it('completes immediately when already doing the requested thing', () => {
		const c = new CharacterController();
		c.perform({ type: 'sit', target: 'sofa' });
		run(c, 10);
		c.perform({ type: 'sit', target: 'sofa' });
		expect(run(c, 1 / 60)).toEqual([
			{ type: 'completed', action: { type: 'sit', target: 'sofa' } },
		]);
	});

	it('turns to face the player on lookAtPlayer', () => {
		const c = new CharacterController(TARGETS['room.center'].approach, Math.PI);
		c.perform({ type: 'lookAtPlayer' });
		run(c, 2);
		expect(wrapAngle(c.snapshot().yaw)).toBeCloseTo(0, 2);
	});

	it('never walks through furniture between any two targets', async () => {
		const { isClear } = await import('./path.ts');
		const ids = Object.keys(TARGETS) as Array<keyof typeof TARGETS>;
		for (const from of ids) {
			for (const to of ids) {
				const c = new CharacterController(TARGETS[from].approach);
				c.perform({ type: 'walkTo', target: to });
				let last = { x: c.snapshot().x, z: c.snapshot().z };
				for (let i = 0; i < 1200; i++) {
					c.update(1 / 60);
					const s = c.snapshot();
					expect(isClear(last, { x: s.x, z: s.z }, 0.05), `${from} -> ${to}`).toBe(true);
					last = { x: s.x, z: s.z };
				}
			}
		}
	});
});
