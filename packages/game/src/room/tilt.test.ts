import { beforeAll, describe, expect, it } from 'vitest';
import { initPhysics, PhysicsWorld } from '../physics.ts';
import { buildRoom } from './build-room.ts';
import { ROOM } from './layout.ts';

describe('the room held in a phone', () => {
	beforeAll(async () => {
		await initPhysics();
	});

	function roomWithBall() {
		const physics = PhysicsWorld.create();
		physics.setTimestep(1 / 60);
		buildRoom(physics);
		const ball = physics.addDynamicBall(0.11, { x: 0, y: 0.3, z: 0.3 });
		for (let i = 0; i < 120; i++) physics.step(); // let it settle
		return { physics, ball };
	}

	it('tilting sends loose things rolling, but never out of the room', () => {
		const { physics, ball } = roomWithBall();
		// Tilted hard towards the player and to the right.
		physics.setGravity({ x: 5, y: -7, z: 5 });
		for (let i = 0; i < 600; i++) physics.step();
		const at = physics.getTransform(ball)?.position;
		expect(at?.x).toBeGreaterThan(1);
		expect(at?.z).toBeLessThan(ROOM.depth / 2); // stopped by the glass
		expect(at?.x).toBeLessThan(ROOM.width / 2);
		expect(at?.y).toBeGreaterThan(0);
	});

	it('a shake throws things up, the ceiling and floor keep them in', () => {
		const { physics, ball } = roomWithBall();
		physics.applyImpulse(ball, { x: 0, y: physics.mass(ball) * 30, z: 0 });
		let highest = 0;
		for (let i = 0; i < 300; i++) {
			physics.step();
			highest = Math.max(highest, physics.getTransform(ball)?.position.y ?? 0);
		}
		expect(highest).toBeGreaterThan(1);
		expect(highest).toBeLessThan(ROOM.height);
		expect(physics.getTransform(ball)?.position.y).toBeLessThan(0.5);
	});
});
