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
