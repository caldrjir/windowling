import { describe, expect, it } from 'vitest';
import { canonicalRedirectUrl } from './canonical-host.ts';

const app = 'https://windowling.com';

describe('canonicalRedirectUrl', () => {
	it('redirects www to the apex, keeping path and query', () => {
		expect(canonicalRedirectUrl(new URL('https://www.windowling.com/a/b?x=1'), app)).toBe(
			'https://windowling.com/a/b?x=1',
		);
	});

	it('leaves the canonical host alone', () => {
		expect(canonicalRedirectUrl(new URL('https://windowling.com/'), app)).toBeNull();
	});

	it('does not touch local development hosts', () => {
		expect(
			canonicalRedirectUrl(new URL('http://localhost:5173/'), 'http://localhost:5173'),
		).toBeNull();
	});

	it('ignores unrelated subdomains', () => {
		expect(canonicalRedirectUrl(new URL('https://api.windowling.com/'), app)).toBeNull();
	});
});
