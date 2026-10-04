import {
	ACESFilmicToneMapping,
	Color,
	Mesh,
	MeshStandardMaterial,
	PCFSoftShadowMap,
	PerspectiveCamera,
	Quaternion,
	Scene,
	SphereGeometry,
	SRGBColorSpace,
	Vector3,
	WebGLRenderer,
} from 'three';
import type { CharacterAction } from '@windowling/shared';
import {
	CharacterController,
	type CharacterSnapshot,
	type ControllerEvent,
} from './character/controller.ts';
import { CharacterRig } from './character/rig.ts';
import { FixedStepAccumulator } from './fixed-step.ts';
import { initPhysics, PhysicsWorld, type BodyHandle, type BodyTransform } from './physics.ts';
import { buildRoom, type Room } from './room/build-room.ts';
import { frameRoom } from './room/framing.ts';

export type GameWorldStatus = 'running' | 'paused' | 'disposed';

export interface GameWorldOptions {
	/** Upper bound for devicePixelRatio - keeps phones cool. */
	maxPixelRatio?: number;
	/** Local clock used for the light outside the window. Defaults to the device clock. */
	now?: () => Date;
}

interface PhysicsMesh {
	handle: BodyHandle;
	mesh: Mesh;
	previous: BodyTransform;
	current: BodyTransform;
}

const PHYSICS_STEP = 1 / 60;
const TIME_OF_DAY_REFRESH_MS = 30_000;

/**
 * Owns the renderer, scene, physics and the requestAnimationFrame loop.
 * UI frameworks only mount/unmount it - they never drive frames.
 */
export class GameWorld {
	private readonly renderer: WebGLRenderer;
	private readonly scene = new Scene();
	private readonly camera = new PerspectiveCamera(40, 1, 0.1, 100);
	private readonly physics: PhysicsWorld;
	private readonly room: Room;
	private readonly now: () => Date;
	private readonly accumulator = new FixedStepAccumulator({
		step: PHYSICS_STEP,
		maxFrameTime: 0.25,
	});
	private readonly bodies: PhysicsMesh[] = [];
	private readonly character = new CharacterController();
	private readonly rig = new CharacterRig();
	private readonly listeners = new Set<(event: ControllerEvent) => void>();
	private readonly resizeObserver: ResizeObserver;
	private frame = 0;
	private lastTime = 0;
	private lastTimeOfDayUpdate = -Infinity;
	private _status: GameWorldStatus = 'paused';

	private readonly tmpPosA = new Vector3();
	private readonly tmpPosB = new Vector3();
	private readonly tmpQuatA = new Quaternion();
	private readonly tmpQuatB = new Quaternion();

	private constructor(
		private readonly canvas: HTMLCanvasElement,
		options: GameWorldOptions,
	) {
		this.now = options.now ?? (() => new Date());
		this.renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' });
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, options.maxPixelRatio ?? 2));
		this.renderer.outputColorSpace = SRGBColorSpace;
		this.renderer.toneMapping = ACESFilmicToneMapping;
		this.renderer.shadowMap.enabled = true;
		this.renderer.shadowMap.type = PCFSoftShadowMap;

		this.scene.background = new Color('#14151f');

		this.physics = PhysicsWorld.create();
		this.physics.setTimestep(PHYSICS_STEP);

		this.room = buildRoom(this.physics);
		this.scene.add(this.room.group);
		this.addBall();
		this.scene.add(this.rig.root);
		this.rig.apply(this.character.snapshot(), this.character.animator.pose());

		this.resizeObserver = new ResizeObserver(() => this.resize());
		this.resizeObserver.observe(canvas);
		this.resize();
		this.updateTimeOfDay(performance.now(), true);
	}

	/** Async because the physics engine is a WASM module. */
	static async create(
		canvas: HTMLCanvasElement,
		options: GameWorldOptions = {},
	): Promise<GameWorld> {
		await initPhysics();
		return new GameWorld(canvas, options);
	}

	get status(): GameWorldStatus {
		return this._status;
	}

	/**
	 * Asks the character to carry out a high-level action. The decision is made
	 * elsewhere (simulation); this only animates it. Returns false if impossible.
	 */
	perform(action: CharacterAction): boolean {
		return this.character.perform(action);
	}

	/** Subscribes to action completion / rejection. Returns an unsubscribe function. */
	onCharacterEvent(listener: (event: ControllerEvent) => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	get characterState(): CharacterSnapshot {
		return this.character.snapshot();
	}

	start(): void {
		if (this._status !== 'paused') return;
		this._status = 'running';
		this.lastTime = performance.now();
		this.accumulator.reset();
		this.frame = requestAnimationFrame(this.tick);
	}

	pause(): void {
		if (this._status !== 'running') return;
		this._status = 'paused';
		cancelAnimationFrame(this.frame);
	}

	dispose(): void {
		if (this._status === 'disposed') return;
		this.pause();
		this._status = 'disposed';
		this.resizeObserver.disconnect();
		this.scene.traverse((object) => {
			if (object instanceof Mesh) {
				object.geometry.dispose();
				const materials = Array.isArray(object.material) ? object.material : [object.material];
				for (const material of materials) material.dispose();
			}
		});
		this.listeners.clear();
		this.rig.dispose();
		this.physics.dispose();
		this.renderer.dispose();
	}

	private readonly tick = (now: number): void => {
		if (this._status !== 'running') return;
		const frameSeconds = (now - this.lastTime) / 1000;
		const { steps, alpha } = this.accumulator.advance(frameSeconds);
		this.lastTime = now;

		// Character runs on frame time (clamped so a background tab doesn't teleport it).
		const events = this.character.update(Math.min(Math.max(frameSeconds, 0), 0.1));
		this.rig.apply(this.character.snapshot(), this.character.animator.pose());
		for (const event of events) for (const listener of this.listeners) listener(event);

		for (let i = 0; i < steps; i++) {
			this.physics.step();
			for (const body of this.bodies) {
				body.previous = body.current;
				body.current = this.physics.getTransform(body.handle) ?? body.current;
			}
		}
		this.syncMeshes(alpha);
		this.updateTimeOfDay(now);
		this.renderer.render(this.scene, this.camera);
		this.frame = requestAnimationFrame(this.tick);
	};

	private updateTimeOfDay(now: number, force = false): void {
		if (!force && now - this.lastTimeOfDayUpdate < TIME_OF_DAY_REFRESH_MS) return;
		this.lastTimeOfDayUpdate = now;
		const date = this.now();
		this.room.setTimeOfDay(date.getHours() + date.getMinutes() / 60);
	}

	private syncMeshes(alpha: number): void {
		for (const { mesh, previous, current } of this.bodies) {
			this.tmpPosA.set(previous.position.x, previous.position.y, previous.position.z);
			this.tmpPosB.set(current.position.x, current.position.y, current.position.z);
			mesh.position.lerpVectors(this.tmpPosA, this.tmpPosB, alpha);
			this.tmpQuatA.set(
				previous.rotation.x,
				previous.rotation.y,
				previous.rotation.z,
				previous.rotation.w,
			);
			this.tmpQuatB.set(
				current.rotation.x,
				current.rotation.y,
				current.rotation.z,
				current.rotation.w,
			);
			mesh.quaternion.slerpQuaternions(this.tmpQuatA, this.tmpQuatB, alpha);
		}
	}

	private resize(): void {
		const width = this.canvas.clientWidth;
		const height = this.canvas.clientHeight;
		if (width === 0 || height === 0) return;
		this.renderer.setSize(width, height, false);
		const aspect = width / height;
		const frame = frameRoom(aspect);
		this.camera.aspect = aspect;
		this.camera.fov = frame.fov;
		this.camera.position.set(frame.position.x, frame.position.y, frame.position.z);
		this.camera.lookAt(frame.target.x, frame.target.y, frame.target.z);
		this.camera.updateProjectionMatrix();
	}

	/** A ball on the rug: the first loose object that later reacts to shaking. */
	private addBall(): void {
		const radius = 0.11;
		const handle = this.physics.addDynamicBall(radius, { x: 0.7, y: 0.6, z: 0.5 });
		const mesh = new Mesh(
			new SphereGeometry(radius, 24, 16),
			new MeshStandardMaterial({ color: '#e07a5f', roughness: 0.5 }),
		);
		mesh.castShadow = true;
		this.scene.add(mesh);
		const transform = this.physics.getTransform(handle);
		if (!transform) throw new Error('physics body was not created');
		this.bodies.push({ handle, mesh, previous: transform, current: transform });
		this.syncMeshes(1);
	}
}
