import RAPIER from '@dimforge/rapier3d-compat';

let ready: Promise<void> | undefined;

/** Loads the Rapier WASM module once (inlined, so no extra asset request). */
export function initPhysics(): Promise<void> {
	ready ??= RAPIER.init();
	return ready;
}

export interface Vec3 {
	x: number;
	y: number;
	z: number;
}

export interface Quat extends Vec3 {
	w: number;
}

export interface BodyTransform {
	position: Vec3;
	rotation: Quat;
}

export type BodyHandle = number;

/**
 * Thin wrapper around a Rapier world. Knows nothing about rendering;
 * the renderer reads transforms from it.
 */
export class PhysicsWorld {
	readonly world: RAPIER.World;

	private constructor(gravity: Vec3) {
		this.world = new RAPIER.World(gravity);
	}

	/** Call `initPhysics()` before creating a world. */
	static create(gravity: Vec3 = { x: 0, y: -9.81, z: 0 }): PhysicsWorld {
		return new PhysicsWorld(gravity);
	}

	setTimestep(seconds: number): void {
		this.world.timestep = seconds;
	}

	/** Gravity is mutable on purpose - the phone's tilt drives it. Wakes resting bodies. */
	setGravity(gravity: Vec3): void {
		this.world.gravity = gravity;
		this.world.forEachRigidBody((body) => {
			if (body.isDynamic()) body.wakeUp();
		});
	}

	get gravity(): Vec3 {
		const g = this.world.gravity;
		return { x: g.x, y: g.y, z: g.z };
	}

	addStaticBox(halfExtents: Vec3, position: Vec3): BodyHandle {
		const body = this.world.createRigidBody(
			RAPIER.RigidBodyDesc.fixed().setTranslation(position.x, position.y, position.z),
		);
		this.world.createCollider(
			RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z),
			body,
		);
		return body.handle;
	}

	addDynamicBox(
		halfExtents: Vec3,
		position: Vec3,
		rotation?: Quat,
		{ density = 1, friction = 0.8, restitution = 0.2 } = {},
	): BodyHandle {
		const desc = RAPIER.RigidBodyDesc.dynamic()
			.setTranslation(position.x, position.y, position.z)
			.setLinearDamping(0.3)
			.setAngularDamping(0.5);
		if (rotation) desc.setRotation(rotation);
		const body = this.world.createRigidBody(desc);
		this.world.createCollider(
			RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z)
				.setRestitution(restitution)
				.setFriction(friction)
				.setDensity(density),
			body,
		);
		return body.handle;
	}

	/** Mass of a body in kg (for impulses that feel the same on light and heavy things). */
	mass(handle: BodyHandle): number {
		return this.world.getRigidBody(handle)?.mass() ?? 0;
	}

	addDynamicBall(radius: number, position: Vec3): BodyHandle {
		const body = this.world.createRigidBody(
			RAPIER.RigidBodyDesc.dynamic()
				.setTranslation(position.x, position.y, position.z)
				.setLinearDamping(0.4)
				.setAngularDamping(0.4),
		);
		this.world.createCollider(
			RAPIER.ColliderDesc.ball(radius).setRestitution(0.5).setFriction(0.6).setDensity(0.3),
			body,
		);
		return body.handle;
	}

	applyImpulse(handle: BodyHandle, impulse: Vec3): void {
		this.world.getRigidBody(handle)?.applyImpulse(impulse, true);
	}

	getTransform(handle: BodyHandle): BodyTransform | null {
		const body = this.world.getRigidBody(handle);
		if (!body) return null;
		const t = body.translation();
		const r = body.rotation();
		return { position: { x: t.x, y: t.y, z: t.z }, rotation: { x: r.x, y: r.y, z: r.z, w: r.w } };
	}

	step(): void {
		this.world.step();
	}

	dispose(): void {
		this.world.free();
	}
}
