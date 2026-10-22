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
];
