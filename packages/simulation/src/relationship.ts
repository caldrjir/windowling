import type { MoneyOutcome, Relationship } from '@windowling/shared';

/** Things that happen between the character and the player. */
export type RelationshipEvent =
	/** It noticed the player and came to the window. */
	| { type: 'visit' }
	/** They talked; `valence` -1..1 is how it felt about it (from the emotion). */
	| { type: 'conversation'; valence: number; intensity: number }
	/** Knocked awake. */
	| { type: 'woken' }
	/** It came over or spoke and the player stayed silent. */
	| { type: 'silence' }
	/** The player shook the whole flat. Intensity 0..1. */
	| { type: 'shaken'; intensity: number }
	/** What came of a question about money (entrusted savings). */
	| { type: 'money'; outcome: MoneyOutcome }
	/** It unpacked a present from the player (#74). */
	| { type: 'gift'; liked: boolean };

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
		case 'money':
			return moneyEffect(rel, event.outcome);
		case 'gift':
			// Someone thought of it - though with its own money, so a miss stings a little.
			return event.liked
				? {
						affinity: clamp(rel.affinity + 0.08, -1, 1),
						trust: clamp(rel.trust + 0.02, 0, 1),
						familiarity: clamp(rel.familiarity + 0.02, 0, 1),
					}
				: { ...rel, affinity: clamp(rel.affinity - 0.03, -1, 1) };
		case 'shaken': {
			const k = clamp(event.intensity, 0, 1);
			return {
				affinity: clamp(rel.affinity - 0.06 * k, -1, 1),
				trust: clamp(rel.trust - 0.04 * k, 0, 1),
				familiarity: rel.familiarity,
			};
		}
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

/**
 * Money is where trust is really tested: giving it back when asked builds it
 * more than anything; keeping it when it is needed hurts more than anything.
 */
function moneyEffect(rel: Relationship, outcome: MoneyOutcome): Relationship {
	const change = (affinity: number, trust: number): Relationship => ({
		affinity: clamp(rel.affinity + affinity, -1, 1),
		trust: clamp(rel.trust + trust, 0, 1),
		familiarity: clamp(rel.familiarity + 0.02, 0, 1),
	});
	switch (outcome) {
		case 'entrusted':
			return change(0.03, 0.03);
		case 'declined':
			return change(0, 0);
		case 'returned':
			return change(0.06, 0.12);
		case 'withheld':
			return change(-0.1, -0.15);
		case 'returned_unasked':
			return change(0.02, 0.04);
	}
}
