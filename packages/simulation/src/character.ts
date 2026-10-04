/**
 * Initial identity of a freshly created character. Deliberately tiny -
 * personality, needs and preferences arrive in later iterations.
 */
export interface InitialCharacter {
	name: string;
}

const STARTER_NAMES = ['Alex', 'Sam', 'Robin', 'Charlie', 'Jamie', 'Kai', 'Noa', 'Riley'] as const;

/** Deterministic: the same seed (e.g. the world id) always yields the same character. */
export function createInitialCharacter(seed: string): InitialCharacter {
	const name = STARTER_NAMES[hashString(seed) % STARTER_NAMES.length] ?? STARTER_NAMES[0];
	return { name };
}

/** FNV-1a 32-bit. Stable across runtimes, good enough for picking from small lists. */
export function hashString(value: string): number {
	let hash = 0x811c9dc5;
	for (let i = 0; i < value.length; i++) {
		hash ^= value.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193);
	}
	return hash >>> 0;
}
