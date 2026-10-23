/**
 * What the account keeps of a player's progress: the localStorage keys games write.
 * The same rule lives in static/games/sync.js (plain JS for the games) - keep them equal.
 */
export const SYNC_KEY_RE =
	/^(gamecenter\.(lang|puzzles|music|stats\.[a-z0-9-]{1,32})|[a-z0-9-]{2,32}\.save\.v1|driftwood\.[A-Za-z0-9._:-]{1,64})$/;

/** Nicknames: 3-20 visible characters, letters, digits, spaces and a few marks. */
export const NICK_RE = /^[\p{L}\p{N}][\p{L}\p{N} ._-]{1,18}[\p{L}\p{N}]$/u;

export function cleanNickname(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const nick = value.normalize('NFC').replace(/\s+/g, ' ').trim();
	return NICK_RE.test(nick) ? nick : null;
}

/**
 * Leaderboard boards: `<scope>:<unit>`. Only comparable results share a board: the same daily
 * puzzle, the same Path level, a free-play mode with fixed rules, a game's all-time best, or
 * play time. The same rule is used by static/games/sync.js and the puzzle kit.
 */
export const BOARD_RE =
	/^(daily:\d{4}-\d{2}-\d{2}|level:\d{1,3}|free:[a-z0-9]{1,16}|best|online|total):(time|score|survive|floor|days|wins|played)$/;
