import { createRng } from './ambient.ts';
import { hashString } from './character.ts';

/**
 * Who the character is. Stable for a world (derived from its id), shown only
 * through behaviour: a competitive one rages at games, an exuberant one
 * dances when the music is good, a shy one is mortified to be caught.
 */
export interface Personality {
	/** Hates losing. */
	competitive: number;
	/** Dances, sings, cheers. */
	exuberant: number;
	/** Embarrassed easily. */
	shy: number;
	/** Talks - also to itself. */
	chatty: number;
}

export const TRAITS: ReadonlyArray<keyof Personality> = [
	'competitive',
	'exuberant',
	'shy',
	'chatty',
];

/** Deterministic: the same world always has the same character. Traits spread 0.1..0.9. */
export function personalityFor(seed: string): Personality {
	const rng = createRng(hashString(`personality:${seed}`));
	const trait = () => 0.1 + rng() * 0.8;
	return { competitive: trait(), exuberant: trait(), shy: trait(), chatty: trait() };
}
