import { pbkdf2Sync } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';
import { E2E_SITE_PASSWORD, GATE_STATE } from './e2e/gate';

// E2E runs the production build inside the real Workers runtime (wrangler dev / workerd)
// against a real Postgres, so it also proves the Cloudflare build works.
try {
	process.loadEnvFile(fileURLToPath(new URL('../../.env', import.meta.url)));
} catch {
	// CI provides env directly
}

const PORT = 8787;
// 127.0.0.1 rather than localhost: wrangler dev rewrites the request host to it.
// Without --local-upstream it would rewrite Host/Origin to the production route
// (windowling.com) and Better Auth would reject cookie-carrying requests as cross-origin.
const BASE_URL = `http://127.0.0.1:${PORT}`;
const databaseUrl = process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('E2E needs DATABASE_URL (or E2E_DATABASE_URL).');

// The site gate is on (wrangler.jsonc); e2e/global-setup.ts signs in once with this password.
const salt = Buffer.from('e2e-salt-1234567');
const sitePasswordHash = `pbkdf2-sha256$1000$${salt.toString('base64')}$${pbkdf2Sync(E2E_SITE_PASSWORD, salt, 1000, 32, 'sha256').toString('base64')}`;

const vars: Record<string, string> = {
	SITE_PASSWORD_HASH: sitePasswordHash,
	DATABASE_URL: databaseUrl,
	BETTER_AUTH_SECRET: 'e2e-only-secret-not-used-anywhere-else-0123456789',
	BETTER_AUTH_URL: BASE_URL,
	PUBLIC_APP_URL: BASE_URL,
};
const varFlags = Object.entries(vars)
	// Single quotes: the password hash contains `$`, which a shell would expand.
	.map(([key, value]) => `--var '${key}:${value}'`)
	.join(' ');

export default defineConfig({
	testDir: './e2e',
	fullyParallel: true,
	forbidOnly: Boolean(process.env.CI),
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
	globalSetup: './e2e/global-setup.ts',
	use: {
		baseURL: BASE_URL,
		storageState: GATE_STATE,
		trace: 'retain-on-failure',
	},
	projects: [
		{
			name: 'desktop-chromium',
			use: {
				...devices['Desktop Chrome'],
				launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE },
			},
		},
		{
			name: 'mobile-chromium',
			use: {
				...devices['Pixel 7'],
				launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE },
			},
		},
	],
	webServer: {
		command: `pnpm build && pnpm exec wrangler dev --port ${PORT} --ip 127.0.0.1 --local-upstream 127.0.0.1:${PORT} ${varFlags}`,
		url: `${BASE_URL}/api/health`,
		reuseExistingServer: !process.env.CI,
		// The Worker reaches Postgres through the Hyperdrive binding; point its local stand-in
		// at the same database the tests use.
		env: {
			...(process.env as Record<string, string>),
			CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE: databaseUrl,
		},
		timeout: 180_000,
		stdout: 'ignore',
		stderr: 'pipe',
	},
});
