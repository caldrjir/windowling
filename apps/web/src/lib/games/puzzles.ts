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
	{
		id: 'pulsar',
		title: 'PULSAR',
		group: 'puzzle',
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
		title: 'FÚZE',
		group: 'puzzle',
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
		title: 'MINY',
		group: 'puzzle',
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
		title: 'OMALOVÁNKY',
		group: 'puzzle',
		tagline: 'Malování podle čísel pro chvíle klidu.',
		description:
			'Vybarvuj generované pixelové obrazy podle čísel: planety, mimozemské krajiny, bytosti, lodě a mlhoviny. Přibližování dvěma prsty, hotové obrazy se ukládají do galerie.',
		genres: ['Relax', 'Malování', 'Podle čísel'],
		features: ['Denní obraz', 'Cesta: 120 obrazů', '5 druhů motivů', 'Galerie'],
		en: {
			tagline: 'Colour by number for quiet moments.',
			description:
				'Paint generated pixel pictures by number: planets, alien landscapes, creatures, ships and nebulae. Pinch to zoom; finished pictures go to your gallery.',
			genres: ['Relax', 'Painting', 'By number'],
			features: ['Daily picture', 'Path: 120 pictures', '5 kinds of motifs', 'Gallery'],
		},
		statLabels: labels,
		path: '/games/omalovanky/index.html',
		colors: ['#ff8ae0', '#7dff9b', '#4fd1ff'],
		statsKey: 'gamecenter.stats.omalovanky',
		cover(ctx, w, h, t) {
			sky(ctx, w, h, t, ['#ff8ae0', '#7dff9b', '#4fd1ff'], 8);
			const n = 16;
			const c = (Math.min(w, h) * 0.75) / n;
			const x0 = (w - n * c) / 2;
			const y0 = h * 0.06;
			const done = (t * 24) % (n * n + 60);
			for (let y = 0; y < n; y++)
				for (let x = 0; x < n; x++) {
					const d = Math.hypot(x - 7.5, y - 7.5);
					const ring =
						Math.abs((x - 7.5) * 0.9 - (y - 7.5) * 0.4) < 7.5 &&
						Math.abs(y - 7.5 + (x - 7.5) * 0.25) < 1.3;
					const k = d < 5 ? (y + x * 0.3 < 9 ? 0 : 1) : ring ? 2 : 3;
					const pal = ['#ff8ae0', '#b14cff', '#7dff9b', '#0d0a22'];
					if (y * n + x < done) {
						ctx.fillStyle = pal[k] ?? '#000';
						ctx.fillRect(x0 + x * c, y0 + y * c, c + 0.5, c + 0.5);
					} else {
						ctx.fillStyle = 'rgba(235,235,245,.85)';
						ctx.fillRect(x0 + x * c + 0.5, y0 + y * c + 0.5, c - 1, c - 1);
						ctx.fillStyle = '#3a2f6b';
						ctx.font = `600 ${c * 0.55}px "Space Grotesk", sans-serif`;
						ctx.textAlign = 'center';
						ctx.textBaseline = 'middle';
						ctx.fillText(String(k + 1), x0 + x * c + c / 2, y0 + y * c + c / 2);
					}
				}
		},
	},
	{
		id: 'solitaire',
		title: 'SOLITAIRE',
		group: 'puzzle',
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
			const cw = Math.min(w, h) * 0.24;
			const ch = cw * 1.4;
			const cards: [string, string, boolean][] = [
				['K', '♠', false],
				['Q', '♥', true],
				['J', '♣', false],
				['A', '♦', true],
				['10', '♥', true],
			];
			cards.forEach(([rank, suit, red], i) => {
				const a = (i - 2) * 0.18 + Math.sin(t * 0.8 + i) * 0.02;
				ctx.save();
				ctx.translate(w / 2 + (i - 2) * cw * 0.32, h * 0.42);
				ctx.rotate(a);
				ctx.fillStyle = '#f7f5ff';
				ctx.shadowColor = 'rgba(0,0,0,.6)';
				ctx.shadowBlur = 12;
				ctx.beginPath();
				ctx.roundRect(-cw / 2, -ch / 2, cw, ch, cw * 0.1);
				ctx.fill();
				ctx.shadowBlur = 0;
				ctx.fillStyle = red ? '#d81b60' : '#1d1840';
				ctx.font = `700 ${cw * 0.26}px Unbounded, sans-serif`;
				ctx.textAlign = 'left';
				ctx.textBaseline = 'top';
				ctx.fillText(rank, -cw * 0.42, -ch * 0.46);
				ctx.font = `${cw * 0.6}px sans-serif`;
				ctx.textAlign = 'center';
				ctx.textBaseline = 'middle';
				ctx.fillText(suit, 0, ch * 0.08);
				ctx.restore();
			});
		},
	},
	{
		id: 'mahjong',
		title: 'MAHJONG',
		group: 'puzzle',
		tagline: 'Dvojice nebeských kamenů.',
		description:
			'Mahjong solitaire: odebírej dvojice stejných volných kamenů s hvězdami, planetami, kometami a souhvězdími. Želva, Pyramida, Pevnost, Věž a generovaná rozložení, která jdou vždy dohrát.',
		genres: ['Hlavolam', 'Kameny', 'Mahjong'],
		features: ['Denní Želva', 'Cesta: 120 rozložení', '4 klasická rozložení', 'Vždy dohratelné'],
		en: {
			tagline: 'Pairs of celestial tiles.',
			description:
				'Mahjong solitaire: remove pairs of matching free tiles with stars, planets, comets and zodiacs. Turtle, Pyramid, Fortress, Tower and generated layouts that can always be cleared.',
			genres: ['Puzzle', 'Tiles', 'Mahjong'],
			features: ['Daily Turtle', 'Path: 120 layouts', '4 classic layouts', 'Always solvable'],
		},
		statLabels: labels,
		path: '/games/mahjong/index.html',
		colors: ['#ffd166', '#18a37a', '#e0446a'],
		statsKey: 'gamecenter.stats.mahjong',
		cover(ctx, w, h, t) {
			sky(ctx, w, h, t, ['#ffd166', '#18a37a', '#e0446a'], 10);
			const tw = Math.min(w, h) * 0.17;
			const th = tw * 1.34;
			const d = tw * 0.09;
			const glyph = ['★', '☾', '●', '☄', '☀', '♌', '★', '●'];
			const col = [
				'#2b8cff',
				'#5b6cff',
				'#e0446a',
				'#18a37a',
				'#ff9a1f',
				'#b14cff',
				'#2b8cff',
				'#e0446a',
			];
			const tiles: [number, number, number][] = [
				[0, 0, 0],
				[1, 0, 0],
				[2, 0, 0],
				[0, 1, 0],
				[1, 1, 0],
				[2, 1, 0],
				[0.5, 0.5, 1],
				[1.5, 0.5, 1],
			];
			tiles.forEach(([x, y, z], i) => {
				const px = w / 2 - tw * 1.5 + x * tw - z * d;
				const py = h * 0.14 + y * th - z * d + (i === Math.floor(t) % 8 ? -4 : 0);
				ctx.fillStyle = '#7d6f55';
				ctx.beginPath();
				ctx.roundRect(px + d, py + d, tw, th, tw * 0.14);
				ctx.fill();
				ctx.fillStyle = '#fbf6e8';
				ctx.beginPath();
				ctx.roundRect(px, py, tw, th, tw * 0.14);
				ctx.fill();
				ctx.fillStyle = col[i] ?? '#222';
				ctx.font = `700 ${tw * 0.55}px sans-serif`;
				ctx.textAlign = 'center';
				ctx.textBaseline = 'middle';
				ctx.fillText(glyph[i] ?? '★', px + tw / 2, py + th / 2);
			});
		},
	},
	{
		id: 'skladacka',
		title: 'SKLÁDAČKA',
		group: 'puzzle',
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
			const s = Math.min(w, h) * 0.2;
			const x0 = w / 2 - s * 1.5;
			const y0 = h * 0.12;
			for (let y = 0; y < 3; y++)
				for (let x = 0; x < 3; x++) {
					const gap = x === 2 && y === 1 ? s * 0.25 + Math.sin(t * 1.5) * s * 0.12 : 0;
					const px = x0 + x * s + gap;
					const py = y0 + y * s - gap * 0.6;
					const g = ctx.createLinearGradient(px, py, px + s, py + s);
					g.addColorStop(0, `hsl(${200 + x * 30 + y * 20} 80% 55%)`);
					g.addColorStop(1, `hsl(${300 + x * 20} 70% 35%)`);
					ctx.fillStyle = g;
					ctx.strokeStyle = 'rgba(255,255,255,.4)';
					ctx.lineWidth = 2;
					ctx.beginPath();
					ctx.rect(px + 2, py + 2, s - 4, s - 4);
					ctx.fill();
					ctx.stroke();
					if (x < 2) {
						ctx.beginPath();
						ctx.arc(px + s, py + s / 2, s * 0.14, 0, TAU);
						ctx.fill();
					}
				}
		},
	},
];
