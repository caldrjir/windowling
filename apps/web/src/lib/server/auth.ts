import { schema, type Database } from '@windowling/database';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import type { ServerEnv } from './env.ts';

/**
 * Built per request: on Cloudflare the database client is request-scoped,
 * and Better Auth holds a reference to it.
 */
export function createAuth(db: Database, env: ServerEnv) {
	return betterAuth({
		appName: 'Windowling Game Center',
		baseURL: env.BETTER_AUTH_URL,
		secret: env.BETTER_AUTH_SECRET,
		trustedOrigins: [env.PUBLIC_APP_URL, env.BETTER_AUTH_URL],
		database: drizzleAdapter(db, {
			provider: 'pg',
			schema: {
				user: schema.user,
				session: schema.session,
				account: schema.account,
				verification: schema.verification,
			},
		}),
		socialProviders: env.google
			? { google: { clientId: env.google.clientId, clientSecret: env.google.clientSecret } }
			: {},
		session: {
			expiresIn: 60 * 60 * 24 * 90,
			updateAge: 60 * 60 * 24,
		},
		advanced: {
			useSecureCookies: env.BETTER_AUTH_URL.startsWith('https://'),
		},
	});
}

export type Auth = ReturnType<typeof createAuth>;
type SessionResult = NonNullable<Awaited<ReturnType<Auth['api']['getSession']>>>;
export type AuthUser = SessionResult['user'];
export type AuthSession = SessionResult['session'];
