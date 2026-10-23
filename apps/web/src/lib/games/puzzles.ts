/**
 * Puzzle games (static/games/<id>/ on the shared puzzle kit in static/games/puzzle-kit).
 * Each one keeps the same browser contract as the other games; the kit writes
 * `gamecenter.stats.<id>` with solved puzzles, the daily streak, Path level and rank.
 */
import type { Game } from './registry';

const TAU = Math.PI * 2;

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
		title: 'SUDOKU',
		group: 'puzzle',
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
		title: 'NONOGRAMY',
		group: 'puzzle',
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
		title: 'KAKURO',
		group: 'puzzle',
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
		title: 'SOUHVĚZDÍ',
		group: 'puzzle',
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
];
