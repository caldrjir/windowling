// The adapter-cloudflare build output, aliased in wrangler.jsonc. It exists only after
// `vite build`, so it is typed here instead of being resolved by TypeScript.
declare module 'sveltekit-worker' {
	const worker: {
		fetch(request: Request, env: unknown, ctx: ExecutionContext): Promise<Response>;
	};
	export default worker;
}
