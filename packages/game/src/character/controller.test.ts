import { describe, expect, it } from 'vitest';
import { FURNITURE, insideBox, TARGETS } from '../room/layout.ts';
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
		const use = TARGETS.sofa.seat!.at;
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

	it('stops walking when a new action cuts the walk short (no frozen stride)', () => {
		const c = new CharacterController();
		c.perform({ type: 'walkTo', target: 'kitchen.counter' });
		run(c, 0.5);
		expect(c.snapshot().animation).toBe('walk');
		c.perform({ type: 'idle' });
		run(c, 1);
		expect(c.snapshot().animation).toBe('idle');
		expect(c.animator.weight('walk')).toBeLessThan(0.05);
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

	it('only starts sitting down once it stands at the seat, back turned', () => {
		for (const [target, box] of [
			['sofa', FURNITURE.sofa],
			['desk.chair', FURNITURE.deskChair],
			['bed', FURNITURE.bed],
		] as const) {
			const c = new CharacterController();
			c.perform({ type: 'sit', target });
			const seat = TARGETS[target].seat!;
			let started = false;
			for (let i = 0; i < 60 * 15; i++) {
				c.update(1 / 60);
				const s = c.snapshot();
				const sitting = c.animator.weight('sit');
				if (!started && sitting > 0.02) {
					started = true;
					// Lowering begins at the edge, facing away from the seat - not mid-room.
					expect(Math.hypot(s.x - seat.edge.x, s.z - seat.edge.z), target).toBeLessThan(0.05);
					expect(Math.abs(wrapAngle(s.yaw - seat.at.yaw)), target).toBeLessThan(0.05);
				}
				// Standing up straight, its feet never go into the furniture.
				if (sitting < 0.02) expect(insideBox(s, box, -0.02), target).toBe(false);
				// The body goes down as fast as it moves onto the seat (no sliding while seated).
				if (started && s.posture === 'standing') {
					const toSeat = Math.hypot(seat.at.x - seat.edge.x, seat.at.z - seat.edge.z);
					const travelled = Math.hypot(s.x - seat.edge.x, s.z - seat.edge.z) / toSeat;
					expect(Math.abs(travelled - sitting), target).toBeLessThan(0.1);
				}
			}
			expect(started, target).toBe(true);
			expect(c.snapshot().posture, target).toBe('sitting');
		}
	});

	it('gets into bed by sitting on the edge, then lies back with the head on the pillow', () => {
		const c = new CharacterController();
		c.perform({ type: 'sleep', target: 'bed' });
		const { seat, lie } = TARGETS.bed;
		let satOnEdge = false;
		for (let i = 0; i < 60 * 15; i++) {
			c.update(1 / 60);
			const s = c.snapshot();
			if (s.posture === 'sitting' && Math.abs(s.x - seat!.at.x) < 1e-6) satOnEdge = true;
		}
		expect(satOnEdge).toBe(true);
		const s = c.snapshot();
		expect(s).toMatchObject({ posture: 'lying', occupying: 'bed' });
		expect(s.x).toBeCloseTo(lie!.x, 3);
		expect(s.z).toBeCloseTo(lie!.z, 3);
		expect(s.y).toBeCloseTo(lie!.y, 3);
		expect(wrapAngle(s.yaw - lie!.yaw)).toBeCloseTo(0, 3);
		// And out again the same way: sit up, stand at the edge, step away.
		c.perform({ type: 'walkTo', target: 'room.center' });
		run(c, 1.6); // sat up (1.2 s), now getting up from the edge
		expect(c.snapshot()).toMatchObject({ posture: 'sitting', occupying: 'bed' });
		run(c, 15);
		expect(c.snapshot()).toMatchObject({ posture: 'standing', occupying: null, y: 0 });
	});

	it('reads in bed sitting on its edge, and lies down from there without getting up', () => {
		const c = new CharacterController();
		c.perform({ type: 'read', target: 'bed' });
		run(c, 12);
		expect(c.snapshot()).toMatchObject({ posture: 'sitting', occupying: 'bed' });
		c.perform({ type: 'sleep', target: 'bed' });
		let stood = false;
		for (let i = 0; i < 60 * 5; i++) {
			c.update(1 / 60);
			if (c.snapshot().posture === 'standing') stood = true;
		}
		expect(stood).toBe(false);
		expect(c.snapshot().posture).toBe('lying');
	});

	it('turns the swivel chair to the desk with the character on it, and back', () => {
		const c = new CharacterController();
		c.perform({ type: 'work', target: 'desk.chair' });
		let receiving = 0;
		for (let i = 0; i < 60 * 15; i++) {
			c.update(1 / 60);
			const s = c.snapshot();
			if (s.posture === 'standing' && c.animator.weight('sit') > 0.5) receiving = s.swivel;
		}
		const turned = wrapAngle(TARGETS['desk.chair'].seat!.at.yaw - Math.PI);
		expect(receiving).toBeCloseTo(turned, 2);
		const seated = c.snapshot();
		expect(wrapAngle(seated.yaw - Math.PI)).toBeCloseTo(0, 3);
		expect(seated.swivel).toBeCloseTo(0, 3);
		c.perform({ type: 'walkTo', target: 'room.center' });
		run(c, 15);
		expect(c.snapshot().swivel).toBeCloseTo(0, 3);
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

	it('eats standing at the kitchen counter, with a bowl in hand', () => {
		const c = new CharacterController();
		c.perform({ type: 'eat', target: 'kitchen.counter' });
		expect(c.snapshot().activity).toBe('none');
		const events = run(c, 12);
		const s = c.snapshot();
		expect(events).toContainEqual({
			type: 'completed',
			action: { type: 'eat', target: 'kitchen.counter' },
		});
		expect(s).toMatchObject({ posture: 'standing', activity: 'eat' });
		expect(s.x).toBeCloseTo(TARGETS['kitchen.counter'].approach.x, 3);
		expect(wrapAngle(s.yaw - TARGETS['kitchen.counter'].approachYaw)).toBeCloseTo(0, 2);
		run(c, 1);
		expect(c.animator.pose().bowl).toBe(1);
	});

	it('works sitting at the desk and plays sitting on the sofa', () => {
		const c = new CharacterController();
		c.perform({ type: 'work', target: 'desk.chair' });
		run(c, 12);
		expect(c.snapshot()).toMatchObject({
			posture: 'sitting',
			occupying: 'desk.chair',
			activity: 'work',
		});
		c.perform({ type: 'play', target: 'sofa' });
		run(c, 0.1);
		expect(c.snapshot().activity).toBe('none'); // stops typing before getting up
		run(c, 15);
		expect(c.snapshot()).toMatchObject({ posture: 'sitting', occupying: 'sofa', activity: 'play' });
	});

	it('switches activity in place without standing up', () => {
		const c = new CharacterController();
		c.perform({ type: 'sit', target: 'desk.chair' });
		run(c, 12);
		c.perform({ type: 'work', target: 'desk.chair' });
		const events = run(c, 1 / 60);
		expect(events).toEqual([{ type: 'completed', action: { type: 'work', target: 'desk.chair' } }]);
		expect(c.snapshot()).toMatchObject({ posture: 'sitting', activity: 'work' });
	});

	it('rejects activities at places that do not support them', () => {
		const c = new CharacterController();
		expect(c.perform({ type: 'work', target: 'sofa' })).toBe(false);
		expect(c.perform({ type: 'eat', target: 'bed' })).toBe(false);
	});

	it('walks slower when sad', () => {
		const timeTo = (mood: number) => {
			const c = new CharacterController();
			c.setMood(mood);
			c.perform({ type: 'walkTo', target: 'window' });
			let t = 0;
			while (c.snapshot().busy && t < 20) {
				c.update(1 / 60);
				t += 1 / 60;
			}
			return t;
		};
		expect(timeTo(0.1)).toBeGreaterThan(timeTo(0.9) * 1.2);
	});

	it('waves at the player, turning to face them first', () => {
		const c = new CharacterController(TARGETS['room.center'].approach, Math.PI);
		c.perform({ type: 'wave' });
		let maxWave = 0;
		const events: ControllerEvent[] = [];
		for (let t = 0; t < 5; t += 1 / 60) {
			events.push(...c.update(1 / 60));
			maxWave = Math.max(maxWave, c.animator.pose().wave);
		}
		expect(wrapAngle(c.snapshot().yaw)).toBeCloseTo(0, 2);
		expect(maxWave).toBeGreaterThan(0.9);
		expect(events).toEqual([{ type: 'completed', action: { type: 'wave' } }]);
		run(c, 1);
		expect(c.animator.pose().wave).toBe(0);
	});

	it('waves from the sofa without getting up', () => {
		const c = new CharacterController();
		c.perform({ type: 'sit', target: 'sofa' });
		run(c, 10);
		c.perform({ type: 'wave' });
		run(c, 1);
		expect(c.snapshot()).toMatchObject({ posture: 'sitting', occupying: 'sofa', activity: 'wave' });
	});

	it('turns its head towards the player while attentive', () => {
		// Facing the desk (away from the player) the head can only turn so far.
		const c = new CharacterController(TARGETS['room.center'].approach, Math.PI / 2);
		c.setAttention(true);
		run(c, 2);
		expect(c.animator.looking).toBe(1);
		expect(c.animator.pose().headYaw).toBeCloseTo(-1.3, 2);
		c.setAttention(false);
		run(c, 2);
		expect(c.animator.looking).toBe(0);
	});

	it('leaves through the door and comes back in', () => {
		const c = new CharacterController();
		c.perform({ type: 'leave', target: 'door' });
		let sawDoorOpen = false;
		const events: ControllerEvent[] = [];
		for (let t = 0; t < 15; t += 1 / 60) {
			events.push(...c.update(1 / 60));
			if (c.snapshot().door > 0.9) sawDoorOpen = true;
		}
		expect(sawDoorOpen).toBe(true);
		expect(c.snapshot()).toMatchObject({ away: true, busy: false });
		expect(c.snapshot().door).toBeLessThan(0.05);
		expect(events).toContainEqual({ type: 'completed', action: { type: 'leave', target: 'door' } });

		// Any next action starts by walking back in.
		c.perform({ type: 'sit', target: 'sofa' });
		run(c, 1);
		expect(c.snapshot().away).toBe(false);
		run(c, 15);
		expect(c.snapshot()).toMatchObject({ posture: 'sitting', occupying: 'sofa' });
	});

	it('sweeps a loop through the room with the broom in hand', () => {
		const c = new CharacterController();
		c.perform({ type: 'clean' });
		run(c, 0.5);
		expect(c.snapshot().activity).toBe('clean');
		expect(c.animator.pose().broom).toBeGreaterThan(0);
		const events = run(c, 30);
		expect(events).toContainEqual({ type: 'completed', action: { type: 'clean' } });
	});

	it('does the richer day where it belongs', () => {
		const cases = [
			[{ type: 'cook', target: 'kitchen.counter' }, 'standing', 'cook'],
			[{ type: 'watch', target: 'sofa' }, 'sitting', 'tv'],
			[{ type: 'read', target: 'bed' }, 'sitting', 'read'],
			[{ type: 'listen', target: 'sofa' }, 'sitting', 'music'],
			[{ type: 'call', target: 'window' }, 'standing', 'phone'],
			[{ type: 'exercise', target: 'room.center' }, 'standing', 'exercise'],
			[{ type: 'dance', target: 'room.center' }, 'standing', 'dance'],
		] as const;
		for (const [action, posture, activity] of cases) {
			const c = new CharacterController();
			expect(c.perform(action), action.type).toBe(true);
			run(c, 15);
			expect(c.snapshot(), action.type).toMatchObject({ posture, activity });
		}
	});

	it('squats while working out and holds the phone while calling', () => {
		const c = new CharacterController();
		c.perform({ type: 'exercise', target: 'room.center' });
		run(c, 10);
		let deepest = 0;
		for (let i = 0; i < 180; i++) {
			c.update(1 / 60);
			deepest = Math.max(deepest, c.animator.pose().knee);
		}
		expect(deepest).toBeGreaterThan(1);
		const p = new CharacterController();
		p.perform({ type: 'call', target: 'window' });
		run(p, 10);
		expect(p.animator.pose().phone).toBe(1);
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
