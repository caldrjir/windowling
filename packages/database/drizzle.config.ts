import { defineConfig } from 'drizzle-kit';
import { fileURLToPath } from 'node:url';

// Local development keeps a single .env in the repository root.
try {
	process.loadEnvFile(fileURLToPath(new URL('../../.env', import.meta.url)));
} catch {
	// No .env file - rely on the real environment (CI, production).
}

const url = process.env.DATABASE_URL;
if (!url) {
	throw new Error('DATABASE_URL is not set. Copy .env.example to .env or export it.');
}

export default defineConfig({
	dialect: 'postgresql',
	schema: './src/schema/index.ts',
	out: './drizzle',
	casing: 'snake_case',
	dbCredentials: { url },
	strict: true,
	verbose: true,
});
