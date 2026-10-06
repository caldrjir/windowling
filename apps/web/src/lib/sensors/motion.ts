/**
 * Turning raw phone sensors into room physics. Pure functions - the browser
 * glue lives in `device.ts`.
 */
export interface Orientation {
	/** Front-back tilt in degrees (DeviceOrientationEvent.beta). */
	beta: number;
	/** Left-right tilt in degrees (DeviceOrientationEvent.gamma). */
	gamma: number;
}

export interface Gravity {
	x: number;
	y: number;
	z: number;
}

export const EARTH = 9.81;
/** Beyond this the room would just slide into a corner - it should feel held, not dropped. */
export const MAX_TILT_DEG = 35;

const rad = (deg: number) => (deg * Math.PI) / 180;
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * Gravity in room space (+x right, +y up, +z towards the player) from how far
 * the phone is tilted relative to `rest` (how it was held when sensors
 * started). Rolling the right edge down sends things right; tipping the top
 * away from you sends them to the back wall. `screenAngle` is
 * `screen.orientation.angle` (0, 90, 180, 270).
 */
export function tiltToGravity(now: Orientation, rest: Orientation, screenAngle = 0): Gravity {
	const dBeta = now.beta - rest.beta;
	const dGamma = now.gamma - rest.gamma;
	// In landscape the phone's axes are swapped relative to the screen.
	let roll: number;
	let pitch: number;
	switch (((screenAngle % 360) + 360) % 360) {
		case 90:
			roll = dBeta;
			pitch = -dGamma;
			break;
		case 180:
			roll = -dGamma;
			pitch = -dBeta;
			break;
		case 270:
			roll = -dBeta;
			pitch = dGamma;
			break;
		default:
			roll = dGamma;
			pitch = dBeta;
	}
	const x = EARTH * Math.sin(rad(clamp(roll, -MAX_TILT_DEG, MAX_TILT_DEG)));
	const z = EARTH * Math.sin(rad(clamp(pitch, -MAX_TILT_DEG, MAX_TILT_DEG)));
	return { x, y: -Math.sqrt(Math.max(0, EARTH * EARTH - x * x - z * z)), z };
}

/** Smooths noisy sensor gravity (exponential moving average). */
export function smoothGravity(previous: Gravity, next: Gravity, factor = 0.15): Gravity {
	return {
		x: previous.x + (next.x - previous.x) * factor,
		y: previous.y + (next.y - previous.y) * factor,
		z: previous.z + (next.z - previous.z) * factor,
	};
}

/** Acceleration peaks above this (m/s², gravity removed) count as a jolt. */
export const JOLT = 12;
const WINDOW_MS = 1_000;
const PEAKS_FOR_SHAKE = 3;
const COOLDOWN_MS = 1_500;

/**
 * A shake is several hard jolts within a second - not a single bump or
 * walking with the phone. Reports an intensity 0..1 once per shake.
 */
export class ShakeDetector {
	private peaks: Array<{ t: number; magnitude: number }> = [];
	private lastShake = -Infinity;
	private wasAbove = false;

	/** `acceleration` without gravity, in m/s²; `t` in ms. Returns intensity on a shake. */
	sample(acceleration: Gravity, t: number): number | null {
		const magnitude = Math.hypot(acceleration.x, acceleration.y, acceleration.z);
		const above = magnitude > JOLT;
		// Count each excursion above the threshold once (its rising edge).
		if (above && !this.wasAbove) this.peaks.push({ t, magnitude });
		else if (above && this.peaks.length) {
			const last = this.peaks[this.peaks.length - 1];
			if (last && last.magnitude < magnitude) last.magnitude = magnitude;
		}
		this.wasAbove = above;
		this.peaks = this.peaks.filter((p) => t - p.t <= WINDOW_MS);
		if (this.peaks.length < PEAKS_FOR_SHAKE || t - this.lastShake < COOLDOWN_MS) return null;
		const average = this.peaks.reduce((sum, p) => sum + p.magnitude, 0) / this.peaks.length;
		this.lastShake = t;
		this.peaks = [];
		return clamp((average - JOLT) / 15, 0.1, 1);
	}
}
