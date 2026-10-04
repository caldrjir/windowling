/** Resolves the integration-test database URL; tests are skipped locally without one. */
export function getTestDatabaseUrl(): string | undefined {
	try {
		process.loadEnvFile(new URL('../../../.env', import.meta.url).pathname);
	} catch {
		// no .env - fine in CI
	}
	const url = process.env.TEST_DATABASE_URL;
	if (!url && process.env.CI) {
		throw new Error('TEST_DATABASE_URL must be set in CI - database tests may not be skipped.');
	}
	return url;
}
