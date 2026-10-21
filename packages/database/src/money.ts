import type { MoneyOutcome } from '@windowling/shared';
import {
	answerMoneyAsk,
	askAboutMoney,
	DOLLAR,
	giveBackAll,
	localClock,
	moneyMoment,
	type MoneyAsk,
	type MoneySettlement,
} from '@windowling/simulation';
import { and, eq } from 'drizzle-orm';
import type { Database } from './client.ts';
import { getRelationship, recordRelationshipEvent, remember } from './memories.ts';
import { character } from './schema/index.ts';
import {
	catchUpWorld,
	envelopeColumns,
	findWorldByUserId,
	lifeColumns,
	type WorldRecord,
} from './worlds.ts';

/**
 * Entrusted money (#70), server side: the character brings money up, the
 * player answers. Every change is checked against what is stored right now
 * (optimistic: the character row must be unchanged since it was read), so a
 * double click or two tabs can never move money twice.
 */
export interface MoneyMomentResult {
	ask: MoneyAsk | null;
	/** What the player keeps for it now (cents). */
	envelope: number;
}

/** It came to the window: does it bring money up? Records the question if so. */
export async function bringUpMoney(
	db: Database,
	userId: string,
	now: Date = new Date(),
): Promise<MoneyMomentResult | null> {
	const found = await findWorldByUserId(db, userId);
	if (!found) return null;
	const world = await catchUpWorld(db, found, now);
	const { life, envelope } = world.character;
	const relationship = await getRelationship(db, world.id);
	const ask = moneyMoment(life.money, envelope, relationship, now, world.timeZone);
	if (!ask) return { ask: null, envelope: envelope.cents };
	const saved = await db
		.update(character)
		.set(envelopeColumns(askAboutMoney(envelope, ask)))
		.where(unchangedEnvelope(world))
		.returning({ id: character.id });
	return { ask: saved.length ? ask : null, envelope: envelope.cents };
}

export interface MoneyAnswerResult {
	outcome: MoneyOutcome;
	cents: number;
	envelope: number;
}

/** The player's answer to its open question; null when there is none (any more). */
export async function answerMoney(
	db: Database,
	userId: string,
	yes: boolean,
	now: Date = new Date(),
): Promise<MoneyAnswerResult | null> {
	const found = await findWorldByUserId(db, userId);
	if (!found) return null;
	const world = await catchUpWorld(db, found, now);
	const { life, envelope } = world.character;
	return settle(db, world, answerMoneyAsk(life.money, envelope, yes, now), now);
}

/** The player hands back everything it keeps, unasked; null when the envelope is empty. */
export async function giveBackMoney(
	db: Database,
	userId: string,
	now: Date = new Date(),
): Promise<MoneyAnswerResult | null> {
	const found = await findWorldByUserId(db, userId);
	if (!found) return null;
	const world = await catchUpWorld(db, found, now);
	const { life, envelope } = world.character;
	return settle(db, world, giveBackAll(life.money, envelope), now);
}

function unchangedEnvelope(world: WorldRecord) {
	const { envelope, life } = world.character;
	return and(
		eq(character.id, world.character.id),
		eq(character.entrustedCents, envelope.cents),
		eq(character.balanceCents, life.money.balance),
	);
}

const dollars = (cents: number) => `$${String(Math.round(cents / DOLLAR))}`;

/** It won't forget how this went. */
const MEMORIES: Record<
	MoneyOutcome,
	{ note: (cents: number) => string; importance: number; emotion: string } | null
> = {
	entrusted: {
		note: (c) => `I gave the player ${dollars(c)} of my savings to keep for me.`,
		importance: 0.7,
		emotion: 'happy',
	},
	declined: {
		note: () => 'I asked the player to keep some of my savings, but they would not.',
		importance: 0.4,
		emotion: 'neutral',
	},
	returned: {
		note: (c) => `The player gave me back ${dollars(c)} of my savings when I needed it.`,
		importance: 0.8,
		emotion: 'happy',
	},
	withheld: {
		note: (c) => `I asked the player for my ${dollars(c)} back and they would not give it to me.`,
		importance: 0.9,
		emotion: 'angry',
	},
	returned_unasked: {
		note: (c) => `The player gave me back all ${dollars(c)} I left with them, without me asking.`,
		importance: 0.6,
		emotion: 'surprised',
	},
};

async function settle(
	db: Database,
	world: WorldRecord,
	settlement: MoneySettlement | null,
	now: Date,
): Promise<MoneyAnswerResult | null> {
	if (!settlement) return null;
	const life = { ...world.character.life, money: settlement.money };
	const saved = await db
		.update(character)
		.set({ ...lifeColumns(life), ...envelopeColumns(settlement.envelope) })
		.where(unchangedEnvelope(world))
		.returning({ id: character.id });
	if (saved.length === 0) return null;

	await recordRelationshipEvent(db, world.id, { type: 'money', outcome: settlement.outcome });
	const memory = MEMORIES[settlement.outcome];
	if (memory) {
		const clock = localClock(now, world.timeZone);
		await remember(db, world.id, {
			kind: 'moment',
			note: `${memory.note(settlement.cents)} (${clock.weekday})`,
			importance: memory.importance,
			tags: ['player', 'money', settlement.outcome],
			emotion: memory.emotion,
			createdAt: now,
		});
	}
	return {
		outcome: settlement.outcome,
		cents: settlement.cents,
		envelope: settlement.envelope.cents,
	};
}
