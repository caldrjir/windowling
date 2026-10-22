import { z } from 'zod';

const emptyToUndefined = (value: unknown) => (value === '' ? undefined : value);
const optionalString = z.preprocess(emptyToUndefined, z.string().min(1).optional());

const httpUrl = z.preprocess(
	emptyToUndefined,
	z.url({ protocol: /^https?$/ }).transform((url) => url.replace(/\/+$/, '')),
);

export const serverEnvSchema = z
	.object({
		DATABASE_URL: z.preprocess(
			emptyToUndefined,
			z
				.string()
				.regex(/^postgres(ql)?:\/\//, 'must be a postgres:// connection string')
				.optional(),
		),
		BETTER_AUTH_SECRET: z.preprocess(
			emptyToUndefined,
			z.string().min(32, 'must be at least 32 characters (openssl rand -base64 32)'),
		),
		BETTER_AUTH_URL: httpUrl,
		PUBLIC_APP_URL: httpUrl,
		GOOGLE_CLIENT_ID: optionalString,
		GOOGLE_CLIENT_SECRET: optionalString,
	})
	.refine((env) => Boolean(env.GOOGLE_CLIENT_ID) === Boolean(env.GOOGLE_CLIENT_SECRET), {
		message: 'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set together',
		path: ['GOOGLE_CLIENT_SECRET'],
	})
	.transform(({ GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, ...env }) => ({
		...env,
		google:
			GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET
				? { clientId: GOOGLE_CLIENT_ID, clientSecret: GOOGLE_CLIENT_SECRET }
				: null,
	}));

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export class EnvValidationError extends Error {
	constructor(issues: string[]) {
		super(`Invalid environment configuration:\n${issues.map((i) => `  - ${i}`).join('\n')}`);
		this.name = 'EnvValidationError';
	}
}

/** Pure parser - the error lists every problem at once and never echoes secret values. */
export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
	const result = serverEnvSchema.safeParse(source);
	if (!result.success) {
		throw new EnvValidationError(
			result.error.issues.map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`),
		);
	}
	return result.data;
}
