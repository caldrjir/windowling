import { defineConfig, devices } from '@playwright/test';

// E2E runs the production build inside the real Workers runtime (wrangler dev / workerd)
// against a real Postgres, so it also proves the Cloudflare build works.
try {
	process.loadEnvFile(new URL('../../.env', import.meta.url).pathname);
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

const vars: Record<string, string> = {
	DATABASE_URL: databaseUrl,
	BETTER_AUTH_SECRET: 'e2e-only-secret-not-used-anywhere-else-0123456789',
	BETTER_AUTH_URL: BASE_URL,
	PUBLIC_APP_URL: BASE_URL,
	// No cloud brain in E2E: the character uses its canned reactions.
	AI_API_URL: '',
};
const varFlags = Object.entries(vars)
	.map(([key, value]) => `--var ${key}:${JSON.stringify(value)}`)
	.join(' ');

export default defineConfig({
	testDir: './e2e',
	fullyParallel: true,
	forbidOnly: Boolean(process.env.CI),
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
	use: {
		baseURL: BASE_URL,
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
