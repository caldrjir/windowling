import { STARTER_ROOM_TARGETS, type CharacterAction } from '@windowling/shared';

/**
 * Placeholder behaviour for Iteration 1: keeps the character visibly living
 * (moving between places) until the real needs-driven scheduler arrives in
 * Iteration 2. It lives in the simulation because choosing *what to do* is a
 * simulation concern - the renderer only carries actions out.
 */
export interface AmbientChoice {
	action: CharacterAction;
	/** How long to stay with it after it completes. */
	dwellSeconds: number;
}

interface Option {
	action: CharacterAction;
	weight: number;
	dwell: [min: number, max: number];
}

const OPTIONS: Option[] = [
	{ action: { type: 'sit', target: 'sofa' }, weight: 3, dwell: [20, 60] },
	{ action: { type: 'sit', target: 'desk.chair' }, weight: 3, dwell: [30, 90] },
	{ action: { type: 'sleep', target: 'bed' }, weight: 1, dwell: [30, 60] },
	{ action: { type: 'walkTo', target: 'window' }, weight: 1, dwell: [5, 15] },
	{ action: { type: 'walkTo', target: 'room.center' }, weight: 2, dwell: [4, 10] },
	{ action: { type: 'idle' }, weight: 1, dwell: [3, 8] },
];

const KNOWN_TARGETS = new Set<string>(STARTER_ROOM_TARGETS.map((t) => t.id));

function targetOf(action: CharacterAction | null): string | null {
	return action && 'target' in action ? action.target : null;
}

/** Small deterministic PRNG (mulberry32) - same seed, same life. */
export function createRng(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** Picks the next thing to do, never repeating the previous place or action. */
export function nextAmbientAction(
	rng: () => number,
	previous: CharacterAction | null,
): AmbientChoice {
	const previousTarget = targetOf(previous);
	const candidates = OPTIONS.filter((o) => {
		const target = targetOf(o.action);
		if (target && !KNOWN_TARGETS.has(target)) return false;
		if (previous && o.action.type === previous.type && target === previousTarget) return false;
		return true;
	});
	const total = candidates.reduce((sum, o) => sum + o.weight, 0);
	let roll = rng() * total;
	let picked = candidates[candidates.length - 1] ?? OPTIONS[0];
	for (const option of candidates) {
		roll -= option.weight;
		if (roll < 0) {
			picked = option;
			break;
		}
	}
	if (!picked) throw new Error('no ambient options configured');
	const [min, max] = picked.dwell;
	return { action: picked.action, dwellSeconds: min + rng() * (max - min) };
}
