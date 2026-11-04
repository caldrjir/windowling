import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MeshoptDecoder } from 'meshoptimizer';
import { describe, expect, it } from 'vitest';

/**
 * HOLLOW SUN asset pipeline (P0): every GLB in static/games/hollowsun/assets must pass the
 * checks the Game Design Bible's asset specification asks of CI – compression (Meshopt +
 * quantization, KTX2 for textures), naming, triangle budget, at most 2 materials per mesh, LODs,
 * module footprint on the 2 m grid, door sockets, vertex-colour AO – plus basic glTF integrity.
 * The GLBs are decoded here the same way the game decodes them (meshoptimizer's decoder).
 */
const dir = fileURLToPath(new URL('../../../static/games/hollowsun/assets/', import.meta.url));
await MeshoptDecoder.ready;

interface Accessor {
	bufferView: number;
	byteOffset?: number;
	componentType: number;
	count: number;
	type: string;
	normalized?: boolean;
	min?: number[];
	max?: number[];
}
interface MeshoptView {
	buffer: number;
	byteOffset?: number;
	byteLength: number;
	byteStride: number;
	count: number;
	mode: string;
	filter?: string;
}
interface BufferView {
	buffer: number;
	byteOffset?: number;
	byteLength: number;
	byteStride?: number;
	extensions?: { EXT_meshopt_compression?: MeshoptView };
}
interface Primitive {
	attributes: Record<string, number>;
	indices: number;
	material: number;
}
interface GltfNode {
	name?: string;
	mesh?: number;
	children?: number[];
	translation?: number[];
	rotation?: number[];
	scale?: number[];
}
interface Gltf {
	asset: { version: string };
	extensionsRequired?: string[];
	nodes: GltfNode[];
	meshes: { primitives: Primitive[] }[];
	materials: { name: string }[];
	accessors: Accessor[];
	bufferViews: BufferView[];
	images?: { mimeType?: string }[];
	textures?: { source?: number; extensions?: { KHR_texture_basisu?: { source: number } } }[];
}
interface ManifestAsset {
	id: string;
	file: string;
	bytes: number;
	rawBytes: number;
	compression: string[];
	materials: string[];
	parts: { name: string; tris: number }[];
	sockets: string[];
	meta: { cells?: number[]; cellSize?: number; trisBudget: number | number[] };
}
/** A mesh instance with its node transform (translation + uniform scale; gltfpack dequantization). */
interface Placed {
	mesh: number;
	t: number[];
	s: number;
}

/** Indexed access that fails the test instead of yielding `undefined`. */
function at<T>(arr: readonly T[] | undefined, i: number | undefined): T {
	const v = arr && i !== undefined ? arr[i] : undefined;
	if (v === undefined) throw new Error(`Missing index ${String(i)}`);
	return v;
}
function attr(p: Primitive, name: string): number {
	const i = p.attributes[name];
	if (i === undefined) throw new Error(`Missing attribute ${name}`);
	return i;
}

class Glb {
	readonly json: Gltf;
	private readonly bin: Uint8Array;
	private readonly views = new Map<number, DataView>();

	constructor(bytes: Uint8Array) {
		const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
		const u32 = (o: number) => dv.getUint32(o, true);
		expect(u32(0)).toBe(0x46546c67); // "glTF"
		expect(u32(4)).toBe(2);
		expect(u32(8)).toBe(bytes.byteLength);
		const jlen = u32(12);
		expect(u32(16)).toBe(0x4e4f534a); // JSON
		this.json = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + jlen))) as Gltf;
		const bOff = 20 + jlen;
		expect(u32(bOff + 4)).toBe(0x004e4942); // BIN
		this.bin = bytes.subarray(bOff + 8, bOff + 8 + u32(bOff));
	}

	/** Bytes of a buffer view, decompressed when it uses EXT_meshopt_compression. */
	view(i: number): DataView {
		const cached = this.views.get(i);
		if (cached) return cached;
		const v = at(this.json.bufferViews, i);
		const m = v.extensions?.EXT_meshopt_compression;
		let bytes: Uint8Array;
		if (m) {
			expect(m.buffer).toBe(0); // compressed data lives in the GLB's BIN chunk
			const src = this.bin.subarray(m.byteOffset ?? 0, (m.byteOffset ?? 0) + m.byteLength);
			bytes = new Uint8Array(m.count * m.byteStride);
			MeshoptDecoder.decodeGltfBuffer(bytes, m.count, m.byteStride, src, m.mode, m.filter);
		} else {
			expect(v.buffer).toBe(0);
			bytes = this.bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength);
		}
		const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
		this.views.set(i, dv);
		return dv;
	}

	/** Accessor values as numbers; normalized integers map to 0..1 / -1..1 (glTF 2.0). */
	read(i: number): number[] {
		const a = at(this.json.accessors, i);
		const v = at(this.json.bufferViews, a.bufferView);
		const dv = this.view(a.bufferView);
		const comps = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type] ?? 0;
		const types: Record<number, [number, (o: number) => number, number]> = {
			5120: [1, (o) => dv.getInt8(o), 127],
			5121: [1, (o) => dv.getUint8(o), 255],
			5122: [2, (o) => dv.getInt16(o, true), 32767],
			5123: [2, (o) => dv.getUint16(o, true), 65535],
			5125: [4, (o) => dv.getUint32(o, true), 1],
			5126: [4, (o) => dv.getFloat32(o, true), 1],
		};
		const type = types[a.componentType];
		if (!type || !comps) throw new Error(`Unsupported accessor ${a.componentType} ${a.type}`);
		const [size, get, norm] = type;
		const stride = v.byteStride ?? size * comps;
		const out: number[] = [];
		for (let e = 0; e < a.count; e++)
			for (let k = 0; k < comps; k++) {
				const x = get((a.byteOffset ?? 0) + e * stride + k * size);
				out.push(a.normalized ? Math.max(x / norm, -1) : x);
			}
		return out;
	}

	/** Mesh instances under a named node (gltfpack moves a mesh into an unnamed child node). */
	placed(name: string): Placed[] {
		const nodes = this.json.nodes;
		const root = nodes.findIndex((n) => n.name === name);
		expect(root, name).toBeGreaterThanOrEqual(0);
		const out: Placed[] = [];
		const walk = (i: number, t: number[], s: number) => {
			const n = at(nodes, i);
			expect(n.rotation, 'no node rotations').toBeUndefined();
			const ns = n.scale ?? [1, 1, 1];
			expect(at(ns, 0)).toBe(at(ns, 1));
			expect(at(ns, 1)).toBe(at(ns, 2));
			const nt = n.translation ?? [0, 0, 0];
			const t2 = t.map((x, k) => x + s * at(nt, k));
			const s2 = s * at(ns, 0);
			if (n.mesh !== undefined) out.push({ mesh: n.mesh, t: t2, s: s2 });
			for (const c of n.children ?? []) walk(c, t2, s2);
		};
		walk(root, [0, 0, 0], 1);
		return out;
	}
}

const manifest = JSON.parse(readFileSync(dir + 'manifest.json', 'utf8')) as {
	assets: ManifestAsset[];
};
const MODULE_RE = /^DM_(crypt|abbey|glass|gloam|sundial)_r(S|M|L)_(D|I|L|T|X)_[a-c]$/;
const CHAR_RE = /^CH_(ak|rb|gc|ns)_[a-z]+_LOD[0-2]$/;
const DOORS: Record<string, number> = { D: 1, I: 2, L: 2, T: 3, X: 4 };
const COMPRESSION = ['EXT_meshopt_compression', 'KHR_mesh_quantization'];

describe.each(manifest.assets)('asset $id', (asset) => {
	const buf = new Uint8Array(readFileSync(dir + asset.file));
	const g = new Glb(buf);
	const tris = (mesh: number) =>
		at(g.json.meshes, mesh).primitives.reduce(
			(s, pr) => s + at(g.json.accessors, pr.indices).count / 3,
			0,
		);

	it('is a valid glTF 2.0 binary that matches the manifest', () => {
		expect(g.json.asset.version).toBe('2.0');
		expect(buf.byteLength).toBe(asset.bytes);
		expect(g.json.materials.map((m) => m.name)).toEqual(asset.materials);
		for (const p of asset.parts) {
			const placed = g.placed(p.name);
			expect(placed.length, p.name).toBeGreaterThan(0);
			expect(placed.reduce((s, m) => s + tris(m.mesh), 0)).toBe(p.tris);
		}
		for (const s of asset.sockets)
			expect(
				g.json.nodes.some((n) => n.name === s),
				s,
			).toBe(true);
	});

	it('is compressed: Meshopt geometry, quantized attributes, KTX2 textures', () => {
		expect(asset.compression).toEqual(COMPRESSION);
		expect(g.json.extensionsRequired ?? []).toEqual(expect.arrayContaining(COMPRESSION));
		for (const v of g.json.bufferViews)
			expect(v.extensions?.EXT_meshopt_compression, 'every buffer view').toBeDefined();
		expect(asset.bytes).toBeLessThan(asset.rawBytes * 0.5);
		// textures only as Basis Universal in KTX2 (none yet: the P0 assets use vertex colours)
		for (const tex of g.json.textures ?? []) {
			const src = tex.extensions?.KHR_texture_basisu?.source;
			expect(tex.source, 'no PNG/JPEG fallback').toBeUndefined();
			expect(at(g.json.images, src).mimeType).toBe('image/ktx2');
		}
	});

	it('follows the naming, budget and material rules', () => {
		const budget = asset.meta.trisBudget;
		asset.parts.forEach((p, i) => {
			expect(p.name).toMatch(asset.id.startsWith('DM_') ? MODULE_RE : CHAR_RE);
			expect(p.tris).toBeLessThanOrEqual(Array.isArray(budget) ? at(budget, i) : budget);
		});
		for (const m of g.json.meshes)
			expect(new Set(m.primitives.map((p) => p.material)).size).toBeLessThanOrEqual(2);
		if (asset.id.startsWith('CH_')) {
			expect(asset.parts.map((p) => p.name.slice(-4))).toEqual(['LOD0', 'LOD1', 'LOD2']);
			const t = asset.parts.map((p) => p.tris);
			expect(at(t, 0)).toBeGreaterThan(at(t, 1));
			expect(at(t, 1)).toBeGreaterThan(at(t, 2));
		}
	});

	it('has consistent geometry: bounds, normals, indices and vertex-colour AO', () => {
		for (const m of g.json.meshes)
			for (const p of m.primitives) {
				const pos = g.read(attr(p, 'POSITION'));
				const nor = g.read(attr(p, 'NORMAL'));
				const col = g.read(attr(p, 'COLOR_0'));
				const idx = g.read(p.indices);
				const acc = at(g.json.accessors, attr(p, 'POSITION'));
				const n = pos.length / 3;
				for (let k = 0; k < 3; k++) {
					const vals = pos.filter((_, i) => i % 3 === k);
					expect(Math.min(...vals)).toBeCloseTo(at(acc.min, k), 4);
					expect(Math.max(...vals)).toBeCloseTo(at(acc.max, k), 4);
				}
				expect(idx.every((i) => i < n)).toBe(true);
				// int8 octahedral normals: unit length up to quantization error
				for (let i = 0; i < nor.length; i += 3) {
					const len = Math.hypot(at(nor, i), at(nor, i + 1), at(nor, i + 2));
					expect(Math.abs(len - 1)).toBeLessThan(0.02);
				}
				expect(col.length).toBe(n * 4);
				expect(Math.min(...col.filter((_, i) => i % 4 === 0))).toBeLessThan(1); // AO darkens something
			}
	});

	it.runIf(asset.id.startsWith('DM_'))('fits its grid footprint and has the door sockets', () => {
		const cells = asset.meta.cells ?? [0, 0];
		const size = asset.meta.cellSize ?? 2;
		const hx = (at(cells, 0) * size) / 2,
			hz = (at(cells, 1) * size) / 2;
		// quantized positions back in metres through the node transform
		for (const pl of g.placed(asset.id))
			for (const p of at(g.json.meshes, pl.mesh).primitives) {
				const a = at(g.json.accessors, attr(p, 'POSITION'));
				const lo = (k: number) => at(pl.t, k) + pl.s * at(a.min, k);
				const hi = (k: number) => at(pl.t, k) + pl.s * at(a.max, k);
				expect(lo(0)).toBeGreaterThanOrEqual(-hx - 1e-3);
				expect(hi(0)).toBeLessThanOrEqual(hx + 1e-3);
				expect(lo(2)).toBeGreaterThanOrEqual(-hz - 1e-3);
				expect(hi(2)).toBeLessThanOrEqual(hz + 1e-3);
			}
		const cfg = at(asset.id.split('_'), 3);
		const doors = g.json.nodes.filter((nd) => nd.name?.startsWith('socket_door_'));
		expect(doors).toHaveLength(DOORS[cfg] ?? -1);
		for (const d of doors) {
			const x = at(d.translation, 0),
				y = at(d.translation, 1),
				z = at(d.translation, 2);
			expect(y).toBe(0);
			// on the edge of the footprint, in the middle of that side
			expect(Math.abs(x) === hx ? z : x).toBe(0);
			expect(Math.abs(x) === hx || Math.abs(z) === hz).toBe(true);
		}
	});
});
