/**
 * windowling.com is the only canonical origin. Requests to www.<host> are
 * permanently redirected (path and query preserved) so sessions, cookies and
 * Better Auth's trusted origin all stay on a single host.
 */
export function canonicalRedirectUrl(requestUrl: URL, publicAppUrl: string): string | null {
	const canonical = new URL(publicAppUrl);
	if (requestUrl.hostname !== `www.${canonical.hostname}`) return null;
	return new URL(`${requestUrl.pathname}${requestUrl.search}`, canonical).toString();
}
