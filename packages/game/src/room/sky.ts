/**
 * Colour of the sky seen through the back window for a local time of day.
 * Real time matters: at 3 AM it is dark outside the character's flat too.
 */
const KEYS: Array<[hour: number, rgb: [number, number, number]]> = [
	[0, [0.03, 0.04, 0.1]],
	[5, [0.05, 0.06, 0.14]],
	[6.5, [0.85, 0.55, 0.45]],
	[8, [0.55, 0.72, 0.92]],
	[17, [0.5, 0.68, 0.9]],
	[19, [0.95, 0.5, 0.35]],
	[20.5, [0.12, 0.12, 0.28]],
	[24, [0.03, 0.04, 0.1]],
];

const MIDNIGHT: [number, number, number] = [0.03, 0.04, 0.1];

export function skyColor(hours: number): [number, number, number] {
	const h = ((hours % 24) + 24) % 24;
	let previous = KEYS[0];
	for (const key of KEYS) {
		if (previous && h <= key[0]) {
			const [h0, c0] = previous;
			const [h1, c1] = key;
			const t = h1 === h0 ? 0 : (h - h0) / (h1 - h0);
			return [
				c0[0] + (c1[0] - c0[0]) * t,
				c0[1] + (c1[1] - c0[1]) * t,
				c0[2] + (c1[2] - c0[2]) * t,
			];
		}
		previous = key;
	}
	return MIDNIGHT;
}

/** 0 at night, 1 in full daylight - drives how much light comes in through the window. */
export function daylight(hours: number): number {
	const [r, g, b] = skyColor(hours);
	return Math.min(1, Math.max(0, (r + g + b) / 3 / 0.7));
}
