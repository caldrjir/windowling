/**
 * Online play for the puzzle shelf: every message a client may send is parsed and bounded
 * here before a room acts on it. Pure functions - unit-tested without a runtime.
 *
 * Two kinds of room:
 *   turn  two players take turns (chess, gomoku); the room keeps the move list and the
 *         result, the clients check the rules.
 *   race  up to MAX_RACERS players solve the same puzzle (same seed); the room times them.
 *
 * Client -> room:
 *   hello   { pid, nick }       join; pid is a private per-browser id that keeps the seat
 *   chat    { text }
 *   move    { n, m }            turn: ply number n (must be next) and the move, game-encoded
 *   end     { winner, why }     turn: the game is over on the board (winner: seat 0/1, -1 draw)
 *   resign  {}                  turn
 *   draw    {}                  turn: offer a draw, or accept the opponent's offer
 *   claim   {}                  turn: win when the opponent has been gone for CLAIM_AFTER ms
 *   rematch {}                  turn: a new game with the colours swapped once both ask
 *   start   { diff }            race: the host starts a round (new seed, short countdown)
 *   prog    { p }               race: own progress 0..1
 *   done    { ok, mistakes, score? }   race: solved (ok) or out
 */

export const MAX_RACERS = 8;
export const MAX_CHAT = 200;
export const MAX_NICK = 20;
export const CHAT_HISTORY = 30;
export const MAX_MOVES = 1000;
/** All moves of one game together (the round is one storage value, capped at 128 KiB). */
export const MAX_MOVES_SIZE = 100_000;
export const CLAIM_AFTER = 60_000;
export const COUNTDOWN = 3500;

export type Kind = 'turn' | 'race';

export interface RoomMeta {
	code: string;
	game: string;
	kind: Kind;
	diff: string;
	host: string;
	/** Listed in the lobby for anybody to join. */
	open: boolean;
	created: number;
}

export type ClientMessage =
	| { t: 'hello'; pid: string; nick: string }
	| { t: 'chat'; text: string }
	| { t: 'move'; n: number; m: string }
	| { t: 'end'; winner: number; why: string }
	| { t: 'resign' }
	| { t: 'draw' }
	| { t: 'claim' }
	| { t: 'rematch' }
	| { t: 'start'; diff: string | null }
	| { t: 'prog'; p: number }
	| { t: 'done'; ok: boolean; mistakes: number; score: number | null };

/** Room codes: no 0/O/1/I to read them out loud. */
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_RE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/;
export function makeCode(random: () => number = Math.random): string {
	let code = '';
	for (let i = 0; i < 5; i++) code += CODE_CHARS[Math.floor(random() * CODE_CHARS.length)];
	return code;
}

/** Visible text only: no control characters, single spaces, trimmed and capped. */
export function cleanText(value: unknown, max: number): string {
	if (typeof value !== 'string') return '';
	return value
		.replace(/[\p{Cc}\p{Cf}]/gu, '')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, max);
}
export function cleanNick(value: unknown): string {
	return cleanText(value, MAX_NICK) || 'Hvězdář';
}

const GAME_RE = /^[a-z][a-z0-9-]{1,23}$/;
const DIFF_RE = /^[a-z][a-z0-9]{0,15}$/;
const PID_RE = /^[a-zA-Z0-9]{12,40}$/;
const WHY_RE = /^[a-z][a-z0-9]{0,15}$/;
/**
 * A move as the game encodes it (chess "52-36-0", gomoku "112", tanks "120:45,80,2:600,310;610,300",
 * worms: a whole turn with its explosions and where every worm ended up).
 */
export const MAX_MOVE = 320;
const MOVE_RE = new RegExp(`^[a-zA-Z0-9=+#.,:;_-]{1,${MAX_MOVE}}$`);

const num = (v: unknown, min: number, max: number): number | null =>
	typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : null;
const int = (v: unknown, min: number, max: number): number | null => {
	const n = num(v, min, max);
	return n !== null && Number.isInteger(n) ? n : null;
};
const match = (re: RegExp, v: unknown): string | null =>
	typeof v === 'string' && re.test(v) ? v : null;

export function parseClientMessage(raw: unknown): ClientMessage | null {
	if (typeof raw !== 'string' || raw.length > 1000) return null;
	let m: Record<string, unknown>;
	try {
		m = JSON.parse(raw) as Record<string, unknown>;
	} catch {
		return null;
	}
	if (!m || typeof m !== 'object') return null;
	switch (m.t) {
		case 'hello': {
			const pid = match(PID_RE, m.pid);
			return pid ? { t: 'hello', pid, nick: cleanNick(m.nick) } : null;
		}
		case 'chat': {
			const text = cleanText(m.text, MAX_CHAT);
			return text ? { t: 'chat', text } : null;
		}
		case 'move': {
			const n = int(m.n, 0, MAX_MOVES - 1),
				mv = match(MOVE_RE, m.m);
			return n !== null && mv ? { t: 'move', n, m: mv } : null;
		}
		case 'end': {
			const winner = int(m.winner, -1, 1),
				why = match(WHY_RE, m.why);
			return winner !== null && why ? { t: 'end', winner, why } : null;
		}
		case 'resign':
		case 'draw':
		case 'claim':
		case 'rematch':
			return { t: m.t };
		case 'start':
			return { t: 'start', diff: match(DIFF_RE, m.diff) };
		case 'prog': {
			const p = num(m.p, 0, 1);
			return p !== null ? { t: 'prog', p } : null;
		}
		case 'done': {
			const mistakes = int(m.mistakes, 0, 1e6) ?? 0,
				score = int(m.score, 0, 1e9);
			return { t: 'done', ok: m.ok === true, mistakes, score };
		}
		default:
			return null;
	}
}

/** Validates the body of "create a room". */
export function parseCreate(body: unknown): Omit<RoomMeta, 'code' | 'created'> | null {
	const b = (body ?? {}) as Record<string, unknown>;
	const game = match(GAME_RE, b.game),
		diff = match(DIFF_RE, b.diff);
	const kind = b.kind === 'turn' || b.kind === 'race' ? b.kind : null;
	if (!game || !diff || !kind) return null;
	return { game, kind, diff, host: cleanNick(b.nick), open: b.open !== false };
}

/** The game in a lobby query, or null. */
export const parseGame = (v: string | null): string | null => match(GAME_RE, v);

/** Turn games: who moves at ply n of round r. Seat r % 2 moves first, so colours swap. */
export const seatToMove = (round: number, ply: number): number => (round + ply) % 2;

export interface RaceResult {
	/** Progress 0..1, the finish time in ms since the start, and whether it was solved. */
	p: number;
	time?: number;
	ok?: boolean;
	mistakes?: number;
	score?: number | null;
}

/** Race standings: solved by time, then the rest by progress. */
export function standings(results: Record<string, RaceResult>): string[] {
	const rank = (r: RaceResult) => (r.ok ? 0 : r.time !== undefined ? 2 : 1);
	return Object.entries(results)
		.sort(([, a], [, b]) => {
			const d = rank(a) - rank(b);
			if (d) return d;
			if (a.ok && b.ok) return (a.time ?? 0) - (b.time ?? 0);
			return b.p - a.p;
		})
		.map(([id]) => id);
}
