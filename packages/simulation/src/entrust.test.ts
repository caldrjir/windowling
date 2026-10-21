import { describe, expect, it } from 'vitest';
import { HOUR_MS } from './catch-up.ts';
import {
	answerMoneyAsk,
	askAboutMoney,
	EMPTY_ENVELOPE,
	giveBackAll,
	MAX_ENTRUSTED,
	moneyMoment,
	type Envelope,
} from './entrust.ts';
import { DOLLAR, type Money } from './money.ts';
import { applyRelationshipEvent } from './relationship.ts';

const ZONE = 'UTC';
// Mid-month: rent is far away.
const NOW = new Date('2026-10-14T18:00:00Z');
const FRIEND = { affinity: 0.5, trust: 0.7, familiarity: 0.5 };
const STRANGER = { affinity: 0, trust: 0.3, familiarity: 0 };
const savings = (dollars: number): Money => ({
	balance: dollars * DOLLAR,
	unpaid: 0,
	paidAt: null,
});

describe('entrusted money', () => {
	it('only asks someone it trusts and knows, and only with savings to spare', () => {
		const ask = moneyMoment(savings(2_000), EMPTY_ENVELOPE, FRIEND, NOW, ZONE);
		expect(ask?.kind).toBe('entrust');
		expect(ask?.cents).toBe(300 * DOLLAR); // 30% of what is above its cushion, in fifties
		expect(moneyMoment(savings(2_000), EMPTY_ENVELOPE, STRANGER, NOW, ZONE)).toBeNull();
		expect(
			moneyMoment(savings(2_000), EMPTY_ENVELOPE, { ...FRIEND, trust: 0.4 }, NOW, ZONE),
		).toBeNull();
		expect(moneyMoment(savings(700), EMPTY_ENVELOPE, FRIEND, NOW, ZONE)).toBeNull();
	});

	it('never leaves more than a limit with the player', () => {
		const full: Envelope = { ...EMPTY_ENVELOPE, cents: MAX_ENTRUSTED - 20 * DOLLAR };
		expect(moneyMoment(savings(9_000), full, FRIEND, NOW, ZONE)).toBeNull();
		const some: Envelope = { ...EMPTY_ENVELOPE, cents: 800 * DOLLAR };
		expect(moneyMoment(savings(9_000), some, FRIEND, NOW, ZONE)?.cents).toBe(200 * DOLLAR);
	});

	it('moves the money only when the player says yes - and only once', () => {
		const money = savings(2_000);
		const ask = moneyMoment(money, EMPTY_ENVELOPE, FRIEND, NOW, ZONE);
		if (!ask) throw new Error('expected an ask');
		const asked = askAboutMoney(EMPTY_ENVELOPE, ask);
		const later = new Date(NOW.getTime() + 60_000);
		const yes = answerMoneyAsk(money, asked, true, later);
		expect(yes?.outcome).toBe('entrusted');
		expect(yes?.money.balance).toBe(money.balance - ask.cents);
		expect(yes?.envelope.cents).toBe(ask.cents);
		// Nothing is created or lost.
		expect((yes?.money.balance ?? 0) + (yes?.envelope.cents ?? 0)).toBe(money.balance);
		// The question is answered: the same answer can't move money twice.
		if (!yes) throw new Error('expected a settlement');
		expect(answerMoneyAsk(yes.money, yes.envelope, true, later)).toBeNull();
		// No means no.
		expect(answerMoneyAsk(money, asked, false, later)?.money).toEqual(money);
	});

	it('forgets an unanswered question after a while, and does not nag', () => {
		const ask = moneyMoment(savings(2_000), EMPTY_ENVELOPE, FRIEND, NOW, ZONE);
		if (!ask) throw new Error('expected an ask');
		const asked = askAboutMoney(EMPTY_ENVELOPE, ask);
		const muchLater = new Date(NOW.getTime() + HOUR_MS);
		expect(answerMoneyAsk(savings(2_000), asked, true, muchLater)).toBeNull();
		expect(moneyMoment(savings(2_000), asked, FRIEND, muchLater, ZONE)).toBeNull();
		const days = new Date(NOW.getTime() + 80 * HOUR_MS);
		expect(moneyMoment(savings(2_000), asked, FRIEND, days, ZONE)?.kind).toBe('entrust');
	});

	it('asks for it back when money is short - even from someone it no longer likes', () => {
		const envelope: Envelope = { ...EMPTY_ENVELOPE, cents: 400 * DOLLAR };
		const broke = savings(50);
		const ask = moneyMoment(broke, envelope, { ...FRIEND, affinity: -0.5, trust: 0.1 }, NOW, ZONE);
		expect(ask?.kind).toBe('return');
		expect(ask?.cents).toBe(400 * DOLLAR); // never more than the player holds
		expect(moneyMoment(savings(2_000), envelope, FRIEND, NOW, ZONE)?.kind).not.toBe('return');
	});

	it('remembers whether it got its money back', () => {
		const envelope: Envelope = { ...EMPTY_ENVELOPE, cents: 400 * DOLLAR };
		const broke = savings(50);
		const ask = moneyMoment(broke, envelope, FRIEND, NOW, ZONE);
		if (!ask) throw new Error('expected an ask');
		const asked = askAboutMoney(envelope, ask);
		const back = answerMoneyAsk(broke, asked, true, NOW);
		expect(back?.outcome).toBe('returned');
		expect(back?.money.balance).toBe(broke.balance + 400 * DOLLAR);
		expect(back?.envelope.cents).toBe(0);
		const kept = answerMoneyAsk(broke, asked, false, NOW);
		expect(kept?.outcome).toBe('withheld');
		expect(kept?.envelope.cents).toBe(400 * DOLLAR);

		const returned = applyRelationshipEvent(FRIEND, { type: 'money', outcome: 'returned' });
		const withheld = applyRelationshipEvent(FRIEND, { type: 'money', outcome: 'withheld' });
		expect(returned.trust).toBeGreaterThan(FRIEND.trust);
		expect(withheld.trust).toBeLessThan(FRIEND.trust - 0.1);
		expect(withheld.affinity).toBeLessThan(FRIEND.affinity);
	});

	it('lets the player give everything back unasked, and never pays out an empty envelope', () => {
		const envelope: Envelope = { ...EMPTY_ENVELOPE, cents: 250 * DOLLAR };
		const back = giveBackAll(savings(100), envelope);
		expect(back?.money.balance).toBe(350 * DOLLAR);
		expect(back?.envelope.cents).toBe(0);
		expect(giveBackAll(savings(100), EMPTY_ENVELOPE)).toBeNull();
	});
});
