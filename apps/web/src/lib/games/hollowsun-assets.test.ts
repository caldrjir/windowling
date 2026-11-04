import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * HOLLOW SUN asset pipeline (P0): every GLB in static/games/hollowsun/assets must pass the
 * checks the Game Design Bible's asset specification asks of CI – naming, triangle budget,
 * at most 2 materials per mesh, LODs, module footprint on the 2 m grid, door sockets,
 * vertex-colour AO – plus basic glTF integrity. Real Blender exports go through the same test.
 */
const dir = fileURLToPath(new URL('../../../static/games/hollowsun/assets/', import.meta.url));

interface Accessor {
	bufferView: number;
	componentType: number;
	count: number;
	type: string;
	normalized?: boolean;
	min?: number[];
	max?: number[];
}
interface Primitive {
	attributes: Record<string, number>;
	indices: number;
	material: number;
}
interface Gltf {
	asset: { version: string };
	nodes: { name: string; mesh?: number; translation?: number[] }[];
	meshes: { name: string; primitives: Primitive[] }[];
	materials: { name: string }[];
	accessors: Accessor[];
	bufferViews: { byteOffset: number; byteLength: number }[];
}
interface ManifestAsset {
	id: string;
	file: string;
	bytes: number;
	materials: string[];
	parts: { name: string; tris: number }[];
	sockets: string[];
	meta: { cells?: number[]; cellSize?: number; trisBudget: number | number[] };
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

function parseGlb(bytes: Uint8Array): { json: Gltf; bin: DataView } {
	const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const u32 = (o: number) => dv.getUint32(o, true);
	expect(u32(0)).toBe(0x46546c67); // "glTF"
	expect(u32(4)).toBe(2);
	expect(u32(8)).toBe(bytes.byteLength);
	const jlen = u32(12);
	expect(u32(16)).toBe(0x4e4f534a); // JSON
	const json = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + jlen))) as Gltf;
	const bOff = 20 + jlen;
	expect(u32(bOff + 4)).toBe(0x004e4942); // BIN
	return { json, bin: new DataView(bytes.buffer, bytes.byteOffset + bOff + 8, u32(bOff)) };
}
function read(g: { json: Gltf; bin: DataView }, i: number): number[] {
	const a = at(g.json.accessors, i);
	const v = at(g.json.bufferViews, a.bufferView);
	const comps = a.type === 'VEC3' ? 3 : a.type === 'VEC4' ? 4 : 1;
	const o = v.byteOffset;
	// float, uint32, uint16, uint8; normalized integers map to 0..1 (glTF 2.0, accessor.normalized)
	const size = { 5126: 4, 5125: 4, 5123: 2, 5121: 1 }[a.componentType] ?? 0;
	const get = (off: number): number =>
		a.componentType === 5126
			? g.bin.getFloat32(off, true)
			: a.componentType === 5125
				? g.bin.getUint32(off, true)
				: a.componentType === 5123
					? g.bin.getUint16(off, true)
					: g.bin.getUint8(off);
	const scale = a.normalized
		? a.componentType === 5123
			? 65535
			: a.componentType === 5121
				? 255
				: 1
		: 1;
	expect(size, `component type ${a.componentType}`).toBeGreaterThan(0);
	const out: number[] = [];
	for (let k = 0; k < a.count * comps; k++) out.push(get(o + k * size) / scale);
	return out;
}

const manifest = JSON.parse(readFileSync(dir + 'manifest.json', 'utf8')) as {
	assets: ManifestAsset[];
};
const MODULE_RE = /^DM_(crypt|abbey|glass|gloam|sundial)_r(S|M|L)_(D|I|L|T|X)_[a-c]$/;
const CHAR_RE = /^CH_(ak|rb|gc|ns)_[a-z]+_LOD[0-2]$/;
const DOORS: Record<string, number> = { D: 1, I: 2, L: 2, T: 3, X: 4 };

describe.each(manifest.assets)('asset $id', (asset) => {
	const buf = new Uint8Array(readFileSync(dir + asset.file));
	const g = parseGlb(buf);

	it('is a valid glTF 2.0 binary that matches the manifest', () => {
		expect(g.json.asset.version).toBe('2.0');
		expect(buf.byteLength).toBe(asset.bytes);
		expect(g.json.materials.map((m) => m.name)).toEqual(asset.materials);
		for (const p of asset.parts) {
			const mesh = g.json.meshes.find((m) => m.name === p.name);
			expect(mesh, p.name).toBeDefined();
			const tris = (mesh?.primitives ?? []).reduce(
				(s, pr) => s + at(g.json.accessors, pr.indices).count / 3,
				0,
			);
			expect(tris).toBe(p.tris);
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
				const pos = read(g, attr(p, 'POSITION'));
				const nor = read(g, attr(p, 'NORMAL'));
				const col = read(g, attr(p, 'COLOR_0'));
				const idx = read(g, p.indices);
				const acc = at(g.json.accessors, attr(p, 'POSITION'));
				const n = pos.length / 3;
				for (let k = 0; k < 3; k++) {
					const vals = pos.filter((_, i) => i % 3 === k);
					expect(Math.min(...vals)).toBeCloseTo(at(acc.min, k), 4);
					expect(Math.max(...vals)).toBeCloseTo(at(acc.max, k), 4);
				}
				expect(idx.every((i) => i < n)).toBe(true);
				for (let i = 0; i < nor.length; i += 3)
					expect(Math.hypot(at(nor, i), at(nor, i + 1), at(nor, i + 2))).toBeCloseTo(1, 3);
				expect(col.length).toBe(n * 4);
				expect(Math.min(...col.filter((_, i) => i % 4 === 0))).toBeLessThan(1); // AO darkens something
			}
	});

	it.runIf(asset.id.startsWith('DM_'))('fits its grid footprint and has the door sockets', () => {
		const cells = asset.meta.cells ?? [0, 0];
		const size = asset.meta.cellSize ?? 2;
		const hx = (at(cells, 0) * size) / 2,
			hz = (at(cells, 1) * size) / 2;
		for (const m of g.json.meshes)
			for (const p of m.primitives) {
				const a = at(g.json.accessors, attr(p, 'POSITION'));
				expect(at(a.min, 0)).toBeGreaterThanOrEqual(-hx - 1e-4);
				expect(at(a.max, 0)).toBeLessThanOrEqual(hx + 1e-4);
				expect(at(a.min, 2)).toBeGreaterThanOrEqual(-hz - 1e-4);
				expect(at(a.max, 2)).toBeLessThanOrEqual(hz + 1e-4);
			}
		const cfg = at(asset.id.split('_'), 3);
		const doors = g.json.nodes.filter((nd) => nd.name.startsWith('socket_door_'));
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
