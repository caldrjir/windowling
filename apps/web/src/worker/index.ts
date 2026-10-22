/**
 * Worker entry: the site gate in front of everything SvelteKit serves, static assets
 * included (`assets.run_worker_first` in wrangler.jsonc). `sveltekit-worker` is an alias
 * for the adapter's built `.svelte-kit/cloudflare/_worker.js`.
 */
import sveltekit from 'sveltekit-worker';
import { gate, type GateEnv } from './gate';

export default {
	fetch(request, env, ctx) {
		return gate(request, env, () => sveltekit.fetch(request, env, ctx));
	},
} satisfies ExportedHandler<GateEnv>;
