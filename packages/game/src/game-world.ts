import {
	ACESFilmicToneMapping,
	AmbientLight,
	BoxGeometry,
	Color,
	DirectionalLight,
	Mesh,
	MeshStandardMaterial,
	PCFSoftShadowMap,
	PerspectiveCamera,
	PlaneGeometry,
	Quaternion,
	Scene,
	SRGBColorSpace,
	Vector3,
	WebGLRenderer,
} from 'three';
import { FixedStepAccumulator } from './fixed-step.ts';
import { initPhysics, PhysicsWorld, type BodyHandle, type BodyTransform } from './physics.ts';

export type GameWorldStatus = 'running' | 'paused' | 'disposed';

export interface GameWorldOptions {
	/** Upper bound for devicePixelRatio - keeps phones cool. */
	maxPixelRatio?: number;
}

interface PhysicsMesh {
	handle: BodyHandle;
	mesh: Mesh;
	previous: BodyTransform;
	current: BodyTransform;
}

const PHYSICS_STEP = 1 / 60;

/**
 * Owns the renderer, scene, physics and the requestAnimationFrame loop.
 * UI frameworks only mount/unmount it - they never drive frames.
 */
export class GameWorld {
	private readonly renderer: WebGLRenderer;
	private readonly scene = new Scene();
	private readonly camera = new PerspectiveCamera(45, 1, 0.1, 100);
	private readonly physics: PhysicsWorld;
	private readonly accumulator = new FixedStepAccumulator({
		step: PHYSICS_STEP,
		maxFrameTime: 0.25,
	});
	private readonly bodies: PhysicsMesh[] = [];
	private readonly resizeObserver: ResizeObserver;
	private frame = 0;
	private lastTime = 0;
	private _status: GameWorldStatus = 'paused';

	private readonly tmpPos = new Vector3();
	private readonly tmpQuatA = new Quaternion();
	private readonly tmpQuatB = new Quaternion();

	private constructor(
		private readonly canvas: HTMLCanvasElement,
		options: GameWorldOptions,
	) {
		this.renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' });
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, options.maxPixelRatio ?? 2));
		this.renderer.outputColorSpace = SRGBColorSpace;
		this.renderer.toneMapping = ACESFilmicToneMapping;
		this.renderer.shadowMap.enabled = true;
		this.renderer.shadowMap.type = PCFSoftShadowMap;

		this.physics = PhysicsWorld.create();
		this.physics.setTimestep(PHYSICS_STEP);

		this.buildPlaceholderScene();

		this.resizeObserver = new ResizeObserver(() => this.resize());
		this.resizeObserver.observe(canvas);
		this.resize();
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
		this.physics.dispose();
		this.renderer.dispose();
	}

	private readonly tick = (now: number): void => {
		if (this._status !== 'running') return;
		const { steps, alpha } = this.accumulator.advance((now - this.lastTime) / 1000);
		this.lastTime = now;

		for (let i = 0; i < steps; i++) {
			this.physics.step();
			for (const body of this.bodies) {
				body.previous = body.current;
				body.current = this.physics.getTransform(body.handle) ?? body.current;
			}
		}
		this.syncMeshes(alpha);
		this.renderer.render(this.scene, this.camera);
		this.frame = requestAnimationFrame(this.tick);
	};

	private syncMeshes(alpha: number): void {
		for (const { mesh, previous, current } of this.bodies) {
			this.tmpPos.set(previous.position.x, previous.position.y, previous.position.z);
			mesh.position.lerpVectors(
				this.tmpPos,
				new Vector3(current.position.x, current.position.y, current.position.z),
				alpha,
			);
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
		this.camera.aspect = width / height;
		// Keep the room framed on portrait phones by pulling the camera back.
		const distance = this.camera.aspect < 1 ? 9 / Math.max(this.camera.aspect, 0.45) : 9;
		// Height scales with distance so the floor keeps a readable angle.
		this.camera.position.set(0, distance * 0.4, distance);
		this.camera.lookAt(0, 1, 0);
		this.camera.updateProjectionMatrix();
	}

	/**
	 * Iteration 0 placeholder: a floor and a few falling crates proving that
	 * rendering and physics run together. The real room arrives in Iteration 1.
	 */
	private buildPlaceholderScene(): void {
		this.scene.background = new Color('#1b1d2a');

		this.scene.add(new AmbientLight('#b9c4ff', 0.6));
		const sun = new DirectionalLight('#ffe2b8', 2.2);
		sun.position.set(4, 8, 5);
		sun.castShadow = true;
		sun.shadow.mapSize.set(1024, 1024);
		this.scene.add(sun);

		const floor = new Mesh(
			new PlaneGeometry(10, 10),
			new MeshStandardMaterial({ color: '#8a6f5a', roughness: 0.9 }),
		);
		floor.rotation.x = -Math.PI / 2;
		floor.receiveShadow = true;
		this.scene.add(floor);
		this.physics.addStaticBox({ x: 5, y: 0.1, z: 5 }, { x: 0, y: -0.1, z: 0 });

		const colors = ['#e07a5f', '#81b29a', '#f2cc8f'];
		colors.forEach((color, i) => {
			const size = 0.5;
			const position = { x: (i - 1) * 0.9, y: 2 + i * 1.2, z: 0 };
			const rotation = new Quaternion().setFromAxisAngle(new Vector3(1, 1, 0).normalize(), i * 0.6);
			const handle = this.physics.addDynamicBox(
				{ x: size / 2, y: size / 2, z: size / 2 },
				position,
				{ x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w },
			);
			const mesh = new Mesh(
				new BoxGeometry(size, size, size),
				new MeshStandardMaterial({ color, roughness: 0.6 }),
			);
			mesh.castShadow = true;
			this.scene.add(mesh);
			const transform = this.physics.getTransform(handle);
			if (!transform) throw new Error('physics body was not created');
			this.bodies.push({ handle, mesh, previous: transform, current: transform });
		});
		this.syncMeshes(1);
	}
}
