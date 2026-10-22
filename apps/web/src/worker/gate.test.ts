import { pbkdf2Sync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { GATE_COOKIE, gate, safeNext, verifyPassword, type GateEnv } from './gate';

const PASSWORD = 'correct horse battery';
const salt = Buffer.from('0123456789abcdef');
const HASH = `pbkdf2-sha256$1000$${salt.toString('base64')}$${Buffer.from(pbkdf2Sync(PASSWORD, salt, 1000, 32, 'sha256')).toString('base64')}`;
const env: GateEnv = { SITE_GATE: 'on', SITE_PASSWORD_HASH: HASH };
const NOW = 1_800_000_000_000;

const ok = () => Promise.resolve(new Response('app'));
const page = (path: string, init: RequestInit = {}) =>
	new Request(`https://windowling.com${path}`, {
		...init,
		headers: { accept: 'text/html', ...(init.headers as Record<string, string>) },
	});
const login = (password: string, next = '/') =>
	new Request('https://windowling.com/gate', {
		method: 'POST',
		body: new URLSearchParams({ password, next }),
	});

async function passCookie(): Promise<string> {
	const response = await gate(login(PASSWORD), env, ok, NOW);
	const cookie = response.headers.get('set-cookie') ?? '';
	return cookie.split(';')[0] ?? '';
}

describe('site gate', () => {
	it('verifies PBKDF2 hashes made by the site-password script', async () => {
		expect(await verifyPassword(PASSWORD, HASH)).toBe(true);
		expect(await verifyPassword('wrong', HASH)).toBe(false);
		expect(await verifyPassword(PASSWORD, 'garbage')).toBe(false);
	});

	it('stays out of the way when it is off', async () => {
		const response = await gate(page('/'), { SITE_PASSWORD_HASH: HASH }, ok, NOW);
		expect(await response.text()).toBe('app');
	});

	it('sends pages to the gate and locks everything else', async () => {
		const redirect = await gate(page('/games/voidborn/index.html?x=1'), env, ok, NOW);
		expect(redirect.status).toBe(303);
		expect(redirect.headers.get('location')).toBe(
			'/gate?next=%2Fgames%2Fvoidborn%2Findex.html%3Fx%3D1',
		);
		const api = await gate(
			new Request('https://windowling.com/api/auth/get-session'),
			env,
			ok,
			NOW,
		);
		expect(api.status).toBe(401);
	});

	it('keeps the health check and cookie-less browser files open', async () => {
		for (const path of [
			'/api/health',
			'/service-worker.js',
			'/manifest.webmanifest',
			'/icons/x.png',
		]) {
			expect(await (await gate(page(path), env, ok, NOW)).text(), path).toBe('app');
		}
	});

	it('lets people in with the right password, for 30 days', async () => {
		const response = await gate(login(PASSWORD, '/games/voidborn/'), env, ok, NOW);
		expect(response.status).toBe(303);
		expect(response.headers.get('location')).toBe('/games/voidborn/');
		expect(response.headers.get('set-cookie')).toMatch(
			new RegExp(`^${GATE_COOKIE}=.+; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax; Secure$`),
		);

		const cookie = await passCookie();
		const inside = await gate(page('/', { headers: { cookie } }), env, ok, NOW);
		expect(await inside.text()).toBe('app');
		const later = await gate(page('/', { headers: { cookie } }), env, ok, NOW + 31 * 86_400_000);
		expect(later.status).toBe(303);
	});

	it('rejects a wrong password, forged passes and passes from an old password', async () => {
		const wrong = await gate(login('nope'), env, ok, NOW);
		expect(wrong.status).toBe(401);
		expect(wrong.headers.get('set-cookie')).toBeNull();
		expect(await wrong.text()).toContain('password');

		const forged = `${GATE_COOKIE}=${NOW + 1000}.AAAA`;
		expect((await gate(page('/', { headers: { cookie: forged } }), env, ok, NOW)).status).toBe(303);

		const cookie = await passCookie();
		const rotated = { ...env, SITE_PASSWORD_HASH: HASH.replace('$1000$', '$1001$') };
		expect((await gate(page('/', { headers: { cookie } }), rotated, ok, NOW)).status).toBe(303);
	});

	it('fails closed when the password is not configured', async () => {
		const unconfigured = { SITE_GATE: 'on' };
		expect((await gate(page('/'), unconfigured, ok, NOW)).status).toBe(303);
		expect((await gate(page('/gate'), unconfigured, ok, NOW)).status).toBe(503);
		expect((await gate(login(PASSWORD), unconfigured, ok, NOW)).status).toBe(503);
	});

	it('only redirects to same-origin paths', () => {
		expect(safeNext('/games/voidborn/')).toBe('/games/voidborn/');
		expect(safeNext('//evil.example')).toBe('/');
		expect(safeNext('/\\evil.example')).toBe('/');
		expect(safeNext('https://evil.example')).toBe('/');
		expect(safeNext('/gate?next=/')).toBe('/');
		expect(safeNext(null)).toBe('/');
	});
});
