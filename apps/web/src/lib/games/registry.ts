/**
 * The game catalogue. A game lives in `static/games/<id>/` (any static web game) and gets
 * an entry here. `cover(ctx, w, h, t)` paints its animated cover (t in seconds); `statsKey`
 * is the localStorage key the game writes `{ playTime, lastPlayed, progress, stats }` to,
 * labelled by `statLabels`. English texts live in `en`.
 */
export interface GameTexts {
	tagline: string;
	description: string;
	genres: string[];
	features?: string[];
}

export interface Game extends GameTexts {
	id: string;
	title: string;
	en: GameTexts;
	/** Label per stat key: [Czech, English]. */
	statLabels: Record<string, [string, string]>;
	/** Where the game starts (a static page). */
	path: string;
	/** Accent colours: the center takes on the selected game's look. */
	colors: [string, string, string];
	statsKey: string;
	cover(ctx: CanvasRenderingContext2D, w: number, h: number, t: number): void;
}

/** Slots on the shelf (the rest show "Coming soon"). */
export const GAME_SLOTS = 4;

export const GAMES: Game[] = [
	{
		id: 'voidborn',
		title: 'VOIDBORN',
		tagline: 'Přežij nekonečný příval prázdnoty.',
		description:
			'Neonový roguelite bullet-heaven. Skládej ničivé kombinace zbraní, objevuj tajné evoluce, porážej bossy a probojuj se pěti sektory až do Srdce prázdnoty. Každá smrt tě posílí.',
		genres: ['Roguelite', 'Akce', 'Bullet heaven'],
		features: ['16 zbraní a evolucí', '9 pilotů', '5 sektorů × 10 Overdrive', '34 úspěchů'],
		en: {
			tagline: 'Survive the endless onslaught of the void.',
			description:
				'A neon roguelite bullet heaven. Build devastating weapon combos, uncover secret evolutions, defeat bosses and fight your way through five sectors to the Heart of the Void. Every death makes you stronger.',
			genres: ['Roguelite', 'Action', 'Bullet heaven'],
			features: [
				'16 weapons & evolutions',
				'9 pilots',
				'5 sectors × 10 Overdrive',
				'34 achievements',
			],
		},
		statLabels: {
			best: ['Nejdelší přežití', 'Longest survival'],
			kills: ['Zničeno nepřátel', 'Enemies destroyed'],
			sectors: ['Dobyté sektory', 'Sectors cleared'],
			achievements: ['Úspěchy', 'Achievements'],
		},
		path: '/games/voidborn/index.html',
		colors: ['#ff4fd8', '#55f6ff', '#7a2cff'],
		statsKey: 'gamecenter.stats.voidborn',
		cover(ctx, w, h, t) {
			const g = ctx.createLinearGradient(0, 0, 0, h);
			g.addColorStop(0, '#12052e');
			g.addColorStop(0.55, '#2a0a4a');
			g.addColorStop(1, '#05010f');
			ctx.fillStyle = g;
			ctx.fillRect(0, 0, w, h);
			const cx = w * 0.5,
				hz = h * 0.58,
				s = Math.min(w, h);
			// hvězdy
			for (let i = 0; i < 70; i++) {
				const x = ((i * 97.13) % 1) * w,
					y = ((i * 53.71) % 1) * hz,
					tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.5 + i));
				ctx.fillStyle = `rgba(255,255,255,${0.15 + 0.5 * tw * ((i % 3) / 3)})`;
				ctx.fillRect(x, y, 1.6, 1.6);
			}
			// prázdnota – prstence
			ctx.save();
			ctx.globalCompositeOperation = 'lighter';
			const vy = hz - s * 0.2;
			const rg = ctx.createRadialGradient(cx, vy, 0, cx, vy, s * 0.42);
			rg.addColorStop(0, 'rgba(255,79,216,0.55)');
			rg.addColorStop(0.35, 'rgba(122,44,255,0.25)');
			rg.addColorStop(1, 'rgba(85,246,255,0)');
			ctx.fillStyle = rg;
			ctx.fillRect(0, 0, w, h);
			for (let i = 0; i < 4; i++) {
				ctx.strokeStyle = i % 2 ? 'rgba(85,246,255,0.55)' : 'rgba(255,79,216,0.6)';
				ctx.lineWidth = Math.max(1, s * 0.006);
				ctx.beginPath();
				ctx.ellipse(
					cx,
					vy,
					s * (0.12 + i * 0.07),
					s * (0.12 + i * 0.07) * 0.35,
					Math.sin(t * 0.3) * 0.1,
					t * (0.6 + i * 0.2),
					t * (0.6 + i * 0.2) + Math.PI * 1.3,
				);
				ctx.stroke();
			}
			ctx.fillStyle = '#000';
			ctx.beginPath();
			ctx.arc(cx, vy, s * 0.07, 0, Math.PI * 2);
			ctx.fill();
			ctx.strokeStyle = 'rgba(255,255,255,0.9)';
			ctx.lineWidth = Math.max(1, s * 0.004);
			ctx.beginPath();
			ctx.arc(cx, vy, s * 0.07, 0, Math.PI * 2);
			ctx.stroke();
			// obíhající nepřátelé
			const cols = ['#ff4fd8', '#ffe14d', '#4dff9a', '#ff9a3c', '#9b6bff'];
			for (let i = 0; i < 12; i++) {
				const a = t * 0.4 + i * 0.52,
					r = s * (0.2 + (i % 4) * 0.06);
				const x = cx + Math.cos(a) * r,
					y = vy + Math.sin(a) * r * 0.38,
					z = s * 0.018 * (1 + (i % 3) * 0.4);
				ctx.strokeStyle = cols[i % cols.length] ?? '#ff4fd8';
				ctx.lineWidth = Math.max(1, s * 0.004);
				ctx.beginPath();
				const n = 3 + (i % 4);
				for (let k = 0; k <= n; k++) {
					const b = a * 2 + (k / n) * Math.PI * 2;
					ctx.lineTo(x + Math.cos(b) * z, y + Math.sin(b) * z);
				}
				ctx.stroke();
			}
			ctx.restore();
			// perspektivní mřížka
			ctx.save();
			ctx.beginPath();
			ctx.rect(0, hz, w, h - hz);
			ctx.clip();
			const fg = ctx.createLinearGradient(0, hz, 0, h);
			fg.addColorStop(0, 'rgba(255,79,216,0.0)');
			fg.addColorStop(1, 'rgba(122,44,255,0.25)');
			ctx.fillStyle = fg;
			ctx.fillRect(0, hz, w, h - hz);
			ctx.strokeStyle = 'rgba(255,79,216,0.55)';
			ctx.lineWidth = 1;
			for (let i = -14; i <= 14; i++) {
				ctx.beginPath();
				ctx.moveTo(cx + i * w * 0.02, hz);
				ctx.lineTo(cx + i * w * 0.18, h);
				ctx.stroke();
			}
			const off = (t * 0.6) % 1;
			for (let i = 0; i < 12; i++) {
				const z = (i + off) / 12,
					y = hz + Math.pow(z, 2.2) * (h - hz);
				ctx.strokeStyle = `rgba(85,246,255,${0.15 + z * 0.5})`;
				ctx.beginPath();
				ctx.moveTo(0, y);
				ctx.lineTo(w, y);
				ctx.stroke();
			}
			ctx.restore();
			ctx.fillStyle = 'rgba(255,79,216,0.8)';
			ctx.fillRect(0, hz - 1, w, 2);
			// loď
			const sx = cx + Math.sin(t * 0.9) * w * 0.06,
				sy = h * 0.8 + Math.sin(t * 1.7) * h * 0.012,
				k = s * 0.0042;
			ctx.save();
			ctx.translate(sx, sy);
			ctx.rotate(-Math.PI / 2 + Math.sin(t * 0.9) * 0.15);
			ctx.scale(k, k);
			ctx.globalCompositeOperation = 'lighter';
			const eg = ctx.createRadialGradient(-16, 0, 0, -16, 0, 30);
			eg.addColorStop(0, 'rgba(85,246,255,0.9)');
			eg.addColorStop(1, 'rgba(85,246,255,0)');
			ctx.fillStyle = eg;
			ctx.fillRect(-60, -30, 60, 60);
			ctx.globalCompositeOperation = 'source-over';
			ctx.shadowColor = '#55f6ff';
			ctx.shadowBlur = 20;
			ctx.beginPath();
			ctx.moveTo(20, 0);
			ctx.lineTo(-4, 6);
			ctx.lineTo(-13, 16);
			ctx.lineTo(-10, 4);
			ctx.lineTo(-14, 0);
			ctx.lineTo(-10, -4);
			ctx.lineTo(-13, -16);
			ctx.lineTo(-4, -6);
			ctx.closePath();
			ctx.fillStyle = 'rgba(85,246,255,0.25)';
			ctx.fill();
			ctx.lineWidth = 2.4;
			ctx.strokeStyle = '#55f6ff';
			ctx.stroke();
			ctx.restore();
			// střely
			ctx.save();
			ctx.globalCompositeOperation = 'lighter';
			for (let i = 0; i < 5; i++) {
				const p = (t * 0.9 + i / 5) % 1;
				const bx = sx + Math.sin(i * 2.1) * p * w * 0.08,
					by = sy - p * (sy - vy);
				ctx.fillStyle = `rgba(85,246,255,${1 - p})`;
				ctx.fillRect(bx - 1.5, by - 6, 3, 12);
			}
			ctx.restore();
		},
	},
	{
		id: 'starspire',
		title: 'STARSPIRE',
		tagline: 'Vystoupej po věži souhvězdí.',
		description:
			'Taktický roguelike s balíčkem karet. Skládej si balíček během výstupu, sbírej relikvie, čti záměry nepřátel a porážej živá souhvězdí. Tři hrdinové, tři akty a deset stupňů Zatmění.',
		genres: ['Deckbuilder', 'Roguelike', 'Strategie'],
		features: ['76 karet', '3 hrdinové', '34 relikvií', '10 stupňů Zatmění'],
		en: {
			tagline: 'Climb the tower of constellations.',
			description:
				'A tactical deck-building roguelike. Build your deck as you climb, collect relics, read enemy intents and defeat living constellations. Three heroes, three acts and ten levels of Eclipse.',
			genres: ['Deckbuilder', 'Roguelike', 'Strategy'],
			features: ['76 cards', '3 heroes', '34 relics', '10 Eclipse levels'],
		},
		statLabels: {
			victories: ['Vítězství', 'Victories'],
			best: ['Nejvyšší patro', 'Highest floor'],
			eclipse: ['Nejvyšší Zatmění', 'Highest Eclipse'],
			achievements: ['Úspěchy', 'Achievements'],
		},
		path: '/games/starspire/index.html',
		colors: ['#ffd98a', '#b99bff', '#4b2a8a'],
		statsKey: 'gamecenter.stats.starspire',
		cover(ctx, w, h, t) {
			const s = Math.min(w, h);
			const g = ctx.createRadialGradient(
				w * 0.6,
				h * 0.35,
				0,
				w * 0.5,
				h * 0.5,
				Math.hypot(w, h) * 0.7,
			);
			g.addColorStop(0, '#2a1a52');
			g.addColorStop(0.5, '#120b2a');
			g.addColorStop(1, '#05030c');
			ctx.fillStyle = g;
			ctx.fillRect(0, 0, w, h);
			for (let i = 0; i < 110; i++) {
				const x = ((i * 97.13) % 1) * w,
					y = ((i * 53.71) % 1) * h,
					tw = 0.3 + 0.7 * Math.abs(Math.sin(t * 0.8 + i));
				ctx.fillStyle = `rgba(240,230,255,${0.12 + 0.45 * tw * ((i % 4) / 4)})`;
				ctx.fillRect(x, y, 1.5, 1.5);
			}
			ctx.save();
			ctx.globalCompositeOperation = 'lighter';
			const star = (x: number, y: number, r: number, c: string) => {
				const sg = ctx.createRadialGradient(x, y, 0, x, y, r);
				sg.addColorStop(0, '#fff');
				sg.addColorStop(0.2, c);
				sg.addColorStop(1, 'rgba(0,0,0,0)');
				ctx.fillStyle = sg;
				ctx.fillRect(x - r, y - r, r * 2, r * 2);
			};
			// A tower of stars
			const cx = w * 0.62,
				base = h * 0.98,
				top = h * 0.12;
			const pts: [number, number][] = [];
			for (let i = 0; i <= 9; i++) {
				const k = i / 9,
					y = base - (base - top) * k,
					half = s * 0.16 * (1 - k * 0.85);
				pts.push([cx - half, y], [cx + half, y]);
			}
			ctx.strokeStyle = 'rgba(255,217,138,0.45)';
			ctx.lineWidth = Math.max(1, s * 0.004);
			ctx.beginPath();
			for (let i = 0; i < pts.length - 2; i += 2) {
				const [a, b, c, d] = [pts[i], pts[i + 1], pts[i + 2], pts[i + 3]];
				if (!a || !b || !c || !d) continue;
				ctx.moveTo(a[0], a[1]);
				ctx.lineTo(c[0], c[1]);
				ctx.moveTo(b[0], b[1]);
				ctx.lineTo(d[0], d[1]);
				if (i % 4 === 0) {
					ctx.moveTo(a[0], a[1]);
					ctx.lineTo(d[0], d[1]);
				}
			}
			ctx.stroke();
			pts.forEach(([x, y], i) => star(x, y, s * (0.018 + 0.008 * Math.sin(t * 2 + i)), '#ffd98a'));
			star(cx, top - s * 0.05, s * (0.09 + 0.015 * Math.sin(t * 1.5)), '#ffe7a8');
			// Orbiting constellations
			const cons: [number, number][][] = [
				[
					[0, 0],
					[0.5, -0.3],
					[1, -0.1],
					[1.4, -0.5],
					[1.2, 0.3],
				],
				[
					[0, 0],
					[0.4, 0.4],
					[0.9, 0.2],
					[1.3, 0.6],
				],
			];
			cons.forEach((c, j) => {
				const ox = w * (0.12 + j * 0.05) + Math.sin(t * 0.2 + j) * s * 0.03,
					oy = h * (0.3 + j * 0.35),
					sc = s * 0.13;
				ctx.strokeStyle = j ? 'rgba(185,155,255,0.5)' : 'rgba(127,180,255,0.5)';
				ctx.beginPath();
				c.forEach(([x, y], i) =>
					i ? ctx.lineTo(ox + x * sc, oy + y * sc) : ctx.moveTo(ox + x * sc, oy + y * sc),
				);
				ctx.stroke();
				c.forEach(([x, y], i) =>
					star(
						ox + x * sc,
						oy + y * sc,
						s * 0.016 * (1 + 0.3 * Math.sin(t * 3 + i + j)),
						j ? '#b99bff' : '#7fb4ff',
					),
				);
			});
			ctx.restore();
			// Cards
			for (let i = 0; i < 3; i++) {
				const a = -0.25 + i * 0.25 + Math.sin(t * 0.7 + i) * 0.03;
				ctx.save();
				ctx.translate(w * 0.24 + i * s * 0.07, h * 0.86);
				ctx.rotate(a);
				const cw = s * 0.13,
					ch = cw * 1.4;
				const cg = ctx.createLinearGradient(0, -ch, 0, 0);
				cg.addColorStop(0, '#3a2a6a');
				cg.addColorStop(1, '#140c2a');
				ctx.fillStyle = cg;
				ctx.strokeStyle = '#ffd98a';
				ctx.lineWidth = Math.max(1, s * 0.004);
				ctx.beginPath();
				ctx.rect(-cw / 2, -ch, cw, ch);
				ctx.fill();
				ctx.stroke();
				ctx.fillStyle = 'rgba(255,217,138,0.85)';
				ctx.beginPath();
				ctx.arc(0, -ch * 0.6, cw * 0.18, 0, Math.PI * 2);
				ctx.fill();
				ctx.restore();
			}
		},
	},
];
