#!/usr/bin/env node
// One-time local setup (Windows, macOS, Linux):  pnpm setup:local
// - creates .env from .env.example and fills in local-only secrets,
// - starts Postgres with Docker Compose (if Docker is available),
// - applies the database migrations.
// Safe to run again: it never overwrites values that are already set.
import { spawnSync } from 'node:child_process';
import { pbkdf2Sync, randomBytes } from 'node:crypto';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Password of the site gate in `pnpm preview` (local only; production has its own). */
const LOCAL_SITE_PASSWORD = 'windowling';

const root = fileURLToPath(new URL('..', import.meta.url));
const envPath = fileURLToPath(new URL('../.env', import.meta.url));
const examplePath = fileURLToPath(new URL('../.env.example', import.meta.url));
const windows = process.platform === 'win32';

function step(text) {
	console.log(`\n▶ ${text}`);
}

function run(command, args) {
	const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', shell: windows });
	return result.error ? null : result.status;
}

const major = Number(process.versions.node.split('.')[0]);
if (major < 24) {
	console.warn(`⚠ Node ${process.versions.node}: this project expects Node 24 (see .nvmrc).`);
}

step('.env');
if (!existsSync(envPath)) {
	copyFileSync(examplePath, envPath);
	console.log('  created .env from .env.example');
}
let env = readFileSync(envPath, 'utf8');
function setIfEmpty(key, value) {
	const line = new RegExp(`^${key}=(.*)$`, 'm');
	const match = env.match(line);
	if (match && match[1]?.trim()) return false;
	env = match ? env.replace(line, `${key}=${value}`) : `${env.trimEnd()}\n${key}=${value}\n`;
	return true;
}
if (setIfEmpty('BETTER_AUTH_SECRET', randomBytes(32).toString('base64'))) {
	console.log('  generated BETTER_AUTH_SECRET');
}
const salt = randomBytes(16);
const hash = pbkdf2Sync(LOCAL_SITE_PASSWORD, salt, 30_000, 32, 'sha256');
if (
	setIfEmpty(
		'SITE_PASSWORD_HASH',
		// Single quotes: Docker Compose also reads .env and would expand the `$` parts.
		`'pbkdf2-sha256$30000$${salt.toString('base64')}$${hash.toString('base64')}'`,
	)
) {
	console.log(`  set the local site password for pnpm preview: "${LOCAL_SITE_PASSWORD}"`);
}
writeFileSync(envPath, env);

step('Postgres (docker compose up -d --wait)');
const docker = run('docker', ['compose', 'up', '-d', '--wait']);
if (docker !== 0) {
	console.warn(
		'  ⚠ Docker is not available or failed. Start Docker Desktop and run this again,\n' +
			'    or point DATABASE_URL / TEST_DATABASE_URL in .env at your own PostgreSQL 16+.',
	);
}

step('Database migrations (pnpm db:migrate)');
if (run('pnpm', ['db:migrate']) !== 0) {
	console.error('  ✖ Migrations failed - is the database running and DATABASE_URL correct?');
	process.exit(1);
}

console.log(`
✔ Ready.
  pnpm dev       → http://localhost:5173  (fast dev server, no site password)
  pnpm preview   → http://localhost:8787  (production Worker locally, password "${LOCAL_SITE_PASSWORD}")
  pnpm test      → unit + database tests
  pnpm test:e2e  → browser tests (first time: pnpm --filter @windowling/web exec playwright install chromium)`);
