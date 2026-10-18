import {
	CanvasTexture,
	Color,
	DoubleSide,
	MeshStandardMaterial,
	RepeatWrapping,
	SRGBColorSpace,
	type Texture,
} from 'three';

/**
 * Realistic-looking materials without downloading anything: textures are
 * painted procedurally on a canvas (wood grain, woven fabric). Outside a
 * browser (unit tests) there is no canvas, so materials fall back to plain
 * colours - the geometry and physics stay the same.
 */

function canvas(size: number): CanvasRenderingContext2D | null {
	if (typeof document === 'undefined') return null;
	const element = document.createElement('canvas');
	element.width = size;
	element.height = size;
	return element.getContext('2d');
}

/** Deterministic pseudo-random numbers, so the same desk looks the same every visit. */
function seeded(seed: number): () => number {
	let s = seed >>> 0;
	return () => {
		s = (s + 0x6d2b79f5) >>> 0;
		let t = s;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function texture(ctx: CanvasRenderingContext2D, repeat: [number, number], color = true): Texture {
	const map = new CanvasTexture(ctx.canvas);
	map.wrapS = RepeatWrapping;
	map.wrapT = RepeatWrapping;
	map.repeat.set(repeat[0], repeat[1]);
	if (color) map.colorSpace = SRGBColorSpace;
	map.anisotropy = 4;
	return map;
}

/**
 * Oak: long wavy grain lines along the board with darker late-wood streaks
 * and an occasional knot-like swirl. Grain runs along the texture's u axis.
 */
function paintWood(
	ctx: CanvasRenderingContext2D,
	base: [number, number, number],
	seed: number,
): void {
	const size = ctx.canvas.width;
	const rnd = seeded(seed);
	const image = ctx.createImageData(size, size);
	// A few low-frequency waves bend the grain so it doesn't look ruled.
	const waves = Array.from({ length: 4 }, () => ({
		f: 1 + rnd() * 3,
		a: 2 + rnd() * 6,
		p: rnd() * Math.PI * 2,
	}));
	const knot = { x: rnd() * size, y: rnd() * size, r: size * (0.04 + rnd() * 0.05) };
	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			let bend = 0;
			for (const w of waves) bend += Math.sin((x / size) * Math.PI * 2 * w.f + w.p) * w.a;
			// Grain swirls around the knot.
			const dx = x - knot.x;
			const dy = y - knot.y;
			const d = Math.hypot(dx, dy);
			bend += ((knot.r * knot.r * 3) / (d * d + knot.r * knot.r)) * Math.sign(dy || 1);
			const v = y + bend;
			// Broad light/dark bands (still visible from across the room), growth rings, fine grain.
			const band =
				(Math.sin(v * 0.07 + Math.sin(x * 0.004) * 1.5) * 0.6 + Math.sin(v * 0.19 + 1.3) * 0.4) *
					0.5 +
				0.5;
			const ring = Math.sin(v * 0.55) * 0.5 + 0.5;
			const fine = Math.sin(v * 2.7 + Math.sin(x * 0.05) * 2) * 0.5 + 0.5;
			const pores = rnd() < 0.04 ? 0.85 : 1;
			const shade = (0.77 + band * 0.15 - ring ** 3 * 0.16 + fine * 0.07) * pores;
			const i = (y * size + x) * 4;
			image.data[i] = Math.min(255, base[0] * shade);
			image.data[i + 1] = Math.min(255, base[1] * shade);
			image.data[i + 2] = Math.min(255, base[2] * shade);
			image.data[i + 3] = 255;
		}
	}
	ctx.putImageData(image, 0, 0);
}

/** Woven upholstery: a fine basket weave with slight colour variation per thread. */
function paintFabric(ctx: CanvasRenderingContext2D, base: [number, number, number]): void {
	const size = ctx.canvas.width;
	const rnd = seeded(7);
	const image = ctx.createImageData(size, size);
	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			const warp = Math.floor(x / 4) % 2 === Math.floor(y / 4) % 2;
			const thread = warp ? Math.sin((y % 4) * 0.8) : Math.sin((x % 4) * 0.8);
			const shade = 0.85 + thread * 0.12 + (rnd() - 0.5) * 0.06;
			const i = (y * size + x) * 4;
			image.data[i] = base[0] * shade;
			image.data[i + 1] = base[1] * shade;
			image.data[i + 2] = base[2] * shade;
			image.data[i + 3] = 255;
		}
	}
	ctx.putImageData(image, 0, 0);
}

/** Open mesh (office chair backs): a dark grid you can almost see through. */
function paintMesh(ctx: CanvasRenderingContext2D): void {
	const size = ctx.canvas.width;
	// Gaps between the threads let some light through.
	ctx.fillStyle = 'rgba(12, 13, 15, 0.45)';
	ctx.fillRect(0, 0, size, size);
	ctx.strokeStyle = 'rgba(40, 43, 49, 1)';
	ctx.lineWidth = 1.2;
	for (let i = 0; i <= size; i += 6) {
		ctx.beginPath();
		ctx.moveTo(i, 0);
		ctx.lineTo(i + size / 8, size);
		ctx.stroke();
		ctx.beginPath();
		ctx.moveTo(0, i);
		ctx.lineTo(size, i + size / 8);
		ctx.stroke();
	}
}

/**
 * sRGB components (0..255) of a CSS hex colour - what a canvas paints. (Not
 * `new Color(...)`: three.js converts that to linear light, which would make
 * every painted texture far too dark.)
 */
const hex = (color: string): [number, number, number] => {
	const c = new Color(color).getHex(SRGBColorSpace);
	return [(c >> 16) & 255, (c >> 8) & 255, c & 255];
};

/** Lacquered oak (desk top, legs). `repeat` scales the grain to the part. */
/**
 * Painted wood grain, by seed. Painting is per pixel, so each seed is painted
 * once and shared (a canvas is plain pixels, not a GPU resource; every
 * material still gets its own texture so `repeat` can differ).
 */
const woodCanvases = new Map<number, HTMLCanvasElement>();
function woodCanvas(seed: number): HTMLCanvasElement | null {
	const cached = woodCanvases.get(seed);
	if (cached) return cached;
	const ctx = canvas(256);
	if (!ctx) return null;
	paintWood(ctx, hex('#d6b48a'), seed);
	woodCanvases.set(seed, ctx.canvas);
	return ctx.canvas;
}

/** Oiled oak (desk top, legs). `repeat` scales the grain to the part; two boards' worth of grain. */
export function oak(repeat: [number, number] = [1, 1], seed = 3): MeshStandardMaterial {
	// Oiled rather than clear-coated: a clear coat doubles the shading cost on every pixel.
	const material = new MeshStandardMaterial({ color: '#ffffff', roughness: 0.5 });
	const painted = woodCanvas(seed % 2 === 0 ? 2 : 3);
	if (painted) {
		const map = new CanvasTexture(painted);
		map.wrapS = RepeatWrapping;
		map.wrapT = RepeatWrapping;
		map.repeat.set(repeat[0], repeat[1]);
		map.colorSpace = SRGBColorSpace;
		map.anisotropy = 4;
		material.map = map;
	} else material.color.set('#b98f63');
	return material;
}

export function fabric(color = '#3a3d44', repeat: [number, number] = [4, 4]): MeshStandardMaterial {
	const material = new MeshStandardMaterial({ color: '#ffffff', roughness: 0.92 });
	const ctx = canvas(128);
	if (ctx) {
		paintFabric(ctx, hex(color));
		material.map = texture(ctx, repeat);
	} else material.color.set(color);
	return material;
}

/** Breathable mesh of an office chair back. */
export function chairMesh(): MeshStandardMaterial {
	const material = new MeshStandardMaterial({
		color: '#ffffff',
		roughness: 0.8,
		transparent: true,
		side: DoubleSide,
	});
	const ctx = canvas(128);
	if (ctx) {
		paintMesh(ctx);
		material.map = texture(ctx, [3, 3]);
	} else material.color.set('#1a1b1f');
	return material;
}

/**
 * Metals reflect the environment (`reflections`); nothing else gets it -
 * image-based light on every surface would make each frame much more
 * expensive on weak devices, and the lamps and the window light the rest.
 */
const metal = (
	params: ConstructorParameters<typeof MeshStandardMaterial>[0],
	reflections: Texture | null,
) => new MeshStandardMaterial({ ...params, envMap: reflections, envMapIntensity: 0.8 });

/** Powder-coated steel (desk frame). */
export const blackSteel = (reflections: Texture | null = null): MeshStandardMaterial =>
	metal({ color: '#1e1f22', metalness: 0.55, roughness: 0.42 }, reflections);

/** Polished chrome (gas lift). */
export const chrome = (reflections: Texture | null = null): MeshStandardMaterial =>
	metal({ color: '#e6e8eb', metalness: 1, roughness: 0.12 }, reflections);

/** Brushed aluminium (laptop, chair base). */
export const aluminium = (reflections: Texture | null = null): MeshStandardMaterial =>
	metal({ color: '#c3c7cd', metalness: 0.9, roughness: 0.32 }, reflections);

/** Matte black plastic (casters, chair shell, keyboard). */
export const blackPlastic = (): MeshStandardMaterial =>
	new MeshStandardMaterial({ color: '#16171a', roughness: 0.6 });

/** Glazed ceramic (mugs, plant pots). */
export const ceramic = (color: string): MeshStandardMaterial =>
	new MeshStandardMaterial({ color, roughness: 0.22 });

/** A canvas of any size (the square `canvas` helper covers most textures). */
function canvasOf(width: number, height: number): CanvasRenderingContext2D | null {
	if (typeof document === 'undefined') return null;
	const element = document.createElement('canvas');
	element.width = width;
	element.height = height;
	return element.getContext('2d');
}

/**
 * Oak floorboards: twelve rows of planks of random length, each its own tint
 * and grain, with dark hairline joints. The texture tiles in both directions;
 * planks run along u (the room's width).
 */
function paintFloorboards(ctx: CanvasRenderingContext2D, base: [number, number, number]): void {
	const size = ctx.canvas.width;
	const rows = 12;
	const rowH = size / rows;
	const rnd = seeded(11);
	const image = ctx.createImageData(size, size);
	for (let row = 0; row < rows; row++) {
		// Joints along this row (positions wrap around, so the row tiles).
		const joints: number[] = [];
		let at = rnd() * size;
		while (joints.length < 2) {
			joints.push(at % size);
			at += size * (0.4 + rnd() * 0.2);
		}
		joints.sort((a, b) => a - b);
		const planks = joints.map(() => ({
			tint: 0.95 + rnd() * 0.09,
			phase: rnd() * 100,
			warm: (rnd() - 0.5) * 0.04,
		}));
		for (let y = Math.floor(row * rowH); y < Math.floor((row + 1) * rowH); y++) {
			const inRow = y - row * rowH;
			for (let x = 0; x < size; x++) {
				// Which plank: the last joint at or before x (wrapping).
				let p = joints.length - 1;
				for (let j = 0; j < joints.length; j++) if ((joints[j] ?? 0) <= x) p = j;
				const plank = planks[p] ?? { tint: 1, phase: 0, warm: 0 };
				const v = inRow + plank.phase + Math.sin(x * 0.011 + plank.phase) * 3;
				const grain =
					(Math.sin(v * 0.9 + Math.sin(x * 0.02 + plank.phase) * 1.8) * 0.5 + 0.5) ** 3 * 0.12 +
					(Math.sin(v * 3.1 + x * 0.004) * 0.5 + 0.5) * 0.05;
				let shade = plank.tint * (0.95 - grain) * (0.97 + rnd() * 0.04);
				// Hairline joints: along the plank edges and at the ends.
				const nearJoint = joints.some((j) => Math.abs(x - j) < 1.2);
				if (inRow < 1.2 || nearJoint) shade *= 0.55;
				const i = (y * size + x) * 4;
				image.data[i] = Math.min(255, base[0] * shade * (1 + plank.warm));
				image.data[i + 1] = Math.min(255, base[1] * shade);
				image.data[i + 2] = Math.min(255, base[2] * shade * (1 - plank.warm));
				image.data[i + 3] = 255;
			}
		}
	}
	ctx.putImageData(image, 0, 0);
}

/** Oiled oak floorboards; one texture tile is 2.4 m square (planks 20 cm wide). */
export function floorboards(repeat: [number, number]): MeshStandardMaterial {
	const material = new MeshStandardMaterial({ color: '#ffffff', roughness: 0.55 });
	const ctx = canvas(512);
	if (ctx) {
		paintFloorboards(ctx, hex('#cfac80'));
		material.map = texture(ctx, repeat);
	} else material.color.set('#b08860');
	return material;
}

/** Hand-troweled plaster: a soft mottle and a fine grain, nearly white (tinted by colour). */
let plasterCanvas: HTMLCanvasElement | null = null;
function paintedPlaster(): HTMLCanvasElement | null {
	if (plasterCanvas) return plasterCanvas;
	const ctx = canvas(256);
	if (!ctx) return null;
	const rnd = seeded(5);
	const size = ctx.canvas.width;
	// Mottle: a tiny random image blown up smoothly.
	const small = canvas(16);
	if (small) {
		const img = small.createImageData(16, 16);
		for (let i = 0; i < img.data.length; i += 4) {
			const v = 246 + rnd() * 9;
			img.data[i] = v;
			img.data[i + 1] = v;
			img.data[i + 2] = v;
			img.data[i + 3] = 255;
		}
		small.putImageData(img, 0, 0);
		ctx.imageSmoothingEnabled = true;
		ctx.drawImage(small.canvas, 0, 0, size, size);
	}
	const image = ctx.getImageData(0, 0, size, size);
	for (let i = 0; i < image.data.length; i += 4) {
		const grain = (rnd() - 0.5) * 5;
		for (let c = 0; c < 3; c++) image.data[i + c] = Math.min(255, (image.data[i + c] ?? 0) + grain);
	}
	ctx.putImageData(image, 0, 0);
	plasterCanvas = ctx.canvas;
	return plasterCanvas;
}

/** Painted plaster walls in `color`. `repeat` per metre of wall (UVs in metres). */
export function plaster(color: string, repeat = 0.6): MeshStandardMaterial {
	const material = new MeshStandardMaterial({ color, roughness: 0.95 });
	const painted = paintedPlaster();
	if (painted) {
		const map = new CanvasTexture(painted);
		map.wrapS = RepeatWrapping;
		map.wrapT = RepeatWrapping;
		map.repeat.set(repeat, repeat);
		map.colorSpace = SRGBColorSpace;
		material.map = map;
	}
	return material;
}

/** Satin paint on wood (skirting, door, window frames). */
export const paintedWood = (color = '#f2efe9'): MeshStandardMaterial =>
	new MeshStandardMaterial({ color, roughness: 0.45 });

/**
 * A wool rug: cream, a charcoal border and a loose diamond lattice, like a
 * hand-knotted Berber rug; every knot slightly different.
 */
export function woolRug(width: number, depth: number): MeshStandardMaterial {
	const material = new MeshStandardMaterial({ color: '#ffffff', roughness: 1 });
	const w = 512;
	const h = Math.round((512 * depth) / width);
	const ctx = canvasOf(w, h);
	if (!ctx) {
		material.color.set('#e4dccd');
		return material;
	}
	ctx.fillStyle = '#e7dfd0';
	ctx.fillRect(0, 0, w, h);
	ctx.strokeStyle = '#3b3835';
	ctx.lineCap = 'round';
	// Border: a thick and a thin line.
	ctx.lineWidth = 7;
	ctx.strokeRect(18, 18, w - 36, h - 36);
	ctx.lineWidth = 2.5;
	ctx.strokeRect(32, 32, w - 64, h - 64);
	// Lattice of slightly wobbly diamonds inside the border.
	const rnd = seeded(23);
	ctx.save();
	ctx.beginPath();
	ctx.rect(40, 40, w - 80, h - 80);
	ctx.clip();
	ctx.lineWidth = 3;
	const step = 64;
	for (let k = -h; k < w + h; k += step) {
		for (const dir of [1, -1]) {
			ctx.beginPath();
			for (let y = 0; y <= h; y += 16) {
				const x = k + dir * y + (rnd() - 0.5) * 3;
				if (y === 0) ctx.moveTo(x, y);
				else ctx.lineTo(x, y);
			}
			ctx.stroke();
		}
	}
	ctx.restore();
	// Pile: every pixel a little lighter or darker.
	const image = ctx.getImageData(0, 0, w, h);
	for (let i = 0; i < image.data.length; i += 4) {
		const n = (rnd() - 0.5) * 22;
		for (let c = 0; c < 3; c++)
			image.data[i + c] = Math.min(255, Math.max(0, (image.data[i + c] ?? 0) + n));
	}
	ctx.putImageData(image, 0, 0);
	const map = new CanvasTexture(ctx.canvas);
	map.colorSpace = SRGBColorSpace;
	map.anisotropy = 4;
	material.map = map;
	return material;
}

/**
 * Prints for the walls: calm mid-century abstractions in the room's palette.
 * `kind` picks the composition.
 */
export function artPrint(kind: 'arches' | 'hills'): MeshStandardMaterial {
	const material = new MeshStandardMaterial({ color: '#ffffff', roughness: 0.8 });
	const [w, h] = kind === 'arches' ? [256, 358] : [358, 256];
	const ctx = canvasOf(w, h);
	if (!ctx) {
		material.color.set('#e8dccb');
		return material;
	}
	ctx.fillStyle = '#efe6d6';
	ctx.fillRect(0, 0, w, h);
	if (kind === 'arches') {
		ctx.fillStyle = '#c46a4a';
		ctx.beginPath();
		ctx.arc(w * 0.5, h * 0.62, w * 0.34, Math.PI, 0);
		ctx.lineTo(w * 0.84, h * 0.82);
		ctx.lineTo(w * 0.16, h * 0.82);
		ctx.fill();
		ctx.fillStyle = '#efe6d6';
		ctx.beginPath();
		ctx.arc(w * 0.5, h * 0.66, w * 0.18, Math.PI, 0);
		ctx.lineTo(w * 0.68, h * 0.82);
		ctx.lineTo(w * 0.32, h * 0.82);
		ctx.fill();
		ctx.fillStyle = '#d9a441';
		ctx.beginPath();
		ctx.arc(w * 0.7, h * 0.22, w * 0.1, 0, Math.PI * 2);
		ctx.fill();
		ctx.fillStyle = '#7f9583';
		ctx.fillRect(w * 0.16, h * 0.82, w * 0.68, h * 0.05);
	} else {
		const layers: [string, number, number][] = [
			['#a9b7a7', 0.55, 0.9],
			['#7f9583', 0.68, 1.4],
			['#55665a', 0.8, 2.1],
		];
		ctx.fillStyle = '#e3b08a';
		ctx.beginPath();
		ctx.arc(w * 0.68, h * 0.38, h * 0.12, 0, Math.PI * 2);
		ctx.fill();
		for (const [color, level, f] of layers) {
			ctx.fillStyle = color;
			ctx.beginPath();
			ctx.moveTo(0, h);
			for (let x = 0; x <= w; x += 4) {
				ctx.lineTo(x, h * level - Math.sin((x / w) * Math.PI * f + level * 7) * h * 0.08);
			}
			ctx.lineTo(w, h);
			ctx.fill();
		}
	}
	const map = new CanvasTexture(ctx.canvas);
	map.colorSpace = SRGBColorSpace;
	material.map = map;
	return material;
}

/**
 * The building across the street: a pale tenement facade with rows of
 * windows. Returns the facade by day and, separately, the windows that are
 * lit at night (to be faded in on top).
 */
export function facadeTextures(): { facade: Texture; lit: Texture } | null {
	const w = 512;
	const h = 512;
	const day = canvasOf(w, h);
	const night = canvasOf(w, h);
	if (!day || !night) return null;
	const rnd = seeded(41);
	day.fillStyle = '#d9c9a8';
	day.fillRect(0, 0, w, h);
	night.fillStyle = '#000000';
	night.fillRect(0, 0, w, h);
	const floorH = h / 4;
	const bays = 5;
	const bayW = w / bays;
	for (let f = 0; f < 4; f++) {
		// A cornice between floors.
		day.fillStyle = '#c7b694';
		day.fillRect(0, f * floorH + floorH - 10, w, 6);
		day.fillStyle = '#eadcbf';
		day.fillRect(0, f * floorH + floorH - 12, w, 2);
		for (let b = 0; b < bays; b++) {
			const x = b * bayW + bayW * 0.28;
			const y = f * floorH + floorH * 0.18;
			const ww = bayW * 0.44;
			const wh = floorH * 0.62;
			// Window surround, frame, then the glass (a dim sky reflection).
			day.fillStyle = '#efe4cc';
			day.fillRect(x - 5, y - 6, ww + 10, wh + 10);
			day.fillStyle = '#f6f3ee';
			day.fillRect(x, y, ww, wh);
			const glass = 60 + rnd() * 30;
			day.fillStyle = `rgb(${glass}, ${glass + 12}, ${glass + 24})`;
			day.fillRect(x + 3, y + 3, ww / 2 - 4.5, wh - 6);
			day.fillRect(x + ww / 2 + 1.5, y + 3, ww / 2 - 4.5, wh - 6);
			// Some windows have curtains.
			if (rnd() < 0.5) {
				day.fillStyle = 'rgba(235, 228, 214, 0.75)';
				day.fillRect(x + 3, y + 3, ww * 0.18, wh - 6);
				day.fillRect(x + ww - 3 - ww * 0.18, y + 3, ww * 0.18, wh - 6);
			}
			// At night, about a third of them are lit, each a slightly different warmth.
			if (rnd() < 0.35) {
				const warm = rnd();
				night.fillStyle = `rgb(255, ${170 + warm * 40}, ${70 + warm * 50})`;
				night.fillRect(x + 3, y + 3, ww - 6, wh - 6);
				night.fillStyle = 'rgba(0, 0, 0, 0.6)';
				night.fillRect(x + ww / 2 - 1.5, y + 3, 3, wh - 6);
			}
		}
	}
	const facade = new CanvasTexture(day.canvas);
	facade.colorSpace = SRGBColorSpace;
	facade.wrapS = RepeatWrapping;
	facade.wrapT = RepeatWrapping;
	const lit = new CanvasTexture(night.canvas);
	lit.colorSpace = SRGBColorSpace;
	lit.wrapS = RepeatWrapping;
	lit.wrapT = RepeatWrapping;
	return { facade, lit };
}
