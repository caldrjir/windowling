import { beforeAll, describe, expect, it } from 'vitest';
import { initPhysics, PhysicsWorld } from './physics.ts';

describe('PhysicsWorld (headless Rapier)', () => {
	beforeAll(async () => {
		await initPhysics();
	});

	it('drops a box onto the ground and lets it come to rest', () => {
		const physics = PhysicsWorld.create();
		physics.addStaticBox({ x: 5, y: 0.1, z: 5 }, { x: 0, y: -0.1, z: 0 });
		const box = physics.addDynamicBox({ x: 0.25, y: 0.25, z: 0.25 }, { x: 0, y: 3, z: 0 });

		for (let i = 0; i < 240; i++) physics.step();

		const y = physics.getTransform(box)!.position.y;
		expect(y).toBeGreaterThan(0.2);
		expect(y).toBeLessThan(0.3);
		physics.dispose();
	});

	it('reacts to changed gravity (future phone tilt)', () => {
		const physics = PhysicsWorld.create({ x: 0, y: 0, z: 0 });
		const box = physics.addDynamicBox({ x: 0.25, y: 0.25, z: 0.25 }, { x: 0, y: 0, z: 0 });
		physics.setGravity({ x: 9.81, y: 0, z: 0 });
		for (let i = 0; i < 60; i++) physics.step();
		expect(physics.getTransform(box)!.position.x).toBeGreaterThan(1);
		physics.dispose();
	});

	it('applies impulses (future shake)', () => {
		const physics = PhysicsWorld.create({ x: 0, y: 0, z: 0 });
		const box = physics.addDynamicBox({ x: 0.25, y: 0.25, z: 0.25 }, { x: 0, y: 0, z: 0 });
		physics.applyImpulse(box, { x: 0, y: 0, z: 5 });
		for (let i = 0; i < 10; i++) physics.step();
		expect(physics.getTransform(box)!.position.z).toBeGreaterThan(0);
		physics.dispose();
	});
});

describe('PhysicsWorld balls', () => {
	beforeAll(async () => {
		await initPhysics();
	});

	it('lets a ball settle on the floor', () => {
		const physics = PhysicsWorld.create();
		physics.addStaticBox({ x: 5, y: 0.1, z: 5 }, { x: 0, y: -0.1, z: 0 });
		const ball = physics.addDynamicBall(0.1, { x: 0, y: 1, z: 0 });
		for (let i = 0; i < 600; i++) physics.step();
		expect(physics.getTransform(ball)!.position.y).toBeCloseTo(0.1, 1);
		physics.dispose();
	});
});
