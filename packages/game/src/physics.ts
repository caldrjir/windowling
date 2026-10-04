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

	/** Gravity is mutable on purpose - later the phone's tilt drives it. */
	setGravity(gravity: Vec3): void {
		this.world.gravity = gravity;
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

	addDynamicBox(halfExtents: Vec3, position: Vec3, rotation?: Quat): BodyHandle {
		const desc = RAPIER.RigidBodyDesc.dynamic().setTranslation(position.x, position.y, position.z);
		if (rotation) desc.setRotation(rotation);
		const body = this.world.createRigidBody(desc);
		this.world.createCollider(
			RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z)
				.setRestitution(0.2)
				.setFriction(0.8),
			body,
		);
		return body.handle;
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
