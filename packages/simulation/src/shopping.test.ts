import { ITEMS, type Belonging } from '@windowling/shared';
import { describe, expect, it } from 'vitest';
import { DAY_MS, HOUR_MS } from './catch-up.ts';
import { advanceLife, startLife, type LifeContext, type LifeState } from './life.ts';
import { DOLLAR, type Money } from './money.ts';
import { applyNeeds } from './needs.ts';
import { scoreActivities } from './scheduler.ts';
import {
	buyGift,
	comforts,
	deliveryTime,
	itemsInRoom,
	likesGift,
	maybeOrder,
	parcelsWaiting,
	roomBelongings,
	tasteFor,
	unpackParcel,
} from './shopping.ts';
import { localTime } from './time.ts';

const CTX: LifeContext = { seed: 'shopper', timeZone: 'Europe/Prague' };
const MONDAY = new Date('2026-10-05T06:00:00Z');
const rich: Money = { balance: 3_000 * DOLLAR, unpaid: 0, paidAt: null };
const always = () => 0;

function liveFor(days: number, money: Money, ctx = CTX) {
	let life: LifeState = startLife(MONDAY, ctx, undefined, money);
	for (let t = MONDAY.getTime(); t < MONDAY.getTime() + days * DAY_MS; t += HOUR_MS) {
		life = advanceLife(life, new Date(t), new Date(t + HOUR_MS), ctx);
	}
	return { life };
}

describe('shopping', () => {
	it('orders things with money to spare - one parcel at a time, never twice the same', () => {
		const { life } = liveFor(28, rich);
		const items = life.belongings.map((b) => b.item);
		expect(items.length).toBeGreaterThanOrEqual(2);
		expect(new Set(items).size).toBe(items.length);
		// Every parcel that came was unpacked (the last may still be on its way), while awake.
		const unpacked = life.belongings.filter((b) => b.unpackedAt !== null);
		expect(unpacked.length).toBeGreaterThanOrEqual(items.length - 1);
		for (const b of unpacked) {
			const { hour } = localTime(b.unpackedAt ?? MONDAY, CTX.timeZone);
			expect(hour).toBeGreaterThanOrEqual(7);
			expect(hour).toBeLessThan(23.5);
			expect(b.unpackedAt?.getTime()).toBeGreaterThan(b.arrivesAt.getTime());
		}
		expect(itemsInRoom(life.belongings)).toHaveLength(unpacked.length);
	});

	it('never buys when money is short', () => {
		const { life } = liveFor(21, { balance: 300 * DOLLAR, unpaid: 0, paidAt: null });
		// Paydays may lift it to "fine", but never enough to keep a cushion after buying.
		for (const b of life.belongings) expect(b.gift).toBe(false);
		expect(
			maybeOrder({ balance: 400 * DOLLAR, unpaid: 0, paidAt: null }, [], MONDAY, 'UTC', always),
		).toBeNull();
	});

	it('pays for what it orders, and waits for one parcel before the next', () => {
		const order = maybeOrder(rich, [], MONDAY, 'UTC', always);
		const item = order?.belongings[0]?.item;
		if (!order || !item) throw new Error('expected an order');
		expect(order.money.balance).toBe(rich.balance - ITEMS[item].price);
		expect(maybeOrder(order.money, order.belongings, MONDAY, 'UTC', always)).toBeNull();
	});

	it('is delivered in the daytime, hours later', () => {
		for (let i = 0; i < 20; i++) {
			const at = new Date(MONDAY.getTime() + i * 3.7 * HOUR_MS);
			let n = i / 20;
			const t = deliveryTime(at, 'Europe/Prague', () => (n = (n + 0.37) % 1));
			const { hour } = localTime(t, 'Europe/Prague');
			expect(hour).toBeGreaterThanOrEqual(9);
			expect(hour).toBeLessThan(19);
			expect(t.getTime() - at.getTime()).toBeGreaterThanOrEqual(4 * HOUR_MS);
		}
	});

	it('unpacks the oldest parcel that is there - not one still on its way', () => {
		const parcel = (item: Belonging['item'], hours: number): Belonging => ({
			item,
			orderedAt: MONDAY,
			arrivesAt: new Date(MONDAY.getTime() + hours * HOUR_MS),
			unpackedAt: null,
			gift: false,
			storedAway: false,
		});
		const belongings = [parcel('plant', 5), parcel('blanket', 2), parcel('headphones', 30)];
		const at = new Date(MONDAY.getTime() + 6 * HOUR_MS);
		expect(parcelsWaiting(belongings, at).map((b) => b.item)).toEqual(['blanket', 'plant']);
		const after = unpackParcel(belongings, at, new Date(at.getTime() + 600_000), 'w');
		expect(itemsInRoom(after)).toEqual(['blanket']);
	});

	it('wants to unpack a parcel when one is waiting (but not at work)', () => {
		const needs = { hunger: 0.3, energy: 0.8, mood: 0.6 };
		const evening = { hour: 18, weekday: 2 };
		const working = { hour: 10, weekday: 2 };
		expect(
			scoreActivities({ needs, local: evening, previous: 'idle', parcelWaiting: true }).unpack,
		).toBeGreaterThan(2);
		expect(scoreActivities({ needs, local: evening, previous: 'idle' }).unpack).toBe(0);
		expect(
			scoreActivities({ needs, local: working, previous: 'idle', parcelWaiting: true }).unpack,
		).toBe(0);
	});

	it('makes life a little better: music, TV, breakfast, a nicer home', () => {
		const needs = { hunger: 0.3, energy: 0.6, mood: 0.5 };
		const withThings = (activity: 'music' | 'tv' | 'eat', items: Parameters<typeof comforts>[0]) =>
			applyNeeds(needs, activity, 1, comforts(items, activity));
		expect(withThings('music', ['headphones']).mood).toBeGreaterThan(withThings('music', []).mood);
		expect(withThings('tv', ['blanket']).mood).toBeGreaterThan(withThings('tv', []).mood);
		expect(withThings('eat', ['coffee_machine']).energy).toBeGreaterThan(
			withThings('eat', []).energy,
		);
		expect(comforts(['plant', 'art_print'], 'idle').mood).toBeGreaterThan(0);
		expect(comforts(['plant'], 'out').mood).toBe(0);
	});

	it('is deterministic however the time is split into visits', () => {
		const once = advanceLife(
			startLife(MONDAY, CTX, undefined, rich),
			MONDAY,
			new Date(MONDAY.getTime() + 20 * DAY_MS),
			CTX,
		);
		expect(liveFor(20, rich).life.belongings).toEqual(once.belongings);
	});
});

describe('gifts', () => {
	const at = new Date('2026-10-14T10:00:00Z');

	it('come out of the envelope, never out of nothing - and never twice the same', () => {
		const bought = buyGift(10_000, [], 'blanket', at, 'UTC', always);
		if (typeof bought === 'string') throw new Error(bought);
		expect(bought.envelopeCents).toBe(10_000 - ITEMS.blanket.price);
		expect(bought.belongings[0]).toMatchObject({ item: 'blanket', gift: true, unpackedAt: null });
		expect(buyGift(10_000, bought.belongings, 'blanket', at, 'UTC', always)).toBe('owned');
		expect(buyGift(ITEMS.coffee_machine.price - 1, [], 'coffee_machine', at, 'UTC', always)).toBe(
			'not_enough',
		);
	});

	it('it decides whether it likes a present: liked ones are used, the rest put away', () => {
		const seeds = Array.from({ length: 40 }, (_, i) => `world-${String(i)}`);
		const liked = seeds.filter((seed) => likesGift(seed, 'string_lights')).length;
		// Mostly welcome, but not by everyone.
		expect(liked).toBeGreaterThan(20);
		expect(liked).toBeLessThan(40);
		const disliker = seeds.find((seed) => !likesGift(seed, 'string_lights')) ?? 'x';
		const gift: Belonging = {
			item: 'string_lights',
			orderedAt: at,
			arrivesAt: at,
			unpackedAt: null,
			gift: true,
			storedAway: false,
		};
		const later = new Date(at.getTime() + HOUR_MS);
		const unpacked = unpackParcel([gift], later, later, disliker);
		expect(unpacked[0]?.storedAway).toBe(true);
		expect(itemsInRoom(unpacked)).toEqual([]);
		expect(roomBelongings(unpacked, later).stored).toEqual(['string_lights']);
		// Its own purchases always come out of the box.
		expect(itemsInRoom(unpackParcel([{ ...gift, gift: false }], later, later, disliker))).toEqual([
			'string_lights',
		]);
	});

	it('likes or dislikes the same way every time (its taste is its own)', () => {
		expect(likesGift('w1', 'plant')).toBe(likesGift('w1', 'plant'));
		expect(tasteFor('w1', 'plant')).toBe(tasteFor('w1', 'plant'));
	});
});
