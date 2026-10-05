/**
 * The character lives on the player's device clock (#10). The browser keeps
 * its current IANA zone in a cookie so the server knows it on every load -
 * including the very first one that creates the world.
 */
export const TIME_ZONE_COOKIE = 'wl_tz';

export function deviceTimeZone(): string {
	return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function rememberTimeZone(timeZone: string): void {
	const secure = location.protocol === 'https:' ? '; secure' : '';
	document.cookie = `${TIME_ZONE_COOKIE}=${encodeURIComponent(timeZone)}; path=/; max-age=31536000; samesite=lax${secure}`;
}
