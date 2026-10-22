#!/usr/bin/env node
// pnpm preview: builds the app and runs the production Worker (site gate included) in
// workerd at http://localhost:8787, configured from the root .env (see pnpm setup:local).
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const PORT = 8787;
const ORIGIN = `http://localhost:${PORT}`;
const webDir = fileURLToPath(new URL('..', import.meta.url));

try {
	process.loadEnvFile(fileURLToPath(new URL('../../../.env', import.meta.url)));
} catch {
	console.error('No .env in the repository root - run: pnpm setup:local');
	process.exit(1);
}

const vars = {
	DATABASE_URL: process.env.DATABASE_URL,
	BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
	SITE_PASSWORD_HASH: process.env.SITE_PASSWORD_HASH,
	GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
	GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
	// The Worker runs on its own port, not on the dev server's.
	PUBLIC_APP_URL: ORIGIN,
	BETTER_AUTH_URL: ORIGIN,
};

const node = process.execPath;
// Run the CLIs with this Node directly (no shell, same on Windows).
const vite = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url));
const wrangler = fileURLToPath(
	new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url),
);

const build = spawnSync(node, [vite, 'build'], { cwd: webDir, stdio: 'inherit' });
if (build.status !== 0) process.exit(build.status ?? 1);

const args = [wrangler, 'dev', '--port', String(PORT), '--local-upstream', `localhost:${PORT}`];
for (const [key, value] of Object.entries(vars)) {
	// Passed as argv (no shell), so `$` in the password hash stays intact.
	if (value) args.push('--var', `${key}:${value}`);
}
console.log(`\nWindowling preview: ${ORIGIN}  (local site password: see pnpm setup:local)\n`);
const result = spawnSync(node, args, {
	cwd: webDir,
	stdio: 'inherit',
	// The Worker reaches Postgres through Hyperdrive; locally that is DATABASE_URL.
	env: {
		...process.env,
		CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE: process.env.DATABASE_URL,
	},
});
process.exit(result.status ?? 0);
