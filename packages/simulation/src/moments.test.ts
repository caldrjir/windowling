import { describe, expect, it } from 'vitest';
import { createRng } from './ambient.ts';
import { nextMoment, type MomentContext, type MomentKind } from './moments.ts';
import { personalityFor, TRAITS, type Personality } from './personality.ts';

const average: Personality = { competitive: 0.5, exuberant: 0.5, shy: 0.5, chatty: 0.5 };
const fine = { hunger: 0.2, energy: 0.8, mood: 0.8 };

/** How often each moment happens over many checks. */
function frequencies(ctx: MomentContext, checks = 2000) {
	const rng = createRng(11);
	const counts: Partial<Record<MomentKind, number>> = {};
	for (let i = 0; i < checks; i++) {
		const moment = nextMoment(ctx, rng);
		if (moment) counts[moment.kind] = (counts[moment.kind] ?? 0) + 1;
	}
	return (kind: MomentKind) => (counts[kind] ?? 0) / checks;
}

describe('personalityFor', () => {
	it('is stable per world and differs between worlds', () => {
		expect(personalityFor('w1')).toEqual(personalityFor('w1'));
		expect(personalityFor('w1')).not.toEqual(personalityFor('w2'));
		for (const trait of TRAITS) {
			expect(personalityFor('w3')[trait]).toBeGreaterThanOrEqual(0.1);
			expect(personalityFor('w3')[trait]).toBeLessThanOrEqual(0.9);
		}
	});
});

describe('nextMoment', () => {
	it('dances only with music, a good mood and some energy', () => {
		expect(
			frequencies({ activity: 'music', needs: fine, personality: average })('dance'),
		).toBeGreaterThan(0.2);
		expect(
			frequencies({ activity: 'music', needs: { ...fine, mood: 0.4 }, personality: average })(
				'dance',
			),
		).toBe(0);
		expect(frequencies({ activity: 'work', needs: fine, personality: average })('dance')).toBe(0);
	});

	it('an exuberant character dances far more than a reserved one', () => {
		const ctx = { activity: 'music' as const, needs: fine };
		const party = frequencies({ ...ctx, personality: { ...average, exuberant: 0.9 } })('dance');
		const wallflower = frequencies({ ...ctx, personality: { ...average, exuberant: 0.1 } })(
			'dance',
		);
		expect(party).toBeGreaterThan(wallflower * 2);
	});

	it('rages at games, more when competitive - and only at games', () => {
		const rage = (competitive: number) =>
			frequencies({ activity: 'gaming', needs: fine, personality: { ...average, competitive } })(
				'rage',
			);
		expect(rage(0.9)).toBeGreaterThan(rage(0.1) * 2);
		expect(frequencies({ activity: 'tv', needs: fine, personality: average })('rage')).toBe(0);
	});

	it('dozes off in front of the TV when tired, never when rested', () => {
		const tired = { hunger: 0.2, energy: 0.1, mood: 0.6 };
		expect(
			frequencies({ activity: 'tv', needs: tired, personality: average })('doze'),
		).toBeGreaterThan(0.3);
		expect(frequencies({ activity: 'tv', needs: fine, personality: average })('doze')).toBe(0);
	});

	it('nothing happens while it is out or asleep', () => {
		for (const activity of ['out', 'shower', 'sleep'] as const) {
			expect(
				nextMoment(
					{ activity, needs: { ...fine, energy: 0.1 }, personality: average },
					createRng(1),
				),
			).toBeNull();
		}
	});

	it('self-talk comes from a fixed list and private moments are marked', () => {
		const rng = createRng(3);
		for (let i = 0; i < 200; i++) {
			const m = nextMoment({ activity: 'gaming', needs: fine, personality: average }, rng);
			if (m?.kind === 'rage') {
				expect(m.private).toBe(true);
				expect(m.line).toMatch(/!/);
			}
		}
	});
});
