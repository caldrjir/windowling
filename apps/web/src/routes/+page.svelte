<script lang="ts">
	import '$lib/hub/hub.css';
	import { invalidateAll } from '$app/navigation';
	import { authClient } from '$lib/auth-client';
	import { GAMES, GROUPS, groupOf, type Game, type GameTexts } from '$lib/games/registry';
	import { onMount } from 'svelte';

	let { data } = $props();

	type Lang = 'cs' | 'en';
	interface Stats {
		playTime?: number;
		lastPlayed?: number;
		progress?: number;
		stats?: Record<string, number | string>;
		lines?: [string, string][];
	}

	// The language is shared with the games through localStorage.
	const LANG_KEY = 'gamecenter.lang';
	// Shelves: each group lists its games (global index for selection) and free slots.
	const shelves = GROUPS.map((grp) => {
		const games = GAMES.map((g, i) => ({ g, i })).filter(({ g }) => groupOf(g) === grp.id);
		return { ...grp, games, free: Math.max(0, grp.slots - games.length) };
	});

	let lang = $state<Lang>('cs');
	let sel = $state(0);
	let now = $state(new Date());
	let launching = $state<Game | null>(null);
	// Stats live in the player's browser (written by the games); read after mount.
	let saved = $state<Record<string, Stats | null>>({});
	let signingIn = $state(false);
	// Cloud saves (static/games/sync.js) and the nickname chosen after the first sign-in.
	interface SyncApi {
		sync: () => Promise<{ state: string }>;
		readonly state: string;
		readonly lastSync: number;
	}
	const gcSync = () => (window as unknown as { GCSync?: SyncApi }).GCSync;
	let syncState = $state('');
	let syncedAt = $state(0);
	let nickOpen = $state(false);
	let nickInput = $state('');
	let nickError = $state('');
	let nickBusy = $state(false);
	// Phones and tablets (no hover, coarse pointer) cannot play mouse + keyboard games.
	let touchOnly = $state(false);
	const blocked = (g: Game) => Boolean(g.desktopOnly) && touchOnly;
	const onlineText = (kind: NonNullable<Game['online']>) =>
		({
			turn: L('Online partie s živým soupeřem', 'Live online games'),
			race: L('Online závody na stejném zadání', 'Online races on the same puzzle'),
			world: L('Společné světy pro více hráčů', 'Shared multiplayer worlds'),
		})[kind];
	// Who is playing what right now (heartbeats from static/games/presence.js).
	interface Live {
		signedIn: number;
		anonymous: number;
	}
	let live = $state<Record<string, Live>>({});

	const L = (cs: string, en: string) => (lang === 'en' ? en : cs);
	const locale = $derived(lang === 'en' ? 'en-US' : 'cs-CZ');
	const tx = <K extends keyof GameTexts>(g: Game, k: K): GameTexts[K] =>
		(lang === 'en' && g.en[k]) || g[k];

	const game = $derived(GAMES[sel]);
	const playing = (id: string) => (live[id]?.signedIn ?? 0) + (live[id]?.anonymous ?? 0);
	function liveText(id: string): string {
		const l = live[id];
		if (!l || !playing(id)) return L('Teď nikdo nehraje', 'Nobody is playing right now');
		const parts: string[] = [];
		if (l.signedIn)
			parts.push(
				L(`${l.signedIn} přihlášen${l.signedIn === 1 ? 'ý' : 'í'}`, `${l.signedIn} signed in`),
			);
		if (l.anonymous) parts.push(L(`${l.anonymous} anonymní`, `${l.anonymous} anonymous`));
		return `${L('Právě hraje', 'Playing now')}: ${parts.join(' · ')}`;
	}
	async function refreshLive() {
		try {
			const res = await fetch('/api/presence', { cache: 'no-store' });
			if (res.ok) live = ((await res.json()) as { games: Record<string, Live> }).games;
		} catch {
			// Offline or locked: keep the last numbers.
		}
	}
	const stats = $derived(game ? saved[game.id] : null);

	// --- Leaderboards (/api/scores): the selected game's record board or play time ----------
	interface Board {
		entries: { rank: number; nickname: string; value: number; me: boolean }[];
		me: { rank: number; value: number } | null;
		total: number;
		signedIn: boolean;
	}
	let lbTab = $state<'record' | 'played'>('record');
	let lb = $state<Board | null>(null);
	const today = () => {
		const d = new Date();
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	};
	const recordOf = (g: Game) =>
		g.record ??
		(groupOf(g) === 'puzzle'
			? {
					board: `daily:${today()}:time`,
					label: ['Dnešní výzva', "Today's puzzle"] as [string, string],
				}
			: null);
	function fmtScore(board: string, v: number): string {
		const unit = board.split(':').pop();
		if (unit === 'time') {
			const s = v / 1000;
			return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}.${Math.floor((s * 10) % 10)}`;
		}
		if (unit === 'survive') {
			const s = Math.floor(v / 1000);
			return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
		}
		if (unit === 'played') return fmtDur(v);
		if (unit === 'days') return L(`${v} dní`, `${v} days`);
		if (unit === 'floor') return L(`${v}. patro`, `floor ${v}`);
		return v.toLocaleString(locale);
	}
	const lbBoard = $derived.by(() => {
		if (!game) return null;
		const rec = recordOf(game);
		return lbTab === 'record' && rec ? rec.board : 'total:played';
	});
	let lbTimer = 0;
	$effect(() => {
		const g = game;
		const board = lbBoard;
		if (!g || !board) return;
		clearTimeout(lbTimer);
		lbTimer = window.setTimeout(async () => {
			try {
				const res = await fetch(
					`/api/scores?game=${g.id}&board=${encodeURIComponent(board)}&limit=5`,
					{
						cache: 'no-store',
					},
				);
				if (res.ok && game === g && lbBoard === board) lb = (await res.json()) as Board;
			} catch {
				// offline: keep the last board
			}
		}, 250);
	});

	function readStats(g: Game): Stats | null {
		try {
			return JSON.parse(localStorage.getItem(g.statsKey) ?? 'null') as Stats | null;
		} catch {
			return null;
		}
	}

	// --- Formatting ---------------------------------------------------------------
	function fmtDur(seconds = 0): string {
		const s = Math.floor(seconds);
		const h = Math.floor(s / 3600);
		const m = Math.floor((s % 3600) / 60);
		return h ? `${h} h ${m} min` : `${m} min`;
	}
	function ago(ts?: number): string | null {
		if (!ts) return null;
		const d = (Date.now() - ts) / 1000;
		if (d < 60) return L('právě teď', 'just now');
		if (d < 3600) return L(`před ${Math.floor(d / 60)} min`, `${Math.floor(d / 60)} min ago`);
		if (d < 86400) return L(`před ${Math.floor(d / 3600)} h`, `${Math.floor(d / 3600)} h ago`);
		if (d < 172800) return L('včera', 'yesterday');
		return L(`před ${Math.floor(d / 86400)} dny`, `${Math.floor(d / 86400)} days ago`);
	}
	/** Stat rows: `{ stats }` labelled from the catalogue, or the older `{ lines }`. */
	function statLines(g: Game, s: Stats): [string, string][] {
		if (s.stats) {
			const values = s.stats;
			return Object.entries(g.statLabels)
				.filter(([k]) => values[k] !== undefined)
				.map(([k, [cs, en]]) => {
					const v = values[k];
					return [L(cs, en), typeof v === 'number' ? v.toLocaleString(locale) : String(v)];
				});
		}
		return s.lines ?? [];
	}
	const greet = $derived.by(() => {
		const h = now.getHours();
		if (h < 5) return L('Dobrou noc', 'Good night');
		if (h < 10) return L('Dobré ráno', 'Good morning');
		if (h < 12) return L('Dobré dopoledne', 'Good morning');
		if (h < 18) return L('Dobré odpoledne', 'Good afternoon');
		return L('Dobrý večer', 'Good evening');
	});
	const totalTime = $derived(GAMES.reduce((t, g) => t + (saved[g.id]?.playTime ?? 0), 0));
	function shelfCount(n: number, free: number): string {
		const games = L(
			`${n} ${n === 1 ? 'hra' : n < 5 ? 'hry' : 'her'}`,
			`${n} ${n === 1 ? 'game' : 'games'}`,
		);
		if (!free) return games;
		return L(
			`${games} · ${free} ${free === 1 ? 'volný slot' : free < 5 ? 'volné sloty' : 'volných slotů'}`,
			`${games} · ${free} free ${free === 1 ? 'slot' : 'slots'}`,
		);
	}

	// --- Interface sounds -----------------------------------------------------------
	let ac: AudioContext | null = null;
	function blip(f: number, d = 0.06, v = 0.04, type: OscillatorType = 'sine') {
		try {
			ac ??= new AudioContext();
			const o = ac.createOscillator();
			const g = ac.createGain();
			o.type = type;
			o.frequency.value = f;
			g.gain.setValueAtTime(v, ac.currentTime);
			g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + d);
			o.connect(g);
			g.connect(ac.destination);
			o.start();
			o.stop(ac.currentTime + d + 0.02);
		} catch {
			// No sound - fine.
		}
	}

	// --- Actions ------------------------------------------------------------------------
	function select(i: number, sound = true) {
		if (i === sel || !GAMES[i]) return;
		sel = i;
		if (sound) blip(880, 0.07, 0.04, 'triangle');
	}
	function launch(g: Game) {
		if (blocked(g)) return;
		blip(220, 0.5, 0.06, 'sawtooth');
		blip(660, 0.4, 0.04, 'triangle');
		launching = g;
		setTimeout(() => (location.href = g.path), 750);
	}
	function setLang(next: Lang) {
		if (next === lang) return;
		lang = next;
		try {
			localStorage.setItem(LANG_KEY, next);
		} catch {
			// No storage - the choice lasts this visit.
		}
		blip(1200, 0.06, 0.03, 'triangle');
	}
	function onCard(i: number) {
		const g = GAMES[i];
		if (!g) return;
		if (i === sel) launch(g);
		else select(i);
	}
	function onKey(e: KeyboardEvent) {
		if (e.key === 'ArrowRight') select(Math.min(GAMES.length - 1, sel + 1));
		else if (e.key === 'ArrowLeft') select(Math.max(0, sel - 1));
		else if (e.key === 'Enter' && game && !(e.target instanceof HTMLButtonElement)) launch(game);
	}
	async function signIn() {
		signingIn = true;
		const { error } = await authClient.signIn.social({ provider: 'google', callbackURL: '/' });
		if (error) {
			console.error('Google sign-in failed', error);
			signingIn = false;
		}
	}
	function loadSaved() {
		const loaded: Record<string, Stats | null> = {};
		let best = 0;
		GAMES.forEach((g, i) => {
			const s = readStats(g);
			loaded[g.id] = s;
			// The last game played is selected.
			if (s?.lastPlayed && s.lastPlayed > best) {
				best = s.lastPlayed;
				sel = i;
			}
		});
		saved = loaded;
	}
	function openNick() {
		const suggestion = (data.user?.nickname ?? data.user?.name ?? '').split(' ')[0] ?? '';
		nickInput = suggestion.slice(0, 20);
		nickError = '';
		nickOpen = true;
	}
	async function saveNick(e: SubmitEvent) {
		e.preventDefault();
		nickBusy = true;
		nickError = '';
		try {
			const res = await fetch('/api/profile', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ nickname: nickInput }),
			});
			if (res.status === 409)
				nickError = L('Tuhle přezdívku už někdo má.', 'Somebody already has this nickname.');
			else if (!res.ok)
				nickError = L(
					'3–20 znaků: písmena, číslice, mezera, tečka, pomlčka.',
					'3–20 characters: letters, digits, space, dot, dash.',
				);
			else {
				nickOpen = false;
				await invalidateAll();
			}
		} catch {
			nickError = L('Nepodařilo se uložit, zkus to znovu.', 'Could not save, try again.');
		} finally {
			nickBusy = false;
		}
	}
	// The account nickname is the player's name in the games too (online puzzles, DRIFTWOOD).
	$effect(() => {
		const nick = data.user?.nickname;
		if (!nick) return;
		try {
			const meta = JSON.parse(localStorage.getItem('gamecenter.puzzles') ?? '{}') as Record<
				string,
				unknown
			>;
			if (meta.nick !== nick)
				localStorage.setItem('gamecenter.puzzles', JSON.stringify({ ...meta, nick }));
			if (localStorage.getItem('driftwood.nick') !== nick)
				localStorage.setItem('driftwood.nick', nick);
		} catch {
			// no storage
		}
	});
	async function signOut() {
		await authClient.signOut();
		await invalidateAll();
	}

	// --- Hero text re-animates when the game changes ----------------------------------
	let heroInfo = $state<HTMLElement>();
	$effect(() => {
		void sel;
		void lang;
		if (!heroInfo) return;
		heroInfo.style.animation = 'none';
		void heroInfo.offsetWidth;
		heroInfo.style.animation = '';
	});

	// The center takes on the selected game's colours.
	$effect(() => {
		const g = GAMES[sel];
		if (!g) return;
		const r = document.documentElement.style;
		r.setProperty('--a', g.colors[0]);
		r.setProperty('--b', g.colors[1]);
		r.setProperty('--c', g.colors[2]);
	});
	$effect(() => {
		document.documentElement.lang = lang;
	});

	// --- Animation: background aurora, hero cover, cards --------------------------------
	let bg: HTMLCanvasElement;
	let heroCover: HTMLCanvasElement;
	const cardCanvases: HTMLCanvasElement[] = $state([]);

	onMount(() => {
		try {
			const s = localStorage.getItem(LANG_KEY);
			if (s === 'cs' || s === 'en') lang = s;
			else lang = /^(cs|sk)/i.test(navigator.language) ? 'cs' : 'en';
		} catch {
			lang = /^(cs|sk)/i.test(navigator.language) ? 'cs' : 'en';
		}
		loadSaved();
		// Progress pulled from the account (other devices) shows up right away.
		const onSync = (e: Event) => {
			const detail = (e as CustomEvent<{ state: string }>).detail;
			syncState = detail.state;
			syncedAt = Date.now();
			loadSaved();
			try {
				const l = localStorage.getItem(LANG_KEY);
				if (l === 'cs' || l === 'en') lang = l;
			} catch {
				// no storage
			}
		};
		addEventListener('gamecenter:sync', onSync);
		const api = gcSync();
		if (api && api.state !== 'unknown') {
			syncState = api.state;
			syncedAt = api.lastSync;
		}
		if (data.user && !data.user.nickname) openNick();

		const DPR = Math.min(window.devicePixelRatio || 1, 2);
		const bctx = bg.getContext('2d');
		const hctx = heroCover.getContext('2d');
		const resize = () => {
			bg.width = innerWidth * 0.5;
			bg.height = innerHeight * 0.5;
			const r = heroCover.getBoundingClientRect();
			heroCover.width = Math.max(1, r.width * DPR);
			heroCover.height = Math.max(1, r.height * DPR);
			for (const cv of cardCanvases) {
				if (!cv) continue;
				const b = cv.getBoundingClientRect();
				cv.width = Math.max(1, b.width * DPR);
				cv.height = Math.max(1, b.height * DPR);
			}
		};
		const hexRgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
		let cur = [
			[255, 79, 216],
			[85, 246, 255],
			[122, 44, 255],
		];
		let raf = 0;
		const frame = (ms: number) => {
			raf = requestAnimationFrame(frame);
			const t = ms / 1000;
			const g = GAMES[sel];
			if (g) {
				const target = g.colors.map(hexRgb);
				cur = cur.map((c, i) =>
					c.map((v, j) => v + (((target[i] ?? target[0] ?? c)[j] ?? v) - v) * 0.03),
				);
			}
			if (bctx) {
				const w = bg.width;
				const h = bg.height;
				bctx.globalCompositeOperation = 'source-over';
				bctx.fillStyle = '#07051a';
				bctx.fillRect(0, 0, w, h);
				bctx.globalCompositeOperation = 'lighter';
				for (let i = 0; i < 4; i++) {
					const c = cur[i % 3];
					const x = w * (0.5 + 0.42 * Math.sin(t * 0.07 * (i + 1) + i * 2));
					const y = h * (0.5 + 0.4 * Math.cos(t * 0.05 * (i + 2) + i));
					const r = Math.max(w, h) * (0.35 + 0.1 * Math.sin(t * 0.2 + i));
					const gr = bctx.createRadialGradient(x, y, 0, x, y, r);
					gr.addColorStop(0, `rgba(${(c ?? [0, 0, 0]).map(Math.round).join(',')},0.16)`);
					gr.addColorStop(1, 'rgba(0,0,0,0)');
					bctx.fillStyle = gr;
					bctx.fillRect(0, 0, w, h);
				}
			}
			if (g && hctx) {
				hctx.setTransform(1, 0, 0, 1, 0, 0);
				g.cover(hctx, heroCover.width, heroCover.height, t);
			}
			cardCanvases.forEach((cv, i) => {
				// Only cards on screen are repainted.
				if (!cv || (drawn.has(cv) && !visible.has(cv))) return;
				drawn.add(cv);
				const ctx = cv.getContext('2d');
				const cardGame = GAMES[i];
				if (!ctx || !cardGame) return;
				ctx.setTransform(1, 0, 0, 1, 0, 0);
				cardGame.cover(ctx, cv.width, cv.height, t + 3);
			});
		};
		const visible = new WeakSet<Element>();
		const drawn = new WeakSet<Element>();
		const io = new IntersectionObserver((entries) => {
			for (const e of entries) {
				if (e.isIntersecting) visible.add(e.target);
				else visible.delete(e.target);
			}
		});
		for (const cv of cardCanvases) if (cv) io.observe(cv);
		resize();
		raf = requestAnimationFrame(frame);
		const clock = setInterval(() => (now = new Date()), 10_000);
		touchOnly = matchMedia('(hover: none) and (pointer: coarse)').matches;
		void refreshLive();
		const liveTimer = setInterval(() => {
			if (!document.hidden) void refreshLive();
		}, 15_000);
		const onPageShow = () => (launching = null);
		addEventListener('resize', resize);
		addEventListener('pageshow', onPageShow);
		return () => {
			cancelAnimationFrame(raf);
			io.disconnect();
			clearInterval(clock);
			clearInterval(liveTimer);
			removeEventListener('resize', resize);
			removeEventListener('pageshow', onPageShow);
		};
	});
</script>

<svelte:head>
	<title>Windowling Game Center</title>
</svelte:head>

<svelte:window onkeydown={onKey} />

<canvas id="bg" bind:this={bg}></canvas>
<div class="grain"></div>

<header class="top">
	<div class="brand">
		<svg viewBox="0 0 32 32" class="brand-mark" aria-hidden="true"
			><path
				d="M16 2l12 7v14l-12 7-12-7V9z"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
			/><path d="M16 9l6 3.5v7L16 23l-6-3.5v-7z" fill="currentColor" opacity=".9" /></svg
		>
		<span>WINDOWLING</span><small>Game Center</small>
	</div>
	<nav class="tabs"><button class="on">{L('Knihovna', 'Library')}</button></nav>
	<div class="spacer"></div>
	<div class="lang" role="group" aria-label={L('Jazyk', 'Language')}>
		<button class:on={lang === 'cs'} onclick={() => setLang('cs')}>CS</button>
		<button class:on={lang === 'en'} onclick={() => setLang('en')}>EN</button>
	</div>
	<div class="account" data-testid="account">
		{#if data.user}
			{#if data.user.image}<img src={data.user.image} alt="" referrerpolicy="no-referrer" />{/if}
			<button class="nick" onclick={openNick} title={L('Změnit přezdívku', 'Change nickname')}
				><b>{data.user.nickname ?? data.user.name}</b></button
			>
			<span
				class="cloud"
				class:ok={syncState === 'synced'}
				class:bad={syncState === 'error'}
				data-testid="cloud"
				title={syncState === 'synced'
					? L(
							`Postup je uložen v účtu (${ago(syncedAt) ?? ''})`,
							`Progress saved to your account (${ago(syncedAt) ?? ''})`,
						)
					: syncState === 'error'
						? L(
								'Ukládání do účtu se nepovedlo, zkusím to znovu',
								'Could not save to your account, retrying',
							)
						: L('Ukládám postup do účtu…', 'Saving progress to your account…')}
				><svg viewBox="0 0 24 24"
					><path
						d="M7 18h10a4 4 0 0 0 .6-8A6 6 0 0 0 6 9.5 4.3 4.3 0 0 0 7 18z"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linejoin="round"
					/>{#if syncState === 'synced'}<path
							d="M9.5 13.5l2 2 3.5-4"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
						/>{/if}</svg
				></span
			>
			<button onclick={signOut}>{L('Odhlásit', 'Sign out')}</button>
		{:else if data.googleEnabled}
			<button
				class="google"
				onclick={signIn}
				disabled={signingIn}
				title={L(
					'Postup se uloží do účtu a půjde hrát dál na jiném zařízení',
					'Your progress is saved to your account and continues on other devices',
				)}>{L('Přihlásit přes Google', 'Sign in with Google')}</button
			>
		{/if}
	</div>
	<div class="clock">
		<span>{greet}</span><b
			>{now.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}</b
		><small
			>{now.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}</small
		>
	</div>
</header>

<main>
	<section class="hero">
		<div class="hero-art"><canvas bind:this={heroCover}></canvas></div>
		<div class="hero-info" bind:this={heroInfo}>
			{#if game}
				{@const last = stats ? ago(stats.lastPlayed) : null}
				{@const lines = stats ? statLines(game, stats) : []}
				{@const feats = tx(game, 'features')}
				<div class="eyebrow">
					<i></i>{stats
						? L('Pokračuj ve hře', 'Continue playing')
						: L('Novinka v knihovně', 'New in your library')}
				</div>
				<h1 class="hero-title">{game.title}</h1>
				<div class="tagline">{tx(game, 'tagline')}</div>
				<div class="chips">
					{#each tx(game, 'genres') as genre (genre)}<span>{genre}</span>{/each}
				</div>
				<div class="live" class:on={playing(game.id) > 0} data-testid="live">
					<i></i>{liveText(game.id)}
				</div>
				<p class="desc">{tx(game, 'description')}</p>
				{#if feats}
					<div class="feats">
						{#each feats as f (f)}<span>{f}</span>{/each}
					</div>
				{/if}
				<div class="actions">
					{#if blocked(game)}
						<button class="play" data-testid="play" disabled
							>{L('JEN NA POČÍTAČI', 'DESKTOP ONLY')}</button
						>
					{:else}
						<button class="play" data-testid="play" onclick={() => launch(game)}
							><svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5l13 7.5-13 7.5z" /></svg
							>{stats ? L('POKRAČOVAT', 'CONTINUE') : L('HRÁT', 'PLAY')}</button
						>
					{/if}
					<div class="last">
						{#if blocked(game)}
							{L(
								'Tahle hra potřebuje myš a klávesnici — spusť ji na počítači.',
								'This game needs a mouse and keyboard — play it on a computer.',
							)}
						{:else if last && stats}
							{L('Naposledy', 'Last played')} <b>{last}</b> · {L('odehráno', 'total')}
							<b>{fmtDur(stats.playTime)}</b>
						{:else}
							{L('Ještě jsi nehrál(a) — tak do toho.', "You haven't played yet — go for it.")}
						{/if}
					</div>
				</div>
				{#if lines.length}
					<div class="stats">
						{#each lines as [k, v] (k)}<div class="stat"><small>{k}</small><b>{v}</b></div>{/each}
					</div>
				{/if}
				<div class="lb" data-testid="leaderboard">
					<div class="lb-head">
						<svg viewBox="0 0 24 24"
							><path
								d="M3 20h18M9 20V9h6v11M3 20v-6h6M15 20v-4h6v4"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linejoin="round"
							/></svg
						>
						<span>{L('Žebříček', 'Leaderboard')}</span>
						{#if recordOf(game)}
							{@const rec = recordOf(game)}
							<button class:on={lbTab === 'record'} onclick={() => (lbTab = 'record')}
								>{rec ? L(rec.label[0], rec.label[1]) : ''}</button
							>
						{/if}
						<button
							class:on={lbTab === 'played' || !recordOf(game)}
							onclick={() => (lbTab = 'played')}>{L('Nejvíc nahráno', 'Most played')}</button
						>
					</div>
					{#if lb && lb.entries.length}
						<ol>
							{#each lb.entries as e (e.rank + e.nickname)}
								<li class:me={e.me}>
									<i>{e.rank}.</i><b>{e.nickname}</b><span>{fmtScore(lbBoard ?? '', e.value)}</span>
								</li>
							{/each}
						</ol>
						{#if lb.me && !lb.entries.some((e) => e.me)}
							<p class="lb-me">
								{L('Tvé místo', 'Your place')}: {lb.me.rank}. · {fmtScore(
									lbBoard ?? '',
									lb.me.value,
								)}
							</p>
						{/if}
					{:else}
						<p class="lb-empty">{L('Zatím tu nikdo není.', 'Nobody here yet.')}</p>
					{/if}
					{#if lb && !lb.signedIn}
						<p class="lb-empty">
							{L('Přihlas se a soupeř s ostatními.', 'Sign in to compete with others.')}
						</p>
					{/if}
				</div>
				{#if stats?.progress !== undefined}
					{@const pct = Math.round(stats.progress * 100)}
					<div class="prog">
						{L('Dokončeno', 'Completion')}
						<div class="bar"><i style:width="{pct}%"></i></div>
						<b>{pct}{L(' %', '%')}</b>
					</div>
				{/if}
			{:else}
				<div class="eyebrow"><i></i>{L('Knihovna je prázdná', 'The library is empty')}</div>
				<h1 class="hero-title">WINDOWLING</h1>
			{/if}
		</div>
	</section>

	{#each shelves as shelf, si (shelf.id)}
		<section class="library" data-group={shelf.id}>
			<div class="lib-head">
				<h2>{L(shelf.title[0], shelf.title[1])}</h2>
				<span>{shelfCount(shelf.games.length, shelf.free)}</span>
				<div class="spacer"></div>
				{#if si === 0}
					<span class="hint"
						><kbd>←</kbd><kbd>→</kbd>
						{L('výběr', 'select')} · <kbd>Enter</kbd>
						{L('spustit', 'launch')}</span
					>
				{/if}
			</div>
			<div class="shelf" data-testid={si === 0 ? 'shelf' : `shelf-${shelf.id}`}>
				{#each shelf.games as { g, i } (g.id)}
					{@const s = saved[g.id]}
					<button
						class="gcard"
						class:sel={i === sel}
						style:--ca={g.colors[0]}
						style:animation-delay="{i * 0.05}s"
						onclick={() => onCard(i)}
						onpointerenter={() => blip(1600, 0.03, 0.015)}
					>
						<canvas bind:this={cardCanvases[i]}></canvas>
						<span class="gc-tag">{s ? fmtDur(s.playTime) : L('NOVÉ', 'NEW')}</span>
						{#if playing(g.id)}
							<span class="gc-live" title={liveText(g.id)}><i></i>{playing(g.id)}</span>
						{/if}
						{#if g.desktopOnly || g.online}
							<span class="gc-badges">
								{#if g.desktopOnly}
									<span title={L('Jen na počítači', 'Desktop only')}>PC</span>
								{/if}
								{#if g.online}
									<span class="on" title={onlineText(g.online)}>ONLINE</span>
								{/if}
							</span>
						{/if}
						<div class="gc-info">
							<h3>{g.title}</h3>
							<p>{tx(g, 'genres').join(' · ')}</p>
						</div>
					</button>
				{/each}
				{#each { length: shelf.free } as _, k (k)}
					<div class="gcard soon" style:animation-delay="{(shelf.games.length + k) * 0.07}s">
						<div class="soon-in">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
								><path d="M12 2l9 5v10l-9 5-9-5V7z" /><path d="M12 8v5M12 16v.5" /></svg
							>
							<b>SLOT {String(shelf.games.length + k + 1).padStart(2, '0')}</b><small
								>{L('Připravujeme', 'Coming soon')}</small
							>
						</div>
					</div>
				{/each}
			</div>
		</section>
	{/each}
</main>

{#if nickOpen && data.user}
	<div class="nick-modal" role="dialog" aria-modal="true" aria-labelledby="nickTitle">
		<form class="nick-card" onsubmit={saveNick}>
			<span class="eyebrow">{L('Tvůj účet', 'Your account')}</span>
			<h2 id="nickTitle">
				{data.user.nickname
					? L('Změnit přezdívku', 'Change nickname')
					: L('Vyber si přezdívku', 'Pick a nickname')}
			</h2>
			<p>
				{L(
					'Pod přezdívkou tě uvidí ostatní hráči v online hrách a v DRIFTWOODu. Postup ve všech hrách se teď ukládá do účtu a pokračuje na každém zařízení, kde se přihlásíš.',
					'Other players see your nickname in online games and in DRIFTWOOD. Your progress in every game is now saved to your account and continues on any device you sign in on.',
				)}
			</p>
			<!-- svelte-ignore a11y_autofocus -->
			<input
				bind:value={nickInput}
				maxlength="20"
				autocomplete="nickname"
				autofocus
				data-testid="nick-input"
				aria-label={L('Přezdívka', 'Nickname')}
			/>
			{#if nickError}<small class="err">{nickError}</small>{/if}
			<div class="row">
				<button class="primary" disabled={nickBusy || nickInput.trim().length < 3}
					>{L('Uložit', 'Save')}</button
				>
				{#if data.user.nickname}
					<button type="button" onclick={() => (nickOpen = false)}>{L('Zrušit', 'Cancel')}</button>
				{/if}
			</div>
		</form>
	</div>
{/if}

<footer class="foot">
	<span>{L('Celkem odehráno', 'Total playtime')}: {fmtDur(totalTime)}</span><span
		>Windowling · v1.0</span
	>
</footer>
<div class="launch" class:on={launching !== null}>
	<div class="launch-inner">
		<div class="launch-ring"></div>
		<b>{launching?.title ?? ''}</b><small>{L('Spouštím…', 'Launching…')}</small>
	</div>
</div>
