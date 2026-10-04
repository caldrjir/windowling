import { schema, transferWorldOwnership, type Database } from '@windowling/database';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { anonymous } from 'better-auth/plugins';
import type { ServerEnv } from './env.ts';

/**
 * Built per request: on Cloudflare the database client is request-scoped,
 * and Better Auth holds a reference to it.
 */
export function createAuth(db: Database, env: ServerEnv) {
	return betterAuth({
		appName: 'Windowling',
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
		account: {
			accountLinking: { enabled: true, trustedProviders: ['google'] },
		},
		session: {
			expiresIn: 60 * 60 * 24 * 365, // anonymous players must not lose their world quickly
			updateAge: 60 * 60 * 24,
		},
		advanced: {
			useSecureCookies: env.BETTER_AUTH_URL.startsWith('https://'),
		},
		plugins: [
			anonymous({
				// Anonymous -> Google: the existing world moves to the account.
				// If the account already owns a world, that one wins (see docs/architecture.md).
				onLinkAccount: async ({ anonymousUser, newUser }) => {
					await transferWorldOwnership(db, anonymousUser.user.id, newUser.user.id);
				},
			}),
		],
	});
}

export type Auth = ReturnType<typeof createAuth>;
type SessionResult = NonNullable<Awaited<ReturnType<Auth['api']['getSession']>>>;
export type AuthUser = SessionResult['user'];
export type AuthSession = SessionResult['session'];
