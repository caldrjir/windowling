/**
 * Site gate: the whole site (hub, games, API) sits behind one shared password.
 *
 * Runs in the Worker entry before SvelteKit and before static assets, so nothing - not
 * even the static games - is served without it. The password is never stored: the
 * Worker secret SITE_PASSWORD_HASH holds a salted PBKDF2 hash
 * (`pbkdf2-sha256$<iterations>$<salt b64>$<hash b64>`, see scripts/site-password.mjs).
 * A correct password sets an HTTP-only cookie signed with that hash, so changing the
 * password signs everybody out.
 */

export interface GateEnv {
	/** "on" enables the gate (wrangler.jsonc). Anything else leaves the site open. */
	SITE_GATE?: string;
	SITE_PASSWORD_HASH?: string;
}

export const GATE_PATH = '/gate';
export const GATE_COOKIE = 'wl_gate';
const PASS_DAYS = 30;
const WRONG_PASSWORD_DELAY_MS = 1000;

/** Served without the password: the gate itself, the deploy smoke test and files a
 * browser fetches without cookies or that must reach old visitors (SW kill switch). */
const OPEN_PATHS = new Set([
	GATE_PATH,
	'/api/health',
	'/favicon.svg',
	'/robots.txt',
	'/manifest.webmanifest',
	'/service-worker.js',
]);
const OPEN_PREFIXES = ['/icons/'];

const encoder = new TextEncoder();

export async function gate(
	request: Request,
	env: GateEnv,
	next: () => Promise<Response>,
	now = Date.now(),
): Promise<Response> {
	if (env.SITE_GATE !== 'on') return next();
	const url = new URL(request.url);
	const hash = env.SITE_PASSWORD_HASH || null;

	if (url.pathname === GATE_PATH) return gatePage(request, url, hash, now);
	if (OPEN_PATHS.has(url.pathname) || OPEN_PREFIXES.some((p) => url.pathname.startsWith(p))) {
		return next();
	}
	if (hash && (await hasValidPass(request, hash, now))) return next();

	const wantsPage =
		(request.method === 'GET' || request.method === 'HEAD') &&
		(request.headers.get('sec-fetch-dest') === 'document' ||
			(request.headers.get('accept') ?? '').includes('text/html'));
	if (wantsPage) {
		const target = new URL(GATE_PATH, url);
		target.searchParams.set('next', url.pathname + url.search);
		return redirect(target.pathname + target.search);
	}
	return new Response('Locked', { status: 401, headers: baseHeaders('text/plain') });
}

async function gatePage(
	request: Request,
	url: URL,
	hash: string | null,
	now: number,
): Promise<Response> {
	const lang = pickLang(request);
	if (!hash) return page(lang, 'unconfigured', 503);

	if (request.method === 'POST') {
		const form = await request.formData().catch(() => null);
		const password = form?.get('password');
		const next = safeNext(form?.get('next'));
		if (typeof password === 'string' && (await verifyPassword(password, hash))) {
			const expires = now + PASS_DAYS * 24 * 3600 * 1000;
			const secure = url.protocol === 'https:' ? '; Secure' : '';
			return redirect(next, {
				'set-cookie': `${GATE_COOKIE}=${await signPass(expires, hash)}; Path=/; Max-Age=${PASS_DAYS * 24 * 3600}; HttpOnly; SameSite=Lax${secure}`,
			});
		}
		// Slows down guessing; wall-clock only, no CPU.
		await new Promise((resolve) => setTimeout(resolve, WRONG_PASSWORD_DELAY_MS));
		return page(lang, 'wrong', 401, next);
	}
	if (request.method !== 'GET' && request.method !== 'HEAD') {
		return new Response('Method not allowed', { status: 405, headers: baseHeaders('text/plain') });
	}
	if (await hasValidPass(request, hash, now))
		return redirect(safeNext(url.searchParams.get('next')));
	return page(lang, 'ask', 200, safeNext(url.searchParams.get('next')));
}

/** Only same-origin paths: never `//evil.example` or `/\evil.example`. */
export function safeNext(value: unknown): string {
	if (typeof value !== 'string' || !value.startsWith('/')) return '/';
	if (value.startsWith('//') || value.startsWith('/\\')) return '/';
	if (value === GATE_PATH || value.startsWith(`${GATE_PATH}?`)) return '/';
	return value;
}

// ── Password hash ────────────────────────────────────────────────────────────

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
	const parts = stored.split('$');
	if (parts.length !== 4 || parts[0] !== 'pbkdf2-sha256') return false;
	const iterations = Number(parts[1]);
	if (!Number.isInteger(iterations) || iterations < 1) return false;
	const salt = fromBase64(parts[2] ?? '');
	const expected = fromBase64(parts[3] ?? '');
	if (!salt || !expected || expected.length === 0) return false;
	const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, [
		'deriveBits',
	]);
	const bits = await crypto.subtle.deriveBits(
		{ name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
		key,
		expected.length * 8,
	);
	return equalBytes(new Uint8Array(bits), expected);
}

// ── Signed pass cookie ───────────────────────────────────────────────────────

async function hmac(message: string, secret: string): Promise<Uint8Array> {
	const key = await crypto.subtle.importKey(
		'raw',
		encoder.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign'],
	);
	return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(message)));
}

export async function signPass(expires: number, hash: string): Promise<string> {
	return `${expires}.${toBase64Url(await hmac(`gate:${expires}`, hash))}`;
}

export async function hasValidPass(request: Request, hash: string, now: number): Promise<boolean> {
	const value = readCookie(request.headers.get('cookie'), GATE_COOKIE);
	if (!value) return false;
	const [expiresText, signature] = value.split('.');
	const expires = Number(expiresText);
	if (!Number.isFinite(expires) || expires <= now || !signature) return false;
	const expected = toBase64Url(await hmac(`gate:${expires}`, hash));
	return equalBytes(encoder.encode(signature), encoder.encode(expected));
}

function readCookie(header: string | null, name: string): string | null {
	for (const part of (header ?? '').split(';')) {
		const [key, ...rest] = part.trim().split('=');
		if (key === name) return rest.join('=');
	}
	return null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
	return diff === 0;
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> | null {
	try {
		const binary = atob(value);
		const bytes = new Uint8Array(binary.length);
		for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
		return bytes;
	} catch {
		return null;
	}
}

function toBase64Url(bytes: Uint8Array): string {
	return btoa(String.fromCharCode(...bytes))
		.replaceAll('+', '-')
		.replaceAll('/', '_')
		.replace(/=+$/, '');
}

function baseHeaders(type: string): Record<string, string> {
	return {
		'content-type': `${type}; charset=utf-8`,
		'cache-control': 'no-store',
		'x-robots-tag': 'noindex, nofollow',
		'referrer-policy': 'same-origin',
		'x-content-type-options': 'nosniff',
	};
}

function redirect(location: string, extra: Record<string, string> = {}): Response {
	return new Response(null, {
		status: 303,
		headers: { ...baseHeaders('text/plain'), location, ...extra },
	});
}

// ── Gate page ────────────────────────────────────────────────────────────────

type Lang = 'cs' | 'en';
type PageState = 'ask' | 'wrong' | 'unconfigured';

function pickLang(request: Request): Lang {
	const accept = (request.headers.get('accept-language') ?? '').toLowerCase();
	return /^(cs|sk)\b/.test(accept) ? 'cs' : 'en';
}

const TEXT = {
	cs: {
		title: 'Soukromý přístup',
		lead: 'Windowling Game Center je zatím jen pro pozvané. Zadej heslo.',
		label: 'Heslo',
		submit: 'Vstoupit',
		wrong: 'Špatné heslo.',
		unconfigured: 'Přístup ještě není nastavený.',
	},
	en: {
		title: 'Private access',
		lead: 'Windowling Game Center is invite-only for now. Enter the password.',
		label: 'Password',
		submit: 'Enter',
		wrong: 'Wrong password.',
		unconfigured: 'Access is not set up yet.',
	},
} as const;

function escapeHtml(value: string): string {
	return value.replace(
		/[&<>"']/g,
		(c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
	);
}

function page(lang: Lang, state: PageState, status: number, next = '/'): Response {
	const t = TEXT[lang];
	const form =
		state === 'unconfigured'
			? `<p class="msg">${t.unconfigured}</p>`
			: `<form method="post" action="${GATE_PATH}">
	<input type="hidden" name="next" value="${escapeHtml(next)}">
	<label for="password">${t.label}</label>
	<input id="password" name="password" type="password" autocomplete="current-password" required autofocus>
	${state === 'wrong' ? `<p class="msg" role="alert">${t.wrong}</p>` : ''}
	<button type="submit">${t.submit}</button>
</form>`;
	const html = `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#07051a">
<title>Windowling Game Center</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<style>
*{box-sizing:border-box;margin:0}
body{min-height:100vh;display:grid;place-items:center;padding:24px 16px;background:radial-gradient(circle at 70% 20%,#2a0f4d,#07051a 60%);color:#f2f1ff;font:16px/1.5 system-ui,-apple-system,'Segoe UI',sans-serif}
main{width:min(380px,100%);padding:32px 26px;border-radius:24px;background:rgba(18,14,38,.7);box-shadow:inset 0 0 0 1px rgba(255,255,255,.1),0 30px 80px -30px #000}
.brand{font-weight:900;letter-spacing:.14em;font-size:20px}
.brand small{display:block;font-size:11px;letter-spacing:.3em;color:#a29fc4;text-transform:uppercase;font-weight:600}
h1{font-size:22px;margin:22px 0 6px}
p{color:#a29fc4;font-size:14px}
form{display:grid;gap:10px;margin-top:22px}
label{font-size:13px;color:#a29fc4}
input{width:100%;padding:13px 14px;border-radius:12px;border:1px solid rgba(255,255,255,.18);background:rgba(0,0,0,.35);color:inherit;font:inherit}
input:focus{outline:2px solid #55f6ff;outline-offset:1px}
button{margin-top:6px;padding:14px;border:0;border-radius:12px;font:inherit;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:#0a0420;background:linear-gradient(110deg,#55f6ff,#ff4fd8);cursor:pointer}
.msg{color:#ff8aa5;margin-top:4px}
</style>
</head>
<body>
<main>
<div class="brand">WINDOWLING<small>Game Center</small></div>
<h1>${t.title}</h1>
<p>${t.lead}</p>
${form}
</main>
</body>
</html>`;
	return new Response(html, {
		status,
		headers: {
			...baseHeaders('text/html'),
			'content-security-policy':
				"default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
		},
	});
}
