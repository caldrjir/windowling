import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defaultClientConditions } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	resolve: {
		// Speech recognition (transformers.js) imports the WebGPU build of onnxruntime-web,
		// which bundles a 27 MB WASM - over Cloudflare's 25 MiB asset limit. We run it on the
		// CPU: use the plain WASM build, with the runtime files we serve ourselves.
		alias: [{ find: /^onnxruntime-web\/webgpu$/, replacement: 'onnxruntime-web/wasm' }],
		conditions: ['onnxruntime-web-use-extern-wasm', ...defaultClientConditions],
	},
	test: {
		name: 'web',
		include: ['src/**/*.test.ts'],
	},
});
