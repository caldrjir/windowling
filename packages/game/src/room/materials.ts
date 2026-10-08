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

const hex = (color: string): [number, number, number] => {
	const c = new Color(color);
	return [c.r * 255, c.g * 255, c.b * 255].map((v) => Math.round(v)) as [number, number, number];
};

/** Lacquered oak (desk top, legs). `repeat` scales the grain to the part. */
export function oak(repeat: [number, number] = [1, 1], seed = 3): MeshStandardMaterial {
	// Oiled rather than clear-coated: a clear coat doubles the shading cost on every pixel.
	const material = new MeshStandardMaterial({ color: '#ffffff', roughness: 0.5 });
	const ctx = canvas(512);
	if (ctx) {
		paintWood(ctx, hex('#d6b48a'), seed);
		material.map = texture(ctx, repeat);
	} else material.color.set('#b98f63');
	return material;
}

/** Charcoal upholstery for seats. */
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
