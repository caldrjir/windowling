import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		// The adapter only needs output paths; the deployed Worker is wrangler.jsonc.
		adapter: adapter({ config: 'wrangler.sveltekit.jsonc' }),
		// One .env for the whole monorepo.
		env: { dir: '../../' },
		csp: {
			mode: 'auto',
			directives: {
				'default-src': ['self'],
				'script-src': ['self'],
				// Google Fonts (stylesheet + font files); nothing else from third parties.
				'style-src': ['self', 'unsafe-inline', 'https://fonts.googleapis.com'],
				'font-src': ['self', 'https://fonts.gstatic.com'],
				'img-src': ['self', 'data:', 'blob:', 'https://lh3.googleusercontent.com'],
				'connect-src': ['self'],
				'worker-src': ['self'],
				'manifest-src': ['self'],
				'object-src': ['none'],
				'base-uri': ['self'],
				'form-action': ['self', 'https://accounts.google.com'],
				'frame-ancestors': ['none'],
			},
		},
	},
};

export default config;
