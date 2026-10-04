import { env as privateEnv } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { parseServerEnv, type ServerEnv } from './env.ts';

let cached: ServerEnv | undefined;

/** Validated server configuration. Throws with a readable message on misconfiguration. */
export function getServerEnv(): ServerEnv {
	cached ??= parseServerEnv({ ...privateEnv, ...publicEnv });
	return cached;
}
