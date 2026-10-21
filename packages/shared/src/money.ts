import { z } from 'zod';

/** How money feels to the character - behaviour and speech see this, never the amount. */
export const moneyFeelingSchema = z.enum(['broke', 'tight', 'fine', 'comfortable']);
export type MoneyFeeling = z.infer<typeof moneyFeelingSchema>;

/** What the character knows about its money right now, in feelings. */
export const moneySenseSchema = z.object({
	feeling: moneyFeelingSchema,
	/** Payday was today or yesterday. */
	justPaid: z.boolean(),
	/** Rent is due within days and the money won't cover it. */
	rentWorry: z.boolean(),
});
export type MoneySense = z.infer<typeof moneySenseSchema>;

/** The character asks the player to keep some savings, or asks for them back. */
export const moneyAskKindSchema = z.enum(['entrust', 'return']);
export type MoneyAskKind = z.infer<typeof moneyAskKindSchema>;

/** What came of a question about money. */
export const moneyOutcomeSchema = z.enum([
	/** The player took the savings into keeping. */
	'entrusted',
	/** The player wouldn't keep them. */
	'declined',
	/** The player gave the money back when asked. */
	'returned',
	/** The player kept the money when it was asked for. */
	'withheld',
	/** The player gave everything back without being asked. */
	'returned_unasked',
]);
export type MoneyOutcome = z.infer<typeof moneyOutcomeSchema>;
