import {
	ITEMS,
	ITEM_IDS,
	type Activity,
	type Belonging,
	type ItemId,
	type RoomBelongings,
} from '@windowling/shared';
import { createRng } from './ambient.ts';
import { HOUR_MS, MINUTE_MS } from './catch-up.ts';
import { hashString } from './character.ts';
import { personalityFor } from './personality.ts';
import { DOLLAR, justPaid, moneyFeeling, spend, type Money } from './money.ts';
import { localTime } from './time.ts';

/**
 * Shopping (Iteration 10): now and then, on its phone with money to spare,
 * the character orders something for the flat. The parcel comes during the
 * day, waits by the door, gets unpacked - and the thing stays.
 */

/** It keeps this much after buying anything. */
const SHOPPING_CUSHION = 600 * DOLLAR;
/** How likely a phone session with money to spare ends in an order. */
const ORDER_CHANCE = 0.35;
/** Couriers come in the daytime. */
const DELIVERY_HOURS: [from: number, to: number] = [9, 19];

/** Things it owns and has unpacked (and kept out). */
export function itemsInRoom(belongings: readonly Belonging[]): ItemId[] {
	return belongings.filter((b) => b.unpackedAt !== null && !b.storedAway).map((b) => b.item);
}

/** Parcels left at the door by `at`, oldest first. */
export function parcelsWaiting(belongings: readonly Belonging[], at: Date): Belonging[] {
	return belongings
		.filter((b) => b.unpackedAt === null && b.arrivesAt.getTime() <= at.getTime())
		.sort((a, b) => a.arrivesAt.getTime() - b.arrivesAt.getTime());
}

/** What the room shows and the character knows at `at`. */
export function roomBelongings(belongings: readonly Belonging[], at: Date): RoomBelongings {
	return {
		items: itemsInRoom(belongings),
		stored: belongings.filter((b) => b.unpackedAt !== null && b.storedAway).map((b) => b.item),
		parcels: parcelsWaiting(belongings, at).map((b) => b.item),
		ordered: belongings
			.filter((b) => b.unpackedAt === null && b.arrivesAt.getTime() > at.getTime())
			.map((b) => b.item),
	};
}

/** When a parcel ordered at `at` is left at the door: hours later, in courier hours. */
export function deliveryTime(at: Date, timeZone: string, rng: () => number): Date {
	let t = at.getTime() + (4 + rng() * 18) * HOUR_MS;
	for (let i = 0; i < 30; i++) {
		const { hour } = localTime(new Date(t), timeZone);
		if (hour >= DELIVERY_HOURS[0] && hour < DELIVERY_HOURS[1]) break;
		t += HOUR_MS;
	}
	return new Date(Math.round(t / MINUTE_MS) * MINUTE_MS);
}

/**
 * On the phone: does it order something? Only with money to spare (comfortable,
 * or fine and just paid), one parcel at a time, never something it already has.
 */
export function maybeOrder(
	money: Money,
	belongings: readonly Belonging[],
	at: Date,
	timeZone: string,
	rng: () => number,
): { money: Money; belongings: Belonging[] } | null {
	const feeling = moneyFeeling(money);
	const spare = feeling === 'comfortable' || (feeling === 'fine' && justPaid(money, at));
	if (!spare || belongings.some((b) => b.unpackedAt === null)) return null;
	if (rng() >= ORDER_CHANCE) return null;
	const owned = new Set(belongings.map((b) => b.item));
	const affordable = ITEM_IDS.filter(
		(id) => !owned.has(id) && money.balance - ITEMS[id].price >= SHOPPING_CUSHION,
	);
	const item = affordable[Math.floor(rng() * affordable.length)];
	if (!item) return null;
	const order: Belonging = {
		item,
		orderedAt: at,
		arrivesAt: deliveryTime(at, timeZone, rng),
		unpackedAt: null,
		gift: false,
		storedAway: false,
	};
	return { money: spend(money, ITEMS[item].price), belongings: [...belongings, order] };
}

/**
 * It finished unpacking: the oldest parcel that was waiting is now in its
 * place - or, a present it doesn't like, in the cupboard.
 */
export function unpackParcel(
	belongings: readonly Belonging[],
	started: Date,
	ended: Date,
	seed: string,
): Belonging[] {
	const parcel = parcelsWaiting(belongings, started)[0];
	if (!parcel) return [...belongings];
	const storedAway = parcel.gift && !likesGift(seed, parcel.item);
	return belongings.map((b) => (b === parcel ? { ...b, unpackedAt: ended, storedAway } : b));
}

/** What owning things does to an hour of an activity (needs per hour). */
export function comforts(
	items: readonly ItemId[],
	activity: Activity,
): { mood: number; energy: number } {
	const has = (id: ItemId) => items.includes(id);
	// A nicer home is a slightly nicer place to be, whatever it is doing there.
	const decor = (['plant', 'art_print', 'string_lights'] as const).filter(has).length;
	let mood = activity === 'out' || activity === 'shower' ? 0 : decor * 0.008;
	let energy = 0;
	if (activity === 'music' && has('headphones')) mood += 0.05;
	if ((activity === 'tv' || activity === 'read') && has('blanket')) mood += 0.03;
	if (activity === 'eat' && has('coffee_machine')) energy += 0.12;
	return { mood, energy };
}

// --- gifts (#74) ---------------------------------------------------------------

/** How much it would like each thing (0..1): its own taste, nudged by who it is. */
export function tasteFor(seed: string, item: ItemId): number {
	const rng = createRng(hashString(`taste:${seed}:${item}`));
	const p = personalityFor(seed);
	const nudge: Record<ItemId, number> = {
		plant: 0.1,
		art_print: (1 - p.competitive) * 0.2,
		string_lights: p.exuberant * 0.3,
		headphones: (1 - p.chatty) * 0.25,
		blanket: p.shy * 0.25,
		coffee_machine: p.competitive * 0.2,
	};
	return Math.min(1, rng() * 0.8 + nudge[item]);
}

/** A present it doesn't care for goes in the cupboard (and it says so). */
export const LIKES_ABOVE = 0.3;

export function likesGift(seed: string, item: ItemId): boolean {
	return tasteFor(seed, item) > LIKES_ABOVE;
}

export type GiftRefusal = 'unknown_item' | 'owned' | 'not_enough';

/**
 * The player buys `item` for it from the envelope (the savings it entrusted).
 * Never something it has (or waits for), never more than the envelope holds.
 */
export function buyGift(
	envelopeCents: number,
	belongings: readonly Belonging[],
	item: ItemId,
	at: Date,
	timeZone: string,
	rng: () => number,
): { envelopeCents: number; belongings: Belonging[] } | GiftRefusal {
	const info = ITEMS[item];
	if (!(ITEM_IDS as readonly string[]).includes(item)) return 'unknown_item';
	if (belongings.some((b) => b.item === item)) return 'owned';
	if (envelopeCents < info.price) return 'not_enough';
	const gift: Belonging = {
		item,
		orderedAt: at,
		arrivesAt: deliveryTime(at, timeZone, rng),
		unpackedAt: null,
		gift: true,
		storedAway: false,
	};
	return { envelopeCents: envelopeCents - info.price, belongings: [...belongings, gift] };
}
