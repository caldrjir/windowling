/**
 * Puzzle games (static/games/<id>/ on the shared puzzle kit in static/games/puzzle-kit).
 * Each one keeps the same browser contract as the other games; the kit writes
 * `gamecenter.stats.<id>` with solved puzzles, the daily streak, Path level and rank.
 */
import type { Game } from './registry';

const TAU = Math.PI * 2;

// VLAK cover art: a scene rendered from the game's art.js (static/games/vlak/cover), loaded once
let vlScene: HTMLImageElement | null = null;
function vlakCover(): HTMLImageElement | null {
	if (!vlScene && typeof Image !== 'undefined') {
		vlScene = new Image();
		vlScene.src = '/games/vlak/cover/scene.webp';
	}
	return vlScene;
}

// BOMBARĎÁK cover art: an arena scene rendered from the game's art.js (static/games/bombardak/cover)
let bbScene: HTMLImageElement | null = null;
function bombardakCover(): HTMLImageElement | null {
	if (!bbScene && typeof Image !== 'undefined') {
		bbScene = new Image();
		bbScene.src = '/games/bombardak/cover/scene.webp';
	}
	return bbScene;
}

// MRAKODRAP cover art: the game's sunset background and tower/floor images rendered from its
// art.js (static/games/mrakodrap), loaded once on the client
let mdImages: { bg: HTMLImageElement; tower: HTMLImageElement; floor: HTMLImageElement } | null =
	null;
function mrakodrapCover(): typeof mdImages {
	if (!mdImages && typeof Image !== 'undefined') {
		const load = (name: string): HTMLImageElement => {
			const i = new Image();
			i.src = `/games/mrakodrap/cover/${name}.webp`;
			return i;
		};
		mdImages = { bg: load('../bg/mesto-2'), tower: load('tower'), floor: load('floor') };
	}
	return mdImages;
}

// LETNÍ HRY cover: the game's outlined athlete (static/games/letni/art.js), x, y are the feet,
// s is pixels per metre; pose 'run' uses ph as the stride phase, 'hurdle' clears a hurdle
function coverAthlete(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	s: number,
	pose: 'run' | 'hurdle',
	ph: number,
	look: { shirt: string; skin: string; shorts: string; shoe: string },
): void {
	const OL = '#2b1712';
	let lean: number, legs: [number, number][], arms: [number, number][];
	if (pose === 'run') {
		const t1 = Math.sin(ph) * 0.95,
			k1 = Math.max(0, -Math.cos(ph)) * 1.7 + 0.15,
			k2 = Math.max(0, Math.cos(ph)) * 1.7 + 0.15;
		lean = 0.25;
		legs = [
			[t1, t1 - k1],
			[-t1, -t1 - k2],
		];
		arms = [
			[-t1 * 0.95, -t1 * 0.95 + 1.7],
			[t1 * 0.95, t1 * 0.95 + 1.7],
		];
	} else {
		lean = 0.55;
		legs = [
			[1.55, 1.55],
			[-1.3, -2.7],
		];
		arms = [
			[1.7, 1.9],
			[-0.9, 0.3],
		];
	}
	const at = (p: [number, number], a: number, l: number): [number, number] => [
		p[0] + Math.sin(a) * l,
		p[1] + Math.cos(a) * l,
	];
	const hip: [number, number] = [0, -0.95],
		up: [number, number] = [Math.sin(lean), -Math.cos(lean)],
		neck: [number, number] = [hip[0] + up[0] * 0.56, hip[1] + up[1] * 0.56],
		sh: [number, number] = [neck[0] - up[0] * 0.06, neck[1] - up[1] * 0.06];
	const limb = (from: [number, number], ang: [number, number], l1: number, l2: number) => {
		const k = at(from, ang[0], l1);
		return [k, at(k, ang[1], l2)] as const;
	};
	const lg = legs.map((a) => limb(hip, a, 0.46, 0.48)),
		am = arms.map((a) => limb(sh, a, 0.3, 0.28));
	let oy = 0;
	if (pose === 'run') {
		const f0 = lg[0]?.[1][1] ?? 0,
			f1 = lg[1]?.[1][1] ?? 0;
		oy = -Math.max(f0, f1) - 0.03;
	}
	ctx.save();
	ctx.translate(x, y + oy * s);
	ctx.scale(s, s);
	ctx.lineCap = 'round';
	ctx.lineJoin = 'round';
	const seg = (
		a: readonly [number, number],
		b: readonly [number, number],
		c: readonly [number, number],
		w1: number,
		w2: number,
		col: string,
	) => {
		for (const [lw, cc] of [
			[0.045, OL],
			[0, col],
		] as const) {
			ctx.strokeStyle = cc;
			ctx.lineWidth = w1 + lw;
			ctx.beginPath();
			ctx.moveTo(a[0], a[1]);
			ctx.lineTo(b[0], b[1]);
			ctx.stroke();
			ctx.lineWidth = w2 + lw;
			ctx.beginPath();
			ctx.moveTo(b[0], b[1]);
			ctx.lineTo(c[0], c[1]);
			ctx.stroke();
		}
	};
	const shoe = (f: readonly [number, number], col: string) => {
		ctx.fillStyle = col;
		ctx.strokeStyle = OL;
		ctx.lineWidth = 0.035;
		ctx.beginPath();
		ctx.ellipse(f[0] + 0.05, f[1], 0.12, 0.055, 0, 0, TAU);
		ctx.fill();
		ctx.stroke();
	};
	const shorts = (k: readonly [number, number], col: string) => {
		for (const [lw, cc] of [
			[0.045, OL],
			[0, col],
		] as const) {
			ctx.strokeStyle = cc;
			ctx.lineWidth = 0.21 + lw;
			ctx.beginPath();
			ctx.moveTo(hip[0], hip[1]);
			ctx.lineTo(hip[0] + (k[0] - hip[0]) * 0.42, hip[1] + (k[1] - hip[1]) * 0.42);
			ctx.stroke();
		}
	};
	const back = lg[1],
		front = lg[0],
		armB = am[1],
		armF = am[0];
	if (back) {
		seg(hip, back[0], back[1], 0.15, 0.12, '#c99872');
		shoe(back[1], '#c9a640');
		shorts(back[0], '#0e0b26');
	}
	if (armB) seg(sh, armB[0], armB[1], 0.1, 0.085, '#c99872');
	if (front) {
		seg(hip, front[0], front[1], 0.16, 0.125, look.skin);
		shoe(front[1], look.shoe);
		shorts(front[0], look.shorts);
	}
	// vest with a race number
	const pp: [number, number] = [Math.cos(lean), Math.sin(lean)];
	const pt = (k: number, w: number): [number, number] => [
		hip[0] + up[0] * k + pp[0] * w,
		hip[1] + up[1] * k + pp[1] * w,
	];
	ctx.fillStyle = look.shirt;
	ctx.strokeStyle = OL;
	ctx.lineWidth = 0.045;
	ctx.beginPath();
	for (const [k, w] of [
		[0.02, -0.12],
		[0.02, 0.12],
		[0.4, 0.16],
		[0.56, 0.1],
		[0.56, -0.09],
		[0.36, -0.13],
	] as const) {
		const p = pt(k, w);
		ctx.lineTo(p[0], p[1]);
	}
	ctx.closePath();
	ctx.fill();
	ctx.stroke();
	const bib = pt(0.3, 0.06);
	ctx.save();
	ctx.translate(bib[0], bib[1]);
	ctx.rotate(lean);
	ctx.fillStyle = '#fff';
	ctx.fillRect(-0.075, -0.08, 0.15, 0.13);
	ctx.restore();
	// head with a headband
	const hc: [number, number] = [neck[0] + up[0] * 0.17 + 0.02, neck[1] + up[1] * 0.17];
	ctx.fillStyle = look.shirt;
	ctx.beginPath();
	ctx.moveTo(hc[0] - 0.12, hc[1] - 0.06);
	ctx.lineTo(hc[0] - 0.4, hc[1] - 0.02);
	ctx.lineTo(hc[0] - 0.36, hc[1] + 0.05);
	ctx.closePath();
	ctx.fill();
	ctx.fillStyle = look.skin;
	ctx.strokeStyle = OL;
	ctx.lineWidth = 0.045;
	ctx.beginPath();
	ctx.ellipse(hc[0], hc[1], 0.15, 0.165, 0, 0, TAU);
	ctx.fill();
	ctx.stroke();
	ctx.fillStyle = '#3a2414';
	ctx.beginPath();
	ctx.arc(hc[0] - 0.01, hc[1] - 0.04, 0.15, Math.PI * 1.02, Math.PI * 1.9);
	ctx.fill();
	ctx.strokeStyle = look.shirt;
	ctx.lineWidth = 0.05;
	ctx.beginPath();
	ctx.moveTo(hc[0] - 0.15, hc[1] - 0.04);
	ctx.lineTo(hc[0] + 0.15, hc[1] - 0.06);
	ctx.stroke();
	ctx.fillStyle = '#1a1020';
	ctx.beginPath();
	ctx.arc(hc[0] + 0.09, hc[1] + 0.01, 0.022, 0, TAU);
	ctx.fill();
	if (armF) seg(sh, armF[0], armF[1], 0.105, 0.09, look.skin);
	ctx.restore();
}

// ŠACHY cover: the game's Staunton pieces (static/games/sachy/sachy.js) as canvas paths
const CHESS_BODY: Record<number, string[]> = {
	1: [
		'M22.5 7.5a4.6 4.6 0 0 0-3 8.1c-2 1.1-3.3 3-3.3 5 0 1.5.7 2.9 1.8 3.8-3.4 1.6-6.2 5-6.6 10.6h22.2c-.4-5.6-3.2-9-6.6-10.6 1.1-.9 1.8-2.3 1.8-3.8 0-2-1.3-3.9-3.3-5a4.6 4.6 0 0 0-3-8.1z',
		'M10.5 35h24v4h-24z',
	],
	2: [
		'M13 39h21.5c.3-8.3-1-14.6-4-19.4-1.3-2.1-2-3.9-2.3-5.9l1.2-4.4-3.6 2-1.3-3.8-2.1 3.7C16.6 12.4 13.2 15 11 19c-1.6 2.9-2.4 5.4-1.5 7 .9 1.4 2.8 1.3 4.6.2 1.6-1 3.4-1.8 5.4-1.6-.6 2.8-2.5 5-4.3 7.2-1.6 1.9-2.4 4.2-2.2 7.2z',
	],
	3: [
		'M10.5 39h24v-3.5h-24zM13.5 35.5c1.3-1.4 2.2-2.6 2.4-4.4h13.2c.2 1.8 1.1 3 2.4 4.4zM15.8 31.1c-3.2-3.9-3.2-10 6.7-17.4 9.9 7.4 9.9 13.5 6.7 17.4z',
		'M25.1 10.5a2.6 2.6 0 1 1-5.2 0a2.6 2.6 0 1 1 5.2 0z',
	],
	4: [
		'M9.5 39h26v-3.5h-26zM12 35.5l1.5-3.5h18l1.5 3.5zM14.5 32l1-14h14l1 14zM12.5 18l2-3h16l2 3zM12.5 15V8.5h4.2v2.8h3.5V8.5h4.6v2.8h3.5V8.5h4.2V15z',
	],
	5: [
		'M10.5 39h24v-3.5h-24zM12.5 35.5l2-4h16l2 4zM14.5 31.5c.1-4.6-2.4-10.6-5-16.2l6.6 6.4 2.4-10 4 9.6 4-9.6 2.4 10 6.6-6.4c-2.6 5.6-5.1 11.6-5 16.2z',
		'M11.5 14a2.3 2.3 0 1 1-4.6 0a2.3 2.3 0 1 1 4.6 0zM18.2 10.4a2.3 2.3 0 1 1-4.6 0a2.3 2.3 0 1 1 4.6 0zM24.8 9a2.3 2.3 0 1 1-4.6 0a2.3 2.3 0 1 1 4.6 0zM31.4 10.4a2.3 2.3 0 1 1-4.6 0a2.3 2.3 0 1 1 4.6 0zM38.1 14a2.3 2.3 0 1 1-4.6 0a2.3 2.3 0 1 1 4.6 0z',
	],
	6: [
		'M10.5 39h24v-3.5h-24zM12.5 35.5l2-4h16l2 4zM14.5 31.5c-1.4-3.6-4.6-6.4-4.6-10.6 0-3.6 3-5.8 6.4-5.8 2.6 0 4.6 1.4 6.2 3.6 1.6-2.2 3.6-3.6 6.2-3.6 3.4 0 6.4 2.2 6.4 5.8 0 4.2-3.2 7-4.6 10.6z',
	],
};
function coverChessPiece(
	ctx: CanvasRenderingContext2D,
	type: number,
	white: boolean,
	x: number,
	y: number,
	s: number,
): void {
	ctx.save();
	ctx.translate(x + s * 0.05, y + s * 0.05);
	ctx.scale((s * 0.9) / 45, (s * 0.9) / 45);
	ctx.shadowColor = 'rgba(0,0,0,.4)';
	ctx.shadowOffsetY = 2;
	ctx.shadowBlur = 2;
	ctx.fillStyle = white ? '#fbf7ee' : '#2e2724';
	ctx.strokeStyle = white ? '#2a1f14' : '#0d0907';
	ctx.lineWidth = 1.4;
	ctx.lineJoin = 'round';
	for (const d of CHESS_BODY[type] ?? []) {
		const p = new Path2D(d);
		ctx.fill(p);
		ctx.shadowColor = 'transparent';
		ctx.stroke(p);
	}
	ctx.lineCap = 'round';
	if (type === 6) {
		ctx.lineWidth = 2.6;
		ctx.stroke(new Path2D('M22.5 18.5V7M18.5 10.5h8'));
	}
	if (type === 2) {
		ctx.fillStyle = white ? '#2a1f14' : '#e8dccb';
		ctx.beginPath();
		ctx.arc(17.3, 16.6, 1.4, 0, TAU);
		ctx.fill();
	}
	if (type === 3) {
		ctx.strokeStyle = white ? '#2a1f14' : '#e8dccb';
		ctx.lineWidth = 1.8;
		ctx.stroke(new Path2D('M25.6 17.6l-4.6 5.6M17.5 28h10'));
	}
	ctx.restore();
}

// HAD cover: a shiny apple with a leaf
function coverApple(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
	ctx.fillStyle = 'rgba(0,0,0,.3)';
	ctx.beginPath();
	ctx.ellipse(x, y + r * 0.95, r * 0.8, r * 0.25, 0, 0, TAU);
	ctx.fill();
	ctx.fillStyle = '#ff4a5a';
	ctx.beginPath();
	ctx.arc(x - r * 0.32, y, r * 0.68, 0, TAU);
	ctx.arc(x + r * 0.32, y, r * 0.68, 0, TAU);
	ctx.fill();
	ctx.strokeStyle = '#6a4a2a';
	ctx.lineWidth = Math.max(1.5, r * 0.14);
	ctx.beginPath();
	ctx.moveTo(x, y - r * 0.5);
	ctx.lineTo(x + r * 0.1, y - r * 1.05);
	ctx.stroke();
	ctx.fillStyle = '#4fc85a';
	ctx.beginPath();
	ctx.ellipse(x + r * 0.38, y - r * 0.85, r * 0.38, r * 0.17, -0.5, 0, TAU);
	ctx.fill();
	ctx.fillStyle = 'rgba(255,255,255,.55)';
	ctx.beginPath();
	ctx.ellipse(x - r * 0.4, y - r * 0.25, r * 0.2, r * 0.14, -0.6, 0, TAU);
	ctx.fill();
}

// SOKOBAN cover sprites: a wooden crate and the robot keeper (one tile of size s at x, y)
function sokobanCrate(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	s: number,
	on: boolean,
	t: number,
): void {
	const p = s * 0.12,
		q = s - p * 2;
	ctx.save();
	if (on) {
		ctx.shadowColor = '#7cf0b6';
		ctx.shadowBlur = s * (0.45 + Math.sin(t * 6) * 0.15);
	}
	const g = ctx.createLinearGradient(0, y + p, 0, y + p + q);
	g.addColorStop(0, on ? '#7ff0b8' : '#e2a55a');
	g.addColorStop(1, on ? '#2fb37a' : '#b8752f');
	ctx.fillStyle = g;
	ctx.beginPath();
	ctx.roundRect(x + p, y + p, q, q, s * 0.09);
	ctx.fill();
	ctx.restore();
	ctx.strokeStyle = on ? '#1f8a5a' : '#9a5f24';
	ctx.lineWidth = s * 0.09;
	ctx.lineCap = 'round';
	ctx.beginPath();
	ctx.moveTo(x + p + q * 0.12, y + p + q * 0.88);
	ctx.lineTo(x + p + q * 0.88, y + p + q * 0.12);
	ctx.stroke();
	ctx.strokeStyle = on ? '#126a44' : '#7a4518';
	ctx.lineWidth = s * 0.05;
	ctx.beginPath();
	ctx.roundRect(x + p, y + p, q, q, s * 0.09);
	ctx.stroke();
	ctx.fillStyle = '#9aa4c0';
	for (const [cx, cy] of [
		[0, 0],
		[1, 0],
		[0, 1],
		[1, 1],
	] as const) {
		ctx.beginPath();
		ctx.roundRect(
			x + p + cx * (q - s * 0.14),
			y + p + cy * (q - s * 0.14),
			s * 0.14,
			s * 0.14,
			s * 0.04,
		);
		ctx.fill();
	}
	if (on) {
		ctx.strokeStyle = '#fff';
		ctx.lineWidth = s * 0.07;
		ctx.lineJoin = 'round';
		ctx.beginPath();
		ctx.moveTo(x + s * 0.34, y + s * 0.5);
		ctx.lineTo(x + s * 0.45, y + s * 0.61);
		ctx.lineTo(x + s * 0.67, y + s * 0.38);
		ctx.stroke();
	}
	ctx.lineCap = 'butt';
}
function sokobanBot(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	s: number,
	t: number,
	pushing: boolean,
): void {
	const u = s / 100;
	ctx.save();
	ctx.translate(x, y);
	if (pushing) {
		ctx.translate(50 * u, 86 * u);
		ctx.rotate(0.14);
		ctx.translate(-50 * u, -86 * u);
	}
	ctx.scale(u, u);
	ctx.fillStyle = 'rgba(0,0,0,.35)';
	ctx.beginPath();
	ctx.ellipse(50, 88, 24, 6, 0, 0, TAU);
	ctx.fill();
	ctx.fillStyle = '#6a76a8';
	const bob = pushing ? Math.abs(Math.sin(t * 10)) * 3 : 0;
	ctx.fillRect(30, 70 - bob, 14, 16);
	ctx.fillRect(56, 70, 14, 16);
	ctx.strokeStyle = '#9fb4ff';
	ctx.lineWidth = 3;
	ctx.beginPath();
	ctx.moveTo(50, 22);
	ctx.lineTo(50, 12);
	ctx.stroke();
	ctx.fillStyle = '#7fd8ff';
	ctx.beginPath();
	ctx.arc(50, 11, 5, 0, TAU);
	ctx.fill();
	const g = ctx.createLinearGradient(24, 22, 76, 76);
	g.addColorStop(0, '#ffffff');
	g.addColorStop(1, '#b9c6ff');
	ctx.fillStyle = g;
	ctx.strokeStyle = '#7f94e8';
	ctx.beginPath();
	ctx.roundRect(24, 22, 52, 54, 20);
	ctx.fill();
	ctx.stroke();
	ctx.fillStyle = '#10183a';
	ctx.beginPath();
	ctx.roundRect(32, 32, 36, 24, 10);
	ctx.fill();
	ctx.fillStyle = '#7fffe0';
	for (const ex of [48, 62]) {
		ctx.beginPath();
		ctx.arc(ex, 44, 4, 0, TAU);
		ctx.fill();
	}
	ctx.fillStyle = '#c7d2ff';
	ctx.beginPath();
	ctx.roundRect(pushing ? 80 : 74, 44, 12, 18, 6);
	ctx.fill();
	ctx.restore();
}

// OMALOVÁNKY cover: a 16 × 16 hot-air balloon and the order in which it gets painted
const BALLOON_PAL = ['#8fd3ff', '#ffffff', '#ff5a7a', '#ffd34d', '#8a5a34', '#5ccf6a'];
let balloon: { map: number[]; order: number[]; rank: number[] } | null = null;
function balloonCells(): { map: number[]; order: number[]; rank: number[] } {
	if (balloon) return balloon;
	const n = 16,
		map: number[] = [];
	for (let y = 0; y < n; y++)
		for (let x = 0; x < n; x++) {
			const dx = x + 0.5 - 8,
				dy = y + 0.5 - 6;
			let k = 0;
			if ((Math.hypot(x - 2.5, y - 3) < 1.8 || Math.hypot(x - 4, y - 2.6) < 1.5) && y < 4) k = 1;
			if (Math.hypot(x - 13, y - 9.2) < 1.4 || Math.hypot(x - 11.8, y - 9.6) < 1.1) k = 1;
			if (y >= 14) k = 5;
			const inBalloon =
				Math.hypot(dx, dy) < 5 || (dy >= 0 && dy < 6 && Math.abs(dx) < 5 - dy * 0.62);
			if (inBalloon) k = Math.floor((dx + 5) / 2) % 2 ? 3 : 2;
			if (y === 12 && Math.abs(dx) < 1.5) k = 4;
			if (y === 13 && Math.abs(dx) < 1.5) k = 4;
			map.push(k);
		}
	const order = map
		.map((_, i) => i)
		.sort(
			(a, b) =>
				(map[a] ?? 0) - (map[b] ?? 0) ||
				(a % n) + Math.floor(a / n) - ((b % n) + Math.floor(b / n)),
		);
	const rank: number[] = [];
	order.forEach((i, k) => (rank[i] = k));
	balloon = { map, order, rank };
	return balloon;
}

// SKLÁDAČKA cover: a jigsaw piece outline (fixed tab pattern) and a cached cosmic picture
const JIG_RIGHT = [
	[1, -1, 1],
	[-1, 1, -1],
	[1, 1, -1],
];
const JIG_DOWN = [
	[-1, 1, -1, 1],
	[1, -1, 1, -1],
];
function jigsawPath(
	x: number,
	y: number,
	cols: number,
	rows: number,
	px: number,
	py: number,
	cw: number,
	ch: number,
): Path2D {
	const p = new Path2D(),
		s = Math.min(cw, ch);
	const side = (ax: number, ay: number, bx: number, by: number, dir: number) => {
		const dx = bx - ax,
			dy = by - ay,
			l = Math.hypot(dx, dy),
			nx = dy / l,
			ny = -dx / l;
		const P = (u: number, v: number): [number, number] => [
			ax + dx * u + nx * v * s * dir,
			ay + dy * u + ny * v * s * dir,
		];
		if (!dir) {
			p.lineTo(bx, by);
			return;
		}
		p.lineTo(...P(0.35, 0));
		p.bezierCurveTo(...P(0.45, 0), ...P(0.38, 0.12), ...P(0.42, 0.14));
		p.bezierCurveTo(...P(0.34, 0.24), ...P(0.4, 0.31), ...P(0.5, 0.31));
		p.bezierCurveTo(...P(0.6, 0.31), ...P(0.66, 0.24), ...P(0.58, 0.14));
		p.bezierCurveTo(...P(0.62, 0.12), ...P(0.55, 0), ...P(0.65, 0));
		p.lineTo(bx, by);
	};
	const top = y ? -(JIG_DOWN[y - 1]?.[x] ?? 0) : 0,
		right = x < cols - 1 ? (JIG_RIGHT[y]?.[x] ?? 0) : 0,
		bottom = y < rows - 1 ? (JIG_DOWN[y]?.[x] ?? 0) : 0,
		left = x ? -(JIG_RIGHT[y]?.[x - 1] ?? 0) : 0;
	p.moveTo(px, py);
	side(px, py, px + cw, py, top);
	side(px + cw, py, px + cw, py + ch, right);
	side(px + cw, py + ch, px, py + ch, bottom);
	side(px, py + ch, px, py, left);
	p.closePath();
	return p;
}
let jigsawPic: HTMLCanvasElement | null = null;
function jigsawPicture(w: number, h: number): HTMLCanvasElement {
	if (jigsawPic && jigsawPic.width === w && jigsawPic.height === h) return jigsawPic;
	const c = document.createElement('canvas');
	c.width = Math.max(1, w);
	c.height = Math.max(1, h);
	const g = c.getContext('2d');
	if (!g) return c;
	// a painted lighthouse on a cliff at sunset, like the game's pictures
	const wy = h * 0.62;
	const sky = g.createLinearGradient(0, 0, 0, wy);
	sky.addColorStop(0, '#2a2a6a');
	sky.addColorStop(0.45, '#c8506a');
	sky.addColorStop(0.75, '#ff9a4a');
	sky.addColorStop(1, '#ffd88a');
	g.fillStyle = sky;
	g.fillRect(0, 0, w, h);
	const sx = w * 0.3,
		sy = wy - h * 0.16;
	const glow = g.createRadialGradient(sx, sy, h * 0.03, sx, sy, h * 0.45);
	glow.addColorStop(0, 'rgba(255,200,120,.7)');
	glow.addColorStop(1, 'rgba(255,200,120,0)');
	g.fillStyle = glow;
	g.fillRect(0, 0, w, h);
	g.fillStyle = '#fff0b0';
	g.beginPath();
	g.arc(sx, sy, h * 0.07, 0, TAU);
	g.fill();
	g.fillStyle = 'rgba(255,190,170,.75)';
	for (const [cx, cy, r] of [
		[0.12, 0.16, 0.06],
		[0.2, 0.14, 0.07],
		[0.28, 0.17, 0.05],
		[0.6, 0.1, 0.05],
		[0.68, 0.12, 0.06],
	] as const) {
		g.beginPath();
		g.ellipse(w * cx, h * cy, h * r * 1.5, h * r, 0, 0, TAU);
		g.fill();
	}
	g.fillStyle = '#8a5a7a';
	g.beginPath();
	g.moveTo(0, wy);
	for (let x = 0; x <= w; x += 4) g.lineTo(x, wy - h * 0.04 - Math.sin(x * 0.03) * h * 0.02);
	g.lineTo(w, wy);
	g.fill();
	const sea = g.createLinearGradient(0, wy, 0, h);
	sea.addColorStop(0, '#a85a7a');
	sea.addColorStop(1, '#4a2a5a');
	g.fillStyle = sea;
	g.fillRect(0, wy, w, h - wy);
	g.fillStyle = 'rgba(255,200,130,.55)';
	for (let y = wy + 2; y < h; y += 4) {
		const ww = 6 + (y - wy) * 0.4;
		g.fillRect(sx - ww / 2 + Math.sin(y) * 3, y, ww, 1.5);
	}
	// cliff, lighthouse and keeper's house
	const cx = w * 0.66;
	const cliff = g.createLinearGradient(cx, wy - h * 0.2, w, h);
	cliff.addColorStop(0, '#7a5a4a');
	cliff.addColorStop(1, '#2a1a18');
	g.fillStyle = cliff;
	g.beginPath();
	g.moveTo(cx - w * 0.04, h);
	g.lineTo(cx, wy - h * 0.1);
	g.lineTo(cx + w * 0.08, wy - h * 0.18);
	g.lineTo(w, wy - h * 0.2);
	g.lineTo(w, h);
	g.fill();
	g.fillStyle = '#5a8a3a';
	g.fillRect(cx + w * 0.02, wy - h * 0.205, w, h * 0.03);
	const lx = cx + w * 0.17,
		lb = wy - h * 0.19,
		lh = h * 0.34,
		lw = w * 0.035;
	g.fillStyle = '#f4f0e8';
	g.beginPath();
	g.moveTo(lx - lw, lb);
	g.lineTo(lx - lw * 0.65, lb - lh);
	g.lineTo(lx + lw * 0.65, lb - lh);
	g.lineTo(lx + lw, lb);
	g.fill();
	g.fillStyle = '#c83a3a';
	for (let k = 0; k < 3; k++) {
		const y = lb - lh * (0.15 + k * 0.3);
		g.fillRect(lx - lw * (0.95 - k * 0.1), y - lh * 0.12, lw * 2 * (0.95 - k * 0.1), lh * 0.12);
	}
	g.fillStyle = '#ffe9a0';
	g.fillRect(lx - lw * 0.5, lb - lh - h * 0.06, lw, h * 0.06);
	g.fillStyle = '#c83a3a';
	g.beginPath();
	g.moveTo(lx - lw * 0.8, lb - lh - h * 0.06);
	g.lineTo(lx, lb - lh - h * 0.11);
	g.lineTo(lx + lw * 0.8, lb - lh - h * 0.06);
	g.fill();
	g.fillStyle = '#e8e0d0';
	g.fillRect(lx - w * 0.1, lb - h * 0.07, w * 0.06, h * 0.07);
	g.fillStyle = '#7a3a2a';
	g.beginPath();
	g.moveTo(lx - w * 0.11, lb - h * 0.07);
	g.lineTo(lx - w * 0.07, lb - h * 0.11);
	g.lineTo(lx - w * 0.03, lb - h * 0.07);
	g.fill();
	// a sailboat and gulls
	const bx = w * 0.35,
		by = wy + h * 0.12;
	g.fillStyle = '#4a2a2a';
	g.beginPath();
	g.moveTo(bx - w * 0.05, by);
	g.lineTo(bx + w * 0.05, by);
	g.lineTo(bx + w * 0.035, by + h * 0.025);
	g.lineTo(bx - w * 0.035, by + h * 0.025);
	g.fill();
	g.fillStyle = '#f8f0e0';
	g.beginPath();
	g.moveTo(bx, by - h * 0.005);
	g.lineTo(bx, by - h * 0.14);
	g.lineTo(bx + w * 0.045, by - h * 0.01);
	g.fill();
	g.strokeStyle = '#2a1a2a';
	g.lineWidth = Math.max(1, h * 0.006);
	for (const [gx, gy] of [
		[0.45, 0.25],
		[0.52, 0.3],
		[0.4, 0.32],
	] as const) {
		g.beginPath();
		g.moveTo(w * gx - h * 0.02, h * gy);
		g.quadraticCurveTo(w * gx - h * 0.01, h * gy - h * 0.015, w * gx, h * gy);
		g.quadraticCurveTo(w * gx + h * 0.01, h * gy - h * 0.015, w * gx + h * 0.02, h * gy);
		g.stroke();
	}
	jigsawPic = c;
	return c;
}

// TANKY cover sprite (a simplified port of static/games/tanky/art.js)
function coverTank(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	s: number,
	col: string,
	ang: number,
	kick: number,
	t: number,
): void {
	const face = ang <= 90 ? 1 : -1,
		la = ((face > 0 ? ang : 180 - ang) * Math.PI) / 180;
	ctx.save();
	ctx.translate(x, y);
	ctx.scale(s * face, s);
	ctx.lineJoin = 'round';
	ctx.lineWidth = 1.1;
	ctx.strokeStyle = '#0c0f1e';
	ctx.beginPath();
	ctx.moveTo(-8, -20);
	ctx.lineTo(-10, -36);
	ctx.stroke();
	ctx.fillStyle = col;
	ctx.beginPath();
	ctx.moveTo(-10, -36);
	ctx.quadraticCurveTo(-6, -35 + Math.sin(t * 8), -3, -34);
	ctx.lineTo(-10, -31.6);
	ctx.fill();
	ctx.save();
	ctx.translate(1, -15);
	ctx.rotate(-la);
	ctx.translate(-kick * 4, 0);
	ctx.fillStyle = '#3a4058';
	ctx.fillRect(3, -1.8, 17, 3.6);
	ctx.fillRect(19, -2.7, 4, 5.4);
	if (kick > 0) {
		ctx.globalAlpha = kick;
		ctx.fillStyle = '#ffd34d';
		ctx.beginPath();
		ctx.arc(28, 0, 7, 0, TAU);
		ctx.fill();
		ctx.globalAlpha = 1;
	}
	ctx.restore();
	ctx.fillStyle = col;
	ctx.beginPath();
	ctx.moveTo(-10, -13);
	ctx.lineTo(-9, -19);
	ctx.quadraticCurveTo(-7, -22.5, -1, -22.5);
	ctx.lineTo(4, -22.5);
	ctx.quadraticCurveTo(9, -22, 10, -16);
	ctx.lineTo(9, -13);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();
	ctx.beginPath();
	ctx.moveTo(-18, -7.5);
	ctx.lineTo(19, -7.5);
	ctx.lineTo(22, -10.5);
	ctx.lineTo(16, -14);
	ctx.lineTo(-15, -14);
	ctx.lineTo(-19, -11);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();
	ctx.fillStyle = 'rgba(255,255,255,.35)';
	ctx.fillRect(-14, -13, 28, 1.4);
	ctx.fillRect(-6, -21, 8, 1.2);
	ctx.fillStyle = '#20253a';
	ctx.beginPath();
	ctx.roundRect(-20, -8, 40, 8, 4);
	ctx.fill();
	ctx.stroke();
	ctx.fillStyle = '#6a7090';
	for (const wx of [-14.5, -7.2, 0, 7.2, 14.5]) {
		ctx.beginPath();
		ctx.arc(wx, -4, 2.9, 0, TAU);
		ctx.fill();
	}
	ctx.restore();
}

// ČERVÍCI cover sprites (a port of the game's static/games/cervici/art.js worm, simplified)
function coverWorm(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	s: number,
	face: number,
	col: string,
	t: number,
	look: number,
	bazooka: boolean,
): void {
	ctx.save();
	ctx.translate(x, y);
	ctx.scale(s * face, s);
	const bob = Math.sin(t * 2.2) * 0.45;
	const bz = (a: number, b: number, c: number, d: number, k: number) =>
		(1 - k) ** 3 * a + 3 * (1 - k) ** 2 * k * b + 3 * (1 - k) * k * k * c + k ** 3 * d;
	const pts: [number, number, number][] = [];
	for (let i = 0; i <= 14; i++) {
		const k = i / 14;
		pts.push([
			bz(-11, -2, 5.5, 2.6, k),
			bz(-2.3, -1.4, -5.5, -15.5 + bob, k),
			2.1 + 2.7 * k ** 0.8,
		]);
	}
	const hx = 2.6,
		hy = -17.1 + bob;
	for (const [fill, grow] of [
		['#5e1834', 1.15],
		['#ff9cc3', 0],
	] as const) {
		ctx.fillStyle = fill;
		ctx.beginPath();
		for (const [px, py, r] of pts) {
			ctx.moveTo(px + r + grow, py);
			ctx.arc(px, py, r + grow, 0, TAU);
		}
		ctx.moveTo(hx + 5.3 + grow, hy);
		ctx.arc(hx, hy, 5.3 + grow, 0, TAU);
		ctx.fill();
	}
	ctx.fillStyle = '#ffd3e4';
	for (const [px, py, r] of pts.filter((_, i) => i >= 4 && i % 3 === 1)) {
		ctx.beginPath();
		ctx.arc(px - r * 0.35, py - r * 0.3, r * 0.32, 0, TAU);
		ctx.fill();
	}
	ctx.strokeStyle = col;
	ctx.lineCap = 'round';
	ctx.lineWidth = 2.3;
	ctx.beginPath();
	ctx.moveTo(hx - 5.1, hy + 0.6);
	ctx.quadraticCurveTo(hx, hy - 1.2, hx + 5.1, hy - 0.2);
	ctx.stroke();
	ctx.lineWidth = 1.7;
	ctx.beginPath();
	ctx.moveTo(hx - 5, hy + 0.5);
	ctx.quadraticCurveTo(hx - 8, hy - 1 + Math.sin(t * 9), hx - 10.5, hy + 0.5);
	ctx.stroke();
	ctx.lineCap = 'butt';
	const la = (look * Math.PI) / 180;
	for (const [ex, ey] of [
		[hx - 0.6, hy - 4.3],
		[hx + 3.4, hy - 4],
	] as const) {
		ctx.fillStyle = '#fff';
		ctx.strokeStyle = '#5e1834';
		ctx.lineWidth = 0.9;
		ctx.beginPath();
		ctx.ellipse(ex, ey, 2.45, 3.2, 0, 0, TAU);
		ctx.fill();
		ctx.stroke();
		ctx.fillStyle = '#0d0f1e';
		ctx.beginPath();
		ctx.arc(ex + Math.cos(la) * 1.05, ey - Math.sin(la) * 1.5 + 0.3, 1.2, 0, TAU);
		ctx.fill();
	}
	ctx.strokeStyle = '#5e1834';
	ctx.beginPath();
	ctx.arc(hx + 2.8, hy + 1.4, 1.6, 0.3, 2.2);
	ctx.stroke();
	if (bazooka) {
		ctx.translate(4.5, -8.5);
		ctx.rotate((-look * Math.PI) / 180);
		ctx.fillStyle = '#6d8043';
		ctx.strokeStyle = '#1b2014';
		ctx.beginPath();
		ctx.roundRect(-8, -2.7, 20, 5.4, 1.2);
		ctx.fill();
		ctx.stroke();
		ctx.fillStyle = '#2e3820';
		ctx.fillRect(-4.5, -2.7, 1.6, 5.4);
		ctx.fillRect(6, -2.7, 1.6, 5.4);
		ctx.fillStyle = '#272c22';
		ctx.fillRect(11.5, -3.4, 3.2, 6.8);
	}
	ctx.restore();
}

function coverPalm(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
	ctx.save();
	ctx.translate(x, y);
	ctx.scale(s, s);
	ctx.strokeStyle = '#6b4a2a';
	ctx.lineWidth = 4;
	ctx.lineCap = 'round';
	ctx.beginPath();
	ctx.moveTo(0, 2);
	ctx.quadraticCurveTo(1, -22, 5, -40);
	ctx.stroke();
	for (let i = 0; i < 7; i++) {
		const a = -Math.PI / 2 + (i - 3) * 0.55,
			l = 20;
		ctx.fillStyle = i % 2 ? '#3fae4a' : '#2f8a3c';
		ctx.beginPath();
		ctx.moveTo(5, -40);
		ctx.quadraticCurveTo(
			5 + Math.cos(a) * l * 0.6,
			-44 + Math.sin(a) * l * 0.6,
			5 + Math.cos(a) * l,
			-30 + Math.sin(a) * l * 0.55,
		);
		ctx.quadraticCurveTo(5 + Math.cos(a) * l * 0.5, -38 + Math.sin(a) * l * 0.5, 5, -38);
		ctx.fill();
	}
	ctx.restore();
}

/** Night sky with slow aurora blobs and twinkling stars - the common puzzle backdrop. */
function sky(
	ctx: CanvasRenderingContext2D,
	w: number,
	h: number,
	t: number,
	colors: [string, string, string],
	seed: number,
) {
	const g = ctx.createLinearGradient(0, 0, 0, h);
	g.addColorStop(0, '#0a0624');
	g.addColorStop(1, '#03020c');
	ctx.fillStyle = g;
	ctx.fillRect(0, 0, w, h);
	ctx.globalCompositeOperation = 'lighter';
	colors.forEach((c, i) => {
		const x = w * (0.5 + 0.4 * Math.sin(t * 0.13 + i * 2.1 + seed));
		const y = h * (0.35 + 0.25 * Math.cos(t * 0.11 + i * 1.7 + seed));
		const r = Math.max(w, h) * 0.6;
		const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
		rg.addColorStop(0, `${c}38`);
		rg.addColorStop(1, `${c}00`);
		ctx.fillStyle = rg;
		ctx.fillRect(0, 0, w, h);
	});
	ctx.globalCompositeOperation = 'source-over';
	for (let i = 0; i < 70; i++) {
		const x = (Math.sin(i * 91.7 + seed) * 0.5 + 0.5) * w;
		const y = (Math.sin(i * 47.3 + seed * 3) * 0.5 + 0.5) * h;
		const a = 0.25 + 0.6 * (0.5 + 0.5 * Math.sin(t * 2 + i));
		ctx.fillStyle = `rgba(255,255,255,${a.toFixed(2)})`;
		ctx.fillRect(x, y, 1.6, 1.6);
	}
}
function glowText(
	ctx: CanvasRenderingContext2D,
	text: string,
	x: number,
	y: number,
	size: number,
	color: string,
) {
	ctx.font = `700 ${size}px Unbounded, "Segoe UI", sans-serif`;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.shadowColor = color;
	ctx.shadowBlur = size * 0.6;
	ctx.fillStyle = color;
	ctx.fillText(text, x, y);
	ctx.shadowBlur = 0;
}

const SUDOKU_DIGITS = [
	5, 3, 0, 0, 7, 0, 0, 0, 0, 6, 0, 0, 1, 9, 5, 0, 0, 0, 0, 9, 8, 0, 0, 0, 0, 6, 0,
];
const CREATURE = [
	'..X....X..',
	'...X..X...',
	'..XXXXXX..',
	'.XX.XX.XX.',
	'XXXXXXXXXX',
	'X.XXXXXX.X',
	'X.X....X.X',
	'...XX.XX..',
];

const labels = {
	solved: ['Vyřešeno', 'Solved'],
	streak: ['Série denních', 'Daily streak'],
	level: ['Cesta hvězd', 'Star Path'],
	rank: ['Hodnost', 'Rank'],
	achievements: ['Úspěchy', 'Achievements'],
} satisfies Record<string, [string, string]>;

const common = {
	cs: [
		'Denní výzva + série',
		'Cesta hvězd: 120 úrovní',
		'Nekonečno nových zadání',
		'Týdenní úkoly a vzhledy',
	],
	en: [
		'Daily puzzle + streaks',
		'Star Path: 120 levels',
		'Endless new puzzles',
		'Weekly quests & themes',
	],
};

export const PUZZLE_GAMES: Game[] = [
	{
		id: 'sudoku',
		online: 'race',
		title: 'SUDOKU',
		group: 'puzzle',
		category: 'logic',
		tagline: 'Devět čísel, devět souhvězdí.',
		description:
			'Klasické sudoku ve čtyřech obtížnostech. Každá mřížka má jediné řešení, poznámky, kandidáty a nápovědu. Denní výzva je stejná pro všechny hráče.',
		genres: ['Hlavolam', 'Logika', 'Čísla'],
		features: common.cs,
		en: {
			tagline: 'Nine numbers, nine constellations.',
			description:
				'Classic sudoku in four difficulties. Every grid has exactly one solution, with notes, candidates and hints. The daily puzzle is the same for every player.',
			genres: ['Puzzle', 'Logic', 'Numbers'],
			features: common.en,
		},
		statLabels: labels,
		path: '/games/sudoku/index.html',
		colors: ['#55f6ff', '#7a8cff', '#2a3bff'],
		statsKey: 'gamecenter.stats.sudoku',
		cover(ctx, w, h, t) {
			sky(ctx, w, h, t, ['#55f6ff', '#7a8cff', '#2a3bff'], 1);
			const s = Math.min(w, h) * 0.62;
			ctx.save();
			ctx.translate(w / 2, h * 0.42);
			ctx.rotate(-0.12 + Math.sin(t * 0.3) * 0.03);
			const c = s / 9;
			for (let i = 0; i <= 9; i++) {
				ctx.strokeStyle = i % 3 === 0 ? 'rgba(85,246,255,.75)' : 'rgba(85,246,255,.22)';
				ctx.lineWidth = i % 3 === 0 ? 2.4 : 1;
				ctx.beginPath();
				ctx.moveTo(-s / 2 + i * c, -s / 2);
				ctx.lineTo(-s / 2 + i * c, s / 2);
				ctx.moveTo(-s / 2, -s / 2 + i * c);
				ctx.lineTo(s / 2, -s / 2 + i * c);
				ctx.stroke();
			}
			SUDOKU_DIGITS.forEach((d, i) => {
				if (!d) return;
				const x = -s / 2 + (i % 9) * c + c / 2;
				const y = -s / 2 + Math.floor(i / 9) * c + c / 2 + c * 3;
				glowText(ctx, String(d), x, y, c * 0.55, i % 4 ? '#e9fbff' : '#55f6ff');
			});
			const pulse = Math.floor(t * 0.8) % 81;
			ctx.fillStyle = 'rgba(85,246,255,.25)';
			ctx.fillRect(-s / 2 + (pulse % 9) * c, -s / 2 + Math.floor(pulse / 9) * c, c, c);
			ctx.restore();
		},
	},
	{
		id: 'nonogram',
		online: 'race',
		title: 'NONOGRAMY',
		group: 'puzzle',
		category: 'logic',
		tagline: 'Malované křížovky, ze kterých se líhnou hvězdné bytosti.',
		description:
			'Vybarvuj políčka podle čísel u řádků a sloupců a odhal obrázek. Každý vyřešený nonogram přidá do tvé sbírky novou hvězdnou bytost. Od 8×8 po 20×20.',
		genres: ['Hlavolam', 'Logika', 'Obrázky'],
		features: [...common.cs.slice(0, 3), 'Sbírka bytostí'],
		en: {
			tagline: 'Picture puzzles that hatch star creatures.',
			description:
				'Fill cells according to the numbers beside rows and columns to reveal a picture. Every solved nonogram adds a new star creature to your collection. From 8×8 to 20×20.',
			genres: ['Puzzle', 'Logic', 'Pictures'],
			features: [...common.en.slice(0, 3), 'Creature collection'],
		},
		statLabels: labels,
		path: '/games/nonogram/index.html',
		colors: ['#ff4fd8', '#ffb86b', '#b14cff'],
		statsKey: 'gamecenter.stats.nonogram',
		cover(ctx, w, h, t) {
			sky(ctx, w, h, t, ['#ff4fd8', '#ffb86b', '#b14cff'], 2);
			const rows = CREATURE.length;
			const cols = CREATURE[0]?.length ?? 10;
			const c = Math.min(w / (cols + 3), h / (rows + 6));
			const x0 = (w - cols * c) / 2;
			const y0 = h * 0.18;
			const shown = Math.floor((t * 6) % (rows * cols + 30));
			CREATURE.forEach((line, y) => {
				[...line].forEach((ch, x) => {
					ctx.strokeStyle = 'rgba(255,255,255,.08)';
					ctx.strokeRect(x0 + x * c, y0 + y * c, c, c);
					if (ch === 'X' && y * cols + x < shown) {
						ctx.fillStyle = `hsl(${310 + y * 8}, 90%, ${60 + 8 * Math.sin(x)}%)`;
						ctx.shadowColor = '#ff4fd8';
						ctx.shadowBlur = c * 0.6;
						ctx.fillRect(x0 + x * c + 1, y0 + y * c + 1, c - 2, c - 2);
						ctx.shadowBlur = 0;
					}
				});
			});
		},
	},
	{
		id: 'kakuro',
		online: 'race',
		title: 'KAKURO',
		group: 'puzzle',
		category: 'logic',
		tagline: 'Číselná křížovka pro ty, kdo rádi počítají.',
		description:
			'Doplň číslice 1–9 tak, aby úseky dávaly zadané součty a nic se neopakovalo. Hra ti ukáže možné kombinace součtů. Mřížky od 6×6 po 11×11.',
		genres: ['Hlavolam', 'Logika', 'Čísla'],
		features: [...common.cs.slice(0, 3), 'Nápověda kombinací'],
		en: {
			tagline: 'The number crossword for people who love sums.',
			description:
				'Fill in digits 1–9 so each run adds up to its clue with no repeats. The game shows the possible combinations for each sum. Grids from 6×6 to 11×11.',
			genres: ['Puzzle', 'Logic', 'Numbers'],
			features: [...common.en.slice(0, 3), 'Combination helper'],
		},
		statLabels: labels,
		path: '/games/kakuro/index.html',
		colors: ['#ffcf5a', '#ff7a3d', '#ff4f6d'],
		statsKey: 'gamecenter.stats.kakuro',
		cover(ctx, w, h, t) {
			sky(ctx, w, h, t, ['#ffcf5a', '#ff7a3d', '#ff4f6d'], 3);
			const n = 5;
			const c = Math.min(w, h) * 0.15;
			const x0 = (w - n * c) / 2;
			const y0 = h * 0.14;
			const black = [0, 1, 2, 5, 10, 15, 20, 21];
			const sums: Record<number, [number, number]> = {
				1: [0, 17],
				2: [0, 9],
				5: [16, 0],
				10: [24, 0],
				15: [11, 0],
				20: [3, 0],
				21: [0, 4],
			};
			const digits = [0, 0, 0, 9, 8, 0, 7, 9, 0, 0, 0, 8, 6, 9, 1, 0, 1, 2, 0, 0, 0, 0, 1, 3, 0];
			for (let i = 0; i < n * n; i++) {
				const x = x0 + (i % n) * c;
				const y = y0 + Math.floor(i / n) * c;
				const isBlack = black.includes(i) || !digits[i];
				ctx.fillStyle = isBlack ? 'rgba(0,0,0,.45)' : 'rgba(255,255,255,.07)';
				ctx.strokeStyle = 'rgba(255,207,90,.35)';
				ctx.beginPath();
				ctx.roundRect(x + 2, y + 2, c - 4, c - 4, 6);
				ctx.fill();
				ctx.stroke();
				const clue = sums[i];
				if (clue) {
					ctx.strokeStyle = 'rgba(255,79,109,.6)';
					ctx.beginPath();
					ctx.moveTo(x + 4, y + 4);
					ctx.lineTo(x + c - 4, y + c - 4);
					ctx.stroke();
					ctx.font = `600 ${c * 0.24}px "Space Grotesk", sans-serif`;
					ctx.fillStyle = '#fff3d6';
					ctx.textAlign = 'center';
					if (clue[0]) ctx.fillText(String(clue[0]), x + c * 0.7, y + c * 0.36);
					if (clue[1]) ctx.fillText(String(clue[1]), x + c * 0.3, y + c * 0.82);
				} else if (!isBlack) {
					const on = Math.sin(t * 1.4 + i) > -0.3;
					if (on) glowText(ctx, String(digits[i]), x + c / 2, y + c / 2, c * 0.46, '#ffcf5a');
				}
			}
		},
	},
	{
		id: 'souhvezdi',
		online: 'race',
		title: 'SOUHVĚZDÍ',
		group: 'puzzle',
		category: 'logic',
		tagline: 'Spoj hvězdy v souhvězdí.',
		description:
			'Hashi pod hvězdnou oblohou: číslo ve hvězdě říká, kolik čar z ní vede. Čáry se nesmí křížit a vše musí tvořit jedno souhvězdí. Jednoduchá pravidla, hluboká logika.',
		genres: ['Hlavolam', 'Logika', 'Hashi'],
		features: [...common.cs.slice(0, 3), 'Pojmenovaná souhvězdí'],
		en: {
			tagline: 'Connect the stars into constellations.',
			description:
				'Hashi under a starry sky: the number in a star tells how many lines leave it. Lines cannot cross and everything must form one constellation. Simple rules, deep logic.',
			genres: ['Puzzle', 'Logic', 'Hashi'],
			features: [...common.en.slice(0, 3), 'Named constellations'],
		},
		statLabels: labels,
		path: '/games/souhvezdi/index.html',
		colors: ['#7dff9b', '#3dd6ff', '#2affd0'],
		statsKey: 'gamecenter.stats.souhvezdi',
		cover(ctx, w, h, t) {
			sky(ctx, w, h, t, ['#7dff9b', '#3dd6ff', '#2affd0'], 4);
			const s = Math.min(w, h);
			const pts: [number, number, number][] = [
				[0.25, 0.2, 3],
				[0.62, 0.2, 4],
				[0.62, 0.42, 2],
				[0.25, 0.52, 4],
				[0.8, 0.52, 3],
				[0.42, 0.52, 1],
			];
			const links: [number, number, number][] = [
				[0, 1, 2],
				[1, 2, 1],
				[0, 3, 1],
				[3, 5, 1],
				[1, 4, 1],
				[4, 2, 1],
			];
			const px = (i: number) => w / 2 + ((pts[i]?.[0] ?? 0) - 0.52) * s * 1.1;
			const py = (i: number) => h * 0.06 + (pts[i]?.[1] ?? 0) * s * 1.05;
			const k = (t * 0.6) % (links.length + 2);
			links.forEach(([a, b, v], i) => {
				if (!v || i > k) return;
				ctx.strokeStyle = '#7dff9b';
				ctx.shadowColor = '#3dd6ff';
				ctx.shadowBlur = 10;
				ctx.lineWidth = 3;
				for (let j = 0; j < v; j++) {
					const o = v === 2 ? (j ? 4 : -4) : 0;
					const hz = py(a) === py(b);
					ctx.beginPath();
					ctx.moveTo(px(a) + (hz ? 0 : o), py(a) + (hz ? o : 0));
					ctx.lineTo(px(b) + (hz ? 0 : o), py(b) + (hz ? o : 0));
					ctx.stroke();
				}
				ctx.shadowBlur = 0;
			});
			pts.forEach(([, , n], i) => {
				const r = s * 0.05;
				ctx.fillStyle = '#0d0a22';
				ctx.strokeStyle = '#bfffe0';
				ctx.lineWidth = 2;
				ctx.beginPath();
				ctx.arc(px(i), py(i), r, 0, TAU);
				ctx.fill();
				ctx.stroke();
				glowText(ctx, String(n), px(i), py(i) + 1, r * 1.05, '#ffffff');
			});
		},
	},
	{
		id: 'pulsar',
		online: 'race',
		title: 'PULSAR',
		group: 'puzzle',
		category: 'arcade',
		tagline: 'Padající bloky v rytmu pulsaru.',
		description:
			'Skládej padající dílky do plných řad. Maraton, Sprint 40, Ultra 2:00 a Kopání, T-spiny, kombo, odkládání dílků. Denní sprint má pro všechny stejné pořadí dílků.',
		genres: ['Hlavolam', 'Arkáda', 'Padající bloky'],
		features: [
			'Denní sprint pro všechny',
			'Cesta: 120 úkolů',
			'4 herní režimy',
			'Gesta i klávesnice',
		],
		en: {
			tagline: 'Falling blocks to the beat of a pulsar.',
			description:
				'Stack falling pieces into full rows. Marathon, Sprint 40, Ultra 2:00 and Dig, with T-spins, combos and hold. The daily sprint has the same piece order for everyone.',
			genres: ['Puzzle', 'Arcade', 'Falling blocks'],
			features: [
				'Daily sprint for everyone',
				'Path: 120 challenges',
				'4 game modes',
				'Gestures and keyboard',
			],
		},
		statLabels: labels,
		path: '/games/pulsar/index.html',
		colors: ['#c77dff', '#55f6ff', '#ff5a7a'],
		statsKey: 'gamecenter.stats.pulsar',
		cover(ctx, w, h, t) {
			sky(ctx, w, h, t, ['#c77dff', '#55f6ff', '#ff5a7a'], 5);
			const c = Math.min(w / 12, h / 16);
			const x0 = (w - 10 * c) / 2;
			const y0 = h * 0.08;
			const stack = [
				'..........',
				'..........',
				'Z.........',
				'ZZ...OO..L',
				'JZ.TTOO.LL',
				'JJJ.T.SS.L',
				'IIIIGGSS.G',
			];
			const col: Record<string, string> = {
				I: '#55f6ff',
				O: '#ffe066',
				T: '#c77dff',
				S: '#6dff9e',
				Z: '#ff5a7a',
				J: '#5a8cff',
				L: '#ffa94d',
				G: '#5d5878',
			};
			const block = (x: number, y: number, k: string) => {
				ctx.fillStyle = col[k] ?? '#fff';
				ctx.shadowColor = col[k] ?? '#fff';
				ctx.shadowBlur = c * 0.4;
				ctx.fillRect(x0 + x * c + 1, y0 + y * c + 1, c - 2, c - 2);
				ctx.shadowBlur = 0;
			};
			stack.forEach((row, y) => [...row].forEach((k, x) => k !== '.' && block(x, y + 8, k)));
			const fall = ((t * 2) % 9) + 0;
			[
				[1, 0],
				[1, 1],
				[1, 2],
				[2, 2],
			].forEach(([x = 0, y = 0]) => block(x + 6, y + Math.floor(fall), 'L'));
		},
	},
	{
		id: 'fuze',
		online: 'race',
		title: 'FÚZE',
		group: 'puzzle',
		category: 'arcade',
		tagline: 'Z prachu planety, z planet hvězdy.',
		description:
			'Princip 2048 s vesmírnými tělesy: posouvej a slučuj prach, asteroidy, planety a hvězdy až k supernově a černé díře. Desky 3×3 až 5×5 a pás asteroidů jako překážky.',
		genres: ['Hlavolam', 'Slučování', '2048'],
		features: ['Denní výzva + série', 'Cesta: 120 úkolů', '4 desky', '16 vesmírných těles'],
		en: {
			tagline: 'Dust into planets, planets into stars.',
			description:
				'2048 with cosmic bodies: slide and merge dust, asteroids, planets and stars up to a supernova and a black hole. Boards from 3×3 to 5×5 and an asteroid belt of obstacles.',
			genres: ['Puzzle', 'Merge', '2048'],
			features: ['Daily puzzle + streaks', 'Path: 120 challenges', '4 boards', '16 cosmic bodies'],
		},
		statLabels: labels,
		path: '/games/fuze/index.html',
		colors: ['#ffb347', '#ff4fd8', '#7a2cff'],
		statsKey: 'gamecenter.stats.fuze',
		cover(ctx, w, h, t) {
			sky(ctx, w, h, t, ['#ffb347', '#ff4fd8', '#7a2cff'], 6);
			const s = Math.min(w, h) * 0.17;
			const vals = [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4, 8, 2, 16, 4];
			const hues = [210, 190, 170, 140, 100, 60, 40, 20, 0, 330, 300, 190, 170, 210, 140, 190];
			const x0 = (w - 4 * s - 3 * 6) / 2;
			const y0 = h * 0.1;
			vals.forEach((v, i) => {
				const x = x0 + (i % 4) * (s + 6);
				const y = y0 + Math.floor(i / 4) * (s + 6);
				const pulse = i === Math.floor(t) % 16 ? 1.08 : 1;
				ctx.save();
				ctx.translate(x + s / 2, y + s / 2);
				ctx.scale(pulse, pulse);
				const g = ctx.createRadialGradient(-s * 0.15, -s * 0.2, 1, 0, 0, s * 0.7);
				g.addColorStop(0, `hsl(${hues[i]} 95% 72%)`);
				g.addColorStop(1, `hsl(${hues[i]} 80% 38%)`);
				ctx.fillStyle = g;
				ctx.beginPath();
				ctx.roundRect(-s / 2, -s / 2, s, s, s * 0.18);
				ctx.fill();
				ctx.restore();
				glowText(ctx, String(v), x + s / 2, y + s / 2, s * (v > 999 ? 0.24 : 0.32), '#ffffff');
			});
		},
	},
	{
		id: 'miny',
		online: 'race',
		title: 'MINY',
		group: 'puzzle',
		category: 'logic',
		tagline: 'Hledání min bez hádání.',
		description:
			'Klasické hledání min, ale každé pole jde vyřešit čistou logikou z označeného startu. Tři štíty odpustí přehmat. Od 9×9 po 16×30 s 99 minami.',
		genres: ['Hlavolam', 'Logika', 'Miny'],
		features: [...common.cs.slice(0, 3), 'Žádné hádání'],
		en: {
			tagline: 'Minesweeper without guessing.',
			description:
				'Classic minesweeper, but every field can be solved by pure logic from the marked start. Three shields forgive a slip. From 9×9 up to 16×30 with 99 mines.',
			genres: ['Puzzle', 'Logic', 'Mines'],
			features: [...common.en.slice(0, 3), 'No guessing'],
		},
		statLabels: labels,
		path: '/games/miny/index.html',
		colors: ['#55c8ff', '#6dff9e', '#ff7a8a'],
		statsKey: 'gamecenter.stats.miny',
		cover(ctx, w, h, t) {
			sky(ctx, w, h, t, ['#55c8ff', '#6dff9e', '#ff7a8a'], 7);
			const n = 7;
			const c = Math.min(w, h) * 0.105;
			const x0 = (w - n * c) / 2;
			const y0 = h * 0.08;
			const nums = '1110000F2100001F21111223F1F1F2213111110000000';
			const colors = ['', '#55c8ff', '#6dff9e', '#ff7a8a', '#c77dff'];
			const opened = Math.floor(t * 4) % 60;
			for (let i = 0; i < n * n; i++) {
				const x = x0 + (i % n) * c;
				const y = y0 + Math.floor(i / n) * c;
				const ch = nums[i] ?? '0';
				const open = i < opened && ch !== 'F';
				ctx.fillStyle = open ? 'rgba(255,255,255,.05)' : 'rgba(85,200,255,.22)';
				ctx.beginPath();
				ctx.roundRect(x + 1.5, y + 1.5, c - 3, c - 3, c * 0.18);
				ctx.fill();
				if (open && ch !== '0')
					glowText(ctx, ch, x + c / 2, y + c / 2, c * 0.48, colors[Number(ch)] ?? '#fff');
				if (ch === 'F' && i < opened) glowText(ctx, '⚑', x + c / 2, y + c / 2, c * 0.5, '#ff4fd8');
			}
		},
	},
	{
		id: 'omalovanky',
		online: 'race',
		title: 'OMALOVÁNKY',
		group: 'puzzle',
		category: 'relax',
		tagline: 'Malování podle čísel pro chvíle klidu.',
		description:
			'Vybarvuj generované pixelové obrazy podle čísel: kytice, kočky, rybky, domky, houby, motýly, balóny, plachetnice, rakety, planety i mlhoviny. Štětec i kyblík na celé plochy, přibližování dvěma prsty, hotové obrazy se ukládají do galerie.',
		genres: ['Relax', 'Malování', 'Podle čísel'],
		features: ['Denní obraz', 'Cesta: 120 obrazů', '13 druhů motivů', 'Kyblík', 'Galerie'],
		en: {
			tagline: 'Colour by number for quiet moments.',
			description:
				'Paint generated pixel pictures by number: bouquets, cats, fish, cottages, mushrooms, butterflies, balloons, sailboats, rockets, planets and nebulae. A brush and a bucket for whole areas, pinch to zoom; finished pictures go to your gallery.',
			genres: ['Relax', 'Painting', 'By number'],
			features: [
				'Daily picture',
				'Path: 120 pictures',
				'13 kinds of motifs',
				'Bucket fill',
				'Gallery',
			],
		},
		statLabels: labels,
		path: '/games/omalovanky/index.html',
		colors: ['#ff8ae0', '#7dff9b', '#4fd1ff'],
		statsKey: 'gamecenter.stats.omalovanky',
		cover(ctx, w, h, t) {
			sky(ctx, w, h, t, ['#ff8ae0', '#7dff9b', '#4fd1ff'], 8);
			// a hot-air balloon painted colour by colour, numbers on the cells still to paint
			const n = 16,
				c = Math.min(w * 0.8, h * 0.62) / n,
				x0 = (w - n * c) / 2,
				y0 = h * 0.06,
				cells = balloonCells(),
				cyc = (t / 9) % 1,
				shown = Math.min(1, cyc / 0.8) * cells.order.length,
				cur = cells.map[cells.order[Math.min(cells.order.length - 1, Math.floor(shown))] ?? 0] ?? 0;
			ctx.fillStyle = 'rgba(0,0,0,.35)';
			ctx.fillRect(x0 - 3, y0 - 3, n * c + 6, n * c + 6);
			ctx.font = `600 ${c * 0.55}px "Space Grotesk", sans-serif`;
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			for (let i = 0; i < n * n; i++) {
				const k = cells.map[i] ?? 0,
					x = x0 + (i % n) * c,
					y = y0 + Math.floor(i / n) * c,
					rank = cells.rank[i] ?? 0;
				if (rank < shown) {
					ctx.fillStyle = BALLOON_PAL[k] ?? '#000';
					ctx.fillRect(x, y, c + 0.5, c + 0.5);
					continue;
				}
				ctx.fillStyle = k === cur ? '#d9d2ff' : '#f2f0f8';
				ctx.fillRect(x + 0.5, y + 0.5, c - 1, c - 1);
				ctx.fillStyle = k === cur ? '#1b1048' : 'rgba(60,56,90,.6)';
				ctx.fillText(String(k + 1), x + c / 2, y + c / 2 + 0.5);
			}
			if (cyc > 0.8) {
				const k = (cyc - 0.8) / 0.2,
					gx = x0 - n * c * 0.3 + k * n * c * 1.6,
					g = ctx.createLinearGradient(gx - c * 3, y0, gx + c * 3, y0 + n * c);
				g.addColorStop(0, 'rgba(255,255,255,0)');
				g.addColorStop(0.5, 'rgba(255,255,255,.5)');
				g.addColorStop(1, 'rgba(255,255,255,0)');
				ctx.fillStyle = g;
				ctx.fillRect(x0, y0, n * c, n * c);
			}
			// the palette under the picture, current colour raised
			const r = c * 0.62,
				py = y0 + n * c + r * 2;
			BALLOON_PAL.forEach((col, k) => {
				const px = w / 2 + (k - (BALLOON_PAL.length - 1) / 2) * r * 2.5,
					on = k === cur && cyc <= 0.8;
				ctx.fillStyle = col;
				ctx.beginPath();
				ctx.arc(px, py - (on ? r * 0.3 : 0), on ? r * 1.15 : r, 0, TAU);
				ctx.fill();
				if (on) {
					ctx.strokeStyle = '#fff';
					ctx.lineWidth = 2;
					ctx.stroke();
				}
			});
		},
	},
	{
		id: 'solitaire',
		online: 'race',
		title: 'SOLITAIRE',
		group: 'puzzle',
		category: 'board',
		tagline: 'Klondike, FreeCell a Pavouk pod hvězdami.',
		description:
			'Klasické karetní pasiánsy: Klondike po jedné i po třech kartách, FreeCell a Pavouk v jedné nebo dvou barvách. Rozdání Klondike na denní výzvě a na Cestě jde vždy dohrát.',
		genres: ['Karty', 'Pasiáns', 'Klondike'],
		features: ['Denní partie pro všechny', 'Cesta: 120 rozdání', '5 variant', 'Dohratelná rozdání'],
		en: {
			tagline: 'Klondike, FreeCell and Spider under the stars.',
			description:
				'Classic patience games: Klondike draw one and draw three, FreeCell, and Spider with one or two suits. Klondike deals in the daily and on the Path can always be won.',
			genres: ['Cards', 'Patience', 'Klondike'],
			features: ['Daily deal for everyone', 'Path: 120 deals', '5 variants', 'Winnable deals'],
		},
		statLabels: labels,
		path: '/games/solitaire/index.html',
		colors: ['#ff4f8b', '#ffd166', '#7a2cff'],
		statsKey: 'gamecenter.stats.solitaire',
		cover(ctx, w, h, t) {
			sky(ctx, w, h, t, ['#ff4f8b', '#ffd166', '#7a2cff'], 9);
			const cw = Math.min(w * 0.2, h * 0.24);
			const ch = cw * 1.4;
			// the same muted ivory cards with vector suits as in the game; kind -1 is a card back
			const SUIT = [
				'M10 1.2C8 4 2 7.6 2 11.6c0 2.7 2 4.5 4.4 4.5 1.4 0 2.6-.7 3.2-1.6-.3 2-1.2 3.4-2.8 4.3h6.4c-1.6-.9-2.5-2.3-2.8-4.3.6.9 1.8 1.6 3.2 1.6 2.4 0 4.4-1.8 4.4-4.5C18 7.6 12 4 10 1.2z',
				'M10 18C4.2 13.6 1.2 10.2 1.2 6.6 1.2 3.8 3.3 1.8 5.9 1.8c1.8 0 3.2 1 4.1 2.5.9-1.5 2.3-2.5 4.1-2.5 2.6 0 4.7 2 4.7 4.8 0 3.6-3 7-8.8 11.4z',
				'M10 .8 17.6 10 10 19.2 2.4 10z',
				'M10 1.4a4.2 4.2 0 1 1 0 8.4a4.2 4.2 0 1 1 0-8.4zM5 7a4.2 4.2 0 1 1 0 8.4A4.2 4.2 0 1 1 5 7zm10 0a4.2 4.2 0 1 1 0 8.4a4.2 4.2 0 1 1 0-8.4zM9 10.5 7.6 18.8h4.8L11 10.5z',
			].map((d) => new Path2D(d));
			const suit = (s: number, x: number, y: number, size: number) => {
				const p = SUIT[s];
				if (!p) return;
				ctx.save();
				ctx.translate(x - size / 2, y - size / 2);
				ctx.scale(size / 20, size / 20);
				ctx.fill(p);
				ctx.restore();
			};
			const gold = '#d9b468';
			const cards: [string, number][] = [
				['', -1],
				['K', 0],
				['Q', 1],
				['A', 2],
				['7', 3],
			];
			cards.forEach(([rank, s], i) => {
				const a = (i - 2) * 0.22 + Math.sin(t * 0.8 + i) * 0.02;
				ctx.save();
				ctx.translate(w / 2 + (i - 2) * cw * 0.5, h * 0.42 + Math.abs(i - 2) * cw * 0.08);
				ctx.rotate(a);
				ctx.shadowColor = 'rgba(0,0,0,.55)';
				ctx.shadowBlur = 14;
				const g = ctx.createLinearGradient(-cw / 2, -ch / 2, cw / 2, ch / 2);
				if (s < 0) {
					g.addColorStop(0, '#4b33b8');
					g.addColorStop(1, '#130b3c');
				} else {
					g.addColorStop(0, '#e6e0d6');
					g.addColorStop(1, '#cec6ba');
				}
				ctx.fillStyle = g;
				ctx.beginPath();
				ctx.roundRect(-cw / 2, -ch / 2, cw, ch, cw * 0.09);
				ctx.fill();
				ctx.shadowBlur = 0;
				if (s < 0) {
					ctx.strokeStyle = gold;
					ctx.lineWidth = 1.5;
					ctx.beginPath();
					ctx.roundRect(-cw * 0.44, -ch * 0.455, cw * 0.88, ch * 0.91, cw * 0.06);
					ctx.stroke();
					ctx.fillStyle = '#140c44';
					ctx.beginPath();
					ctx.arc(0, 0, cw * 0.21, 0, TAU);
					ctx.fill();
					ctx.stroke();
					ctx.fillStyle = gold;
					ctx.beginPath();
					for (let k = 0; k < 8; k++) {
						const r = k % 2 ? cw * 0.04 : cw * 0.16;
						const an = (k * Math.PI) / 4 - Math.PI / 2;
						ctx.lineTo(Math.cos(an) * r, Math.sin(an) * r);
					}
					ctx.fill();
					ctx.restore();
					return;
				}
				const col = s === 1 || s === 2 ? '#b8405f' : '#3a3466';
				if (rank === 'K' || rank === 'Q') {
					ctx.fillStyle = s === 1 ? '#e4cfcf' : '#d3d2e2';
					ctx.strokeStyle = gold;
					ctx.lineWidth = 1.5;
					ctx.beginPath();
					ctx.roundRect(-cw * 0.28, -ch * 0.38, cw * 0.56, ch * 0.76, cw * 0.05);
					ctx.fill();
					ctx.stroke();
				}
				ctx.fillStyle = col;
				ctx.font = `900 ${cw * 0.2}px Unbounded, sans-serif`;
				ctx.textAlign = 'center';
				ctx.textBaseline = 'top';
				ctx.fillText(rank, -cw * 0.38, -ch * 0.46);
				suit(s, -cw * 0.38, -ch * 0.24, cw * 0.13);
				if (rank === 'K' || rank === 'Q') {
					ctx.font = `900 ${cw * 0.32}px Unbounded, sans-serif`;
					ctx.textBaseline = 'middle';
					ctx.fillText(rank, 0, ch * 0.08);
					suit(s, 0, -ch * 0.18, cw * 0.18);
				} else if (rank === 'A') {
					ctx.strokeStyle = gold;
					ctx.lineWidth = 1.2;
					ctx.beginPath();
					ctx.arc(0, ch * 0.02, cw * 0.27, 0, TAU);
					ctx.stroke();
					suit(s, 0, ch * 0.02, cw * 0.4);
				} else {
					suit(s, 0, ch * 0.05, cw * 0.36);
				}
				ctx.restore();
			});
		},
	},
	{
		id: 'mahjong',
		online: 'race',
		title: 'MAHJONG',
		group: 'puzzle',
		category: 'board',
		tagline: 'Dvojice nebeských kamenů.',
		description:
			'Mahjong solitaire: odebírej dvojice stejných volných kamenů s hvězdami, planetami, kometami a souhvězdími. Kámen, na který klepneš, odletí do přihrádky se čtyřmi místy a dva stejné v ní zmizí. Některé kameny leží lícem dolů. Želva, Pyramida, Pevnost, Věž a generovaná rozložení, která jdou vždy dohrát.',
		genres: ['Hlavolam', 'Kameny', 'Mahjong'],
		features: ['Denní Želva', 'Cesta: 120 rozložení', 'Přihrádka na 4 kameny', 'Skryté kameny'],
		en: {
			tagline: 'Pairs of celestial tiles.',
			description:
				'Mahjong solitaire: remove pairs of matching free tiles with stars, planets, comets and zodiacs. Tapped tiles fly to a four-place tray where two matching tiles vanish. Some tiles lie face down. Turtle, Pyramid, Fortress, Tower and generated layouts that can always be cleared.',
			genres: ['Puzzle', 'Tiles', 'Mahjong'],
			features: ['Daily Turtle', 'Path: 120 layouts', '4-tile tray', 'Hidden tiles'],
		},
		statLabels: labels,
		path: '/games/mahjong/index.html',
		colors: ['#ffd166', '#18a37a', '#e0446a'],
		statsKey: 'gamecenter.stats.mahjong',
		cover(ctx, w, h, t) {
			sky(ctx, w, h, t, ['#ffd166', '#18a37a', '#e0446a'], 10);
			const tw = Math.min(w / 5.6, h / 5.8);
			const th = tw * 1.34;
			const d = tw * 0.1;
			// ivory face, gold frame, jade body; kind -1 is a face-down tile
			const tile = (px: number, py: number, s: number, kind: number, glow = 0) => {
				const ww = tw * s;
				const hh = th * s;
				const dd = d * s;
				ctx.fillStyle = '#0b5f52';
				ctx.beginPath();
				ctx.roundRect(px + dd * 1.4, py + dd * 1.4, ww, hh, ww * 0.16);
				ctx.fill();
				ctx.fillStyle = '#1fae94';
				ctx.beginPath();
				ctx.roundRect(px + dd, py + dd, ww, hh, ww * 0.16);
				ctx.fill();
				if (glow) {
					ctx.shadowColor = '#6dff9e';
					ctx.shadowBlur = 24 * glow;
				}
				const g = ctx.createLinearGradient(px, py, px + ww, py + hh);
				if (kind < 0) {
					g.addColorStop(0, '#2b5d9a');
					g.addColorStop(1, '#0b1a3a');
				} else {
					g.addColorStop(0, '#fffdf7');
					g.addColorStop(1, '#efe2c6');
				}
				ctx.fillStyle = g;
				ctx.beginPath();
				ctx.roundRect(px, py, ww, hh, ww * 0.16);
				ctx.fill();
				ctx.shadowBlur = 0;
				ctx.strokeStyle = kind < 0 ? 'rgba(232,197,116,.5)' : 'rgba(190,150,80,.45)';
				ctx.lineWidth = 1;
				ctx.beginPath();
				ctx.roundRect(px + ww * 0.08, py + ww * 0.08, ww * 0.84, hh - ww * 0.16, ww * 0.1);
				ctx.stroke();
				const cx = px + ww / 2;
				const cy = py + hh / 2;
				if (kind < 0) {
					ctx.fillStyle = '#f4d68a';
					ctx.beginPath();
					for (let k = 0; k < 8; k++) {
						const r = k % 2 ? ww * 0.07 : ww * 0.26;
						const a = (k * Math.PI) / 4 - Math.PI / 2;
						ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
					}
					ctx.fill();
					return;
				}
				const cols = ['#1f4fd8', '#e0446a', '#14b08a', '#ff9a1f', '#9b3dff'];
				const col = cols[kind % cols.length] ?? '#1f4fd8';
				if (kind === 3) {
					ctx.strokeStyle = '#ff9a1f';
					ctx.lineWidth = ww * 0.04;
					for (let k = 0; k < 12; k++) {
						const a = (k * Math.PI) / 6;
						ctx.beginPath();
						ctx.moveTo(cx + Math.cos(a) * ww * 0.26, cy + Math.sin(a) * ww * 0.26);
						ctx.lineTo(cx + Math.cos(a) * ww * 0.36, cy + Math.sin(a) * ww * 0.36);
						ctx.stroke();
					}
				}
				const rg = ctx.createRadialGradient(cx - ww * 0.06, cy - ww * 0.06, 0, cx, cy, ww * 0.24);
				rg.addColorStop(0, '#ffffff');
				rg.addColorStop(0.35, col);
				rg.addColorStop(1, '#1b1240');
				ctx.fillStyle = rg;
				ctx.beginPath();
				ctx.arc(cx, cy, ww * 0.2, 0, TAU);
				ctx.fill();
				if (kind === 1 || kind === 4) {
					ctx.strokeStyle = col;
					ctx.lineWidth = ww * 0.045;
					ctx.beginPath();
					ctx.ellipse(cx, cy, ww * 0.36, ww * 0.1, -0.35, 0, TAU);
					ctx.stroke();
				}
			};
			// a small stack: base row, second layer, one face-down tile on top
			const x0 = w / 2 - tw * 2.1;
			const y0 = h * 0.15;
			const base = [0, 2, 1, 4, 1, 3, 0, 2];
			base.forEach((k, i) => tile(x0 + (i % 4) * tw, y0 + Math.floor(i / 4) * th, 1, k));
			tile(x0 + tw * 0.5 - d, y0 + th * 0.5 - d, 1, 3);
			tile(x0 + tw * 1.5 - d, y0 + th * 0.5 - d, 1, -1);
			tile(x0 + tw * 2.5 - d, y0 + th * 0.5 - d, 1, 4);
			// the tray: two matching tiles pop, then the cycle repeats
			const ts = 0.62;
			const sw = tw * ts + 8;
			const trayW = sw * 4 + 18;
			const tx = w / 2 - trayW / 2;
			const ty = y0 + th * 2 + tw * 0.35;
			ctx.fillStyle = 'rgba(0,0,0,.45)';
			ctx.beginPath();
			ctx.roundRect(tx, ty, trayW, th * ts + 16, 12);
			ctx.fill();
			const phase = (t * 0.6) % 1;
			const pop = phase > 0.7 ? (phase - 0.7) / 0.3 : 0;
			[2, 2, 0].forEach((k, i) => {
				const gone = i < 2 && pop > 0;
				const s = gone ? ts * (1 - pop) : ts;
				if (s <= 0.02) return;
				const sx = tx + 9 + i * sw + (sw - tw * s) / 2;
				const sy = ty + 8 + (th * ts - th * s) / 2;
				tile(sx, sy, s, k, gone ? 1 - pop : 0);
			});
			if (pop > 0) {
				for (let k = 0; k < 14; k++) {
					const a = (k / 14) * TAU;
					ctx.fillStyle = k % 2 ? '#6dff9e' : '#ffd166';
					ctx.globalAlpha = 1 - pop;
					ctx.beginPath();
					ctx.arc(
						tx + 9 + sw + Math.cos(a) * pop * tw,
						ty + th * ts * 0.5 + Math.sin(a) * pop * tw,
						2.5,
						0,
						TAU,
					);
					ctx.fill();
				}
				ctx.globalAlpha = 1;
			}
		},
	},
	{
		id: 'skladacka',
		online: 'race',
		title: 'SKLÁDAČKA',
		group: 'puzzle',
		category: 'relax',
		tagline: 'Co skládáš, poznáš až na konci.',
		description:
			'Skládej malované obrazy: maják nad mořem, horské jezero, balóny nad údolím, korálový útes, pohádkový hrad, sakurová zahrada, noční město, polární záře, pyramidy i planeta s prstenci, každý v jiné denní době. Po složení se obraz odhalí i se jménem a skončí v galerii. Od 24 do 150 dílků.',
		genres: ['Relax', 'Skládačka', 'Jigsaw'],
		features: ['Denní obraz', 'Cesta: 120 obrazů', '24–150 dílků', 'Galerie'],
		en: {
			tagline: 'You only find out what you built at the end.',
			description:
				'Assemble painted pictures: a lighthouse by the sea, a mountain lake, balloons over a valley, a coral reef, a fairytale castle, a cherry blossom garden, a city at night, the northern lights, pyramids and a ringed planet, each at a different time of day. When done, the picture is revealed with its name and joins your gallery. From 24 to 150 pieces.',
			genres: ['Relax', 'Jigsaw', 'Puzzle'],
			features: ['Daily picture', 'Path: 120 pictures', '24–150 pieces', 'Gallery'],
		},
		statLabels: labels,
		path: '/games/skladacka/index.html',
		colors: ['#3dd6ff', '#ff8ae0', '#7a2cff'],
		statsKey: 'gamecenter.stats.skladacka',
		cover(ctx, w, h, t) {
			sky(ctx, w, h, t, ['#3dd6ff', '#ff8ae0', '#7a2cff'], 11);
			// a painted picture cut into 4 × 3 real jigsaw pieces; a joined pair flies in and snaps home
			const cols = 4,
				rows = 3,
				pw = Math.min(w * 0.82, (h * 0.62 * 4) / 3),
				ph = (pw * 3) / 4,
				cw = pw / cols,
				ch = ph / rows,
				x0 = (w - pw) / 2,
				y0 = h * 0.1;
			const pic = jigsawPicture(Math.round(pw), Math.round(ph));
			ctx.fillStyle = 'rgba(0,0,0,.35)';
			ctx.fillRect(x0, y0, pw, ph);
			ctx.strokeStyle = 'rgba(255,255,255,.25)';
			ctx.lineWidth = 1.5;
			ctx.strokeRect(x0, y0, pw, ph);
			const cyc = (t / 3.4) % 1,
				k = Math.min(1, cyc / 0.5),
				ease = 1 - (1 - k) ** 3,
				snap = cyc > 0.5 && cyc < 0.68 ? 1 - (cyc - 0.5) / 0.18 : 0,
				fade = cyc > 0.92 ? 1 - (cyc - 0.92) / 0.08 : 1;
			const moving = (x: number, y: number) => y === 1 && (x === 2 || x === 3);
			const piece = (x: number, y: number, dx: number, dy: number, rot: number, lift: number) => {
				const px = x0 + x * cw,
					py = y0 + y * ch;
				ctx.save();
				ctx.translate(px + cw / 2 + dx, py + ch / 2 + dy);
				ctx.rotate(rot);
				ctx.translate(-px - cw / 2, -py - ch / 2);
				const path = jigsawPath(x, y, cols, rows, px, py, cw, ch);
				if (lift) {
					ctx.shadowColor = 'rgba(0,0,0,.6)';
					ctx.shadowBlur = 14 * lift;
					ctx.shadowOffsetY = 8 * lift;
					ctx.fillStyle = '#000';
					ctx.fill(path);
					ctx.shadowColor = 'transparent';
				}
				ctx.save();
				ctx.clip(path);
				ctx.drawImage(pic, x0, y0, pw, ph);
				ctx.restore();
				ctx.strokeStyle = 'rgba(0,0,0,.5)';
				ctx.lineWidth = 2.2;
				ctx.stroke(path);
				ctx.strokeStyle = 'rgba(255,255,255,.35)';
				ctx.lineWidth = 1;
				ctx.stroke(path);
				ctx.restore();
			};
			for (let y = 0; y < rows; y++)
				for (let x = 0; x < cols; x++)
					if (!moving(x, y) && !(x === 0 && y === 2)) piece(x, y, 0, 0, 0, 0);
			// one loose piece waits beside the board
			piece(0, 2, -cw * 0.25, ch * 0.75, -0.25, 0.6);
			ctx.globalAlpha = fade;
			const ox = (1 - ease) * cw * 0.9,
				oy = (1 - ease) * ch * 1.7,
				rot = (1 - ease) * 0.3;
			// the joined pair rotates as one around its shared seam
			const sx = Math.cos(rot) * cw * 0.5,
				sy = Math.sin(rot) * cw * 0.5;
			piece(2, 1, ox + cw * 0.5 - sx, oy - sy, rot, 1 - ease);
			piece(3, 1, ox - cw * 0.5 + sx, oy + sy, rot, 1 - ease);
			ctx.globalAlpha = 1;
			if (snap > 0) {
				ctx.strokeStyle = `rgba(255,255,255,${snap * 0.9})`;
				ctx.lineWidth = 3;
				ctx.shadowColor = '#ff8ae0';
				ctx.shadowBlur = 16 * snap;
				ctx.stroke(jigsawPath(2, 1, cols, rows, x0 + 2 * cw, y0 + ch, cw, ch));
				ctx.stroke(jigsawPath(3, 1, cols, rows, x0 + 3 * cw, y0 + ch, cw, ch));
				ctx.shadowBlur = 0;
				ctx.shadowColor = 'transparent';
			}
		},
	},
	{
		id: 'sachy',
		online: 'turn',
		title: 'ŠACHY',
		group: 'puzzle',
		category: 'board',
		tagline: 'Šachy pod hvězdami.',
		description:
			'Šachy proti počítači v šesti silách od nováčka po mistra, denní úloha mat v 1–2 tazích, Cesta hvězd střídající úlohy a partie a hra ve dvou na jednom zařízení.',
		genres: ['Strategie', 'Šachy', 'Úlohy'],
		features: [
			'Denní úloha: mat v 1–2',
			'Cesta: 120 úloh a partií',
			'6 sil soupeře',
			'Hra ve dvou',
		],
		en: {
			tagline: 'Chess under the stars.',
			description:
				'Chess against the computer at six strengths from novice to master, a daily mate-in-1–2 puzzle, a Star Path that alternates puzzles and games, and two players on one device.',
			genres: ['Strategy', 'Chess', 'Puzzles'],
			features: [
				'Daily mate-in-1–2',
				'Path: 120 puzzles & games',
				'6 opponent strengths',
				'Two players',
			],
		},
		statLabels: labels,
		path: '/games/sachy/index.html',
		colors: ['#ffd166', '#5b6cff', '#b14cff'],
		statsKey: 'gamecenter.stats.sachy',
		cover(ctx, w, h, t) {
			sky(ctx, w, h, t, ['#ffd166', '#5b6cff', '#b14cff'], 12);
			// a corner of a wooden board: the white knight jumps and checks the black king
			const n = 5,
				s = Math.min((w * 0.84) / n, (h * 0.6) / n),
				x0 = (w - n * s) / 2,
				y0 = h * 0.08;
			ctx.fillStyle = '#4a2e1a';
			ctx.beginPath();
			ctx.roundRect(x0 - s * 0.12, y0 - s * 0.12, n * s + s * 0.24, n * s + s * 0.24, s * 0.12);
			ctx.fill();
			const cyc = (t / 3.6) % 1,
				k = Math.min(1, Math.max(0, (cyc - 0.25) / 0.3)),
				check = cyc > 0.55 && cyc < 0.95;
			for (let y = 0; y < n; y++)
				for (let x = 0; x < n; x++) {
					ctx.fillStyle = (x + y) % 2 ? '#b98a5e' : '#f0dbb4';
					ctx.fillRect(x0 + x * s, y0 + y * s, s, s);
				}
			if (check) {
				const g = ctx.createRadialGradient(
					x0 + 3.5 * s,
					y0 + 0.5 * s,
					0,
					x0 + 3.5 * s,
					y0 + 0.5 * s,
					s * 0.7,
				);
				g.addColorStop(0, 'rgba(255,60,60,.9)');
				g.addColorStop(1, 'rgba(255,60,60,0)');
				ctx.fillStyle = g;
				ctx.fillRect(x0 + 3 * s, y0, s, s);
			}
			ctx.fillStyle = 'rgba(205,210,60,.42)';
			if (k >= 1) {
				ctx.fillRect(x0, y0 + 3 * s, s, s);
				ctx.fillRect(x0 + s, y0 + s, s, s);
			}
			const put = (type: number, white: boolean, x: number, y: number, lift = 0) =>
				coverChessPiece(ctx, type, white, x0 + x * s, y0 + y * s - lift, s);
			put(4, false, 0, 0);
			put(6, false, 3, 0);
			put(1, false, 2, 1);
			put(1, false, 4, 1);
			put(3, false, 4, 0);
			put(1, true, 3, 3);
			put(5, true, 4, 4);
			put(6, true, 2, 4);
			// the knight's L-jump: a shadow on the board and the piece arcing above it
			const kx = k,
				ky = 3 - 2 * k,
				lift = Math.sin(k * Math.PI) * s * 0.7;
			if (lift > 0) {
				ctx.fillStyle = 'rgba(0,0,0,.25)';
				ctx.beginPath();
				ctx.ellipse(x0 + (kx + 0.5) * s, y0 + (ky + 0.85) * s, s * 0.3, s * 0.08, 0, 0, TAU);
				ctx.fill();
			}
			put(2, true, kx, ky, lift);
		},
	},
	{
		id: 'piskvorky',
		online: 'turn',
		title: 'PIŠKVORKY',
		group: 'puzzle',
		category: 'board',
		tagline: 'Pět hvězd v řadě.',
		description:
			'Piškvorky na 15×15: hvězdy proti planetám. Soupeř ve čtyřech silách, který hlídá hrozby a počítá vynucené výhry, denní zahájení, Cesta hvězd a hra ve dvou na jednom zařízení.',
		genres: ['Strategie', 'Piškvorky', 'Gomoku'],
		features: ['Denní zahájení', 'Cesta: 120 partií', '4 síly soupeře', 'Hra ve dvou'],
		en: {
			tagline: 'Five stars in a row.',
			description:
				'Gomoku on 15×15: stars against planets. An opponent at four strengths that watches threats and calculates forced wins, a daily opening, the Star Path and two players on one device.',
			genres: ['Strategy', 'Gomoku', 'Five in a row'],
			features: ['Daily opening', 'Path: 120 games', '4 opponent strengths', 'Two players'],
		},
		statLabels: labels,
		path: '/games/piskvorky/index.html',
		colors: ['#3dd6ff', '#ff9a1f', '#e0446a'],
		statsKey: 'gamecenter.stats.piskvorky',
		cover(ctx, w, h, t) {
			sky(ctx, w, h, t, ['#3dd6ff', '#ff9a1f', '#e0446a'], 13);
			const n = 7;
			const s = Math.min(w * 0.62, h * 0.66) / n;
			const x0 = w / 2 - (s * n) / 2;
			const y0 = h * 0.08;
			ctx.strokeStyle = 'rgba(255,255,255,.18)';
			ctx.lineWidth = 1;
			for (let i = 0; i <= n; i++) {
				ctx.beginPath();
				ctx.moveTo(x0 + i * s, y0);
				ctx.lineTo(x0 + i * s, y0 + n * s);
				ctx.moveTo(x0, y0 + i * s);
				ctx.lineTo(x0 + n * s, y0 + i * s);
				ctx.stroke();
			}
			const lit = Math.floor(t * 1.2) % 6;
			for (let i = 0; i < 5; i++) {
				if (i > lit) break;
				glowText(ctx, '★', x0 + (i + 1) * s + s / 2, y0 + (i + 1) * s + s / 2, s * 0.8, '#3dd6ff');
			}
			const planets: [number, number][] = [
				[2, 1],
				[4, 2],
				[1, 4],
				[5, 4],
			];
			planets.forEach(([x, y]) => {
				ctx.fillStyle = '#ff9a1f';
				ctx.beginPath();
				ctx.arc(x0 + x * s + s / 2, y0 + y * s + s / 2, s * 0.3, 0, TAU);
				ctx.fill();
			});
		},
	},
	{
		id: 'sokoban',
		online: 'race',
		title: 'SOKOBAN',
		group: 'puzzle',
		category: 'logic',
		tagline: 'Skladník ve vesmírném skladu.',
		description:
			'Klasický Sokoban: dotlač všechny bedny na zářící cíle a nezasekni se v rohu. Každý sklad je vygenerovaný a zaručeně řešitelný, s limitem posunů na tři hvězdy, neomezeným vracením tahů a nápovědou.',
		genres: ['Logika', 'Sokoban', 'Hlavolam'],
		features: ['Denní sklad', 'Cesta: 120 skladů', '2–5 beden', 'Limit posunů'],
		en: {
			tagline: 'A warehouse keeper in a space depot.',
			description:
				'Classic Sokoban: push every crate onto a glowing goal without getting stuck in a corner. Every depot is generated and guaranteed solvable, with a push par for three stars, unlimited undo and hints.',
			genres: ['Logic', 'Sokoban', 'Puzzle'],
			features: ['Daily depot', 'Path: 120 depots', '2–5 crates', 'Push par'],
		},
		statLabels: labels,
		path: '/games/sokoban/index.html',
		colors: ['#ffb547', '#7fd8ff', '#6b4cff'],
		statsKey: 'gamecenter.stats.sokoban',
		cover(ctx, w, h, t) {
			sky(ctx, w, h, t, ['#ffb547', '#7fd8ff', '#6b4cff'], 17);
			// a little depot: the robot keeper pushes a crate along the row onto the glowing pad
			const map = ['#######', '#  #  #', '#     #', '#    .#', '#######'];
			const s = Math.min((w * 0.84) / 7, (h * 0.6) / 5),
				x0 = w / 2 - s * 3.5,
				y0 = h * 0.08;
			map.forEach((row, y) =>
				[...row].forEach((c, x) => {
					const X = x0 + x * s,
						Y = y0 + y * s;
					if (c === '#') {
						ctx.fillStyle = '#41467c';
						ctx.fillRect(X - 0.5, Y - 0.5, s + 1, s + 1);
						ctx.strokeStyle = 'rgba(10,10,40,.35)';
						ctx.lineWidth = Math.max(1, s * 0.025);
						ctx.beginPath();
						ctx.moveTo(X, Y + s / 2);
						ctx.lineTo(X + s, Y + s / 2);
						ctx.moveTo(X + (y % 2 ? s / 2 : 0), Y);
						ctx.lineTo(X + (y % 2 ? s / 2 : 0), Y + s / 2);
						ctx.stroke();
						if (map[y + 1]?.[x] && map[y + 1]?.[x] !== '#') {
							ctx.fillStyle = '#1d2046';
							ctx.fillRect(X - 0.5, Y + s * 0.72, s + 1, s * 0.28 + 0.5);
							ctx.fillStyle = 'rgba(127,216,255,.5)';
							ctx.fillRect(X + s * 0.1, Y + s * 0.84, s * 0.8, Math.max(1, s * 0.04));
						}
						return;
					}
					ctx.fillStyle = '#26244a';
					ctx.fillRect(X, Y, s, s);
					ctx.strokeStyle = 'rgba(255,255,255,.06)';
					ctx.lineWidth = 1;
					ctx.strokeRect(X + s * 0.07, Y + s * 0.07, s * 0.86, s * 0.86);
					if (c === '.') {
						ctx.save();
						ctx.shadowColor = '#7fd8ff';
						ctx.shadowBlur = s * 0.4;
						ctx.strokeStyle = '#7fd8ff';
						ctx.lineWidth = s * 0.05;
						ctx.setLineDash([s * 0.12, s * 0.08]);
						ctx.lineDashOffset = -t * s * 0.4;
						ctx.strokeRect(X + s * 0.18, Y + s * 0.18, s * 0.64, s * 0.64);
						ctx.restore();
					}
				}),
			);
			// three pushes, one tile each, then the crate glows on the pad
			const cyc = (t / 4.5) % 1,
				k = Math.max(0, Math.min(3, (cyc - 0.1) / 0.18)),
				stepK = Math.floor(k) + Math.min(1, ((k % 1) * 1.6) ** 2),
				cx = 2 + Math.min(3, stepK),
				on = cyc > 0.66,
				fade = cyc > 0.94 ? 1 - (cyc - 0.94) / 0.06 : 1;
			ctx.globalAlpha = fade;
			sokobanCrate(ctx, x0 + cx * s, y0 + 3 * s, s, on, t);
			sokobanBot(ctx, x0 + (cx - 1) * s, y0 + 3 * s, s, t, k < 3 && cyc > 0.1);
			ctx.globalAlpha = 1;
		},
	},
	{
		id: 'clickomania',
		online: 'race',
		title: 'CLICKOMANIA',
		group: 'puzzle',
		category: 'arcade',
		tagline: 'Nech prasknout skupiny krystalů.',
		description:
			'Klasická Clickomania: klepni na skupinu aspoň dvou stejných krystalů, zbytek spadne dolů a prázdné sloupce se přisunou. Vyčisti celou plochu. Každá deska je ověřená řešitelem, takže jde vždy vyčistit.',
		genres: ['Logika', 'Clickomania', 'Hlavolam'],
		features: ['Denní deska', 'Cesta: 120 desek', '3–5 barev', 'Vždy řešitelná'],
		en: {
			tagline: 'Let groups of crystals burst.',
			description:
				'Classic Clickomania: tap a group of two or more matching crystals, the rest falls down and empty columns slide in. Clear the whole board. Every board is checked by a solver, so it can always be cleared.',
			genres: ['Logic', 'Clickomania', 'Puzzle'],
			features: ['Daily board', 'Path: 120 boards', '3–5 colours', 'Always solvable'],
		},
		statLabels: labels,
		path: '/games/clickomania/index.html',
		colors: ['#ff5f7e', '#ffc04d', '#5d9bff'],
		statsKey: 'gamecenter.stats.clickomania',
		cover(ctx, w, h, t) {
			sky(ctx, w, h, t, ['#ff5f7e', '#ffc04d', '#5d9bff'], 19);
			const cols = 7;
			const rows = 5;
			const s = Math.min((w * 0.66) / cols, (h * 0.6) / rows);
			const x0 = w / 2 - (s * cols) / 2;
			const y0 = h * 0.1;
			const colors = ['#ff5f7e', '#ffc04d', '#3ddc97', '#5d9bff', '#c06bff'];
			// a group of three bursts and rebuilds in a loop
			const phase = (t * 0.6) % 1;
			for (let x = 0; x < cols; x++)
				for (let y = 0; y < rows; y++) {
					const c = (x * 7 + y * 3 + ((x * y) % 4)) % colors.length;
					const burst = y === rows - 1 && x >= 2 && x <= 4;
					const k = burst ? Math.max(0, 1 - Math.max(0, phase - 0.5) * 4) : 1;
					if (k <= 0) continue;
					const cx = x0 + x * s + s / 2;
					const cy = y0 + y * s + s / 2;
					const r = (s / 2 - 3) * k;
					ctx.save();
					ctx.fillStyle = burst ? '#3ddc97' : (colors[c] ?? '#fff');
					if (burst) {
						ctx.shadowColor = '#3ddc97';
						ctx.shadowBlur = s * 0.6 * (0.5 + 0.5 * Math.sin(t * 6));
					}
					ctx.beginPath();
					ctx.roundRect(cx - r, cy - r, r * 2, r * 2, r * 0.45);
					ctx.fill();
					ctx.restore();
					ctx.fillStyle = 'rgba(255,255,255,.35)';
					ctx.fillRect(cx - r * 0.5, cy - r * 0.75, r, r * 0.22);
				}
		},
	},
	{
		id: 'mlsoun',
		online: 'race',
		title: 'MLSOUN',
		group: 'puzzle',
		category: 'arcade',
		tagline: 'Spořádej tečky, utíkej přízrakům.',
		description:
			'Honička v neonovém bludišti na motivy Pac-Mana: sněz všechny tečky a nenech se chytit čtyřmi přízraky, z nichž každý honí jinak. Velká tečka je vyleká a pak je můžeš sníst. Každé bludiště je nové, denní je pro všechny stejné.',
		genres: ['Arkáda', 'Bludiště', 'Honička'],
		features: ['Denní bludiště', 'Cesta: 120 bludišť', 'Arkáda na skóre', 'Tah prstem i šipky'],
		en: {
			tagline: 'Eat the dots, run from the ghosts.',
			description:
				"A chase through a neon maze in the spirit of Pac-Man: eat every dot and don't get caught by four ghosts that each hunt differently. A big dot scares them and then you can eat them. Every maze is new; the daily one is the same for everyone.",
			genres: ['Arcade', 'Maze', 'Chase'],
			features: ['Daily maze', 'Path: 120 mazes', 'Arcade for score', 'Swipe or arrows'],
		},
		statLabels: labels,
		path: '/games/mlsoun/index.html',
		colors: ['#ffe066', '#5d7bff', '#ff5a7a'],
		statsKey: 'gamecenter.stats.mlsoun',
		cover(ctx, w, h, t) {
			sky(ctx, w, h, t, ['#ffe066', '#5d7bff', '#ff5a7a'], 23);
			const s = Math.min(w / 9, h / 12);
			const y = h * 0.36;
			// maze walls above and below the corridor
			ctx.strokeStyle = '#5d7bff';
			ctx.lineWidth = Math.max(2, s * 0.12);
			ctx.shadowColor = '#5d7bff';
			ctx.shadowBlur = s * 0.5;
			ctx.beginPath();
			ctx.roundRect(w * 0.06, y - s * 1.1, w * 0.88, s * 0.5, s * 0.25);
			ctx.roundRect(w * 0.06, y + s * 0.6, w * 0.88, s * 0.5, s * 0.25);
			ctx.stroke();
			ctx.shadowBlur = 0;
			// the muncher runs right, eating dots; a ghost follows
			const span = w * 0.88;
			const px = w * 0.06 + ((t * s * 2.2) % (span + s * 3)) - s;
			ctx.fillStyle = '#ffd9a8';
			for (let x = w * 0.1; x < w * 0.94; x += s * 0.8)
				if (x > px + s * 0.2) ctx.fillRect(x - s * 0.07, y - s * 0.07, s * 0.14, s * 0.14);
			const open = 0.1 + 0.5 * Math.abs(Math.sin(t * 9));
			ctx.fillStyle = '#ffe066';
			ctx.shadowColor = '#ffe066';
			ctx.shadowBlur = s * 0.6;
			ctx.beginPath();
			ctx.moveTo(px, y);
			ctx.arc(px, y, s * 0.42, open, TAU - open);
			ctx.closePath();
			ctx.fill();
			const gx = px - s * 1.8;
			const r = s * 0.42;
			ctx.fillStyle = '#ff5a7a';
			ctx.shadowColor = '#ff5a7a';
			ctx.beginPath();
			ctx.arc(gx, y - r * 0.1, r, Math.PI, 0);
			ctx.lineTo(gx + r, y + r * 0.85);
			for (let k = 0; k < 3; k++)
				ctx.quadraticCurveTo(
					gx + r - (k + 0.5) * ((2 * r) / 3),
					y + r * 0.55,
					gx + r - (k + 1) * ((2 * r) / 3),
					y + r * 0.85,
				);
			ctx.closePath();
			ctx.fill();
			ctx.shadowBlur = 0;
			ctx.fillStyle = '#fff';
			ctx.beginPath();
			ctx.arc(gx - r * 0.35, y - r * 0.2, r * 0.24, 0, TAU);
			ctx.moveTo(gx + r * 0.59, y - r * 0.2);
			ctx.arc(gx + r * 0.35, y - r * 0.2, r * 0.24, 0, TAU);
			ctx.fill();
			ctx.fillStyle = '#1b1a52';
			ctx.beginPath();
			ctx.arc(gx - r * 0.25, y - r * 0.2, r * 0.12, 0, TAU);
			ctx.moveTo(gx + r * 0.57, y - r * 0.2);
			ctx.arc(gx + r * 0.45, y - r * 0.2, r * 0.12, 0, TAU);
			ctx.fill();
		},
	},
	{
		id: 'had',
		online: 'race',
		title: 'HAD',
		group: 'puzzle',
		category: 'arcade',
		tagline: 'Sbírej plody, rosti, nenaraz.',
		description:
			'Klasický had v neonu: veď ho pro plody, každý ho prodlouží a zrychlí, a nesmíš narazit do zdi ani do vlastního ocasu. Sprint na mapě s překážkami, nekonečná Klasika a režim bez stěn, kde okrajem projdeš na druhou stranu.',
		genres: ['Arkáda', 'Had', 'Postřeh'],
		features: ['Denní sprint', 'Cesta: 120 map', 'Skóre i bez stěn', 'Tah prstem i šipky'],
		en: {
			tagline: 'Eat the fruit, grow, don’t crash.',
			description:
				'The classic snake in neon: guide it to the fruit, every one makes it longer and faster, and don’t hit a wall or your own tail. A sprint on a map with obstacles, endless Classic and a no-walls mode where you pass through the edges.',
			genres: ['Arcade', 'Snake', 'Reflexes'],
			features: ['Daily sprint', 'Path: 120 maps', 'Score and no walls', 'Swipe or arrows'],
		},
		statLabels: labels,
		path: '/games/had/index.html',
		colors: ['#6dff9e', '#55f6ff', '#ff5a7a'],
		statsKey: 'gamecenter.stats.had',
		cover(ctx, w, h, t) {
			// a night garden: the striped snake slithers along a wave and snaps up an apple
			const c = Math.min(w, h) / 9;
			for (let y = 0; y * c < h; y++)
				for (let x = 0; x * c < w; x++) {
					ctx.fillStyle = (x + y) % 2 ? '#13301f' : '#16372a';
					ctx.fillRect(x * c, y * c, c + 0.5, c + 0.5);
				}
			const cyc = (t / 5) % 1,
				headX = -w * 0.1 + cyc * w * 1.3,
				path = (x: number) => h * 0.42 + Math.sin(x / (w * 0.22) - t * 1.5) * h * 0.12,
				len = w * 0.75,
				appleX = w * 0.78,
				eaten = headX > appleX - c * 0.4;
			if (!eaten) coverApple(ctx, appleX, path(appleX) + Math.sin(t * 4) * c * 0.05, c * 0.42);
			for (let pass = 0; pass < 2; pass++)
				for (let d = len; d >= 0; d -= c * 0.15) {
					const x = headX - d,
						k = d / len,
						bulge = eaten && Math.abs(d - (headX - appleX) * 1.1) < c * 0.6 ? c * 0.12 : 0,
						r = c * (0.4 - 0.22 * k ** 1.4) + bulge;
					ctx.fillStyle = pass
						? `hsl(${(d / c) % 1 < 0.5 ? 110 : 135} 70% ${(d / c) % 1 < 0.5 ? 40 : 60}%)`
						: '#14401f';
					ctx.beginPath();
					ctx.arc(x, path(x), r + (pass ? 0 : 1.5), 0, TAU);
					ctx.fill();
				}
			const hy = path(headX),
				ang = Math.atan2(path(headX + 1) - hy, 1);
			ctx.save();
			ctx.translate(headX, hy);
			ctx.rotate(ang);
			if (t % 1.6 < 0.4) {
				ctx.strokeStyle = '#ff3a5a';
				ctx.lineWidth = Math.max(1.5, c * 0.06);
				ctx.lineCap = 'round';
				ctx.beginPath();
				ctx.moveTo(c * 0.4, 0);
				ctx.lineTo(c * 0.85, 0);
				ctx.lineTo(c * 0.97, -c * 0.09);
				ctx.moveTo(c * 0.85, 0);
				ctx.lineTo(c * 0.97, c * 0.09);
				ctx.stroke();
			}
			ctx.fillStyle = '#14401f';
			ctx.beginPath();
			ctx.ellipse(c * 0.05, 0, c * 0.5, c * 0.42, 0, 0, TAU);
			ctx.fill();
			ctx.fillStyle = 'hsl(120 70% 56%)';
			ctx.beginPath();
			ctx.ellipse(c * 0.05, 0, c * 0.45, c * 0.37, 0, 0, TAU);
			ctx.fill();
			for (const sd of [-1, 1]) {
				ctx.fillStyle = '#fff';
				ctx.beginPath();
				ctx.arc(c * 0.12, sd * c * 0.19, c * 0.13, 0, TAU);
				ctx.fill();
				ctx.fillStyle = '#10102e';
				ctx.beginPath();
				ctx.arc(c * 0.17, sd * c * 0.19, c * 0.065, 0, TAU);
				ctx.fill();
			}
			ctx.restore();
		},
	},
	{
		id: 'impakt',
		online: 'race',
		title: 'IMPAKT',
		group: 'puzzle',
		category: 'arcade',
		tagline: 'Sestřel vlny, poraz bosse.',
		description:
			'Vesmírná střílečka na motivy Space Impact: loď střílí sama, ty uhýbáš a sbíráš rakety, laser a štít. Vlny nepřátel přilétají zprava a na konci každého sektoru čeká boss. Kampaň je pro všechny stejná, s přepínačem do zeleného retro displeje.',
		genres: ['Arkáda', 'Střílečka', 'Retro'],
		features: ['Denní sektor', 'Cesta: 120 sektorů', 'Kampaň a Nekonečno', 'Retro displej'],
		en: {
			tagline: 'Shoot the waves, beat the boss.',
			description:
				'A space shooter in the spirit of Space Impact: the ship fires on its own while you dodge and grab missiles, a laser and a shield. Enemy waves come from the right and a boss waits at the end of every sector. The campaign is the same for everyone, with a switch to a green retro screen.',
			genres: ['Arcade', 'Shooter', 'Retro'],
			features: ['Daily sector', 'Path: 120 sectors', 'Campaign and Endless', 'Retro screen'],
		},
		statLabels: labels,
		path: '/games/impakt/index.html',
		colors: ['#55f6ff', '#ff5a7a', '#ffe066'],
		statsKey: 'gamecenter.stats.impakt',
		cover(ctx, w, h, t) {
			sky(ctx, w, h, t, ['#55f6ff', '#ff5a7a', '#ffe066'], 31);
			const p = Math.max(2, Math.floor(Math.min(w, h) / 46));
			const sprite = (rows: string[], x: number, y: number, col: string) => {
				ctx.fillStyle = col;
				ctx.shadowColor = col;
				ctx.shadowBlur = p * 3;
				rows.forEach((row, ry) =>
					[...row].forEach((ch, rx) => {
						if (ch === '#') ctx.fillRect(x + rx * p, y + ry * p, p, p);
					}),
				);
				ctx.shadowBlur = 0;
			};
			const ship = [
				'##..........',
				'####........',
				'.######.....',
				'.##########.',
				'.######.....',
				'####........',
				'##..........',
			];
			const drone = ['..####..', '.######.', '##.##.##', '########', '.#.##.#.', '#......#'];
			const sy = h * 0.32 + Math.sin(t * 1.6) * h * 0.06;
			sprite(ship, w * 0.1, sy, '#55f6ff');
			// shots fly right; drones drift left in a loop
			ctx.fillStyle = '#ffe066';
			for (let i = 0; i < 4; i++) {
				const x = w * 0.1 + 12 * p + ((t * w * 0.5 + i * w * 0.22) % (w * 0.85));
				ctx.fillRect(x, sy + 3 * p, 3 * p, p);
			}
			for (let i = 0; i < 3; i++) {
				const x = w - ((t * w * 0.12 + i * w * 0.3) % (w * 0.75)) - 8 * p;
				const y = h * (0.16 + i * 0.16) + Math.sin(t * 2 + i) * p * 3;
				sprite(drone, x, y, '#ff5a7a');
			}
		},
	},
	{
		id: 'skladnik',
		online: 'race',
		title: 'SKLADNÍK',
		group: 'puzzle',
		category: 'arcade',
		tagline: 'Tlač bedny, skládej řady, kryj si hlavu.',
		description:
			'Skladová honička na motivy Stack Attack: jeřáby shazují bedny, ty je tlačíš a vyskakuješ na ně a skládáš plné řady, které zmizí. Bacha na hlavu a na bomby; srdce přidá život a pírko vyšší skok. Pořadí beden je ze semínka, denní směna je pro všechny stejná.',
		genres: ['Arkáda', 'Bedny', 'Postřeh'],
		features: ['Denní směna', 'Cesta: 120 směn', 'Bomby a bonusy', 'Tlačítka i klávesnice'],
		en: {
			tagline: 'Push crates, clear rows, mind your head.',
			description:
				'A warehouse scramble in the spirit of Stack Attack: cranes drop crates, you push them, jump onto them and stack full rows that disappear. Mind your head and the bombs; a heart gives a life and a feather a higher jump. The crate order comes from the seed, so the daily shift is the same for everyone.',
			genres: ['Arcade', 'Crates', 'Reflexes'],
			features: ['Daily shift', 'Path: 120 shifts', 'Bombs and bonuses', 'Buttons or keyboard'],
		},
		statLabels: labels,
		path: '/games/skladnik/index.html',
		colors: ['#ffa94d', '#ffe066', '#c77dff'],
		statsKey: 'gamecenter.stats.skladnik',
		cover(ctx, w, h, t) {
			sky(ctx, w, h, t, ['#ffa94d', '#ffe066', '#c77dff'], 37);
			const s = Math.min(w / 8, h / 11);
			const floor = h * 0.72;
			const x0 = (w - 7 * s) / 2;
			const crate = (cx: number, cy: number, col: string) => {
				ctx.strokeStyle = col;
				ctx.lineWidth = Math.max(2, s * 0.08);
				ctx.shadowColor = col;
				ctx.shadowBlur = s * 0.3;
				ctx.strokeRect(cx + s * 0.1, cy + s * 0.1, s * 0.8, s * 0.8);
				ctx.shadowBlur = 0;
				ctx.globalAlpha = 0.5;
				ctx.beginPath();
				ctx.moveTo(cx + s * 0.18, cy + s * 0.18);
				ctx.lineTo(cx + s * 0.82, cy + s * 0.82);
				ctx.moveTo(cx + s * 0.82, cy + s * 0.18);
				ctx.lineTo(cx + s * 0.18, cy + s * 0.82);
				ctx.stroke();
				ctx.globalAlpha = 1;
			};
			const cols = ['#ffa94d', '#c77dff', '#55f6ff', '#6dff9e', '#ff9de6'];
			[0, 1, 3, 4, 6].forEach((x, i) => crate(x0 + x * s, floor - s, cols[i] ?? '#fff'));
			crate(x0 + 4 * s, floor - 2 * s, '#ffe066');
			// a crane carries a crate along the rail and drops it
			const ph = (t * 0.35) % 1;
			ctx.fillStyle = 'rgba(255,255,255,.18)';
			ctx.fillRect(0, h * 0.08, w, s * 0.12);
			const cx = x0 - s + ph * 9 * s;
			ctx.fillStyle = '#ffa94d';
			ctx.fillRect(cx, h * 0.06, s, s * 0.3);
			crate(cx, h * 0.08 + s * 0.6, '#55f6ff');
			// the worker with a yellow hard hat
			const wx = x0 + 2 * s + s * 0.5;
			const wy = floor - s * 1.9;
			ctx.fillStyle = '#5d7bff';
			ctx.fillRect(wx - s * 0.3, wy + s * 0.9, s * 0.6, s * 0.65);
			ctx.fillStyle = '#3a4bff';
			ctx.fillRect(wx - s * 0.22, wy + s * 1.5, s * 0.16, s * 0.4);
			ctx.fillRect(wx + s * 0.06, wy + s * 1.5, s * 0.16, s * 0.4);
			ctx.fillStyle = '#ffd9a8';
			ctx.beginPath();
			ctx.arc(wx, wy + s * 0.66, s * 0.27, 0, TAU);
			ctx.fill();
			ctx.fillStyle = '#ffe066';
			ctx.beginPath();
			ctx.arc(wx, wy + s * 0.56, s * 0.3, Math.PI, 0);
			ctx.fill();
			ctx.fillRect(wx - s * 0.36, wy + s * 0.53, s * 0.72, s * 0.08);
		},
	},
	{
		id: 'tanky',
		online: 'turn',
		title: 'TANKY',
		group: 'puzzle',
		category: 'duo',
		tagline: 'Úhel, síla, vítr. Pal!',
		description:
			'Dělostřelecký souboj dvou tanků na tahy: nastav úhel a sílu, počítej s větrem a trefuj soupeře přes kopec. Výbuchy hloubí terén, k dispozici je těžká a trojitá střela, kopáč i hlína. Proti počítači, ve dvou na jednom zařízení i online.',
		genres: ['Pro dva', 'Dělostřelectvo', 'Tahy'],
		features: ['Online souboje', 'Dva hráči na jednom zařízení', '3 síly počítače', '5 zbraní'],
		en: {
			tagline: 'Angle, power, wind. Fire!',
			description:
				'A turn-based artillery duel of two tanks: set the angle and power, mind the wind and hit the opponent over the hill. Explosions dig into the terrain; heavy and triple shells, a digger and dirt are at hand. Against the computer, two players on one device or online.',
			genres: ['Two players', 'Artillery', 'Turn-based'],
			features: ['Online duels', 'Two players, one device', '3 computer strengths', '5 weapons'],
		},
		statLabels: labels,
		path: '/games/tanky/index.html',
		colors: ['#55f6ff', '#ff6fb5', '#ff8a3d'],
		statsKey: 'gamecenter.stats.tanky',
		cover(ctx, w, h, t) {
			const sky = ctx.createLinearGradient(0, 0, 0, h);
			sky.addColorStop(0, '#1a1240');
			sky.addColorStop(0.55, '#5a2a6e');
			sky.addColorStop(1, '#ff8a5c');
			ctx.fillStyle = sky;
			ctx.fillRect(0, 0, w, h);
			const sx = w * 0.55,
				sy = h * 0.4,
				sr = Math.min(w, h) * 0.1;
			const glow = ctx.createRadialGradient(sx, sy, sr * 0.5, sx, sy, sr * 4);
			glow.addColorStop(0, 'rgba(255,210,122,.55)');
			glow.addColorStop(1, 'rgba(255,210,122,0)');
			ctx.fillStyle = glow;
			ctx.fillRect(0, 0, w, h);
			ctx.fillStyle = '#ffd27a';
			ctx.beginPath();
			ctx.arc(sx, sy, sr, 0, TAU);
			ctx.fill();
			// hills with a row of pine silhouettes
			const hill = (x: number) => h * 0.52 + Math.sin((x / w) * 7 + 2) * h * 0.035;
			ctx.fillStyle = '#2e1c4a';
			ctx.beginPath();
			ctx.moveTo(0, h);
			for (let x = 0; x <= w; x += 6) ctx.lineTo(x, hill(x));
			ctx.lineTo(w, h);
			ctx.fill();
			for (let x = 4; x < w; x += w * 0.06) {
				const th = h * (0.04 + ((x * 7) % 3) * 0.012);
				ctx.beginPath();
				ctx.moveTo(x - th * 0.35, hill(x) + 2);
				ctx.lineTo(x, hill(x) - th);
				ctx.lineTo(x + th * 0.35, hill(x) + 2);
				ctx.fill();
			}
			const ground = (x: number) =>
				h * 0.64 + Math.sin((x / w) * 5 + 1) * h * 0.04 - Math.sin((x / w) * 3.1) * h * 0.05;
			const soil = ctx.createLinearGradient(0, h * 0.55, 0, h);
			soil.addColorStop(0, '#8c603e');
			soil.addColorStop(1, '#3e261e');
			ctx.fillStyle = soil;
			ctx.beginPath();
			ctx.moveTo(0, h);
			for (let x = 0; x <= w; x += 4) ctx.lineTo(x, ground(x));
			ctx.lineTo(w, h);
			ctx.fill();
			ctx.strokeStyle = '#8ae06a';
			ctx.lineWidth = Math.max(3, h * 0.025);
			ctx.beginPath();
			for (let x = 0; x <= w; x += 4) ctx.lineTo(x, ground(x) + h * 0.008);
			ctx.stroke();
			// the blue tank fires, the shell arcs over and hits the pink one
			const s = Math.min(w, h * 0.85) / 140,
				ax = w * 0.22,
				bx = w * 0.78,
				cyc = (t * 0.42) % 1,
				fly = Math.min(1, cyc / 0.6),
				boom = cyc > 0.6 ? (cyc - 0.6) / 0.4 : -1;
			const start = { x: ax + 14 * s, y: ground(ax) - 26 * s },
				end = { x: bx, y: ground(bx) - 10 * s };
			const arc = (k: number) => ({
				x: start.x + (end.x - start.x) * k,
				y: start.y + (end.y - start.y) * k - Math.sin(k * Math.PI) * h * 0.36,
			});
			const kick = Math.max(0, 1 - cyc * 8);
			coverTank(ctx, ax, ground(ax), s, '#55f6ff', 50, kick, t);
			coverTank(ctx, bx, ground(bx), s, '#ff6fb5', 135, 0, t + 1);
			if (boom < 0) {
				for (let i = 1; i < 6; i++) {
					const p = arc(Math.max(0, fly - i * 0.045));
					ctx.fillStyle = `rgba(235,235,245,${0.45 - i * 0.07})`;
					ctx.beginPath();
					ctx.arc(p.x, p.y, s * (1 + i * 0.45), 0, TAU);
					ctx.fill();
				}
				const p = arc(fly),
					q = arc(Math.min(1, fly + 0.01));
				ctx.save();
				ctx.translate(p.x, p.y);
				ctx.rotate(Math.atan2(q.y - p.y, q.x - p.x));
				ctx.scale(s * 1.2, s * 1.2);
				ctx.fillStyle = '#ffb02e';
				ctx.beginPath();
				ctx.moveTo(-5, -1.6);
				ctx.lineTo(-10 - Math.sin(t * 40) * 2, 0);
				ctx.lineTo(-5, 1.6);
				ctx.fill();
				ctx.fillStyle = '#d8bc72';
				ctx.beginPath();
				ctx.moveTo(-5, -2.4);
				ctx.lineTo(2, -2.4);
				ctx.quadraticCurveTo(8, 0, 2, 2.4);
				ctx.lineTo(-5, 2.4);
				ctx.fill();
				ctx.restore();
			} else {
				const r = h * (0.1 + boom * 0.14),
					a = Math.max(0, 1 - boom * 1.3);
				const g = ctx.createRadialGradient(end.x, end.y, 0, end.x, end.y, r);
				g.addColorStop(0, `rgba(255,255,230,${a})`);
				g.addColorStop(0.4, `rgba(255,210,90,${a})`);
				g.addColorStop(0.75, `rgba(255,110,40,${a * 0.8})`);
				g.addColorStop(1, 'rgba(200,40,30,0)');
				ctx.fillStyle = g;
				ctx.beginPath();
				ctx.arc(end.x, end.y, r, 0, TAU);
				ctx.fill();
				ctx.globalAlpha = Math.min(1, a * 2);
				ctx.font = `900 ${Math.round(h * 0.1)}px Unbounded, sans-serif`;
				ctx.textAlign = 'center';
				ctx.lineWidth = Math.max(2, h * 0.02);
				ctx.strokeStyle = 'rgba(20,8,30,.8)';
				const ty = ground(bx) - h * 0.28 - boom * h * 0.08;
				ctx.strokeText('-34', bx, ty);
				ctx.fillStyle = '#ff5a7a';
				ctx.fillText('-34', bx, ty);
				ctx.globalAlpha = 1;
			}
		},
	},
	{
		id: 'cervici',
		online: 'turn',
		title: 'ČERVÍCI',
		group: 'puzzle',
		category: 'duo',
		tagline: 'Bazuka, granát, nálet. Tvůj tah!',
		description:
			'Tahová válka dvou týmů červů na zničitelném ostrově na motivy Worms: chodíš, skáčeš, míříš a pálíš z bazuky, granátu, brokovnice, dynamitu nebo náletu. Výbuchy hloubí jeskyně a odhazují červy, voda je smrtelná. Proti počítači, ve dvou na jednom zařízení i online.',
		genres: ['Pro dva', 'Válka červů', 'Tahy'],
		features: ['Online souboje', 'Dva hráči na jednom zařízení', 'Zničitelný ostrov', '5 zbraní'],
		en: {
			tagline: 'Bazooka, grenade, air strike. Your turn!',
			description:
				'A turn-based war of two worm teams on a destructible island in the spirit of Worms: walk, jump, aim and fire a bazooka, grenade, shotgun, dynamite or an air strike. Explosions dig caves and throw worms around; the water is deadly. Against the computer, two players on one device or online.',
			genres: ['Two players', 'Worm war', 'Turn-based'],
			features: ['Online duels', 'Two players, one device', 'Destructible island', '5 weapons'],
		},
		statLabels: labels,
		path: '/games/cervici/index.html',
		colors: ['#ff9db8', '#55f6ff', '#ff8a3d'],
		statsKey: 'gamecenter.stats.cervici',
		cover(ctx, w, h, t) {
			const sky = ctx.createLinearGradient(0, 0, 0, h);
			sky.addColorStop(0, '#1b1550');
			sky.addColorStop(0.6, '#6a3a8a');
			sky.addColorStop(1, '#ff9a6a');
			ctx.fillStyle = sky;
			ctx.fillRect(0, 0, w, h);
			const glow = ctx.createRadialGradient(w * 0.7, h * 0.55, 0, w * 0.7, h * 0.55, h * 0.5);
			glow.addColorStop(0, 'rgba(255,230,160,.5)');
			glow.addColorStop(1, 'rgba(255,230,160,0)');
			ctx.fillStyle = glow;
			ctx.fillRect(0, 0, w, h);
			ctx.fillStyle = '#ffd27a';
			ctx.beginPath();
			ctx.arc(w * 0.7, h * 0.55, h * 0.12, 0, TAU);
			ctx.fill();
			ctx.fillStyle = '#5a3a86';
			ctx.beginPath();
			ctx.moveTo(0, h);
			for (let x = 0; x <= w; x += 6)
				ctx.lineTo(x, h * 0.62 - Math.abs(Math.sin((x / w) * 5 + 0.5)) * h * 0.14);
			ctx.lineTo(w, h);
			ctx.fill();
			// the island with grass, a palm and the sea
			const ground = (x: number) =>
				h * 0.6 - Math.sin((x / w) * 6.2 + 0.4) * h * 0.04 - Math.sin((x / w) * 2.4 + 1) * h * 0.05;
			const soil = ctx.createLinearGradient(0, h * 0.5, 0, h);
			soil.addColorStop(0, '#96643e');
			soil.addColorStop(1, '#4a2c1c');
			ctx.fillStyle = soil;
			ctx.beginPath();
			ctx.moveTo(w * 0.03, h);
			for (let x = w * 0.03; x <= w * 0.97; x += 3) ctx.lineTo(x, ground(x));
			ctx.lineTo(w * 0.97, h);
			ctx.fill();
			ctx.strokeStyle = '#76d656';
			ctx.lineWidth = Math.max(3, h * 0.035);
			ctx.beginPath();
			for (let x = w * 0.03; x <= w * 0.97; x += 3) ctx.lineTo(x, ground(x) + h * 0.012);
			ctx.stroke();
			const s = Math.min(w, h * 0.8) / 84;
			coverPalm(ctx, w * 0.5, ground(w * 0.5) + 2, s * 0.9);
			ctx.fillStyle = '#1e5a92';
			ctx.beginPath();
			ctx.moveTo(0, h);
			for (let x = 0; x <= w; x += 6)
				ctx.lineTo(x, h * 0.9 + Math.sin(x * 0.05 + t * 2) * h * 0.012);
			ctx.lineTo(w, h);
			ctx.fill();
			// a bazooka shot arcs over the palm and hits the pink worm
			const ax = w * 0.24,
				bx = w * 0.76,
				cyc = (t * 0.45) % 1,
				fly = Math.min(1, cyc / 0.62),
				boom = cyc > 0.62 ? (cyc - 0.62) / 0.38 : -1;
			const arc = (k: number) => ({
				x: ax + w * 0.06 + (bx - ax - w * 0.06) * k,
				y:
					ground(ax) -
					h * 0.2 +
					(ground(bx) - h * 0.1 - ground(ax) + h * 0.2) * k -
					Math.sin(k * Math.PI) * h * 0.38,
			});
			const hop = boom >= 0 ? Math.sin(Math.min(1, boom * 1.6) * Math.PI) * h * 0.12 : 0;
			coverWorm(ctx, ax, ground(ax) + 1, s, 1, '#55f6ff', t, 40, true);
			coverWorm(ctx, bx, ground(bx) + 1 - hop, s, -1, '#ff6fb5', t + 1, boom >= 0 ? 60 : 0, false);
			if (boom < 0) {
				for (let i = 1; i < 6; i++) {
					const p = arc(Math.max(0, fly - i * 0.05));
					ctx.fillStyle = `rgba(235,235,245,${0.45 - i * 0.07})`;
					ctx.beginPath();
					ctx.arc(p.x, p.y, s * (1.2 + i * 0.5), 0, TAU);
					ctx.fill();
				}
				const p = arc(fly),
					q = arc(Math.min(1, fly + 0.01));
				ctx.save();
				ctx.translate(p.x, p.y);
				ctx.rotate(Math.atan2(q.y - p.y, q.x - p.x));
				ctx.scale(s, s);
				ctx.fillStyle = '#ffb02e';
				ctx.beginPath();
				ctx.moveTo(-6, -1.6);
				ctx.lineTo(-11 - Math.sin(t * 40) * 2, 0);
				ctx.lineTo(-6, 1.6);
				ctx.fill();
				ctx.fillStyle = '#dfe3f0';
				ctx.fillRect(-6, -2.2, 10, 4.4);
				ctx.fillStyle = '#e8344a';
				ctx.beginPath();
				ctx.moveTo(4, -2.2);
				ctx.quadraticCurveTo(9, 0, 4, 2.2);
				ctx.fill();
				ctx.restore();
			} else {
				const e = arc(1),
					r = h * (0.1 + boom * 0.14),
					a = Math.max(0, 1 - boom * 1.3);
				const g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, r);
				g.addColorStop(0, `rgba(255,255,230,${a})`);
				g.addColorStop(0.4, `rgba(255,210,90,${a})`);
				g.addColorStop(0.75, `rgba(255,110,40,${a * 0.8})`);
				g.addColorStop(1, 'rgba(200,40,30,0)');
				ctx.fillStyle = g;
				ctx.beginPath();
				ctx.arc(e.x, e.y, r, 0, TAU);
				ctx.fill();
				ctx.globalAlpha = Math.min(1, a * 2);
				ctx.font = `900 ${Math.round(h * 0.11)}px Unbounded, sans-serif`;
				ctx.textAlign = 'center';
				ctx.lineWidth = Math.max(2, h * 0.02);
				ctx.strokeStyle = 'rgba(20,8,30,.8)';
				ctx.strokeText('-48', bx, ground(bx) - h * 0.3 - boom * h * 0.08);
				ctx.fillStyle = '#ff6fb5';
				ctx.fillText('-48', bx, ground(bx) - h * 0.3 - boom * h * 0.08);
				ctx.globalAlpha = 1;
			}
		},
	},
	{
		id: 'bubliny',
		online: 'race',
		title: 'BUBLINY',
		group: 'puzzle',
		category: 'arcade',
		tagline: 'Tři stejné prasknou, zbytek spadne.',
		description:
			'Klasický Bubble Shooter: střílej barevné bubliny do plástve, tři stejné prasknou a co zůstane viset bez spojení, spadne. Odrážej se od stěn, prohazuj bubliny a nenech strop sjet až dolů. Denní plocha je pro všechny stejná, v Nekonečnu hraješ na skóre.',
		genres: ['Arkáda', 'Bubble Shooter', 'Postřeh'],
		features: ['Denní plocha', 'Cesta: 120 ploch', 'Nekonečno na skóre', 'Online závody'],
		en: {
			tagline: 'Three alike pop, the rest falls.',
			description:
				'The classic Bubble Shooter: shoot coloured bubbles into the cluster, three alike pop and whatever hangs free falls down. Bank off the walls, swap bubbles and keep the ceiling from reaching the bottom. The daily board is the same for everyone; Endless plays for score.',
			genres: ['Arcade', 'Bubble Shooter', 'Reflexes'],
			features: ['Daily board', 'Path: 120 boards', 'Endless for score', 'Online races'],
		},
		statLabels: labels,
		path: '/games/bubliny/index.html',
		colors: ['#5d9bff', '#ff5a7a', '#ffc04d'],
		statsKey: 'gamecenter.stats.bubliny',
		cover(ctx, w, h, t) {
			sky(ctx, w, h, t, ['#5d9bff', '#ff5a7a', '#ffc04d'], 41);
			const cols = ['#ff5a7a', '#ffc04d', '#3ddc97', '#5d9bff', '#c06bff'];
			const r = Math.min(w / 16, h / 18);
			const ball = (x: number, y: number, c: string) => {
				const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
				g.addColorStop(0, '#fff');
				g.addColorStop(0.2, c);
				g.addColorStop(1, c);
				ctx.fillStyle = g;
				ctx.beginPath();
				ctx.arc(x, y, r * 0.95, 0, TAU);
				ctx.fill();
			};
			const n = Math.floor(w / (2 * r));
			for (let row = 0; row < 4; row++)
				for (let i = 0; i < n - (row % 2); i++)
					ball(
						r + i * 2 * r + (row % 2) * r + (w - n * 2 * r) / 2,
						h * 0.06 + r + row * r * 1.73,
						cols[(i * 3 + row * 2 + ((i * row) % 3)) % cols.length] ?? '#fff',
					);
			// a bubble flies up from the cannon in a loop
			const ph = (t * 0.5) % 1;
			ball(w / 2 + Math.sin(ph * 3) * w * 0.12, h * 0.86 - ph * h * 0.4, '#3ddc97');
			ctx.fillStyle = '#3a3070';
			ctx.beginPath();
			ctx.arc(w / 2, h * 0.9, r * 1.3, 0, TAU);
			ctx.fill();
		},
	},
	{
		id: 'rybky',
		online: 'race',
		title: 'RYBKY',
		group: 'puzzle',
		category: 'logic',
		tagline: 'Dvě rybky, jedna cesta ven.',
		description:
			'Logická hra pod vodou na motivy Fish Fillets: malá a velká rybka musí uplavat z jeskyně. Malá pohne jen lehkými věcmi, velká i ocelí, předměty padají a na rybku nesmí nic spadnout. Stovky ověřených jeskyní od mělčiny po propast.',
		genres: ['Logika', 'Fyzika', 'Hlavolam'],
		features: ['Denní jeskyně', 'Cesta: 120 jeskyní', '2 rybky', 'Vrácení tahů'],
		en: {
			tagline: 'Two fish, one way out.',
			description:
				'An underwater logic game in the spirit of Fish Fillets: a small and a big fish must swim out of a cave. The small one moves only light things, the big one steel too, objects fall and nothing may land on a fish. Hundreds of verified caves from shallows to the abyss.',
			genres: ['Logic', 'Physics', 'Puzzle'],
			features: ['Daily cave', 'Path: 120 caves', '2 fish', 'Undo'],
		},
		statLabels: labels,
		path: '/games/rybky/index.html',
		colors: ['#4d8bff', '#ffb547', '#2ad6c4'],
		statsKey: 'gamecenter.stats.rybky',
		cover(ctx, w, h, t) {
			const g = ctx.createLinearGradient(0, 0, 0, h);
			g.addColorStop(0, '#0d4d6e');
			g.addColorStop(1, '#03101f');
			ctx.fillStyle = g;
			ctx.fillRect(0, 0, w, h);
			ctx.fillStyle = 'rgba(170,230,255,.06)';
			for (let i = 0; i < 3; i++) {
				const x = w * (0.15 + i * 0.3) + Math.sin(t * 0.3 + i) * 20;
				ctx.beginPath();
				ctx.moveTo(x, 0);
				ctx.lineTo(x + w * 0.08, 0);
				ctx.lineTo(x - w * 0.1, h);
				ctx.lineTo(x - w * 0.18, h);
				ctx.fill();
			}
			// bubbles
			for (let i = 0; i < 14; i++) {
				const bx = ((i * 73) % 100) / 100;
				const by = 1 - ((t * 0.08 + i * 0.13) % 1);
				ctx.strokeStyle = 'rgba(200,240,255,.35)';
				ctx.lineWidth = 1.2;
				ctx.beginPath();
				ctx.arc(w * bx, h * by, 2 + (i % 3), 0, TAU);
				ctx.stroke();
			}
			const fish = (x: number, y: number, s: number, body: string, fin: string, dir: number) => {
				ctx.save();
				ctx.translate(x, y);
				ctx.scale(dir, 1);
				ctx.fillStyle = fin;
				ctx.beginPath();
				ctx.moveTo(-s * 0.55, 0);
				ctx.lineTo(-s, -s * 0.35);
				ctx.lineTo(-s, s * 0.35);
				ctx.fill();
				ctx.fillStyle = body;
				ctx.beginPath();
				ctx.ellipse(0, 0, s * 0.62, s * 0.38, 0, 0, TAU);
				ctx.fill();
				ctx.fillStyle = '#fff';
				ctx.beginPath();
				ctx.arc(s * 0.3, -s * 0.08, s * 0.1, 0, TAU);
				ctx.fill();
				ctx.fillStyle = '#0b1630';
				ctx.beginPath();
				ctx.arc(s * 0.33, -s * 0.08, s * 0.05, 0, TAU);
				ctx.fill();
				ctx.restore();
			};
			const m = Math.min(w, h);
			// a steel block and a crate on rock, the fish swim by
			ctx.fillStyle = '#24434f';
			ctx.fillRect(0, h * 0.82, w, h * 0.18);
			ctx.fillStyle = '#8e9aab';
			ctx.fillRect(w * 0.62, h * 0.64, m * 0.18, m * 0.18);
			ctx.fillStyle = '#d98f4a';
			ctx.fillRect(w * 0.3, h * 0.7, m * 0.12, m * 0.12);
			fish(w * 0.35 + Math.sin(t * 0.7) * w * 0.08, h * 0.35, m * 0.22, '#4d8bff', '#2f62c9', 1);
			fish(w * 0.7 - Math.sin(t * 0.9) * w * 0.06, h * 0.5, m * 0.13, '#ffb547', '#e8862a', -1);
		},
	},
	{
		id: 'letni',
		title: 'LETNÍ HRY',
		group: 'puzzle',
		category: 'arcade',
		tagline: 'Mačkej, běž, skoč, hoď!',
		description:
			'Atletický víceboj na motivy mobilních Playman Summer Games: 100 m, skok daleký, 110 m překážek a hod oštěpem. Běžíš střídavým mačkáním dvou tlačítek, skáčeš a házíš načasovaným podržením. Body podle desetibojařských tabulek, soupeři v drahách a denní víceboj pro všechny stejný.',
		genres: ['Arkáda', 'Sport', 'Atletika'],
		features: ['4 disciplíny', 'Denní víceboj', 'Cesta: 120 kol', 'Žebříčky bodů'],
		en: {
			tagline: 'Tap, run, jump, throw!',
			description:
				'An athletics multi-event in the spirit of the mobile Playman Summer Games: 100 m, long jump, 110 m hurdles and javelin. You run by alternating two buttons and jump or throw with a timed hold. Points from the decathlon tables, rivals in the other lanes and a daily multi-event that is the same for everyone.',
			genres: ['Arcade', 'Sports', 'Athletics'],
			features: ['4 events', 'Daily multi-event', 'Path: 120 rounds', 'Points leaderboards'],
		},
		statLabels: labels,
		path: '/games/letni/index.html',
		colors: ['#ff5a7a', '#ffd34d', '#55f6ff'],
		statsKey: 'gamecenter.stats.letni',
		cover(ctx, w, h, t) {
			// a summer stadium: sun, bunting, a cheering crowd; a hurdler clears hurdle after hurdle
			const sky = ctx.createLinearGradient(0, 0, 0, h * 0.12);
			sky.addColorStop(0, '#2b7fe0');
			sky.addColorStop(1, '#a8dcff');
			ctx.fillStyle = sky;
			ctx.fillRect(0, 0, w, h * 0.14);
			const sx = w * 0.86,
				sy = h * 0.05,
				sr = h * 0.04;
			ctx.save();
			ctx.translate(sx, sy);
			ctx.rotate(t * 0.3);
			ctx.fillStyle = 'rgba(255,236,150,.45)';
			for (let i = 0; i < 12; i++) {
				ctx.rotate(TAU / 12);
				ctx.beginPath();
				ctx.moveTo(-sr * 0.2, sr * 1.2);
				ctx.lineTo(0, sr * 2.2);
				ctx.lineTo(sr * 0.2, sr * 1.2);
				ctx.fill();
			}
			ctx.restore();
			ctx.fillStyle = '#ffe680';
			ctx.beginPath();
			ctx.arc(sx, sy, sr, 0, TAU);
			ctx.fill();
			// roof with bunting
			ctx.fillStyle = '#d8dde8';
			ctx.fillRect(0, h * 0.1, w, h * 0.015);
			ctx.fillStyle = '#9aa3b8';
			ctx.fillRect(0, h * 0.115, w, h * 0.02);
			// stands and the crowd
			const st = ctx.createLinearGradient(0, h * 0.135, 0, h * 0.37);
			st.addColorStop(0, '#2a2f4a');
			st.addColorStop(1, '#3f4668');
			ctx.fillStyle = st;
			ctx.fillRect(0, h * 0.135, w, h * 0.235);
			ctx.save();
			ctx.beginPath();
			ctx.rect(0, h * 0.135, w, h * 0.235);
			ctx.clip();
			const shirts = ['#ff5a7a', '#55f6ff', '#ffd34d', '#6dff9e', '#c77dff', '#ffffff', '#ff9a3d'];
			const skins = ['#ffd9b3', '#d79a6a', '#a8694a', '#f1c08e'];
			const pw = Math.max(7, w / 34);
			for (let row = 0; row < 5; row++)
				for (let i = 0; i < 40; i++) {
					const x = i * pw + (row % 2) * pw * 0.5,
						y =
							h * 0.2 + row * h * 0.037 - Math.max(0, Math.sin(t * 7 + i * 1.7 + row)) * h * 0.012;
					if (x > w + pw) break;
					ctx.fillStyle = shirts[(i * 3 + row * 5) % 7] ?? '#fff';
					ctx.fillRect(x - pw * 0.28, y - pw * 0.2, pw * 0.56, pw * 0.6);
					ctx.fillStyle = skins[(i + row) % 4] ?? '#ffd9b3';
					ctx.beginPath();
					ctx.arc(x, y - pw * 0.42, pw * 0.22, 0, TAU);
					ctx.fill();
					if ((i * 7 + row * 3) % 11 === 0) {
						ctx.fillStyle = shirts[(i + row) % 7] ?? '#fff';
						const wv = Math.sin(t * 6 + i) * pw * 0.2;
						ctx.fillRect(x + pw * 0.3, y - pw * 1.5 + wv, pw * 0.8, pw * 0.5);
						ctx.fillStyle = '#ddd';
						ctx.fillRect(x + pw * 0.26, y - pw * 1.5, pw * 0.08, pw * 1.6);
					}
				}
			ctx.restore();
			const flags = ['#ff5a7a', '#ffd34d', '#55f6ff', '#6dff9e', '#c77dff', '#ff9a3d'];
			const fw = w / 18;
			for (let i = 0; i < 19; i++) {
				ctx.fillStyle = flags[i % 6] ?? '#fff';
				const sw = Math.sin(t * 4 + i) * fw * 0.08;
				ctx.beginPath();
				ctx.moveTo(i * fw + fw * 0.12, h * 0.135);
				ctx.lineTo(i * fw + fw * 0.88, h * 0.135);
				ctx.lineTo(i * fw + fw * 0.5 + sw, h * 0.175);
				ctx.fill();
			}
			// ad boards and the infield grass
			const ads = ['#1b6bd6', '#ffd34d', '#ff5a7a', '#13a37a'];
			const aw = w / 4,
				aoff = (t * w * 0.35) % aw;
			for (let i = 0; i < 6; i++) {
				ctx.fillStyle = ads[(i + Math.floor((t * w * 0.35) / aw)) % 4] ?? '#1b6bd6';
				ctx.fillRect(i * aw - aoff, h * 0.37, aw - 2, h * 0.035);
			}
			ctx.fillStyle = '#4caf48';
			ctx.fillRect(0, h * 0.405, w, h * 0.04);
			// tartan track with lanes
			ctx.fillStyle = '#c9512f';
			ctx.fillRect(0, h * 0.445, w, h * 0.555);
			ctx.fillStyle = 'rgba(255,255,255,.9)';
			for (const ly of [0.445, 0.52, 0.6, 0.72, 0.86]) ctx.fillRect(0, h * ly - 1, w, 2);
			// hurdles scroll by, the runners stay in frame
			const speed = w * 0.42,
				gap = w * 0.62,
				scroll = t * speed,
				ax = w * 0.4,
				s = h / 7.2;
			let lift = 0;
			for (let k = -1; k < 4; k++) {
				const hx = k * gap - (scroll % gap) + gap * 0.6;
				const d = hx - ax - s * 0.25;
				if (Math.abs(d) < s * 1.5) lift = Math.max(lift, Math.cos((d / (s * 1.5)) * (Math.PI / 2)));
				for (const [base, sc] of [
					[0.59, 0.6],
					[0.7, 1],
				] as const) {
					const px = base > 0.65 ? hx : hx - w * 0.08,
						hy = h * base,
						hh = s * 0.95 * sc;
					ctx.fillStyle = 'rgba(0,0,0,.25)';
					ctx.fillRect(px - hh * 0.2, hy, hh * 0.5, 2);
					ctx.fillStyle = '#d8dde8';
					ctx.fillRect(px - 2 * sc, hy - hh, 4 * sc, hh);
					ctx.fillRect(px - 6 * sc, hy - 2 * sc, 16 * sc, 3 * sc);
					ctx.fillStyle = '#fff';
					ctx.fillRect(px - 3 * sc, hy - hh - 6 * sc, 10 * sc, 7 * sc);
					ctx.fillStyle = '#16123a';
					ctx.fillRect(px + 0.5 * sc, hy - hh - 6 * sc, 3.5 * sc, 7 * sc);
				}
			}
			const rx = w * 0.2 + Math.sin(t * 0.7) * w * 0.04;
			coverAthlete(ctx, rx, h * 0.59, s * 0.6, 'run', t * 15 + 1, {
				shirt: '#55f6ff',
				skin: '#a8694a',
				shorts: '#1d1d2a',
				shoe: '#ffffff',
			});
			ctx.fillStyle = 'rgba(0,0,0,.25)';
			ctx.beginPath();
			ctx.ellipse(ax, h * 0.705, s * (0.45 - lift * 0.2), s * 0.08, 0, 0, TAU);
			ctx.fill();
			coverAthlete(ctx, ax, h * 0.7 - lift * s * 0.55, s, lift > 0.35 ? 'hurdle' : 'run', t * 15, {
				shirt: '#ff5a7a',
				skin: '#ffcf9e',
				shorts: '#16123a',
				shoe: '#ffd34d',
			});
			// confetti
			for (let i = 0; i < 18; i++) {
				const cx = ((i * 0.137 + Math.sin(t * 0.8 + i) * 0.03) % 1) * w,
					cy = (((t * 0.18 + i * 0.29) % 1) * 0.5 + 0.1) * h;
				ctx.save();
				ctx.translate(cx, cy);
				ctx.rotate(t * 3 + i);
				ctx.fillStyle = flags[i % 6] ?? '#fff';
				ctx.fillRect(-3, -1.5, 6, 3);
				ctx.restore();
			}
		},
	},
	{
		id: 'zlatokop',
		title: 'ZLATOKOP',
		group: 'puzzle',
		category: 'arcade',
		tagline: 'Spusť drapák, vytáhni zlato!',
		description:
			'Na motivy klasického Gold Mineru: drapák na laně se kývá sem a tam, klepnutím ho spustíš a naviják vytáhne zlato, kameny, diamanty nebo pytel s překvapením. Každý důl má minutu a cíl peněz, mezi doly nakupuješ dynamit a vylepšení u Starého Joea.',
		genres: ['Arkáda', 'Zlatokop', 'Jedno tlačítko'],
		features: ['Klasika s obchodem', 'Zlatá horečka', 'Denní důl', 'Žebříčky peněz'],
		en: {
			tagline: 'Drop the claw, haul the gold!',
			description:
				'In the spirit of the classic Gold Miner: a claw on a rope swings to and fro, one tap drops it and the winch pulls up gold, rocks, diamonds or a surprise bag. Every mine has one minute and a money target, and between mines you buy dynamite and upgrades from Old Joe.',
			genres: ['Arcade', 'Gold miner', 'One button'],
			features: ['Classic with a shop', 'Gold rush', 'Daily mine', 'Money leaderboards'],
		},
		statLabels: labels,
		path: '/games/zlatokop/index.html',
		colors: ['#ffd23f', '#e09a14', '#8e5631'],
		statsKey: 'gamecenter.stats.zlatokop',
		cover(ctx, w, h, t) {
			// the game's scene: an old prospector cranks the reel and hauls a big shiny nugget out of the dirt
			const surf = h * 0.3,
				m = Math.min(w, h),
				OL = '#2a160c';
			const sky = ctx.createLinearGradient(0, 0, 0, surf);
			sky.addColorStop(0, '#ff9f4a');
			sky.addColorStop(0.6, '#ffd27a');
			sky.addColorStop(1, '#ffeab8');
			ctx.fillStyle = sky;
			ctx.fillRect(0, 0, w, surf);
			const sun = ctx.createRadialGradient(w * 0.18, h * 0.08, 2, w * 0.18, h * 0.08, m * 0.2);
			sun.addColorStop(0, 'rgba(255,255,230,1)');
			sun.addColorStop(0.3, 'rgba(255,240,170,.9)');
			sun.addColorStop(1, 'rgba(255,240,170,0)');
			ctx.fillStyle = sun;
			ctx.fillRect(0, 0, w * 0.5, h * 0.3);
			ctx.fillStyle = '#e9a070';
			for (const [x0, x1, top] of [
				[0.02, 0.3, 0.14],
				[0.62, 0.95, 0.12],
			] as const) {
				ctx.beginPath();
				ctx.moveTo(w * x0 - 12, surf);
				ctx.lineTo(w * x0, h * top + 4);
				ctx.lineTo(w * x1, h * top);
				ctx.lineTo(w * x1 + 14, surf);
				ctx.fill();
			}
			const dirt = ctx.createLinearGradient(0, surf, 0, h);
			dirt.addColorStop(0, '#b07440');
			dirt.addColorStop(0.5, '#7a4426');
			dirt.addColorStop(1, '#4f2a18');
			ctx.fillStyle = dirt;
			ctx.fillRect(0, surf, w, h - surf);
			ctx.strokeStyle = 'rgba(40,18,6,.35)';
			ctx.lineWidth = 2;
			for (const k of [0.46, 0.64]) {
				ctx.beginPath();
				for (let x = 0; x <= w; x += 16) ctx.lineTo(x, h * k + Math.sin(x * 0.03 + k * 9) * 4);
				ctx.stroke();
			}
			ctx.fillStyle = '#5e9a42';
			ctx.fillRect(0, surf - 3, w, 4);
			// lumpy nuggets with a soft shine
			const lump = (x: number, y: number, r: number, gold: boolean, seed: number) => {
				const pts: [number, number][] = [];
				for (let i = 0; i < 9; i++) {
					const a = (i / 9) * TAU,
						k = 0.82 + ((Math.sin(seed * 7.3 + i * 2.1) + 1) / 2) * 0.25;
					pts.push([x + Math.cos(a) * r * k, y + Math.sin(a) * r * k * 0.85]);
				}
				ctx.fillStyle = 'rgba(0,0,0,.28)';
				ctx.beginPath();
				ctx.ellipse(x + 2, y + r * 0.72, r, r * 0.3, 0, 0, TAU);
				ctx.fill();
				ctx.beginPath();
				pts.forEach((p, i) => {
					const q = pts[(i + 1) % pts.length] ?? p;
					if (i === 0) {
						const l = pts[pts.length - 1] ?? p;
						ctx.moveTo((l[0] + p[0]) / 2, (l[1] + p[1]) / 2);
					}
					ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
				});
				ctx.closePath();
				const gr = ctx.createRadialGradient(x - r * 0.35, y - r * 0.45, r * 0.05, x, y, r * 1.15);
				gr.addColorStop(0, gold ? '#fffbd6' : '#ebe7e1');
				gr.addColorStop(0.3, gold ? '#ffe14d' : '#aaa49c');
				gr.addColorStop(0.72, gold ? '#f2a71b' : '#7d766e');
				gr.addColorStop(1, gold ? '#a8620a' : '#4a443e');
				ctx.fillStyle = gr;
				ctx.fill();
				ctx.strokeStyle = gold ? '#6b3a00' : '#2a2622';
				ctx.lineWidth = Math.max(1.6, r * 0.07);
				ctx.stroke();
				ctx.fillStyle = gold ? 'rgba(255,255,255,.85)' : 'rgba(255,255,255,.4)';
				ctx.beginPath();
				ctx.ellipse(x - r * 0.38, y - r * 0.38, r * 0.22, r * 0.11, -0.6, 0, TAU);
				ctx.fill();
				if (gold) {
					const sp = Math.max(0, Math.sin(t * 2.4 + seed * 3)) * r * 0.4;
					ctx.fillStyle = '#fff';
					ctx.beginPath();
					ctx.moveTo(x + r * 0.4, y - r * 0.3 - sp);
					ctx.quadraticCurveTo(x + r * 0.4, y - r * 0.3, x + r * 0.4 + sp, y - r * 0.3);
					ctx.quadraticCurveTo(x + r * 0.4, y - r * 0.3, x + r * 0.4, y - r * 0.3 + sp);
					ctx.quadraticCurveTo(x + r * 0.4, y - r * 0.3, x + r * 0.4 - sp, y - r * 0.3);
					ctx.quadraticCurveTo(x + r * 0.4, y - r * 0.3, x + r * 0.4, y - r * 0.3 - sp);
					ctx.fill();
				}
			};
			lump(w * 0.12, h * 0.5, m * 0.07, true, 1);
			lump(w * 0.86, h * 0.44, m * 0.06, false, 3);
			lump(w * 0.84, h * 0.62, m * 0.11, true, 4);
			lump(w * 0.2, h * 0.68, m * 0.05, false, 5);
			// deck, A-frame and the reel
			const rx = w * 0.4,
				ry = surf - h * 0.09,
				rw = w * 0.13,
				rr = h * 0.035;
			ctx.fillStyle = '#a8703a';
			ctx.strokeStyle = OL;
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.rect(w * 0.18, surf - h * 0.02, w * 0.64, h * 0.02);
			ctx.fill();
			ctx.stroke();
			ctx.lineCap = 'round';
			for (const s of [-1, 1])
				for (const [lw, c] of [
					[6, OL],
					[3.5, '#a8703a'],
				] as const) {
					ctx.strokeStyle = c;
					ctx.lineWidth = lw;
					ctx.beginPath();
					ctx.moveTo(rx + s * (rw + 12), surf - h * 0.02);
					ctx.lineTo(rx + s * (rw + 3), ry);
					ctx.lineTo(rx + s * (rw - 6), surf - h * 0.02);
					ctx.stroke();
				}
			const dg = ctx.createLinearGradient(0, ry - rr, 0, ry + rr);
			dg.addColorStop(0, '#6b4224');
			dg.addColorStop(0.35, '#e8d6a8');
			dg.addColorStop(1, '#5a361c');
			ctx.fillStyle = dg;
			ctx.strokeStyle = OL;
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.rect(rx - rw, ry - rr, rw * 2, rr * 2);
			ctx.fill();
			ctx.stroke();
			ctx.strokeStyle = 'rgba(90,60,30,.6)';
			ctx.lineWidth = 1;
			for (let x = rx - rw + 4; x < rx + rw - 4; x += 4) {
				const o = (t * 12) % 4;
				ctx.beginPath();
				ctx.moveTo(x + o, ry - rr);
				ctx.lineTo(x + o + 3, ry + rr);
				ctx.stroke();
			}
			for (const s of [-1, 1]) {
				ctx.fillStyle = '#5d6478';
				ctx.beginPath();
				ctx.ellipse(rx + s * rw, ry, 4, rr + 3, 0, 0, TAU);
				ctx.fill();
				ctx.stroke();
			}
			// rope, claw and the hauled nugget
			const ang = Math.sin(t * 1.1) * 0.25 + 0.15,
				len = h * 0.24 + Math.sin(t * 0.9) * h * 0.04,
				tx = rx + Math.sin(ang) * len,
				ty = ry + rr + Math.cos(ang) * len;
			for (const [lw, c] of [
				[3.4, OL],
				[1.6, '#e8d6a8'],
			] as const) {
				ctx.strokeStyle = c;
				ctx.lineWidth = lw;
				ctx.beginPath();
				ctx.moveTo(rx, ry + rr);
				ctx.lineTo(tx, ty);
				ctx.stroke();
			}
			lump(tx + Math.sin(ang) * m * 0.1, ty + Math.cos(ang) * m * 0.1, m * 0.12, true, 2);
			ctx.save();
			ctx.translate(tx, ty);
			ctx.rotate(-ang);
			for (const s of [-1, 1]) {
				ctx.beginPath();
				ctx.moveTo(s * 3, 3);
				ctx.bezierCurveTo(s * 16, 5, s * 18, 18, s * 7, 25);
				ctx.lineTo(s * 4, 22);
				ctx.bezierCurveTo(s * 12, 17, s * 11, 9, s * 1, 8);
				ctx.closePath();
				ctx.fillStyle = '#d8dde6';
				ctx.fill();
				ctx.strokeStyle = OL;
				ctx.lineWidth = 1.6;
				ctx.stroke();
			}
			ctx.fillStyle = '#c99a3a';
			ctx.beginPath();
			ctx.roundRect(-6, -3, 12, 9, 3);
			ctx.fill();
			ctx.stroke();
			ctx.restore();
			// the prospector at the crank
			const ms = (h * 0.24) / 100,
				mx = rx + rw + 36 * ms + 4,
				my = surf - h * 0.02;
			ctx.save();
			ctx.translate(mx, my);
			ctx.scale(ms, ms);
			ctx.lineJoin = 'round';
			const limb = (col: string, ...p: number[]) => {
				for (const [lw, c] of [
					[11, OL],
					[8, col],
				] as const) {
					ctx.strokeStyle = c;
					ctx.lineWidth = lw;
					ctx.beginPath();
					ctx.moveTo(p[0] ?? 0, p[1] ?? 0);
					for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i] ?? 0, p[i + 1] ?? 0);
					ctx.stroke();
				}
			};
			limb('#3b5a8c', -6, -30, -9, -4);
			limb('#4a6aa0', 6, -30, 8, -4);
			ctx.fillStyle = '#4a2a14';
			ctx.strokeStyle = OL;
			ctx.lineWidth = 2;
			for (const bx of [-12, 5]) {
				ctx.beginPath();
				ctx.roundRect(bx, -6, 14, 7, 3);
				ctx.fill();
				ctx.stroke();
			}
			ctx.fillStyle = '#c8402e';
			ctx.beginPath();
			ctx.moveTo(-13, -30);
			ctx.quadraticCurveTo(-15, -50, -10, -60);
			ctx.lineTo(10, -60);
			ctx.quadraticCurveTo(16, -48, 13, -30);
			ctx.closePath();
			ctx.fill();
			ctx.stroke();
			ctx.strokeStyle = '#2b3f66';
			ctx.lineWidth = 3.5;
			ctx.beginPath();
			ctx.moveTo(-7, -59);
			ctx.lineTo(-6, -32);
			ctx.moveTo(7, -59);
			ctx.lineTo(6, -32);
			ctx.stroke();
			const cr = t * 4;
			limb('#c8402e', -8, -54, -22, -44, -34 + Math.cos(cr) * 4, -48 + Math.sin(cr) * 4);
			ctx.fillStyle = '#f2c79a';
			ctx.strokeStyle = OL;
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.ellipse(0, -72, 12, 13, 0, 0, TAU);
			ctx.fill();
			ctx.stroke();
			ctx.fillStyle = '#f4f1ea';
			ctx.beginPath();
			ctx.moveTo(-12, -70);
			ctx.quadraticCurveTo(-16, -50, -3, -46);
			ctx.quadraticCurveTo(8, -48, 10, -64);
			ctx.quadraticCurveTo(-1, -60, -12, -70);
			ctx.fill();
			ctx.stroke();
			ctx.fillStyle = '#e8957a';
			ctx.beginPath();
			ctx.ellipse(-11, -68, 5, 4.2, 0, 0, TAU);
			ctx.fill();
			ctx.stroke();
			ctx.fillStyle = '#1a0e08';
			ctx.beginPath();
			ctx.ellipse(-6, -75, 1.6, 2.2, 0, 0, TAU);
			ctx.fill();
			ctx.fillStyle = '#8a5428';
			ctx.strokeStyle = OL;
			ctx.beginPath();
			ctx.ellipse(0, -83, 22, 5, -0.06, 0, TAU);
			ctx.fill();
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(-12, -84);
			ctx.quadraticCurveTo(-13, -101, -4, -99);
			ctx.quadraticCurveTo(0, -95, 4, -99);
			ctx.quadraticCurveTo(13, -101, 12, -84);
			ctx.closePath();
			ctx.fill();
			ctx.stroke();
			ctx.restore();
		},
	},
	{
		id: 'skokan',
		title: 'SKOKAN',
		group: 'puzzle',
		category: 'arcade',
		tagline: 'Skákej pořád výš!',
		description:
			'Na motivy Doodle Jumpu: zelený panáček z čtverečkovaného sešitu sám skáče po plošinkách a ty ho posíláš doleva a doprava. Pohyblivé, lámavé a mizející plošinky, pružiny, vrtulka, raketový batoh, příšery a černé díry. Sešit nebo vesmír, denní skok a Cesta se zlatými hvězdami.',
		genres: ['Arkáda', 'Skákačka', 'Nekonečná'],
		features: ['Sešit a Vesmír', 'Denní skok', 'Cesta: 120 skoků', 'Žebříčky výšky'],
		en: {
			tagline: 'Jump higher and higher!',
			description:
				'In the spirit of Doodle Jump: a green doodle from a squared notebook bounces up the platforms by itself and you steer it left and right. Moving, breaking and vanishing platforms, springs, a propeller, a jetpack, monsters and black holes. Notebook or space, a daily jump and a Path with gold stars.',
			genres: ['Arcade', 'Jumper', 'Endless'],
			features: ['Notebook and Space', 'Daily jump', 'Path: 120 jumps', 'Height leaderboards'],
		},
		statLabels: labels,
		path: '/games/skokan/index.html',
		colors: ['#7fd34a', '#5ab8ff', '#f8f3e3'],
		statsKey: 'gamecenter.stats.skokan',
		cover(ctx, w, h, t) {
			// squared notebook paper; the doodle bounces up while the platforms scroll down
			const INK = '#2b2b3a',
				s = Math.max(12, w / 20),
				scroll = (t * 40) % (h * 0.25);
			ctx.fillStyle = '#f8f3e3';
			ctx.fillRect(0, 0, w, h);
			ctx.strokeStyle = 'rgba(120,160,210,.4)';
			ctx.lineWidth = 1;
			ctx.beginPath();
			for (let x = 0; x <= w; x += s) {
				ctx.moveTo(x + 0.5, 0);
				ctx.lineTo(x + 0.5, h);
			}
			for (let y = (scroll % s) - s; y <= h; y += s) {
				ctx.moveTo(0, y + 0.5);
				ctx.lineTo(w, y + 0.5);
			}
			ctx.stroke();
			ctx.strokeStyle = 'rgba(230,90,90,.4)';
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.moveTo(w * 0.08, 0);
			ctx.lineTo(w * 0.08, h);
			ctx.stroke();
			const pw = w * 0.2,
				ph = Math.max(8, h * 0.028);
			const plat = (x: number, y: number, c1: string, c2: string) => {
				ctx.fillStyle = c1;
				ctx.beginPath();
				ctx.roundRect(x - pw / 2, y, pw, ph, ph / 2);
				ctx.fill();
				ctx.fillStyle = c2;
				ctx.beginPath();
				ctx.roundRect(x - pw / 2 + 2, y + ph * 0.55, pw - 4, ph * 0.38, ph / 3);
				ctx.fill();
				ctx.strokeStyle = INK;
				ctx.lineWidth = 2;
				ctx.beginPath();
				ctx.roundRect(x - pw / 2, y, pw, ph, ph / 2);
				ctx.stroke();
			};
			const rows = [0.18, 0.28, 0.43, 0.53, 0.68, 0.78, 0.93, 1.03];
			rows.forEach((ry, i) => {
				const y = ((ry * h + scroll) % (h * 1.0)) - ph,
					x = w * (0.2 + ((i * 0.37 + 0.13) % 1) * 0.6);
				if (i % 4 === 1) plat(x + Math.sin(t * 1.5 + i) * w * 0.12, y, '#5ab8ff', '#2a74c8');
				else plat(x, y, '#7fd34a', '#4e9a2a');
			});
			// the doodle: bean body, striped trousers, snout and legs
			const bounce = Math.abs(Math.sin(t * 2.6)),
				dx = w * 0.5 + Math.sin(t * 0.9) * w * 0.12,
				dy = h * 0.56 - bounce * h * 0.2,
				ds = h / 9 / 45,
				face = Math.cos(t * 0.9) >= 0 ? 1 : -1;
			ctx.save();
			ctx.translate(dx, dy);
			ctx.scale(ds * face, ds * (1 - (1 - bounce) * 0.08));
			ctx.lineCap = 'round';
			ctx.strokeStyle = INK;
			ctx.lineWidth = 3;
			for (const lx of [-12, -4, 4, 12]) {
				ctx.beginPath();
				ctx.moveTo(lx, -10);
				ctx.lineTo(lx + 1.5, -1);
				ctx.lineTo(lx + 5, -1);
				ctx.stroke();
			}
			const body = () => {
				ctx.beginPath();
				ctx.moveTo(-16, -10);
				ctx.bezierCurveTo(-19, -26, -16, -44, 0, -45);
				ctx.bezierCurveTo(14, -45, 18, -32, 17, -20);
				ctx.lineTo(17, -10);
				ctx.closePath();
			};
			body();
			ctx.fillStyle = '#a8d84a';
			ctx.fill();
			ctx.save();
			body();
			ctx.clip();
			ctx.fillStyle = '#6f9e2c';
			ctx.fillRect(-20, -19, 40, 10);
			ctx.fillStyle = '#4a7a1a';
			for (let i = 0; i < 3; i++) ctx.fillRect(-20, -18 + i * 3.4, 40, 1.6);
			ctx.restore();
			body();
			ctx.lineWidth = 2.4;
			ctx.stroke();
			ctx.fillStyle = '#a8d84a';
			ctx.beginPath();
			ctx.moveTo(10, -37);
			ctx.lineTo(24, -36);
			ctx.lineTo(24, -28);
			ctx.lineTo(10, -27);
			ctx.fill();
			ctx.stroke();
			ctx.fillStyle = '#d9f09a';
			ctx.beginPath();
			ctx.ellipse(25, -32, 3, 5.5, 0, 0, TAU);
			ctx.fill();
			ctx.stroke();
			ctx.fillStyle = INK;
			for (const ex of [3, 9]) {
				ctx.beginPath();
				ctx.ellipse(ex, -36, 1.8, 2.6, 0, 0, TAU);
				ctx.fill();
			}
			ctx.restore();
		},
	},
	{
		id: 'smik',
		title: 'ŠMIK!',
		group: 'puzzle',
		category: 'arcade',
		tagline: 'Krájej ovoce, nesekej bomby!',
		description:
			'Na motivy Fruit Ninji: ovoce vylétá do vzduchu a ty ho krájíš tahem prstu nebo myši. Kombo za víc kusů jedním tahem, šťáva po celém dřevěném dojo a bomby, do kterých se nesmí seknout. Klasika se třemi životy, minutová Arkáda s kouzelnými banány a klidný Zen.',
		genres: ['Arkáda', 'Krájení', 'Reflexy'],
		features: ['Klasika, Arkáda, Zen', 'Komba a banány', 'Denní krájení', 'Žebříčky bodů'],
		en: {
			tagline: 'Slice the fruit, spare the bombs!',
			description:
				'In the spirit of Fruit Ninja: fruit flies into the air and you slice it with a swipe of a finger or the mouse. Combos for several in one swipe, juice all over the wooden dojo and bombs you must never cut. Classic with three lives, a one-minute Arcade with magic bananas and a calm Zen.',
			genres: ['Arcade', 'Slicing', 'Reflexes'],
			features: [
				'Classic, Arcade, Zen',
				'Combos and bananas',
				'Daily slicing',
				'Points leaderboards',
			],
		},
		statLabels: labels,
		path: '/games/smik/index.html',
		colors: ['#ff4d5a', '#7bd24a', '#ffa53a'],
		statsKey: 'gamecenter.stats.smik',
		cover(ctx, w, h, t) {
			// a wooden dojo: fruit arcs up, a glowing blade swipes through and the watermelon splits
			const OL = '#2a1408',
				pw = w / 5;
			for (let i = 0; i < 6; i++) {
				const gr = ctx.createLinearGradient(i * pw, 0, (i + 1) * pw, 0);
				const base = ['#7a4a2a', '#6b3f22', '#865534'][i % 3] ?? '#7a4a2a';
				gr.addColorStop(0, base);
				gr.addColorStop(0.5, '#8f5c38');
				gr.addColorStop(1, base);
				ctx.fillStyle = gr;
				ctx.fillRect(i * pw, 0, pw, h);
				ctx.fillStyle = 'rgba(20,10,4,.7)';
				ctx.fillRect(i * pw, 0, 2, h);
				ctx.strokeStyle = 'rgba(40,20,8,.3)';
				ctx.lineWidth = 1;
				for (let k = 0; k < 4; k++) {
					ctx.beginPath();
					for (let y = 0; y <= h; y += 30)
						ctx.lineTo(i * pw + 8 + k * (pw / 4) + Math.sin(y * 0.03 + k + i) * 3, y);
					ctx.stroke();
				}
			}
			const m = Math.min(w, h),
				cyc = (t % 3) / 3;
			const ball = (x: number, y: number, r: number, c1: string, c2: string) => {
				const gr = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r * 1.2);
				gr.addColorStop(0, c1);
				gr.addColorStop(1, c2);
				ctx.fillStyle = gr;
				ctx.strokeStyle = OL;
				ctx.lineWidth = 2;
				ctx.beginPath();
				ctx.arc(x, y, r, 0, TAU);
				ctx.fill();
				ctx.stroke();
				ctx.fillStyle = 'rgba(255,255,255,.55)';
				ctx.beginPath();
				ctx.ellipse(x - r * 0.38, y - r * 0.4, r * 0.24, r * 0.13, -0.6, 0, TAU);
				ctx.fill();
			};
			// juice splat left by the cut
			if (cyc > 0.3) {
				ctx.globalAlpha = Math.min(0.5, (cyc - 0.3) * 2);
				ctx.fillStyle = '#ff3b4a';
				ctx.beginPath();
				for (let i = 0; i <= 12; i++) {
					const a = (i / 12) * TAU,
						q = m * 0.16 * (0.7 + 0.35 * Math.abs(Math.sin(i * 1.7)));
					ctx.lineTo(w * 0.5 + Math.cos(a) * q, h * 0.32 + Math.sin(a) * q);
				}
				ctx.fill();
				ctx.globalAlpha = 1;
			}
			// two fruits on arcs
			const arc = (ph: number, x0: number, x1: number) => {
				const k = (cyc + ph) % 1;
				return [x0 + (x1 - x0) * k, h * 0.95 - Math.sin(k * Math.PI) * h * 0.75] as const;
			};
			const [ox, oy] = arc(0.3, w * 0.1, w * 0.45);
			ball(ox, oy, m * 0.08, '#ffc46a', '#ff8a1a');
			const [ax, ay] = arc(0.65, w * 0.95, w * 0.6);
			ball(ax, ay, m * 0.075, '#ff7a6a', '#c81e2a');
			// the watermelon: whole until the blade passes, then two halves fly apart
			const mr = m * 0.15,
				mx = w * 0.5,
				my = h * 0.32;
			if (cyc < 0.3) {
				ball(mx, my - (0.3 - cyc) * h * 0.4, mr, '#7bd24a', '#2e7d1e');
				ctx.save();
				ctx.beginPath();
				ctx.arc(mx, my - (0.3 - cyc) * h * 0.4, mr, 0, TAU);
				ctx.clip();
				ctx.strokeStyle = '#1f5a14';
				ctx.lineWidth = 4;
				for (let i = -3; i <= 3; i++) {
					ctx.beginPath();
					ctx.moveTo(mx + i * mr * 0.3, my - (0.3 - cyc) * h * 0.4 - mr);
					ctx.quadraticCurveTo(
						mx + i * mr * 0.4,
						my - (0.3 - cyc) * h * 0.4,
						mx + i * mr * 0.3,
						my - (0.3 - cyc) * h * 0.4 + mr,
					);
					ctx.stroke();
				}
				ctx.restore();
			} else {
				const k = (cyc - 0.3) * 0.7;
				for (const s of [-1, 1]) {
					ctx.save();
					ctx.translate(mx + s * k * w * 0.4, my + k * k * h * 1.6);
					ctx.rotate(-0.6 + s * k * 3);
					ctx.beginPath();
					ctx.rect(s > 0 ? 0 : -mr, -mr, mr, mr * 2);
					ctx.clip();
					for (const [rr, c] of [
						[1, '#2e7d1e'],
						[0.9, '#e8f5c8'],
						[0.8, '#ff4d5a'],
					] as const) {
						ctx.fillStyle = c;
						ctx.beginPath();
						ctx.arc(0, 0, mr * rr, 0, TAU);
						ctx.fill();
					}
					ctx.strokeStyle = OL;
					ctx.lineWidth = 2;
					ctx.beginPath();
					ctx.arc(0, 0, mr, 0, TAU);
					ctx.stroke();
					ctx.fillStyle = '#1a1010';
					for (let i = 0; i < 6; i++) {
						const a = i * 1.05 + 0.3;
						ctx.beginPath();
						ctx.ellipse(Math.cos(a) * mr * 0.45, Math.sin(a) * mr * 0.5, 1.5, 3, a, 0, TAU);
						ctx.fill();
					}
					ctx.restore();
				}
			}
			// blade swipe
			if (cyc > 0.2 && cyc < 0.42) {
				const k = (cyc - 0.2) / 0.22;
				ctx.save();
				ctx.lineCap = 'round';
				ctx.shadowColor = '#7ad8ff';
				for (const [lw, col, blur] of [
					[10, 'rgba(120,220,255,.4)', 12],
					[3, '#ffffff', 0],
				] as const) {
					ctx.shadowBlur = blur;
					ctx.strokeStyle = col;
					ctx.lineWidth = lw * (1 - k * 0.5);
					ctx.beginPath();
					ctx.moveTo(w * (0.15 + k * 0.4), h * (0.5 - k * 0.15));
					ctx.lineTo(w * (0.25 + k * 0.6), h * (0.42 - k * 0.3));
					ctx.stroke();
				}
				ctx.restore();
			}
		},
	},
	{
		id: 'veky',
		title: 'VĚKY VÁLEK',
		group: 'puzzle',
		category: 'strategy',
		tagline: 'Od kyje po laser!',
		description:
			'Na motivy Age of War: veď svůj národ od pravěku po budoucnost. Cvič pěšáky, střelce a těžké jednotky od jezdce na dinosaurovi po bojového robota, stav věže, sesílej meteory, nálety i orbitální laser a zboř nepřátelskou základnu. S vlastní hrdinskou hudbou, kterou každý věk hraje jinými nástroji.',
		genres: ['Strategie', 'Obrana', 'Věky'],
		features: ['5 věků, 15 jednotek', 'Věže a zvláštní útoky', 'Vlastní hudba', 'Cesta: 120 bitev'],
		en: {
			tagline: 'From clubs to lasers!',
			description:
				'In the spirit of Age of War: lead your people from the Stone Age to the future. Train infantry, ranged and heavy units from a dino rider to a war mech, build turrets, call down meteors, air strikes and an orbital laser and destroy the enemy base. With its own heroic score that every age plays on different instruments.',
			genres: ['Strategy', 'Defense', 'Ages'],
			features: ['5 ages, 15 units', 'Turrets and specials', 'Own music', 'Path: 120 battles'],
		},
		statLabels: labels,
		path: '/games/veky/index.html',
		colors: ['#b07aff', '#3d8bff', '#ff4d4d'],
		statsKey: 'gamecenter.stats.veky',
		cover(ctx, w, h, t) {
			// a battle across the ages: blue knights from a stone castle against red robots from a
			// glowing future tower, sparks at the clash and meteors falling
			const OL = '#1a1210',
				gy = h * 0.62,
				m = Math.min(w, h);
			const sky = ctx.createLinearGradient(0, 0, w, 0);
			sky.addColorStop(0, '#5aa8ff');
			sky.addColorStop(0.55, '#8a7ad8');
			sky.addColorStop(1, '#2a1a5a');
			ctx.fillStyle = sky;
			ctx.fillRect(0, 0, w, gy);
			for (let i = 0; i < 30; i++) {
				ctx.fillStyle = `rgba(255,255,255,${0.2 + ((i * 37) % 10) / 14})`;
				ctx.beginPath();
				ctx.arc(w * 0.55 + ((i * 53) % (w * 0.45)), (i * 29) % (gy * 0.6), 1.1, 0, TAU);
				ctx.fill();
			}
			ctx.fillStyle = 'rgba(40,40,80,.35)';
			ctx.beginPath();
			ctx.moveTo(0, gy);
			for (let x = 0; x <= w; x += 16)
				ctx.lineTo(x, gy - h * 0.14 - Math.sin(x * 0.025) * h * 0.04);
			ctx.lineTo(w, gy);
			ctx.fill();
			const ground = ctx.createLinearGradient(0, gy, 0, h);
			ground.addColorStop(0, '#7a8a4a');
			ground.addColorStop(0.15, '#8a7a5a');
			ground.addColorStop(1, '#2a2018');
			ctx.fillStyle = ground;
			ctx.fillRect(0, gy, w, h - gy);
			ctx.fillStyle = '#5a9a3a';
			ctx.fillRect(0, gy - 2, w * 0.55, 4);
			ctx.fillStyle = '#5ad8ff';
			ctx.fillRect(w * 0.55, gy - 2, w * 0.45, 3);
			const out = (fill: string | CanvasGradient, path: () => void, lw = 1.6) => {
				path();
				ctx.fillStyle = fill;
				ctx.fill();
				ctx.strokeStyle = OL;
				ctx.lineWidth = lw;
				ctx.stroke();
			};
			// stone castle with a blue banner
			const cw = m * 0.24;
			out(
				'#b8b2a6',
				() => {
					ctx.beginPath();
					ctx.rect(-cw * 0.2, gy - m * 0.3, cw, m * 0.3);
				},
				2,
			);
			for (let i = 0; i < 4; i++)
				out('#a8a296', () => {
					ctx.beginPath();
					ctx.rect(-cw * 0.2 + i * cw * 0.27, gy - m * 0.34, cw * 0.15, m * 0.04);
				});
			out('#3d7bff', () => {
				ctx.beginPath();
				ctx.moveTo(cw * 0.25, gy - m * 0.26);
				ctx.lineTo(cw * 0.5, gy - m * 0.26);
				ctx.lineTo(cw * 0.5, gy - m * 0.14);
				ctx.lineTo(cw * 0.375, gy - m * 0.11);
				ctx.lineTo(cw * 0.25, gy - m * 0.14);
				ctx.closePath();
			});
			ctx.fillStyle = '#ffe066';
			ctx.fillRect(cw * 0.36, gy - m * 0.25, 3, m * 0.11);
			ctx.fillRect(cw * 0.29, gy - m * 0.21, cw * 0.17, 3);
			// future tower with a glowing core
			out(
				'#3a3a5a',
				() => {
					ctx.beginPath();
					ctx.moveTo(w + 4, gy);
					ctx.lineTo(w - m * 0.22, gy);
					ctx.lineTo(w - m * 0.14, gy - m * 0.44);
					ctx.lineTo(w - m * 0.05, gy - m * 0.5);
					ctx.lineTo(w + 4, gy - m * 0.44);
					ctx.closePath();
				},
				2,
			);
			ctx.shadowColor = '#5ad8ff';
			ctx.shadowBlur = 12;
			ctx.fillStyle = `rgba(90,216,255,${0.7 + 0.3 * Math.sin(t * 3)})`;
			ctx.beginPath();
			ctx.arc(w - m * 0.1, gy - m * 0.32, m * 0.03, 0, TAU);
			ctx.fill();
			ctx.fillRect(w - m * 0.1 - 1.5, gy - m * 0.3, 3, m * 0.3);
			ctx.shadowBlur = 0;
			const s = m / 220;
			const knight = (x: number, ph: number) => {
				const step = Math.sin(t * 8 + ph) * 4,
					swing = Math.max(0, Math.sin(t * 5 + ph));
				ctx.save();
				ctx.translate(x, gy);
				ctx.scale(s, s);
				ctx.lineCap = 'round';
				for (const [lw, c] of [
					[9, OL],
					[6.4, '#5a4a3a'],
				] as const) {
					ctx.strokeStyle = c;
					ctx.lineWidth = lw;
					ctx.beginPath();
					ctx.moveTo(-3, -24);
					ctx.lineTo(-3 + step, 0);
					ctx.moveTo(3, -24);
					ctx.lineTo(3 - step, 0);
					ctx.stroke();
				}
				out(
					'#3d7bff',
					() => {
						ctx.beginPath();
						ctx.moveTo(-8, -23);
						ctx.lineTo(8, -23);
						ctx.lineTo(10, -44);
						ctx.lineTo(-9, -44);
						ctx.closePath();
					},
					1.8,
				);
				ctx.fillStyle = '#fff';
				ctx.fillRect(-0.5, -41, 2.4, 14);
				ctx.fillRect(-4, -36, 9, 2.4);
				out('#f0c49a', () => {
					ctx.beginPath();
					ctx.ellipse(2, -53, 8, 8.8, 0, 0, TAU);
				});
				out('#c8ccd4', () => {
					ctx.beginPath();
					ctx.moveTo(-9, -52);
					ctx.quadraticCurveTo(-10, -66, 2, -66);
					ctx.quadraticCurveTo(12, -66, 11, -54);
					ctx.lineTo(-9, -54);
					ctx.closePath();
				});
				ctx.fillStyle = OL;
				ctx.beginPath();
				ctx.arc(6, -51, 1.3, 0, TAU);
				ctx.fill();
				ctx.save();
				ctx.translate(8, -40);
				ctx.rotate(0.6 - swing * 2);
				ctx.strokeStyle = OL;
				ctx.lineWidth = 6.5;
				ctx.beginPath();
				ctx.moveTo(0, 0);
				ctx.lineTo(16, 0);
				ctx.stroke();
				ctx.fillStyle = '#e8ecf4';
				ctx.fillRect(16, -1.5, 22, 3);
				ctx.fillStyle = '#c99a3a';
				ctx.fillRect(14, -5, 3, 10);
				ctx.restore();
				out('#3d7bff', () => {
					ctx.beginPath();
					ctx.moveTo(8, -46);
					ctx.lineTo(20, -46);
					ctx.quadraticCurveTo(21, -30, 14, -22);
					ctx.quadraticCurveTo(7, -30, 8, -46);
					ctx.closePath();
				});
				ctx.fillStyle = '#ffe066';
				ctx.fillRect(13, -42, 2.4, 14);
				ctx.restore();
			};
			const robot = (x: number, ph: number) => {
				const step = Math.sin(t * 8 + ph) * 4,
					swing = Math.max(0, Math.sin(t * 5 + ph + 1));
				ctx.save();
				ctx.translate(x, gy);
				ctx.scale(-s, s);
				ctx.lineCap = 'round';
				for (const [lw, c] of [
					[9, OL],
					[6.4, '#4a4a6a'],
				] as const) {
					ctx.strokeStyle = c;
					ctx.lineWidth = lw;
					ctx.beginPath();
					ctx.moveTo(-3, -24);
					ctx.lineTo(-3 + step, 0);
					ctx.moveTo(3, -24);
					ctx.lineTo(3 - step, 0);
					ctx.stroke();
				}
				out(
					'#8a92b0',
					() => {
						ctx.beginPath();
						ctx.roundRect(-9, -46, 19, 24, 4);
					},
					1.8,
				);
				ctx.shadowColor = '#e8383a';
				ctx.shadowBlur = 6;
				ctx.strokeStyle = '#e8383a';
				ctx.lineWidth = 2;
				ctx.beginPath();
				ctx.moveTo(-8, -36);
				ctx.lineTo(9, -36);
				ctx.stroke();
				ctx.shadowBlur = 0;
				out('#a8b0c8', () => {
					ctx.beginPath();
					ctx.ellipse(1, -55, 9, 10, 0, 0, TAU);
				});
				ctx.fillStyle = '#ff5a5a';
				ctx.shadowColor = '#ff5a5a';
				ctx.shadowBlur = 8;
				ctx.fillRect(1, -58, 9, 4);
				ctx.shadowBlur = 0;
				ctx.save();
				ctx.translate(8, -40);
				ctx.rotate(0.6 - swing * 2);
				ctx.strokeStyle = OL;
				ctx.lineWidth = 6.5;
				ctx.beginPath();
				ctx.moveTo(0, 0);
				ctx.lineTo(16, 0);
				ctx.stroke();
				ctx.shadowColor = '#5affe8';
				ctx.shadowBlur = 10;
				ctx.fillStyle = '#9affee';
				ctx.fillRect(16, -2, 26, 4);
				ctx.shadowBlur = 0;
				ctx.restore();
				ctx.restore();
			};
			const clash = w * 0.5 + Math.sin(t * 0.7) * w * 0.04;
			for (let i = 0; i < 3; i++) knight(clash - m * 0.06 - i * m * 0.11, i);
			for (let i = 0; i < 3; i++) robot(clash + m * 0.06 + i * m * 0.11, i + 2);
			for (let i = 0; i < 6; i++) {
				const a = t * 9 + i * 1.05,
					r = (Math.sin(t * 7 + i) * 0.5 + 0.5) * m * 0.05;
				ctx.fillStyle = i % 2 ? '#ffe066' : '#ffffff';
				ctx.beginPath();
				ctx.arc(clash + Math.cos(a) * r, gy - m * 0.17 + Math.sin(a) * r, 2.2, 0, TAU);
				ctx.fill();
			}
			for (let i = 0; i < 3; i++) {
				const k = (t * 0.45 + i / 3) % 1,
					mx = w * (0.5 + i * 0.16) - (1 - k) * w * 0.25,
					my = k * gy * 0.8;
				const tr = ctx.createLinearGradient(mx - m * 0.14, my - m * 0.14, mx, my);
				tr.addColorStop(0, 'rgba(255,140,40,0)');
				tr.addColorStop(1, 'rgba(255,190,70,.95)');
				ctx.strokeStyle = tr;
				ctx.lineWidth = 7;
				ctx.beginPath();
				ctx.moveTo(mx - m * 0.14, my - m * 0.14);
				ctx.lineTo(mx, my);
				ctx.stroke();
				out(
					'#6a4a3a',
					() => {
						ctx.beginPath();
						ctx.arc(mx, my, m * 0.025, 0, TAU);
					},
					1.4,
				);
			}
		},
	},
	{
		id: 'ptaci',
		title: 'PTAČÍ POMSTA',
		group: 'puzzle',
		category: 'arcade',
		tagline: 'Natáhni prak a pomsti hnízdo!',
		description:
			'Na motivy Angry Birds: prakem střílíš ptáky na stavby ze dřeva, skla a kamene, ve kterých se schovávají zelená prasata. Skutečná fyzika, padající věže, žlutý pták, který zrychlí, modrý, který se rozdělí na tři, a černý, který vybuchne. Čím míň ptáků spotřebuješ, tím víc hvězd.',
		genres: ['Arkáda', 'Fyzika', 'Prak'],
		features: ['Fyzika staveb', '4 druhy ptáků', 'Cesta: 120 úrovní', 'Denní pomsta'],
		en: {
			tagline: 'Pull the slingshot, avenge the nest!',
			description:
				'In the spirit of Angry Birds: launch birds from a slingshot at forts of wood, glass and stone where green pigs are hiding. Real physics, toppling towers, a yellow bird that dashes, a blue one that splits in three and a black one that explodes. The fewer birds you use, the more stars you get.',
			genres: ['Arcade', 'Physics', 'Slingshot'],
			features: ['Fort physics', '4 kinds of birds', 'Path: 120 levels', 'Daily revenge'],
		},
		statLabels: labels,
		path: '/games/ptaci/index.html',
		colors: ['#ff4a3a', '#7cc8f4', '#7ccd3c'],
		statsKey: 'gamecenter.stats.ptaci',
		cover(ctx, w, h, t) {
			// a summer field: a red bird flies from the slingshot in an arc and knocks the pig
			// off a little wooden tower, then everything starts again
			const OL = '#1c1410',
				gy = h * 0.8,
				m = Math.min(w, h),
				cyc = (t % 3.2) / 3.2;
			const sky = ctx.createLinearGradient(0, 0, 0, gy);
			sky.addColorStop(0, '#7cc8f4');
			sky.addColorStop(1, '#d6f0ff');
			ctx.fillStyle = sky;
			ctx.fillRect(0, 0, w, gy);
			ctx.fillStyle = 'rgba(255,255,255,.85)';
			for (const [cx, cy, r] of [
				[0.2, 0.18, 0.06],
				[0.26, 0.2, 0.05],
				[0.72, 0.12, 0.05],
				[0.78, 0.14, 0.06],
			] as const) {
				ctx.beginPath();
				ctx.arc(w * cx, h * cy, m * r, 0, TAU);
				ctx.fill();
			}
			ctx.fillStyle = '#7cbf5a';
			ctx.beginPath();
			ctx.moveTo(0, gy);
			for (let x = 0; x <= w; x += 10)
				ctx.lineTo(x, gy - h * 0.12 - Math.sin(x * 0.012) * h * 0.05);
			ctx.lineTo(w, gy);
			ctx.fill();
			ctx.fillStyle = '#7a4e2a';
			ctx.fillRect(0, gy, w, h - gy);
			ctx.fillStyle = '#8fd14f';
			ctx.fillRect(0, gy - 3, w, 8);
			const blob = (fill: string | CanvasGradient, path: () => void) => {
				ctx.beginPath();
				path();
				ctx.fillStyle = fill;
				ctx.fill();
				ctx.lineWidth = 2;
				ctx.strokeStyle = OL;
				ctx.stroke();
			};
			// tower: two posts and a roof plank, the pig on top until the bird arrives
			const tx = w * 0.74,
				ph = h * 0.22,
				pw = m * 0.035;
			const plank = (x: number, y: number, ww: number, hh: number) =>
				blob('#d8944a', () => ctx.rect(x - ww / 2, y - hh / 2, ww, hh));
			plank(tx - m * 0.1, gy - ph / 2, pw, ph);
			plank(tx + m * 0.1, gy - ph / 2, pw, ph);
			const hitT = 0.55,
				after = Math.max(0, cyc - hitT);
			ctx.save();
			ctx.translate(tx, gy - ph - pw / 2);
			ctx.rotate(Math.min(0.5, after * 3));
			plank(0, 0, m * 0.28, pw);
			ctx.restore();
			const pr = m * 0.075,
				px = tx + after * w * 0.5,
				py = gy - ph - pw - pr + after * after * h * 2.4;
			if (py < gy + pr) {
				ctx.save();
				ctx.translate(px, Math.min(py, gy - pr));
				ctx.rotate(after * 6);
				blob('#7ccd3c', () => ctx.arc(0, 0, pr, 0, TAU));
				blob('#b4ec6a', () => ctx.ellipse(0, pr * 0.2, pr * 0.32, pr * 0.24, 0, 0, TAU));
				ctx.fillStyle = '#fff';
				for (const s of [-1, 1]) {
					ctx.beginPath();
					ctx.arc(s * pr * 0.38, -pr * 0.25, pr * 0.16, 0, TAU);
					ctx.fill();
					ctx.fillStyle = OL;
					ctx.beginPath();
					ctx.arc(s * pr * 0.38, -pr * 0.22, pr * 0.07, 0, TAU);
					ctx.fill();
					ctx.fillStyle = '#fff';
				}
				ctx.restore();
			}
			// slingshot and the flying bird
			const sx = w * 0.18,
				sy = gy - h * 0.25;
			ctx.lineCap = 'round';
			ctx.strokeStyle = OL;
			ctx.lineWidth = m * 0.05;
			ctx.beginPath();
			ctx.moveTo(sx, gy);
			ctx.lineTo(sx, sy + h * 0.08);
			ctx.lineTo(sx - m * 0.05, sy);
			ctx.moveTo(sx, sy + h * 0.08);
			ctx.lineTo(sx + m * 0.05, sy);
			ctx.stroke();
			ctx.strokeStyle = '#9a5a2a';
			ctx.lineWidth = m * 0.035;
			ctx.stroke();
			const k = Math.min(1, cyc / hitT),
				bx = sx + (tx - sx) * k,
				by = sy - Math.sin(k * Math.PI) * h * 0.35 + (gy - ph - pw - sy) * k,
				br = m * 0.07;
			for (let i = 1; i < 7; i++) {
				const q = k - i * 0.06;
				if (q <= 0) break;
				ctx.fillStyle = 'rgba(255,255,255,.85)';
				ctx.beginPath();
				ctx.arc(
					sx + (tx - sx) * q,
					sy - Math.sin(q * Math.PI) * h * 0.35 + (gy - ph - pw - sy) * q,
					2.5,
					0,
					TAU,
				);
				ctx.fill();
			}
			const bird = (x: number, y: number) => {
				ctx.save();
				ctx.translate(x, y);
				ctx.rotate(cyc < hitT ? k * 1.2 - 0.6 : 0.6);
				const gr = ctx.createRadialGradient(-br * 0.3, -br * 0.3, br * 0.1, 0, 0, br * 1.1);
				gr.addColorStop(0, '#ff6a5a');
				gr.addColorStop(1, '#c8181e');
				blob(gr, () => ctx.arc(0, 0, br, 0, TAU));
				ctx.fillStyle = 'rgba(255,240,220,.8)';
				ctx.beginPath();
				ctx.ellipse(br * 0.15, br * 0.5, br * 0.55, br * 0.35, 0, 0, TAU);
				ctx.fill();
				ctx.fillStyle = '#fff';
				ctx.beginPath();
				ctx.arc(br * 0.3, -br * 0.15, br * 0.2, 0, TAU);
				ctx.fill();
				ctx.fillStyle = OL;
				ctx.beginPath();
				ctx.arc(br * 0.36, -br * 0.13, br * 0.08, 0, TAU);
				ctx.fill();
				ctx.fillRect(0, -br * 0.5, br * 0.7, br * 0.12);
				blob('#ffb23a', () => {
					ctx.moveTo(br * 0.5, 0);
					ctx.lineTo(br * 1.1, br * 0.15);
					ctx.lineTo(br * 0.5, br * 0.35);
					ctx.closePath();
				});
				ctx.restore();
			};
			bird(bx, cyc < hitT ? by : gy - ph - pw - br + Math.min(after * h * 1.5, ph + pw));
		},
	},
	{
		id: 'pirko',
		title: 'PÍRKO',
		group: 'puzzle',
		category: 'arcade',
		tagline: 'Ťukni a mávni křídly!',
		description:
			'Na motivy Flappy Bird: jedno ťuknutí a ptáček mávne křídly. Proleť co nejvíc mezer mezi zelenými rourami, každá desátá je zlatá, sbírej medaile od bronzové po platinovou a sleduj, jak se den mění v západ a noc. Lehká, Klasika a Těžká s pohyblivými rourami.',
		genres: ['Arkáda', 'Jedno tlačítko', 'Reflexy'],
		features: ['Tři obtížnosti', 'Medaile', 'Den, západ a noc', 'Žebříčky rour'],
		en: {
			tagline: 'Tap and flap!',
			description:
				'In the spirit of Flappy Bird: one tap and the little bird flaps its wings. Fly through as many gaps between the green pipes as you can, every tenth one is golden, earn medals from bronze to platinum and watch the day turn to sunset and night. Easy, Classic and Hard with moving pipes.',
			genres: ['Arcade', 'One button', 'Reflexes'],
			features: ['Three difficulties', 'Medals', 'Day, sunset and night', 'Pipe leaderboards'],
		},
		statLabels: labels,
		path: '/games/pirko/index.html',
		colors: ['#ffe14a', '#5ec4f0', '#7ccd3c'],
		statsKey: 'gamecenter.stats.pirko',
		cover(ctx, w, h, t) {
			// a sunny sky over a little city: pipes slide past and the bird flaps through the gaps
			const OL = '#2a1e14',
				gy = h * 0.84,
				m = Math.min(w, h);
			const sky = ctx.createLinearGradient(0, 0, 0, gy);
			sky.addColorStop(0, '#5ec4f0');
			sky.addColorStop(1, '#c8f0ff');
			ctx.fillStyle = sky;
			ctx.fillRect(0, 0, w, gy);
			ctx.fillStyle = 'rgba(255,255,255,.9)';
			for (const [cx, cy, r] of [
				[0.18, 0.2, 0.06],
				[0.24, 0.22, 0.05],
				[0.7, 0.14, 0.05],
				[0.76, 0.16, 0.06],
			] as const) {
				ctx.beginPath();
				ctx.arc(((w * cx - t * 10) % (w * 1.2)) + w * 0.1, h * cy, m * r, 0, TAU);
				ctx.fill();
			}
			ctx.fillStyle = '#8ccab8';
			for (let i = 0; i < 12; i++) {
				const bw = w / 12,
					bh = h * (0.08 + ((i * 37) % 7) / 50);
				ctx.fillRect(i * bw, gy - bh, bw - 2, bh);
			}
			ctx.fillStyle = '#5cbf4a';
			for (let i = 0; i <= 8; i++) {
				ctx.beginPath();
				ctx.arc((i * w) / 8, gy, m * 0.05, Math.PI, 0);
				ctx.fill();
			}
			// pipes
			const pw = m * 0.16,
				gap = h * 0.32,
				span = w * 0.62,
				off = (t * w * 0.18) % span;
			for (let i = -1; i < 3; i++) {
				const x = w * 0.75 + i * span - off,
					c = h * (0.42 + 0.12 * Math.sin(i * 2.1 + Math.floor((t * w * 0.18) / span) * 1.3));
				for (const [y0, y1] of [
					[-4, c - gap / 2],
					[c + gap / 2, gy],
				] as const) {
					const gr = ctx.createLinearGradient(x, 0, x + pw, 0);
					gr.addColorStop(0, '#4a9a2a');
					gr.addColorStop(0.3, '#a8ec6a');
					gr.addColorStop(1, '#3e8a22');
					ctx.fillStyle = gr;
					ctx.strokeStyle = OL;
					ctx.lineWidth = 2;
					ctx.fillRect(x, y0, pw, y1 - y0);
					ctx.strokeRect(x, y0, pw, y1 - y0);
					const ly = y0 < 0 ? y1 - h * 0.05 : y0;
					ctx.fillRect(x - 3, ly, pw + 6, h * 0.05);
					ctx.strokeRect(x - 3, ly, pw + 6, h * 0.05);
				}
			}
			ctx.fillStyle = '#ded28a';
			ctx.fillRect(0, gy, w, h - gy);
			ctx.fillStyle = '#7ccd3c';
			ctx.fillRect(0, gy, w, h * 0.03);
			ctx.fillStyle = OL;
			ctx.fillRect(0, gy, w, 2);
			// the bird
			const bx = w * 0.3,
				by = h * 0.44 + Math.sin(t * 4) * h * 0.04,
				r = m * 0.08,
				wing = Math.sin(t * 14);
			ctx.save();
			ctx.translate(bx, by);
			ctx.rotate(-Math.cos(t * 4) * 0.25);
			const gr = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r * 1.15);
			gr.addColorStop(0, '#fff6c0');
			gr.addColorStop(0.35, '#ffe14a');
			gr.addColorStop(1, '#f0a81a');
			ctx.fillStyle = gr;
			ctx.strokeStyle = OL;
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.ellipse(0, 0, r * 1.08, r, 0, 0, TAU);
			ctx.fill();
			ctx.stroke();
			ctx.fillStyle = '#fff';
			ctx.beginPath();
			ctx.ellipse(r * 0.48, -r * 0.3, r * 0.34, r * 0.38, 0, 0, TAU);
			ctx.fill();
			ctx.stroke();
			ctx.fillStyle = OL;
			ctx.beginPath();
			ctx.arc(r * 0.6, -r * 0.27, r * 0.14, 0, TAU);
			ctx.fill();
			ctx.fillStyle = '#ff8a2a';
			ctx.beginPath();
			ctx.moveTo(r * 0.7, 0);
			ctx.lineTo(r * 1.45, r * 0.15);
			ctx.lineTo(r * 0.72, r * 0.32);
			ctx.closePath();
			ctx.fill();
			ctx.stroke();
			ctx.fillStyle = '#fff6c0';
			ctx.beginPath();
			ctx.ellipse(
				-r * 0.25,
				r * 0.05 + wing * r * 0.15,
				r * 0.5,
				r * 0.28,
				-0.3 - wing * 0.4,
				0,
				TAU,
			);
			ctx.fill();
			ctx.stroke();
			ctx.restore();
		},
	},
	{
		id: 'mrakodrap',
		title: 'MRAKODRAP',
		group: 'puzzle',
		category: 'arcade',
		tagline: 'Pusť patro a stav do nebe!',
		description:
			'Na motivy Tower Bloxx: jeřáb houpe patrem a ty ho ťuknutím pustíš na věž. Přesně položená patra přivedou víc obyvatel a zklidní houpání, nepřesná věž rozkývají. Tři patra smíš upustit. Stav ze dne přes západ a noc až do vesmíru. Lehká, Klasika a Těžká s větrem.',
		genres: ['Arkáda', 'Jedno tlačítko', 'Načasování'],
		features: [
			'Perfektní položení a série',
			'Den, noc i vesmír',
			'Vítr v Těžké',
			'Žebříčky obyvatel',
		],
		en: {
			tagline: 'Drop a floor and build to the sky!',
			description:
				'In the spirit of Tower Bloxx: the crane swings a floor and one tap drops it onto the tower. Precisely placed floors bring more residents and calm the sway, sloppy ones make the tower rock. You may drop three floors. Build from day through sunset and night into space. Easy, Classic and Hard with wind.',
			genres: ['Arcade', 'One button', 'Timing'],
			features: [
				'Perfect drops and streaks',
				'Day, night and space',
				'Wind in Hard',
				'Resident leaderboards',
			],
		},
		statLabels: labels,
		path: '/games/mrakodrap/index.html',
		colors: ['#f6b80b', '#f0a87a', '#3b86d6'],
		statsKey: 'gamecenter.stats.mrakodrap',
		cover(ctx, w, h, t) {
			// the game's own art: its sunset city with the tower on the pedestal; the crane swings a
			// floor that drops onto the tower every few seconds
			const img = mrakodrapCover();
			const loaded = (i: HTMLImageElement): boolean => i.complete && i.naturalWidth > 0;
			if (!img || !loaded(img.bg) || !loaded(img.tower) || !loaded(img.floor)) {
				const sky = ctx.createLinearGradient(0, 0, 0, h);
				sky.addColorStop(0, '#3d6fcf');
				sky.addColorStop(0.6, '#f0a87a');
				sky.addColorStop(1, '#ffe0a8');
				ctx.fillStyle = sky;
				ctx.fillRect(0, 0, w, h);
				return;
			}
			// the sunset panel (406×941, the tower pedestal at x 202, y 795), mirrored at the sides on wide canvases
			const gy = h * 0.88,
				s = Math.max(gy / 795, Math.min(w / 406, h / 520)),
				x0 = w / 2 - 202 * s,
				y0 = gy - 795 * s,
				pw = 406 * s;
			ctx.fillStyle = '#3352a7';
			ctx.fillRect(0, 0, w, h);
			ctx.drawImage(img.bg, x0, y0, pw, 941 * s);
			for (let k = 1; x0 - (k - 1) * pw > 0 || x0 + k * pw < w; k++) {
				for (const side of [-1, 1]) {
					const x = side < 0 ? x0 - k * pw : x0 + k * pw;
					ctx.save();
					if (k % 2) {
						ctx.translate(x + pw, 0);
						ctx.scale(-1, 1);
						ctx.drawImage(img.bg, 0, y0, pw, 941 * s);
					} else ctx.drawImage(img.bg, x, y0, pw, 941 * s);
					ctx.restore();
				}
			}
			const jy = Math.max(10, h * 0.07),
				st = Math.min(s * 0.97, (gy - jy - 120 * s) / 250),
				cx = w / 2,
				top = gy - 246 * st,
				roof = gy - 210 * st;
			ctx.drawImage(img.tower, cx - 56 * st, gy - 248 * st, 112 * st, 250 * st);
			// crane jib: two chords and the lattice between them, trolley above the tower
			const y1 = jy + 14 * st;
			ctx.strokeStyle = '#f6b80b';
			ctx.lineWidth = Math.max(1.5, 3 * st);
			ctx.beginPath();
			ctx.moveTo(0, jy);
			ctx.lineTo(w, jy);
			ctx.moveTo(0, y1);
			ctx.lineTo(w, y1);
			ctx.stroke();
			ctx.strokeStyle = '#c48a00';
			ctx.lineWidth = Math.max(1, 1.6 * st);
			ctx.beginPath();
			for (let x = -14 * st; x < w + 14 * st; x += 14 * st) {
				ctx.moveTo(x, y1);
				ctx.lineTo(x + 7 * st, jy);
				ctx.lineTo(x + 14 * st, y1);
			}
			ctx.stroke();
			ctx.fillStyle = '#38404f';
			ctx.beginPath();
			ctx.roundRect(cx - 13 * st, y1 - st, 26 * st, 9 * st, 3 * st);
			ctx.fill();
			// the floor swings, drops onto the roof and a perfect ring flashes
			const cyc = t % 3.8,
				len = Math.max(20 * st, top - 30 * st - (y1 + 8 * st) - 52 * st),
				py = y1 + 8 * st,
				swing = (c: number): number => Math.sin(c * 2.2) * 0.38,
				th = swing(Math.min(cyc, 2.6)),
				hx = cx + Math.sin(th) * len,
				hy = py + Math.cos(th) * len;
			ctx.strokeStyle = '#3a404c';
			ctx.lineWidth = Math.max(1, 1.2 * st);
			ctx.beginPath();
			ctx.moveTo(cx - 4 * st, py);
			ctx.lineTo(hx - 3 * st, hy - 9 * st);
			ctx.moveTo(cx + 4 * st, py);
			ctx.lineTo(hx + 3 * st, hy - 9 * st);
			ctx.stroke();
			ctx.fillStyle = '#f6b80b';
			ctx.fillRect(hx - 8 * st, hy - 15 * st, 16 * st, 10 * st);
			ctx.fillStyle = '#1b1f28';
			for (let k = 0; k < 3; k++)
				ctx.fillRect(hx - 6 * st + k * 5 * st, hy - 15 * st, 2 * st, 10 * st);
			const drop = Math.max(0, cyc - 2.6),
				fallY = hy + 6 * st + Math.min(1, (drop / 0.45) ** 2) * (roof - 36 * st - hy - 6 * st),
				landed = drop > 0.45;
			if (cyc < 3.5) {
				ctx.save();
				ctx.translate(hx, drop > 0 ? fallY : hy);
				if (!drop) {
					ctx.rotate(-th * 0.12);
					ctx.strokeStyle = '#4a5160';
					ctx.lineWidth = Math.max(1, 1.2 * st);
					ctx.beginPath();
					ctx.moveTo(0, 0);
					ctx.lineTo(-46 * st, 6 * st);
					ctx.moveTo(0, 0);
					ctx.lineTo(46 * st, 6 * st);
					ctx.stroke();
				}
				ctx.globalAlpha = landed ? Math.max(0, 1 - (drop - 0.45) / 0.45) : 1;
				ctx.drawImage(img.floor, -56 * st, drop > 0 ? 0 : 6 * st, 112 * st, 36 * st);
				ctx.restore();
			}
			if (landed) {
				const r = Math.min(1, (drop - 0.45) / 0.6);
				ctx.strokeStyle = `rgba(255,214,90,${1 - r})`;
				ctx.lineWidth = Math.max(1.5, 3 * st * (1 - r));
				ctx.beginPath();
				ctx.ellipse(hx, roof - 18 * st, (52 + r * 70) * st, (14 + r * 22) * st, 0, 0, TAU);
				ctx.stroke();
			}
		},
	},
	{
		id: 'vlak',
		title: 'VLAK',
		group: 'puzzle',
		category: 'logic',
		tagline: 'Posbírej vše a vjeď do brány!',
		description:
			'Na motivy české klasiky Vlak z roku 1993: mašinka jezdí po louce a ty jí určuješ, kam zatočí. Posbírej všechna jablka, diamanty, koruny i dorty, každý předmět přidá vagón, a pak vjeď otevřenou bránou ven. Nenaraz do zdi ani do vlastních vagonů! Úrovně se generují a vždy jdou projet, denní výzva, 120 úrovní Cesty a čtyři obtížnosti.',
		genres: ['Logická', 'Retro', 'Plánování'],
		features: ['Generované úrovně', 'Rostoucí vlak', 'Denní výzva', 'Žebříčky časů'],
		en: {
			tagline: 'Collect it all and leave through the gate!',
			description:
				'In the spirit of the Czech classic Vlak from 1993: the engine rolls across the meadow and you decide where it turns. Collect every apple, diamond, crown and cake, each item adds a wagon, then drive out through the open gate. Do not crash into a wall or your own wagons! Generated levels that can always be solved, a daily puzzle, 120 Path levels and four difficulties.',
			genres: ['Logic', 'Retro', 'Planning'],
			features: ['Generated levels', 'A growing train', 'Daily puzzle', 'Time leaderboards'],
		},
		statLabels: labels,
		path: '/games/vlak/index.html',
		colors: ['#7cc768', '#e5463b', '#5fe3ff'],
		statsKey: 'gamecenter.stats.vlak',
		cover(ctx, w, h, t) {
			// the game's own scene (rendered from its art.js); smoke puffs from the engine and the gate glows
			ctx.fillStyle = '#5d6a7c';
			ctx.fillRect(0, 0, w, h);
			const img = vlakCover();
			if (!img || !img.complete || img.naturalWidth === 0) return;
			const s = Math.max(w / 960, h / 960),
				bx = Math.min(0, Math.max(w - 960 * s, w / 2 - 520 * s)),
				by = Math.min(0, Math.max(h - 960 * s, h * 0.42 - 440 * s));
			ctx.drawImage(img, bx, by, 960 * s, 960 * s);
			// glowing gate
			const p = (Math.sin(t * 4) + 1) / 2,
				gx = bx + 760 * s,
				gy = by + 520 * s;
			ctx.strokeStyle = `rgba(255,255,255,${0.4 + p * 0.5})`;
			ctx.lineWidth = Math.max(1.5, 3 * s);
			ctx.beginPath();
			ctx.arc(gx, gy, (22 + p * 14) * s, 0, TAU);
			ctx.stroke();
			// smoke from the chimney drifting back over the train
			for (let i = 0; i < 5; i++) {
				const k = (t * 0.8 + i / 5) % 1,
					x = bx + (545 - k * 120) * s,
					y = by + (440 - 30 - k * 60) * s;
				ctx.fillStyle = `rgba(245,245,250,${0.7 * (1 - k)})`;
				ctx.beginPath();
				ctx.arc(x, y, (6 + k * 16) * s, 0, TAU);
				ctx.fill();
			}
		},
	},
	{
		id: 'bombardak',
		title: 'BOMBARĎÁK',
		group: 'puzzle',
		category: 'arcade',
		tagline: 'Polož bombu a uteč za roh!',
		description:
			'Na motivy Bombermana: v aréně plné beden pokládáš bomby, plameny boří bedny a pod nimi čekají vylepšení, delší plamen, víc bomb a rychlost. Ve Výpravě zneškodníš příšery a najdeš skrytý východ, v Souboji se utkáš se třemi počítačovými bombarďáky, kteří umí utíkat i útočit. Šest světů, 120 úrovní Cesty, denní výprava a arkáda na skóre.',
		genres: ['Arkáda', 'Akce', 'Souboj'],
		features: ['Souboj proti počítači', '6 světů', 'Denní výprava', 'Arkáda na skóre'],
		en: {
			tagline: 'Drop a bomb and run around the corner!',
			description:
				'In the spirit of Bomberman: drop bombs in an arena full of crates, blast them open and grab the power-ups underneath, a longer blast, more bombs and speed. In Quest defeat the monsters and find the hidden exit; in Battle take on three computer bombers that know how to dodge and attack. Six worlds, 120 Path levels, a daily quest and an arcade for score.',
			genres: ['Arcade', 'Action', 'Battle'],
			features: ['Battle against the computer', '6 worlds', 'Daily quest', 'Arcade for score'],
		},
		statLabels: labels,
		path: '/games/bombardak/index.html',
		colors: ['#ffb22e', '#3d7bff', '#ff4d5e'],
		statsKey: 'gamecenter.stats.bombardak',
		cover(ctx, w, h, t) {
			// the game's own arena (rendered from its art.js); the blast pulses and the fuse sparks
			ctx.fillStyle = '#5fae4a';
			ctx.fillRect(0, 0, w, h);
			const img = bombardakCover();
			if (!img || !img.complete || img.naturalWidth === 0) return;
			const s = Math.max(w / 960, h / 960),
				bx = Math.min(0, Math.max(w - 960 * s, w / 2 - 520 * s)),
				by = Math.min(0, Math.max(h - 960 * s, h / 2 - 520 * s));
			ctx.drawImage(img, bx, by, 960 * s, 960 * s);
			const p = (Math.sin(t * 5) + 1) / 2,
				cx = bx + 540 * s,
				cy = by + 540 * s,
				glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, (150 + p * 60) * s);
			glow.addColorStop(0, `rgba(255,240,160,${0.35 + p * 0.3})`);
			glow.addColorStop(1, 'rgba(255,140,40,0)');
			ctx.fillStyle = glow;
			ctx.fillRect(cx - 220 * s, cy - 220 * s, 440 * s, 440 * s);
			// spark on the fuse of the lit bomb
			const fx = bx + 325 * s,
				fy = by + 248 * s;
			for (let i = 0; i < 4; i++) {
				const a = t * 9 + i * 1.7;
				ctx.fillStyle = i % 2 ? '#ff8a2a' : '#fff6b0';
				ctx.beginPath();
				ctx.arc(fx + Math.cos(a) * 9 * s, fy + Math.sin(a) * 9 * s, (4 + (i % 2) * 2) * s, 0, TAU);
				ctx.fill();
			}
		},
	},
];
