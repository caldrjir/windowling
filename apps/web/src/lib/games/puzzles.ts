/**
 * Puzzle games (static/games/<id>/ on the shared puzzle kit in static/games/puzzle-kit).
 * Each one keeps the same browser contract as the other games; the kit writes
 * `gamecenter.stats.<id>` with solved puzzles, the daily streak, Path level and rank.
 */
import type { Game } from './registry';

const TAU = Math.PI * 2;

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
	const bg = g.createLinearGradient(0, 0, w * 0.4, h);
	bg.addColorStop(0, '#1a0f3a');
	bg.addColorStop(1, '#07051a');
	g.fillStyle = bg;
	g.fillRect(0, 0, w, h);
	g.globalCompositeOperation = 'lighter';
	for (const [x, y, r, col] of [
		[0.25, 0.3, 0.55, '255,90,200'],
		[0.75, 0.65, 0.6, '80,200,255'],
		[0.5, 0.15, 0.4, '150,90,255'],
	] as const) {
		const rg = g.createRadialGradient(x * w, y * h, 0, x * w, y * h, r * w);
		rg.addColorStop(0, `rgba(${col},.45)`);
		rg.addColorStop(1, `rgba(${col},0)`);
		g.fillStyle = rg;
		g.fillRect(0, 0, w, h);
	}
	for (let i = 0; i < 140; i++) {
		const n = Math.sin(i * 91.7) * 43758.5453,
			m = Math.sin(i * 12.3) * 9341.17,
			fx = n - Math.floor(n),
			fy = m - Math.floor(m);
		g.fillStyle = `rgba(255,255,255,${0.4 + (i % 5) * 0.12})`;
		g.beginPath();
		g.arc(fx * w, fy * h, i % 17 === 0 ? 1.8 : 0.8, 0, TAU);
		g.fill();
	}
	g.globalCompositeOperation = 'source-over';
	// a ringed planet
	const px = w * 0.62,
		py = h * 0.5,
		R = h * 0.26;
	const ring = (front: boolean) => {
		g.save();
		g.translate(px, py);
		g.rotate(-0.35);
		g.scale(1, 0.3);
		g.lineWidth = R * 0.18;
		g.strokeStyle = 'rgba(255,200,140,.7)';
		g.beginPath();
		g.arc(0, 0, R * 1.6, front ? 0 : Math.PI, front ? Math.PI : TAU);
		g.stroke();
		g.restore();
	};
	ring(false);
	const pg = g.createRadialGradient(px - R * 0.35, py - R * 0.4, R * 0.1, px, py, R);
	pg.addColorStop(0, '#ffd0a0');
	pg.addColorStop(0.6, '#e0608a');
	pg.addColorStop(1, '#3a1040');
	g.fillStyle = pg;
	g.beginPath();
	g.arc(px, py, R, 0, TAU);
	g.fill();
	ring(true);
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
		tagline: 'Jigsaw z vesmírných obrazů.',
		description:
			'Skládej generované vesmírné obrazy: mlhoviny, planety s prstenci, galaxie, komety a mimozemské krajiny. Od 24 do 150 dílků, náhled, třídění okrajů a galerie složených obrazů.',
		genres: ['Relax', 'Skládačka', 'Jigsaw'],
		features: ['Denní obraz', 'Cesta: 120 obrazů', '24–150 dílků', 'Galerie'],
		en: {
			tagline: 'A jigsaw of cosmic paintings.',
			description:
				'Assemble generated cosmic paintings: nebulae, ringed planets, galaxies, comets and alien landscapes. From 24 to 150 pieces, with preview, edge sorting and a gallery of finished pictures.',
			genres: ['Relax', 'Jigsaw', 'Puzzle'],
			features: ['Daily picture', 'Path: 120 pictures', '24–150 pieces', 'Gallery'],
		},
		statLabels: labels,
		path: '/games/skladacka/index.html',
		colors: ['#3dd6ff', '#ff8ae0', '#7a2cff'],
		statsKey: 'gamecenter.stats.skladacka',
		cover(ctx, w, h, t) {
			sky(ctx, w, h, t, ['#3dd6ff', '#ff8ae0', '#7a2cff'], 11);
			// a cosmic picture cut into 4 × 3 real jigsaw pieces; a joined pair flies in and snaps home
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
			const n = 5;
			const s = Math.min(w * 0.6, h * 0.62) / n;
			const x0 = w / 2 - (s * n) / 2;
			const y0 = h * 0.1;
			for (let y = 0; y < n; y++)
				for (let x = 0; x < n; x++) {
					ctx.fillStyle = (x + y) % 2 ? 'rgba(91,108,255,.55)' : 'rgba(255,255,255,.16)';
					ctx.fillRect(x0 + x * s, y0 + y * s, s, s);
				}
			const bob = Math.sin(t * 1.6) * s * 0.06;
			glowText(ctx, '♞', x0 + s * 1.5, y0 + s * 2.5 + bob, s * 0.95, '#ffd166');
			glowText(ctx, '♚', x0 + s * 3.5, y0 + s * 0.5, s * 0.85, '#d9b8ff');
			glowText(ctx, '♛', x0 + s * 3.5, y0 + s * 3.5, s * 0.85, '#ffd166');
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
			sky(ctx, w, h, t, ['#6dff9e', '#55f6ff', '#ff5a7a'], 29);
			const s = Math.min(w / 10, h / 13);
			const cols = Math.floor(w / s);
			const rows = Math.floor((h * 0.62) / s);
			const ox = (w - cols * s) / 2;
			const oy = h * 0.06;
			// the snake runs around a loop of cells; its length is 7
			const loop: [number, number][] = [];
			for (let x = 1; x < cols - 1; x++) loop.push([x, 1]);
			for (let y = 2; y < rows - 1; y++) loop.push([cols - 2, y]);
			for (let x = cols - 3; x > 0; x--) loop.push([x, rows - 2]);
			for (let y = rows - 3; y > 1; y--) loop.push([1, y]);
			const head = Math.floor(t * 6) % loop.length;
			const fruit = loop[(head + 9) % loop.length] ?? [1, 1];
			ctx.fillStyle = '#ff5a7a';
			ctx.shadowColor = '#ff5a7a';
			ctx.shadowBlur = s * 0.6;
			ctx.beginPath();
			ctx.arc(ox + (fruit[0] + 0.5) * s, oy + (fruit[1] + 0.5) * s, s * 0.3, 0, TAU);
			ctx.fill();
			ctx.lineCap = 'round';
			for (let k = 6; k >= 0; k--) {
				const a = loop[(head - k + loop.length) % loop.length] ?? [1, 1];
				const b = loop[(head - k + 1 + loop.length) % loop.length] ?? [1, 1];
				ctx.strokeStyle = `hsl(${110 + k * 6}, 100%, ${70 - k * 4}%)`;
				ctx.shadowColor = ctx.strokeStyle;
				ctx.lineWidth = s * (0.72 - k * 0.04);
				ctx.beginPath();
				ctx.moveTo(ox + (a[0] + 0.5) * s, oy + (a[1] + 0.5) * s);
				ctx.lineTo(ox + (b[0] + 0.5) * s, oy + (b[1] + 0.5) * s);
				ctx.stroke();
			}
			ctx.shadowBlur = 0;
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
];
