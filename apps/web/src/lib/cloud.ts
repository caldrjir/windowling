/**
 * What the account keeps of a player's progress: the localStorage keys games write.
 * The same rule lives in static/games/sync.js (plain JS for the games) - keep them equal.
 */
export const SYNC_KEY_RE =
	/^(gamecenter\.(lang|puzzles|stats\.[a-z0-9-]{1,32})|[a-z0-9-]{2,32}\.save\.v1|driftwood\.[A-Za-z0-9._:-]{1,64})$/;

/** Nicknames: 3-20 visible characters, letters, digits, spaces and a few marks. */
export const NICK_RE = /^[\p{L}\p{N}][\p{L}\p{N} ._-]{1,18}[\p{L}\p{N}]$/u;

export function cleanNickname(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const nick = value.normalize('NFC').replace(/\s+/g, ' ').trim();
	return NICK_RE.test(nick) ? nick : null;
}
