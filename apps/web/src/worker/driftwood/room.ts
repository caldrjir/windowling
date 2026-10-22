/**
 * One DRIFTWOOD world shared by up to MAX_PLAYERS players: a Durable Object with
 * hibernatable WebSockets. It relays positions and chat, and keeps what makes the world
 * the same for everybody (seed, mode, clock, harvested nodes, structures, recent chat) in
 * its storage, so a world can be re-joined later by its code.
 */
import { DurableObject } from 'cloudflare:workers';
import {
	CHAT_HISTORY,
	MAX_PLAYERS,
	MAX_STRUCTURES,
	parseClientMessage,
	type Look,
	type PlayerState,
	type RoomMeta,
	type Structure,
} from './protocol';

export interface DriftwoodEnv {
	DRIFTWOOD_ROOM: DurableObjectNamespace<DriftwoodRoom>;
	DRIFTWOOD_LOBBY: DurableObjectNamespace<DriftwoodLobby>;
}

interface Attachment {
	id: string;
	nick: string;
	look: Look | null;
	state: PlayerState | null;
	joinedAt: number;
	lastChat: number;
}
interface ChatLine {
	nick: string;
	text: string;
	at: number;
	sys?: boolean;
}
interface Clock {
	hour: number;
	day: number;
}

export class DriftwoodRoom extends DurableObject<DriftwoodEnv> {
	/** Creates the world once; false when the code is already taken. */
	async create(meta: RoomMeta): Promise<boolean> {
		if (await this.ctx.storage.get('meta')) return false;
		await this.ctx.storage.put({ meta, clock: { hour: 8, day: 1 } satisfies Clock });
		return true;
	}

	async info(): Promise<(RoomMeta & { players: number }) | null> {
		const meta = await this.ctx.storage.get<RoomMeta>('meta');
		return meta ? { ...meta, players: this.joined().length } : null;
	}

	override async fetch(request: Request): Promise<Response> {
		if (request.headers.get('upgrade') !== 'websocket') {
			return new Response('Expected a WebSocket', { status: 426 });
		}
		if (!(await this.ctx.storage.get('meta')))
			return new Response('No such world', { status: 404 });
		if (this.ctx.getWebSockets().length >= MAX_PLAYERS) {
			return new Response('The world is full', { status: 503 });
		}
		const { 0: client, 1: server } = new WebSocketPair();
		this.ctx.acceptWebSocket(server);
		server.serializeAttachment({
			id: crypto.randomUUID().slice(0, 8),
			nick: '',
			look: null,
			state: null,
			joinedAt: 0,
			lastChat: 0,
		} satisfies Attachment);
		return new Response(null, { status: 101, webSocket: client });
	}

	override async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
		const msg = parseClientMessage(typeof raw === 'string' ? raw : null);
		if (!msg) return;
		const me = ws.deserializeAttachment() as Attachment;
		if (msg.t === 'hello') {
			const first = !me.joinedAt;
			Object.assign(me, { nick: msg.nick, look: msg.look, joinedAt: me.joinedAt || Date.now() });
			ws.serializeAttachment(me);
			if (first) await this.welcome(ws, me);
			return;
		}
		if (!me.joinedAt) return;
		switch (msg.t) {
			case 's': {
				const { t: _t, ...state } = msg;
				me.state = state;
				ws.serializeAttachment(me);
				this.broadcast({ t: 's', id: me.id, ...state }, ws);
				break;
			}
			case 'chat': {
				const now = Date.now();
				if (now - me.lastChat < 400) return;
				me.lastChat = now;
				ws.serializeAttachment(me);
				await this.say({ nick: me.nick, text: msg.text, at: now });
				break;
			}
			case 'node': {
				const stored = (await this.ctx.storage.get<Record<string, number>>('nodes')) ?? {};
				const now = Date.now();
				// Drop nodes that have grown back, then add this one.
				const nodes = Object.fromEntries(
					Object.entries(stored).filter(([, until]) => until >= now),
				);
				nodes[`${msg.k}:${msg.i}`] = now + msg.r * 1000;
				await this.ctx.storage.put('nodes', nodes);
				this.broadcast({ ...msg, by: me.id }, ws);
				break;
			}
			case 'build': {
				const list = (await this.ctx.storage.get<Structure[]>('structures')) ?? [];
				if (list.length >= MAX_STRUCTURES) return;
				const { t: _t, ...s } = msg;
				list.push(s);
				await this.ctx.storage.put('structures', list);
				this.broadcast({ ...msg, by: me.id }, ws);
				break;
			}
			case 'time': {
				await this.ctx.storage.put('clock', { hour: msg.hour, day: msg.day } satisfies Clock);
				this.broadcast(msg, ws);
				break;
			}
		}
	}

	override async webSocketClose(ws: WebSocket): Promise<void> {
		await this.leave(ws);
	}
	override async webSocketError(ws: WebSocket): Promise<void> {
		await this.leave(ws);
	}

	// ── helpers ───────────────────────────────────────────────────────────────

	private joined(except?: WebSocket): { ws: WebSocket; a: Attachment }[] {
		return this.ctx
			.getWebSockets()
			.filter((ws) => ws !== except && ws.readyState === WebSocket.OPEN)
			.map((ws) => ({ ws, a: ws.deserializeAttachment() as Attachment }))
			.filter(({ a }) => a.joinedAt > 0)
			.sort((x, y) => x.a.joinedAt - y.a.joinedAt);
	}

	private broadcast(message: unknown, except?: WebSocket): void {
		const text = JSON.stringify(message);
		for (const { ws } of this.joined(except)) {
			try {
				ws.send(text);
			} catch {
				// closing socket - its close event cleans up
			}
		}
	}

	/** The longest-connected player keeps the clock for everybody. */
	private hostId(except?: WebSocket): string | null {
		return this.joined(except)[0]?.a.id ?? null;
	}

	private async welcome(ws: WebSocket, me: Attachment): Promise<void> {
		const s = this.ctx.storage;
		const [meta, clock, nodes, structures, chat] = await Promise.all([
			s.get<RoomMeta>('meta'),
			s.get<Clock>('clock'),
			s.get<Record<string, number>>('nodes'),
			s.get<Structure[]>('structures'),
			s.get<ChatLine[]>('chat'),
		]);
		const now = Date.now();
		const others = this.joined(ws).map(({ a }) => ({
			id: a.id,
			nick: a.nick,
			look: a.look,
			state: a.state,
		}));
		ws.send(
			JSON.stringify({
				t: 'welcome',
				you: me.id,
				host: this.hostId() === me.id,
				meta,
				clock,
				// Remaining respawn time in seconds for every harvested node.
				nodes: Object.entries(nodes ?? {})
					.filter(([, until]) => until > now)
					.map(([key, until]) => [key, Math.round((until - now) / 1000)]),
				structures: structures ?? [],
				chat: chat ?? [],
				players: others,
			}),
		);
		this.broadcast({ t: 'join', id: me.id, nick: me.nick, look: me.look }, ws);
		await this.say({ nick: me.nick, text: 'join', at: now, sys: true });
		await this.syncLobby();
	}

	private async leave(ws: WebSocket): Promise<void> {
		const me = ws.deserializeAttachment() as Attachment | null;
		try {
			ws.close(1000, 'bye');
		} catch {
			// already closed
		}
		if (!me?.joinedAt) return;
		this.broadcast({ t: 'leave', id: me.id, host: this.hostId(ws) }, ws);
		await this.say({ nick: me.nick, text: 'leave', at: Date.now(), sys: true }, ws);
		await this.syncLobby(ws);
	}

	private async say(line: ChatLine, except?: WebSocket): Promise<void> {
		const chat = (await this.ctx.storage.get<ChatLine[]>('chat')) ?? [];
		chat.push(line);
		await this.ctx.storage.put('chat', chat.slice(-CHAT_HISTORY));
		this.broadcast({ t: 'chat', ...line }, except);
	}

	private async syncLobby(except?: WebSocket): Promise<void> {
		const meta = await this.ctx.storage.get<RoomMeta>('meta');
		if (!meta) return;
		const players = this.joined(except).map(({ a }) => a.nick);
		const lobby = this.env.DRIFTWOOD_LOBBY.get(this.env.DRIFTWOOD_LOBBY.idFromName('lobby'));
		await lobby.update({ code: meta.code, name: meta.name, mode: meta.mode, players });
	}
}

export interface LobbyRoom {
	code: string;
	name: string;
	mode: string;
	players: string[];
	updated: number;
}

/** The list of worlds that somebody is playing in right now. */
export class DriftwoodLobby extends DurableObject<DriftwoodEnv> {
	async update(room: Omit<LobbyRoom, 'updated'>): Promise<void> {
		const stored = (await this.ctx.storage.get<Record<string, LobbyRoom>>('rooms')) ?? {};
		const rooms = Object.fromEntries(Object.entries(stored).filter(([code]) => code !== room.code));
		if (room.players.length) rooms[room.code] = { ...room, updated: Date.now() };
		await this.ctx.storage.put('rooms', rooms);
	}

	async list(): Promise<LobbyRoom[]> {
		const rooms = (await this.ctx.storage.get<Record<string, LobbyRoom>>('rooms')) ?? {};
		// A room that vanished without saying goodbye drops out after a while.
		const fresh = Date.now() - 6 * 3600_000;
		return Object.values(rooms)
			.filter((r) => r.updated > fresh)
			.sort((a, b) => b.players.length - a.players.length || b.updated - a.updated);
	}
}
