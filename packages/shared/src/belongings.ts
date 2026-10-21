import { z } from 'zod';

/**
 * Things the character can own (Iteration 10): bought, delivered, unpacked,
 * and then part of the room for good. Ids are stable contracts (saved state,
 * the renderer's models, AI prompts).
 */
export const ITEM_IDS = [
	'plant',
	'art_print',
	'string_lights',
	'headphones',
	'blanket',
	'coffee_machine',
] as const;
export const itemIdSchema = z.enum(ITEM_IDS);
export type ItemId = z.infer<typeof itemIdSchema>;

export interface ItemInfo {
	/** What it is called in speech ("a floor plant"). */
	name: string;
	/** Price in cents. */
	price: number;
}

export const ITEMS: Record<ItemId, ItemInfo> = {
	plant: { name: 'a floor plant', price: 35_00 },
	art_print: { name: 'an art print', price: 25_00 },
	string_lights: { name: 'some string lights', price: 20_00 },
	headphones: { name: 'a pair of good headphones', price: 80_00 },
	blanket: { name: 'a soft blanket for the sofa', price: 45_00 },
	coffee_machine: { name: 'a coffee machine', price: 90_00 },
};

/** Something it owns or is waiting for. */
export const belongingSchema = z.object({
	item: itemIdSchema,
	orderedAt: z.coerce.date(),
	/** When the parcel is (or was) left at the door. */
	arrivesAt: z.coerce.date(),
	/** Unpacked and in its place; null while still a parcel (or on its way). */
	unpackedAt: z.coerce.date().nullable(),
	/** A present from the player (#74) rather than its own purchase. */
	gift: z.boolean().default(false),
	/** A present it didn't care for: put away, not in the room. */
	storedAway: z.boolean().default(false),
});
export type Belonging = z.infer<typeof belongingSchema>;

/** What the room shows: the things in their places, and parcels by the door. */
export const roomBelongingsSchema = z.object({
	items: z.array(itemIdSchema),
	/** Parcels by the door, in the order they came. */
	parcels: z.array(itemIdSchema),
	/** Ordered, not delivered yet. */
	ordered: z.array(itemIdSchema),
});
export type RoomBelongings = z.infer<typeof roomBelongingsSchema>;
