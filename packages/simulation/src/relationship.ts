import type { Relationship } from '@windowling/shared';

/** Things that happen between the character and the player. */
export type RelationshipEvent =
	/** It noticed the player and came to the window. */
	| { type: 'visit' }
	/** They talked; `valence` -1..1 is how it felt about it (from the emotion). */
	| { type: 'conversation'; valence: number; intensity: number }
	/** Knocked awake. */
	| { type: 'woken' }
	/** It came over or spoke and the player stayed silent. */
	| { type: 'silence' };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * One event never swings a relationship much - it is built (or ruined) over
 * many moments. Familiarity only grows.
 */
export function applyRelationshipEvent(rel: Relationship, event: RelationshipEvent): Relationship {
	switch (event.type) {
		case 'visit':
			return { ...rel, familiarity: clamp(rel.familiarity + 0.03, 0, 1) };
		case 'conversation': {
			const strength = clamp(event.valence, -1, 1) * (0.5 + 0.5 * clamp(event.intensity, 0, 1));
			return {
				affinity: clamp(rel.affinity + strength * 0.05, -1, 1),
				trust: clamp(rel.trust + (strength > 0 ? 0.01 : strength * 0.02), 0, 1),
				familiarity: clamp(rel.familiarity + 0.02, 0, 1),
			};
		}
		case 'woken':
			return {
				affinity: clamp(rel.affinity - 0.12, -1, 1),
				trust: clamp(rel.trust - 0.05, 0, 1),
				familiarity: rel.familiarity,
			};
		case 'silence':
			return { ...rel, affinity: clamp(rel.affinity - 0.01, -1, 1) };
	}
}

/** How an emotion felt: pleasant (+) or unpleasant (-). */
export function emotionValence(emotion: string): number {
	switch (emotion) {
		case 'happy':
			return 1;
		case 'surprised':
			return 0.2;
		case 'neutral':
		case 'embarrassed':
		case 'nervous':
		case 'tired':
			return 0;
		case 'sad':
			return -0.3;
		case 'annoyed':
			return -0.6;
		case 'angry':
			return -1;
		default:
			return 0;
	}
}
