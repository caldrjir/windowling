/**
 * Worker entry: the site gate in front of everything SvelteKit serves, static assets
 * included (`assets.run_worker_first` in wrangler.jsonc). `sveltekit-worker` is an alias
 * for the adapter's built `.svelte-kit/cloudflare/_worker.js`. DRIFTWOOD multiplayer and
 * online puzzle games (WebSockets into Durable Objects) are served here, behind the same gate.
 */
import sveltekit from 'sveltekit-worker';
import { driftwoodApi } from './driftwood/api';
import type { DriftwoodEnv } from './driftwood/room';
import { duelApi } from './duel/api';
import type { DuelEnv } from './duel/room';
import { gate, type GateEnv } from './gate';

export { DriftwoodLobby, DriftwoodRoom } from './driftwood/room';
export { DuelLobby, DuelRoom } from './duel/room';

export default {
	fetch(request, env, ctx) {
		return gate(
			request,
			env,
			async () =>
				(await driftwoodApi(request, env)) ??
				(await duelApi(request, env)) ??
				sveltekit.fetch(request, env, ctx),
		);
	},
} satisfies ExportedHandler<GateEnv & DriftwoodEnv & DuelEnv>;
