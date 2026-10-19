/**
 * Who lives in a world: realistic people built from MakeHuman's CC0 assets
 * (tools/character). Each world gets one, picked from its id - like its name.
 * The models are served as `/characters/<id>.glb`.
 */
export const CHARACTER_LOOKS = [
	{ id: 'ava', voice: 'female' },
	{ id: 'theo', voice: 'male' },
	{ id: 'maya', voice: 'female' },
	{ id: 'kenji', voice: 'male' },
] as const;

export type CharacterLook = (typeof CHARACTER_LOOKS)[number];

/** FNV-1a: stable across devices and visits. */
function hash(text: string): number {
	let h = 0x811c9dc5;
	for (let i = 0; i < text.length; i++) {
		h ^= text.charCodeAt(i);
		h = Math.imul(h, 0x01000193) >>> 0;
	}
	return h;
}

/** Deterministic: the same world always shows the same person. */
export function lookFor(seed: string): CharacterLook {
	return CHARACTER_LOOKS[hash(seed) % CHARACTER_LOOKS.length] ?? CHARACTER_LOOKS[0];
}

export function characterModelUrl(look: CharacterLook): string {
	return `/characters/${look.id}.glb`;
}

/** Motion capture every character plays (see `scripts/mocap.mjs`). */
export const CHARACTER_MOTIONS_URL = '/characters/motions.json';
