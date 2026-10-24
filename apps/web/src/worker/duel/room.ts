/**
 * One online game of the puzzle shelf: a Durable Object with hibernatable WebSockets.
 * Turn rooms seat two players and keep the move list and the result; race rooms time up
 * to MAX_RACERS players on the same puzzle. A room left empty deletes itself after a day.
 */
import { DurableObject } from 'cloudflare:workers';
import {
	CHAT_HISTORY,
	CLAIM_AFTER,
	COUNTDOWN,
	MAX_MOVES,
	MAX_MOVES_SIZE,
	MAX_RACERS,
	parseClientMessage,
	seatToMove,
	type ClientMessage,
	type RaceResult,
	type RoomMeta,
} from './protocol';

export interface DuelEnv {
	DUEL_ROOM: DurableObjectNamespace<DuelRoom>;
	DUEL_LOBBY: DurableObjectNamespace<DuelLobby>;
}

interface Player {
	/** Public id other players see; the private pid is only the storage key. */
	id: string;
	nick: string;
	/** Turn rooms: seat 0 or 1. */
	seat: number | null;
	joinedAt: number;
	/** When the player's last socket closed (null while connected). */
	leftAt: number | null;
	lastChat: number;
}
interface Over {
	/** Turn: winning seat, -1 for a draw. Race: always -1. */
	winner: number;
	why: string;
}
interface Round {
	n: number;
	seed: number;
	diff: string;
	moves: string[];
	over: Over | null;
	drawOffer: number | null;
	rematch: number[];
	/** Race: server time of the start, results by public player id. */
	startAt: number | null;
	results: Record<string, RaceResult>;
}
interface ChatLine {
	nick: string;
	text: string;
	at: number;
	sys?: boolean;
}
interface Attachment {
	pid: string | null;
}

const EXPIRE_AFTER = 24 * 3600_000;
const newSeed = () => crypto.getRandomValues(new Uint32Array(1))[0] ?? 1;

export class DuelRoom extends DurableObject<DuelEnv> {
	/** Creates the room once; false when the code is already taken. */
	async create(meta: RoomMeta): Promise<boolean> {
		if (await this.ctx.storage.get('meta')) return false;
		const round: Round = {
			n: 0,
			seed: newSeed(),
			diff: meta.diff,
			moves: [],
			over: null,
			drawOffer: null,
			rematch: [],
			startAt: null,
			results: {},
		};
		await this.ctx.storage.put({ meta, round, players: {} });
		await this.ctx.storage.setAlarm(Date.now() + EXPIRE_AFTER);
		return true;
	}

	async info(): Promise<(RoomMeta & { players: number }) | null> {
		const meta = await this.ctx.storage.get<RoomMeta>('meta');
		return meta ? { ...meta, players: this.online().size } : null;
	}

	override async fetch(request: Request): Promise<Response> {
		if (request.headers.get('upgrade') !== 'websocket') {
			return new Response('Expected a WebSocket', { status: 426 });
		}
		if (!(await this.ctx.storage.get('meta'))) return new Response('No such game', { status: 404 });
		if (this.ctx.getWebSockets().length >= MAX_RACERS * 2) {
			return new Response('The game is full', { status: 503 });
		}
		const { 0: client, 1: server } = new WebSocketPair();
		this.ctx.acceptWebSocket(server);
		server.serializeAttachment({ pid: null } satisfies Attachment);
		await this.ctx.storage.deleteAlarm();
		return new Response(null, { status: 101, webSocket: client });
	}

	override async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
		const msg = parseClientMessage(typeof raw === 'string' ? raw : null);
		if (!msg) return;
		const me = ws.deserializeAttachment() as Attachment;
		if (msg.t === 'hello') {
			if (!me.pid) await this.hello(ws, msg.pid, msg.nick);
			return;
		}
		if (!me.pid) return;
		const players = await this.players();
		const player = players[me.pid];
		if (!player) return;
		if (msg.t === 'chat') {
			const now = Date.now();
			if (now - player.lastChat < 400) return;
			player.lastChat = now;
			await this.ctx.storage.put('players', players);
			await this.say({ nick: player.nick, text: msg.text, at: now });
			return;
		}
		const meta = await this.meta();
		const round = await this.round();
		if (!meta || !round) return;
		const changed =
			meta.kind === 'turn'
				? this.turn(msg, player, players, round)
				: this.race(msg, player, players, round);
		if (changed) {
			await this.ctx.storage.put('round', round);
			if (changed === 'lobby') await this.syncLobby();
		}
	}

	override async webSocketClose(ws: WebSocket): Promise<void> {
		await this.leave(ws);
	}
	override async webSocketError(ws: WebSocket): Promise<void> {
		await this.leave(ws);
	}

	override async alarm(): Promise<void> {
		if (this.ctx.getWebSockets().length) return;
		const meta = await this.meta();
		await this.ctx.storage.deleteAll();
		if (meta) await this.lobby().remove(meta.code);
	}

	// ── turn games ───────────────────────────────────────────────────────────

	/** Applies a turn-game message; returns whether the round changed. */
	private turn(
		msg: ClientMessage,
		player: Player,
		players: Record<string, Player>,
		round: Round,
	): boolean | 'lobby' {
		const seat = player.seat;
		if (seat === null) return false;
		const seated = Object.values(players).filter((p) => p.seat !== null).length === 2;
		const finish = (winner: number, why: string) => {
			round.over = { winner, why };
			round.drawOffer = null;
			this.broadcast({ t: 'over', ...round.over });
			return true;
		};
		switch (msg.t) {
			case 'move': {
				if (
					round.over ||
					!seated ||
					msg.n !== round.moves.length ||
					round.moves.length >= MAX_MOVES ||
					round.moves.reduce((n, m) => n + m.length, msg.m.length) > MAX_MOVES_SIZE
				)
					return false;
				if (seatToMove(round.n, msg.n) !== seat) return false;
				round.moves.push(msg.m);
				round.drawOffer = null;
				this.broadcast({ t: 'move', n: msg.n, m: msg.m, seat });
				return true;
			}
			case 'end':
				return round.over ? false : finish(msg.winner, msg.why);
			case 'resign':
				return round.over ? false : finish(1 - seat, 'resign');
			case 'draw': {
				if (round.over || !seated) return false;
				if (round.drawOffer !== null && round.drawOffer !== seat) return finish(-1, 'agreed');
				round.drawOffer = seat;
				this.broadcast({ t: 'draw', seat });
				return true;
			}
			case 'claim': {
				const other = Object.values(players).find((p) => p.seat === 1 - seat);
				const gone = other?.leftAt ? Date.now() - other.leftAt : 0;
				if (round.over || !other || gone < CLAIM_AFTER) return false;
				return finish(seat, 'left');
			}
			case 'rematch': {
				if (!round.over || round.rematch.includes(seat)) return false;
				round.rematch.push(seat);
				if (round.rematch.length < 2) {
					this.broadcast({ t: 'rematch', seats: round.rematch });
					return true;
				}
				Object.assign(round, {
					n: round.n + 1,
					seed: newSeed(),
					moves: [],
					over: null,
					drawOffer: null,
					rematch: [],
				});
				this.broadcast({ t: 'round', round, now: Date.now() });
				return true;
			}
			default:
				return false;
		}
	}

	// ── races ────────────────────────────────────────────────────────────────

	private race(
		msg: ClientMessage,
		player: Player,
		players: Record<string, Player>,
		round: Round,
	): boolean | 'lobby' {
		const now = Date.now();
		const running = round.startAt !== null && !round.over;
		const mine = round.results[player.id];
		switch (msg.t) {
			case 'start': {
				if (running || this.hostId(players) !== player.id) return false;
				const online = this.online();
				Object.assign(round, {
					n: round.startAt === null ? round.n : round.n + 1,
					seed: newSeed(),
					diff: msg.diff ?? round.diff,
					over: null,
					startAt: now + COUNTDOWN,
					results: Object.fromEntries(
						Object.entries(players)
							.filter(([pid]) => online.has(pid))
							.map(([, p]) => [p.id, { p: 0 }]),
					),
				});
				this.broadcast({ t: 'round', round, now });
				return 'lobby';
			}
			case 'prog': {
				if (!running || !mine || mine.time !== undefined) return false;
				mine.p = msg.p;
				this.broadcast({ t: 'prog', id: player.id, p: msg.p });
				return true;
			}
			case 'done': {
				if (!running || !mine || mine.time !== undefined || now < (round.startAt ?? now))
					return false;
				Object.assign(mine, {
					p: msg.ok ? 1 : mine.p,
					time: now - (round.startAt ?? now),
					ok: msg.ok,
					mistakes: msg.mistakes,
					score: msg.score,
				});
				this.broadcast({ t: 'done', id: player.id, r: mine });
				this.raceOver(round, players);
				return 'lobby';
			}
			default:
				return false;
		}
	}

	/** The round ends when every racer still here has finished. */
	private raceOver(round: Round, players: Record<string, Player>): void {
		if (round.over || round.startAt === null) return;
		const online = this.online();
		const here = new Set(
			Object.entries(players)
				.filter(([pid]) => online.has(pid))
				.map(([, p]) => p.id),
		);
		const waiting = Object.entries(round.results).some(
			([id, r]) => here.has(id) && r.time === undefined,
		);
		if (waiting) return;
		round.over = { winner: -1, why: 'race' };
		this.broadcast({ t: 'over', ...round.over });
	}

	// ── players ──────────────────────────────────────────────────────────────

	private async hello(ws: WebSocket, pid: string, nick: string): Promise<void> {
		const meta = await this.meta();
		const round = await this.round();
		if (!meta || !round) return;
		const players = await this.players();
		let player = players[pid];
		if (!player) {
			const count = Object.keys(players).length;
			const taken = new Set(Object.values(players).map((p) => p.seat));
			const seat = meta.kind === 'turn' ? ([0, 1].find((s) => !taken.has(s)) ?? null) : null;
			const full =
				meta.kind === 'turn'
					? seat === null
					: this.online().size >= MAX_RACERS || count >= MAX_RACERS * 4;
			if (full) {
				ws.send(JSON.stringify({ t: 'full' }));
				ws.close(4000, 'full');
				return;
			}
			player = {
				id: crypto.randomUUID().replace(/-/g, '').slice(0, 10),
				nick,
				seat,
				joinedAt: Date.now(),
				leftAt: null,
				lastChat: 0,
			};
			players[pid] = player;
		}
		const wasOnline = this.online().has(pid);
		player.nick = nick;
		player.leftAt = null;
		await this.ctx.storage.put('players', players);
		ws.serializeAttachment({ pid } satisfies Attachment);
		const chat = (await this.ctx.storage.get<ChatLine[]>('chat')) ?? [];
		ws.send(
			JSON.stringify({
				t: 'welcome',
				you: player.id,
				seat: player.seat,
				meta,
				round,
				players: this.publicPlayers(players),
				chat,
				now: Date.now(),
			}),
		);
		this.broadcast({ t: 'players', players: this.publicPlayers(players) }, ws);
		if (!wasOnline) await this.say({ nick, text: 'join', at: Date.now(), sys: true }, ws);
		await this.syncLobby();
	}

	private async leave(ws: WebSocket): Promise<void> {
		const me = ws.deserializeAttachment() as Attachment | null;
		try {
			ws.close(1000, 'bye');
		} catch {
			// already closed
		}
		if (!this.ctx.getWebSockets().some((s) => s !== ws && s.readyState === WebSocket.OPEN)) {
			await this.ctx.storage.setAlarm(Date.now() + EXPIRE_AFTER);
		}
		if (!me?.pid || this.online(ws).has(me.pid)) return;
		const players = await this.players();
		const player = players[me.pid];
		if (!player) return;
		player.leftAt = Date.now();
		await this.ctx.storage.put('players', players);
		this.broadcast({ t: 'players', players: this.publicPlayers(players, ws) }, ws);
		await this.say({ nick: player.nick, text: 'leave', at: Date.now(), sys: true }, ws);
		const round = await this.round();
		const meta = await this.meta();
		if (round && meta?.kind === 'race') {
			const before = round.over;
			this.raceOver(round, players);
			if (round.over !== before) await this.ctx.storage.put('round', round);
		}
		await this.syncLobby(ws);
	}

	/** Private ids of players with an open socket. */
	private online(except?: WebSocket): Set<string> {
		const ids = new Set<string>();
		for (const ws of this.ctx.getWebSockets()) {
			if (ws === except || ws.readyState !== WebSocket.OPEN) continue;
			const a = ws.deserializeAttachment() as Attachment | null;
			if (a?.pid) ids.add(a.pid);
		}
		return ids;
	}

	/** Races: the earliest-joined player still here starts the rounds. */
	private hostId(players: Record<string, Player>, except?: WebSocket): string | null {
		const online = this.online(except);
		return (
			Object.entries(players)
				.filter(([pid]) => online.has(pid))
				.sort(([, a], [, b]) => a.joinedAt - b.joinedAt)[0]?.[1].id ?? null
		);
	}

	private publicPlayers(players: Record<string, Player>, except?: WebSocket) {
		const online = this.online(except);
		const host = this.hostId(players, except);
		return Object.entries(players)
			.sort(([, a], [, b]) => a.joinedAt - b.joinedAt)
			.map(([pid, p]) => ({
				id: p.id,
				nick: p.nick,
				seat: p.seat,
				online: online.has(pid),
				host: p.id === host,
			}));
	}

	// ── helpers ──────────────────────────────────────────────────────────────

	private meta = () => this.ctx.storage.get<RoomMeta>('meta');
	private round = () => this.ctx.storage.get<Round>('round');
	private players = async () =>
		(await this.ctx.storage.get<Record<string, Player>>('players')) ?? {};
	private lobby = () => this.env.DUEL_LOBBY.get(this.env.DUEL_LOBBY.idFromName('lobby'));

	private broadcast(message: unknown, except?: WebSocket): void {
		const text = JSON.stringify(message);
		for (const ws of this.ctx.getWebSockets()) {
			if (ws === except || ws.readyState !== WebSocket.OPEN) continue;
			if (!(ws.deserializeAttachment() as Attachment | null)?.pid) continue;
			try {
				ws.send(text);
			} catch {
				// closing socket - its close event cleans up
			}
		}
	}

	private async say(line: ChatLine, except?: WebSocket): Promise<void> {
		const chat = (await this.ctx.storage.get<ChatLine[]>('chat')) ?? [];
		chat.push(line);
		await this.ctx.storage.put('chat', chat.slice(-CHAT_HISTORY));
		this.broadcast({ t: 'chat', ...line }, except);
	}

	/** Lists the room in the lobby while somebody can still join it. */
	private async syncLobby(except?: WebSocket): Promise<void> {
		const meta = await this.meta();
		const round = await this.round();
		if (!meta || !round) return;
		const players = await this.players();
		const online = this.online(except);
		const here = Object.entries(players).filter(([pid]) => online.has(pid));
		const joinable =
			meta.kind === 'turn'
				? Object.keys(players).length < 2
				: round.startAt === null || round.over !== null;
		if (!meta.open || !here.length || !joinable || here.length >= MAX_RACERS) {
			await this.lobby().remove(meta.code);
			return;
		}
		await this.lobby().update({
			code: meta.code,
			game: meta.game,
			kind: meta.kind,
			diff: round.diff,
			host: here.sort(([, a], [, b]) => a.joinedAt - b.joinedAt)[0]?.[1].nick ?? meta.host,
			players: here.length,
			max: meta.kind === 'turn' ? 2 : MAX_RACERS,
		});
	}
}

export interface LobbyRoom {
	code: string;
	game: string;
	kind: string;
	diff: string;
	host: string;
	players: number;
	max: number;
	updated: number;
}

/** Open online games waiting for players, for every puzzle. */
export class DuelLobby extends DurableObject<DuelEnv> {
	async update(room: Omit<LobbyRoom, 'updated'>): Promise<void> {
		const rooms = (await this.ctx.storage.get<Record<string, LobbyRoom>>('rooms')) ?? {};
		rooms[room.code] = { ...room, updated: Date.now() };
		await this.ctx.storage.put('rooms', rooms);
	}

	async remove(code: string): Promise<void> {
		const rooms = (await this.ctx.storage.get<Record<string, LobbyRoom>>('rooms')) ?? {};
		if (!rooms[code]) return;
		await this.ctx.storage.put(
			'rooms',
			Object.fromEntries(Object.entries(rooms).filter(([c]) => c !== code)),
		);
	}

	async list(game: string): Promise<LobbyRoom[]> {
		const rooms = (await this.ctx.storage.get<Record<string, LobbyRoom>>('rooms')) ?? {};
		// A room that vanished without saying goodbye drops out after a while.
		const fresh = Date.now() - 3 * 3600_000;
		const live = Object.values(rooms).filter((r) => r.updated > fresh);
		if (live.length < Object.keys(rooms).length)
			await this.ctx.storage.put('rooms', Object.fromEntries(live.map((r) => [r.code, r])));
		return live
			.filter((r) => r.game === game)
			.sort((a, b) => b.updated - a.updated)
			.slice(0, 30);
	}
}
