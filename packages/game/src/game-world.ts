import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { Object3D } from 'three';
import {
	ACESFilmicToneMapping,
	Color,
	Mesh,
	MeshStandardMaterial,
	PCFShadowMap,
	PerspectiveCamera,
	Quaternion,
	Scene,
	SphereGeometry,
	SRGBColorSpace,
	Vector3,
	WebGLRenderer,
	PMREMGenerator,
	Texture,
} from 'three';
import type { CharacterAction } from '@windowling/shared';
import {
	CharacterController,
	type CharacterSnapshot,
	type ControllerEvent,
} from './character/controller.ts';
import type { Emotion, MomentAnimation } from './character/animation.ts';
import { CharacterRig } from './character/rig.ts';
import { AdaptiveResolution } from './adaptive-resolution.ts';
import { FixedStepAccumulator } from './fixed-step.ts';
import {
	initPhysics,
	PhysicsWorld,
	type BodyHandle,
	type BodyTransform,
	type Vec3,
} from './physics.ts';
import { buildBook, buildMug, buildThrowPillow } from './room/furniture/props.ts';
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
	mesh: Object3D;
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
	private readonly environment: Texture;
	private readonly resolution: AdaptiveResolution;
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
	private lean = { x: 0, z: 0 };
	private shakeLeft = 0;
	private shakeStrength = 0;
	private frame0 = { position: new Vector3(), target: new Vector3() };
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
		this.resolution = new AdaptiveResolution(
			Math.min(window.devicePixelRatio, options.maxPixelRatio ?? 2),
		);
		this.renderer.setPixelRatio(this.resolution.ratio);
		this.renderer.outputColorSpace = SRGBColorSpace;
		this.renderer.toneMapping = ACESFilmicToneMapping;
		this.renderer.shadowMap.enabled = true;
		this.renderer.shadowMap.type = PCFShadowMap;

		this.scene.background = new Color('#14151f');
		// Soft reflections of a generic room for the metal parts (see room/materials.ts).
		const pmrem = new PMREMGenerator(this.renderer);
		this.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
		pmrem.dispose();

		this.physics = PhysicsWorld.create();
		this.physics.setTimestep(PHYSICS_STEP);

		this.room = buildRoom(this.physics, this.environment);
		this.scene.add(this.room.group);
		this.addLooseThings();
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
		const world = new GameWorld(canvas, options);
		// Compile every shader before the first frame, in parallel where the browser can:
		// otherwise the first frame blocks the page for seconds on weak devices.
		await world.renderer.compileAsync(world.scene, world.camera);
		return world;
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

	/** The character looks at the player (true) or minds its own business (false). */
	setAttention(on: boolean): void {
		this.character.setAttention(on);
	}

	/** Mouth moves while the character's voice is playing (basic lip sync). */
	setSpeaking(speaking: boolean): void {
		this.character.animator.setSpeaking(speaking);
	}

	/** A new word started: snap the mouth open for it. */
	pulseMouth(): void {
		this.character.animator.pulseMouth();
	}

	/** Shows a feeling in posture for a few seconds (from a decision's emotion). */
	showEmotion(emotion: Emotion, intensity: number): void {
		this.character.animator.showEmotion(emotion, intensity);
	}

	/** Plays a short moment over the current activity (raging, dozing...); null ends it. */
	setMoment(moment: MomentAnimation | null): void {
		this.character.animator.setMoment(moment);
	}

	/**
	 * Which way is down, in room space (the phone's tilt). Loose things roll,
	 * and the camera leans a little - like holding a box with a room inside.
	 */
	setGravity(gravity: Vec3): void {
		this.physics.setGravity(gravity);
		const g = Math.hypot(gravity.x, gravity.y, gravity.z) || 1;
		this.lean = { x: gravity.x / g, z: gravity.z / g };
		this.applyCamera();
	}

	/**
	 * The phone was shaken: loose things fly, the view jolts, the character
	 * loses balance. Intensity 0..1. Consequences are decided elsewhere.
	 */
	shake(intensity: number): void {
		const k = Math.min(1, Math.max(0, intensity));
		this.shakeLeft = 0.4 + 0.5 * k;
		this.shakeStrength = 0.04 + 0.08 * k;
		for (const [i, body] of this.bodies.entries()) {
			const mass = this.physics.mass(body.handle);
			const angle = i * 2.399 + performance.now() / 1000;
			const speed = 1.5 + 3 * k;
			this.physics.applyImpulse(body.handle, {
				x: Math.cos(angle) * speed * mass,
				y: (1 + 2 * k) * mass,
				z: Math.sin(angle) * speed * mass * 0.6,
			});
		}
		this.character.animator.startle(k);
	}

	/** How the character feels (0..1, from the simulation); shows in pace and posture. */
	setMood(mood: number): void {
		this.character.setMood(mood);
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
				for (const material of materials) {
					// Procedural textures (wood grain, fabric) belong to their materials.
					for (const value of Object.values(material)) {
						if (value instanceof Texture) value.dispose();
					}
					material.dispose();
				}
			}
		});
		this.listeners.clear();
		this.rig.dispose();
		this.physics.dispose();
		this.environment.dispose();
		this.renderer.dispose();
	}

	private readonly tick = (now: number): void => {
		if (this._status !== 'running') return;
		const frameSeconds = (now - this.lastTime) / 1000;
		// A device that can't keep up draws fewer pixels rather than a choppy room.
		const ratio = this.resolution.update(frameSeconds);
		if (ratio !== null) {
			this.renderer.setPixelRatio(ratio);
			this.resize();
		}
		const { steps, alpha } = this.accumulator.advance(frameSeconds);
		this.lastTime = now;

		// Character runs on frame time (clamped so a background tab doesn't teleport it).
		const events = this.character.update(Math.min(Math.max(frameSeconds, 0), 0.1));
		const snapshot = this.character.snapshot();
		this.rig.apply(snapshot, this.character.animator.pose());
		// Out of the flat: nobody to see. The door shows the coming and going.
		this.rig.root.visible = !snapshot.away;
		this.room.setDoor(snapshot.door);
		this.room.setChairSwivel(snapshot.swivel);
		// The duvet comes up over the second half of lying down (and goes as it sits up).
		const lying = snapshot.occupying === 'bed' ? this.character.animator.weight('lie') : 0;
		this.room.setDuvet(Math.max(0, lying * 2 - 1));
		this.updateTv(snapshot.activity === 'tv', now);
		for (const event of events) for (const listener of this.listeners) listener(event);

		for (let i = 0; i < steps; i++) {
			this.physics.step();
			for (const body of this.bodies) {
				body.previous = body.current;
				body.current = this.physics.getTransform(body.handle) ?? body.current;
			}
		}
		this.syncMeshes(alpha);
		if (this.shakeLeft > 0) {
			this.shakeLeft = Math.max(0, this.shakeLeft - frameSeconds);
			this.applyCamera(this.shakeLeft > 0 ? this.shakeStrength * this.shakeLeft : 0);
		}
		this.updateTimeOfDay(now);
		this.renderer.render(this.scene, this.camera);
		this.frame = requestAnimationFrame(this.tick);
	};

	private tvFlicker = { next: 0, intensity: 0, hue: 0.6 };

	/** A TV on our side of the glass: only its restless light reaches the room. */
	private updateTv(on: boolean, now: number): void {
		if (!on) {
			if (this.tvFlicker.intensity !== 0) this.room.setTvGlow(0, 0.6);
			this.tvFlicker.intensity = 0;
			return;
		}
		if (now < this.tvFlicker.next) return;
		// New "shot" every 0.3-1.5 s: brightness and colour jump like a programme.
		this.tvFlicker.next = now + 300 + Math.random() * 1200;
		this.tvFlicker.intensity = 1.5 + Math.random() * 2.5;
		this.tvFlicker.hue = 0.5 + Math.random() * 0.2;
		this.room.setTvGlow(this.tvFlicker.intensity, this.tvFlicker.hue);
	}

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
		this.frame0.position.set(frame.position.x, frame.position.y, frame.position.z);
		this.frame0.target.set(frame.target.x, frame.target.y, frame.target.z);
		this.applyCamera();
		this.camera.updateProjectionMatrix();
	}

	/** Framing + tilt lean + shake jitter. */
	private applyCamera(jitter = 0): void {
		const { position, target } = this.frame0;
		// Leaning the box right shows a little more of the right wall, and so on.
		this.camera.position.set(
			position.x + this.lean.x * 0.4 + (jitter ? (Math.random() - 0.5) * jitter : 0),
			position.y + (jitter ? (Math.random() - 0.5) * jitter : 0),
			position.z + this.lean.z * 0.4,
		);
		this.camera.up.set(-this.lean.x * 0.15, 1, 0).normalize();
		this.camera.lookAt(target);
	}

	/**
	 * Loose things that tilt and shake with the phone: a ball, books, a cushion,
	 * a mug. Furniture is bolted down (static colliders in buildRoom).
	 */
	private addLooseThings(): void {
		const radius = 0.11;
		this.track(
			this.physics.addDynamicBall(radius, { x: 0.7, y: 0.6, z: 0.5 }),
			new Mesh(
				new SphereGeometry(radius, 24, 16),
				new MeshStandardMaterial({ color: '#e07a5f', roughness: 0.5 }),
			),
		);
		const things: Array<{ size: Vec3; at: Vec3; density: number; model: Object3D }> = [
			// Two books on the floor by the bed.
			{
				size: { x: 0.22, y: 0.04, z: 0.3 },
				at: { x: -1.25, y: 0.05, z: 0.9 },
				density: 0.8,
				model: buildBook({ x: 0.22, y: 0.04, z: 0.3 }, '#6b4a7a'),
			},
			{
				size: { x: 0.2, y: 0.05, z: 0.27 },
				at: { x: -1.2, y: 0.12, z: 0.88 },
				density: 0.8,
				model: buildBook({ x: 0.2, y: 0.05, z: 0.27 }, '#2f6f68'),
			},
			// A throw pillow on the free side of the bed.
			{
				size: { x: 0.42, y: 0.13, z: 0.34 },
				at: { x: -2.55, y: 0.75, z: -0.45 },
				density: 0.15,
				model: buildThrowPillow({ x: 0.42, y: 0.13, z: 0.34 }, '#c9a66b'),
			},
			// The coffee mug on the desk.
			{
				size: { x: 0.08, y: 0.1, z: 0.08 },
				at: { x: 2.4, y: 0.82, z: -1.76 },
				density: 0.6,
				model: buildMug(),
			},
		];
		for (const thing of things) {
			this.track(
				this.physics.addDynamicBox(
					{ x: thing.size.x / 2, y: thing.size.y / 2, z: thing.size.z / 2 },
					thing.at,
					undefined,
					{ density: thing.density },
				),
				thing.model,
			);
		}
		this.syncMeshes(1);
	}

	private track(handle: BodyHandle, mesh: Object3D): void {
		mesh.traverse((part) => {
			part.castShadow = true;
			part.receiveShadow = true;
		});
		this.scene.add(mesh);
		const transform = this.physics.getTransform(handle);
		if (!transform) throw new Error('physics body was not created');
		this.bodies.push({ handle, mesh, previous: transform, current: transform });
	}
}
