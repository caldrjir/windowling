import {
	ShakeDetector,
	smoothGravity,
	tiltToGravity,
	type Gravity,
	type Orientation,
} from './motion';

type PermissionFn = () => Promise<'granted' | 'denied'>;

interface WithPermission {
	requestPermission?: PermissionFn;
}

/** Does this device have motion sensors worth offering (phones and tablets)? */
export function hasMotionSensors(): boolean {
	return (
		typeof window !== 'undefined' &&
		'DeviceOrientationEvent' in window &&
		'DeviceMotionEvent' in window &&
		navigator.maxTouchPoints > 0
	);
}

/** iOS only lets pages read sensors after asking, from a tap. */
export function sensorsNeedPermission(): boolean {
	return (
		typeof (DeviceOrientationEvent as unknown as WithPermission).requestPermission === 'function' ||
		typeof (DeviceMotionEvent as unknown as WithPermission).requestPermission === 'function'
	);
}

/** Must be called from a user gesture on iOS. Resolves true when sensors may be used. */
export async function requestSensorPermission(): Promise<boolean> {
	try {
		const ask = [
			(DeviceOrientationEvent as unknown as WithPermission).requestPermission,
			(DeviceMotionEvent as unknown as WithPermission).requestPermission,
		].filter((fn): fn is PermissionFn => typeof fn === 'function');
		const answers = await Promise.all(ask.map((fn) => fn()));
		return answers.every((a) => a === 'granted');
	} catch {
		return false;
	}
}

export interface SensorCallbacks {
	onGravity: (gravity: Gravity) => void;
	/** Intensity 0..1. */
	onShake: (intensity: number) => void;
}

/**
 * Listens to the phone: tilt becomes gravity (relative to how it was held
 * when started), several hard jolts become a shake.
 */
export class PhoneSensors {
	private rest: Orientation | null = null;
	private gravity: Gravity = { x: 0, y: -9.81, z: 0 };
	private lastGravityPush = 0;
	private readonly detector = new ShakeDetector();
	/** Low-pass estimate of gravity, to remove it when the browser has no pure `acceleration`. */
	private lowPass: Gravity | null = null;

	constructor(private readonly callbacks: SensorCallbacks) {}

	start(): void {
		window.addEventListener('deviceorientation', this.onOrientation);
		window.addEventListener('devicemotion', this.onMotion);
	}

	stop(): void {
		window.removeEventListener('deviceorientation', this.onOrientation);
		window.removeEventListener('devicemotion', this.onMotion);
		this.rest = null;
		this.callbacks.onGravity({ x: 0, y: -9.81, z: 0 });
	}

	/** Treat the current way the phone is held as "level" again. */
	recalibrate(): void {
		this.rest = null;
	}

	private readonly onOrientation = (event: DeviceOrientationEvent) => {
		if (event.beta === null || event.gamma === null) return;
		const now: Orientation = { beta: event.beta, gamma: event.gamma };
		this.rest ??= now;
		const angle = screen.orientation?.angle ?? 0;
		this.gravity = smoothGravity(this.gravity, tiltToGravity(now, this.rest, angle));
		// Physics doesn't need more than ~30 updates a second.
		const t = performance.now();
		if (t - this.lastGravityPush > 33) {
			this.lastGravityPush = t;
			this.callbacks.onGravity(this.gravity);
		}
	};

	private readonly onMotion = (event: DeviceMotionEvent) => {
		let a: Gravity;
		const pure = event.acceleration;
		if (pure && pure.x !== null && pure.y !== null && pure.z !== null) {
			a = { x: pure.x, y: pure.y, z: pure.z };
		} else {
			const g = event.accelerationIncludingGravity;
			if (!g || g.x === null || g.y === null || g.z === null) return;
			const raw = { x: g.x, y: g.y, z: g.z };
			this.lowPass = this.lowPass ? smoothGravity(this.lowPass, raw, 0.1) : raw;
			a = { x: raw.x - this.lowPass.x, y: raw.y - this.lowPass.y, z: raw.z - this.lowPass.z };
		}
		const intensity = this.detector.sample(a, performance.now());
		if (intensity !== null) this.callbacks.onShake(intensity);
	};
}
