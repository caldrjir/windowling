import { z } from 'zod';

const emptyToUndefined = (value: unknown) => (value === '' ? undefined : value);
const optionalString = z.preprocess(emptyToUndefined, z.string().min(1).optional());

const httpUrl = z.preprocess(
	emptyToUndefined,
	z.url({ protocol: /^https?$/ }).transform((url) => url.replace(/\/+$/, '')),
);

function isLocalUrl(url: string): boolean {
	const { hostname } = new URL(url);
	return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

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
		// The cloud brain: any OpenAI-compatible chat API (Workers AI in production,
		// Ollama locally). Unset = canned reactions only.
		AI_API_URL: z.preprocess(emptyToUndefined, httpUrl.optional()),
		AI_API_KEY: optionalString,
		AI_MODEL: z.preprocess(
			emptyToUndefined,
			z.string().min(1).default('@cf/meta/llama-3.1-8b-instruct-fp8'),
		),
		AI_DAILY_LIMIT: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).default(60)),
	})
	.refine((env) => Boolean(env.GOOGLE_CLIENT_ID) === Boolean(env.GOOGLE_CLIENT_SECRET), {
		message: 'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set together',
		path: ['GOOGLE_CLIENT_SECRET'],
	})
	.transform(
		({
			GOOGLE_CLIENT_ID,
			GOOGLE_CLIENT_SECRET,
			AI_API_URL,
			AI_API_KEY,
			AI_MODEL,
			AI_DAILY_LIMIT,
			...env
		}) => ({
			...env,
			google:
				GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET
					? { clientId: GOOGLE_CLIENT_ID, clientSecret: GOOGLE_CLIENT_SECRET }
					: null,
			// Hosted APIs need a key; a local Ollama doesn't. Without either: no cloud brain.
			ai:
				AI_API_URL && (AI_API_KEY || isLocalUrl(AI_API_URL))
					? { baseUrl: AI_API_URL, apiKey: AI_API_KEY, model: AI_MODEL, dailyLimit: AI_DAILY_LIMIT }
					: null,
		}),
	);

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
