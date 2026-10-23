/**
 * DRIFTWOOD multiplayer protocol: every message a client may send is parsed and bounded
 * here before a room acts on it. Pure functions - unit-tested without a runtime.
 *
 * Client -> room:
 *   hello { nick, look }                 join with a nickname and character look
 *   s     { x, y, z, yaw, pitch, ... }   own position and animation state (~10/s)
 *   chat  { text }
 *   node  { k, i, r }                    harvested node k#i, respawns in r seconds
 *   build { type, x, z, rot }            placed structure
 *   time  { hour, day }                  shared clock (the host sends it; sleeping too)
 *   drop  { item, x, z }                 an item put on the ground
 *   take  { id }                         pick a ground item up (first one wins)
 */

export const MAX_PLAYERS = 8;
export const MAX_CHAT = 200;
export const MAX_NICK = 20;
export const CHAT_HISTORY = 40;
export const MAX_STRUCTURES = 400;
export const MAX_DROPS = 150;
const WORLD = 1000;

export interface Look {
	skin: number;
	hair: number;
	shirt: number;
	pants: number;
}
export interface PlayerState {
	x: number;
	y: number;
	z: number;
	yaw: number;
	pitch: number;
	/** moving, sprinting, swimming, on ground */
	m: boolean;
	sp: boolean;
	sw: boolean;
	g: boolean;
	/** swing 0..1 and held item id */
	w: number;
	it: string | null;
}
export interface Structure {
	type: string;
	x: number;
	z: number;
	rot: number;
}
/** An inventory stack: item id, count, tool durability / waterskin charges. */
export interface Item {
	id: string;
	n: number;
	dur?: number;
	ch?: number;
}
export interface Drop {
	id: string;
	item: Item;
	x: number;
	z: number;
}
export type ClientMessage =
	| { t: 'hello'; nick: string; look: Look }
	| ({ t: 's' } & PlayerState)
	| { t: 'chat'; text: string }
	| { t: 'node'; k: string; i: number; r: number }
	| ({ t: 'build' } & Structure)
	| { t: 'time'; hour: number; day: number }
	| { t: 'drop'; item: Item; x: number; z: number }
	| { t: 'take'; id: string };

export interface RoomMeta {
	code: string;
	name: string;
	seed: number;
	mode: string;
	host: string;
	created: number;
}

/** Room codes: no 0/O/1/I to read them out loud. */
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_RE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;
export function makeCode(random: () => number = Math.random): string {
	let code = '';
	for (let i = 0; i < 6; i++) code += CODE_CHARS[Math.floor(random() * CODE_CHARS.length)];
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
	return cleanText(value, MAX_NICK) || 'Trosečník';
}

const num = (v: unknown, min: number, max: number): number | null =>
	typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : null;
const int = (v: unknown, min: number, max: number): number | null => {
	const n = num(v, min, max);
	return n !== null && Number.isInteger(n) ? n : null;
};
const id = (v: unknown, max = 24): string | null =>
	typeof v === 'string' && new RegExp(`^[a-zA-Z][a-zA-Z0-9]{0,${max - 1}}$`).test(v) ? v : null;

function parseLook(v: unknown): Look {
	const o = (v ?? {}) as Record<string, unknown>;
	const part = (k: string) => int(o[k], 0, 15) ?? 0;
	return { skin: part('skin'), hair: part('hair'), shirt: part('shirt'), pants: part('pants') };
}

function parseItem(v: unknown): Item | null {
	const o = (v ?? {}) as Record<string, unknown>;
	const itemId = id(o.id),
		n = int(o.n, 1, 999);
	if (!itemId || n === null) return null;
	const item: Item = { id: itemId, n };
	const dur = num(o.dur, 0, 1e5),
		ch = int(o.ch, 0, 100);
	if (dur !== null) item.dur = dur;
	if (ch !== null) item.ch = ch;
	return item;
}

export function parseClientMessage(raw: unknown): ClientMessage | null {
	if (typeof raw !== 'string' || raw.length > 2000) return null;
	let m: Record<string, unknown>;
	try {
		m = JSON.parse(raw) as Record<string, unknown>;
	} catch {
		return null;
	}
	if (!m || typeof m !== 'object') return null;
	switch (m.t) {
		case 'hello':
			return { t: 'hello', nick: cleanNick(m.nick), look: parseLook(m.look) };
		case 's': {
			const x = num(m.x, -WORLD, WORLD),
				y = num(m.y, -WORLD, WORLD),
				z = num(m.z, -WORLD, WORLD),
				yaw = num(m.yaw, -1e6, 1e6),
				pitch = num(m.pitch, -2, 2),
				w = num(m.w, 0, 1);
			if (x === null || y === null || z === null || yaw === null || pitch === null) return null;
			return {
				t: 's',
				x,
				y,
				z,
				yaw,
				pitch,
				m: m.m === true,
				sp: m.sp === true,
				sw: m.sw === true,
				g: m.g !== false,
				w: w ?? 0,
				it: id(m.it),
			};
		}
		case 'chat': {
			const text = cleanText(m.text, MAX_CHAT);
			return text ? { t: 'chat', text } : null;
		}
		case 'node': {
			const k = id(m.k),
				i = int(m.i, 0, 1e6),
				r = num(m.r, 0, 1e6);
			return k && i !== null && r !== null ? { t: 'node', k, i, r } : null;
		}
		case 'build': {
			const type = id(m.type),
				x = num(m.x, -WORLD, WORLD),
				z = num(m.z, -WORLD, WORLD),
				rot = num(m.rot, -1e6, 1e6);
			return type && x !== null && z !== null && rot !== null
				? { t: 'build', type, x, z, rot }
				: null;
		}
		case 'time': {
			const hour = num(m.hour, 0, 24),
				day = int(m.day, 1, 1e6);
			return hour !== null && day !== null ? { t: 'time', hour, day } : null;
		}
		case 'drop': {
			const item = parseItem(m.item),
				x = num(m.x, -WORLD, WORLD),
				z = num(m.z, -WORLD, WORLD);
			return item && x !== null && z !== null ? { t: 'drop', item, x, z } : null;
		}
		case 'take': {
			const dropId = typeof m.id === 'string' && /^[a-z0-9]{1,16}$/.test(m.id) ? m.id : null;
			return dropId ? { t: 'take', id: dropId } : null;
		}
		default:
			return null;
	}
}

/** Validates the body of "create a world". */
export function parseCreate(body: unknown): Omit<RoomMeta, 'code' | 'created'> | null {
	const b = (body ?? {}) as Record<string, unknown>;
	const seed = int(b.seed, 0, 2 ** 32);
	const mode = typeof b.mode === 'string' && /^[a-z]{1,12}$/.test(b.mode) ? b.mode : null;
	if (seed === null || !mode) return null;
	const host = cleanNick(b.nick);
	return { seed, mode, host, name: cleanText(b.name, 30) || `${host}` };
}
