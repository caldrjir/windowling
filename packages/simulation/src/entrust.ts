import type { MoneyAskKind, MoneyOutcome, Relationship } from '@windowling/shared';
import { HOUR_MS } from './catch-up.ts';
import { DOLLAR, moneyFeeling, moneySense, RENT, type Money } from './money.ts';

/**
 * Entrusted money (Iteration 9, pillar "earned trust"): the character owns its
 * money and may ask the player to keep some of its savings - and later ask for
 * them back. The player decides; the simulation keeps the books, so money can
 * never be created, lost or taken twice.
 */
export interface Envelope {
	/** What the player is keeping for the character. Never negative. */
	cents: number;
	/** A question the character asked and the player hasn't answered yet. */
	ask: MoneyAsk | null;
	/** When it last brought money up (it doesn't nag). */
	lastAskAt: Date | null;
}

export interface MoneyAsk {
	kind: MoneyAskKind;
	cents: number;
	at: Date;
}

export const EMPTY_ENVELOPE: Envelope = { cents: 0, ask: null, lastAskAt: null };

/** It never keeps more than this with someone else. */
export const MAX_ENTRUSTED = 1_000 * DOLLAR;
/** An unanswered question is forgotten after this. */
const ASK_EXPIRES_MS = 10 * 60_000;
const ENTRUST_COOLDOWN_MS = 72 * HOUR_MS;
const RETURN_COOLDOWN_MS = 12 * HOUR_MS;
/** It keeps a cushion of its own. */
const CUSHION = 900 * DOLLAR;

const roundDown50 = (cents: number) => Math.floor(cents / (50 * DOLLAR)) * 50 * DOLLAR;
const roundUp50 = (cents: number) => Math.ceil(cents / (50 * DOLLAR)) * 50 * DOLLAR;

export function pendingAsk(envelope: Envelope, now: Date): MoneyAsk | null {
	const { ask } = envelope;
	return ask && now.getTime() - ask.at.getTime() < ASK_EXPIRES_MS ? ask : null;
}

/**
 * Does it bring money up now that it is at the window with the player? Asking
 * for its money back comes first (it needs it); offering to leave some with
 * the player takes trust, familiarity, liking and savings to spare.
 */
export function moneyMoment(
	money: Money,
	envelope: Envelope,
	rel: Relationship,
	now: Date,
	timeZone: string,
): MoneyAsk | null {
	if (pendingAsk(envelope, now)) return null;
	const since = envelope.lastAskAt ? now.getTime() - envelope.lastAskAt.getTime() : Infinity;
	const sense = moneySense(money, now, timeZone);

	if (envelope.cents > 0 && since >= RETURN_COOLDOWN_MS) {
		const short = sense.feeling === 'broke' || sense.feeling === 'tight' || sense.rentWorry;
		if (short) {
			const needed = Math.max(300 * DOLLAR, RENT - (money.balance + money.unpaid));
			return { kind: 'return', cents: Math.min(envelope.cents, roundUp50(needed)), at: now };
		}
	}

	const feeling = moneyFeeling(money);
	if (
		since >= ENTRUST_COOLDOWN_MS &&
		rel.trust >= 0.5 &&
		rel.familiarity >= 0.25 &&
		rel.affinity >= 0.2 &&
		(feeling === 'fine' || feeling === 'comfortable') &&
		!sense.rentWorry
	) {
		const spare = roundDown50(
			Math.min(0.3 * (money.balance - CUSHION), MAX_ENTRUSTED - envelope.cents),
		);
		if (spare >= 50 * DOLLAR) return { kind: 'entrust', cents: spare, at: now };
	}
	return null;
}

export interface MoneySettlement {
	money: Money;
	envelope: Envelope;
	outcome: MoneyOutcome;
	cents: number;
}

/** It asks: remembers the question (and that it asked). */
export function askAboutMoney(envelope: Envelope, ask: MoneyAsk): Envelope {
	return { ...envelope, ask, lastAskAt: ask.at };
}

/**
 * The player's answer to the open question. Null when there is no question
 * (any more) - an answer can never move money on its own.
 */
export function answerMoneyAsk(
	money: Money,
	envelope: Envelope,
	yes: boolean,
	now: Date,
): MoneySettlement | null {
	const ask = pendingAsk(envelope, now);
	if (!ask) return null;
	const cleared = { ...envelope, ask: null };
	if (ask.kind === 'entrust') {
		// The savings may have been spent since it asked.
		const cents = Math.min(ask.cents, Math.max(0, money.balance));
		if (!yes || cents <= 0) return { money, envelope: cleared, outcome: 'declined', cents: 0 };
		return {
			money: { ...money, balance: money.balance - cents },
			envelope: { ...cleared, cents: envelope.cents + cents },
			outcome: 'entrusted',
			cents,
		};
	}
	const cents = Math.min(ask.cents, envelope.cents);
	if (!yes || cents <= 0) return { money, envelope: cleared, outcome: 'withheld', cents };
	return {
		money: { ...money, balance: money.balance + cents },
		envelope: { ...cleared, cents: envelope.cents - cents },
		outcome: 'returned',
		cents,
	};
}

/** The player hands everything back, unasked. Null when there is nothing to give. */
export function giveBackAll(money: Money, envelope: Envelope): MoneySettlement | null {
	if (envelope.cents <= 0) return null;
	return {
		money: { ...money, balance: money.balance + envelope.cents },
		envelope: { ...envelope, cents: 0, ask: null },
		outcome: 'returned_unasked',
		cents: envelope.cents,
	};
}
