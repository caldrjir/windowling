import type { Database } from '@windowling/database';
import type { Auth, AuthSession, AuthUser } from '$lib/server/auth';

declare global {
	namespace App {
		interface Locals {
			db: Database;
			auth: Auth;
			user: AuthUser | null;
			session: AuthSession | null;
		}
		interface Platform {
			env: {
				HYPERDRIVE?: Hyperdrive;
			} & Record<string, unknown>;
			ctx: ExecutionContext;
			caches: CacheStorage;
			cf?: IncomingRequestCfProperties;
		}
	}
}

export {};
