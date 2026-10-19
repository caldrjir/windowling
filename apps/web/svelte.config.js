import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter(),
		// One .env for the whole monorepo.
		env: { dir: '../../' },
		csp: {
			mode: 'auto',
			directives: {
				'default-src': ['self'],
				// Rapier ships its physics engine as WebAssembly.
				'script-src': ['self', 'wasm-unsafe-eval'],
				'style-src': ['self', 'unsafe-inline'],
				'img-src': ['self', 'data:', 'blob:', 'https://lh3.googleusercontent.com'],
				// Models for on-device speech recognition come from the Hugging Face Hub (data only).
				// blob: - the character model's textures are decoded from the .glb in memory.
				'connect-src': ['self', 'blob:', 'https://huggingface.co', 'https://*.hf.co'],
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
