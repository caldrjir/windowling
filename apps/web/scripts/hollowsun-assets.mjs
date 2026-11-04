#!/usr/bin/env node
// HOLLOW SUN – asset pipeline test (P0): writes two GLB assets the way an export from Blender
// would arrive, plus a manifest. Stands in for Blender until real art exists; the same checks
// (src/lib/games/hollowsun-assets.test.ts) must pass for every real export too.
//   DM_crypt_rS_X_a – dungeon module from the Bible's catalogue: small room (5×5 cells of 2 m),
//                     door sockets on all four sides, vertex-colour AO, 2 materials.
//   CH_ak_body      – placeholder Ash Knight body with LOD0/1/2 (static; skeleton comes later).
// Usage: node scripts/hollowsun-assets.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../static/games/hollowsun/assets/', import.meta.url));

/** A mesh under construction: interleaved later into glTF accessors. */
function meshBuilder() {
	const m = { pos: [], nor: [], col: [], idx: [] };
	const vert = (p, n, ao) => {
		m.pos.push(...p);
		m.nor.push(...n);
		m.col.push(ao, ao, ao, 1);
		return m.pos.length / 3 - 1;
	};
	// Vertex-colour AO: darker towards the floor (y = 0), as the Bible's module spec asks.
	const aoAt = (y, h) => Math.min(1, 0.55 + 0.45 * Math.min(1, y / Math.max(0.5, h)));
	/** Axis-aligned box from min to max corner, 12 triangles. */
	m.box = (a, b, aoHeight = 4) => {
		const faces = [
			[
				[1, 0, 0],
				[b[0], a[1], a[2]],
				[b[0], b[1], a[2]],
				[b[0], b[1], b[2]],
				[b[0], a[1], b[2]],
			],
			[
				[-1, 0, 0],
				[a[0], a[1], b[2]],
				[a[0], b[1], b[2]],
				[a[0], b[1], a[2]],
				[a[0], a[1], a[2]],
			],
			[
				[0, 1, 0],
				[a[0], b[1], a[2]],
				[a[0], b[1], b[2]],
				[b[0], b[1], b[2]],
				[b[0], b[1], a[2]],
			],
			[
				[0, -1, 0],
				[a[0], a[1], b[2]],
				[a[0], a[1], a[2]],
				[b[0], a[1], a[2]],
				[b[0], a[1], b[2]],
			],
			[
				[0, 0, 1],
				[b[0], a[1], b[2]],
				[b[0], b[1], b[2]],
				[a[0], b[1], b[2]],
				[a[0], a[1], b[2]],
			],
			[
				[0, 0, -1],
				[a[0], a[1], a[2]],
				[a[0], b[1], a[2]],
				[b[0], b[1], a[2]],
				[b[0], a[1], a[2]],
			],
		];
		for (const [n, ...q] of faces) {
			const i = q.map((p) => vert(p, n, aoAt(p[1], aoHeight)));
			m.idx.push(i[0], i[1], i[2], i[0], i[2], i[3]);
		}
	};
	/** Vertical cylinder (radius r, from y0 to y1) with `seg` sides and caps. */
	m.cyl = (cx, cz, r, y0, y1, seg, aoHeight = 2) => {
		const ring = (y, ny) => {
			const out = [];
			for (let k = 0; k <= seg; k++) {
				const a = (k / seg) * Math.PI * 2;
				const n = ny === 0 ? [Math.cos(a), 0, Math.sin(a)] : [0, ny, 0];
				out.push(vert([cx + Math.cos(a) * r, y, cz + Math.sin(a) * r], n, aoAt(y, aoHeight)));
			}
			return out;
		};
		const lo = ring(y0, 0),
			hi = ring(y1, 0);
		for (let k = 0; k < seg; k++) m.idx.push(lo[k], hi[k], hi[k + 1], lo[k], hi[k + 1], lo[k + 1]);
		for (const [y, ny] of [
			[y0, -1],
			[y1, 1],
		]) {
			const c = vert([cx, y, cz], [0, ny, 0], aoAt(y, aoHeight));
			const rr = ring(y, ny);
			for (let k = 0; k < seg; k++)
				m.idx.push(...(ny > 0 ? [c, rr[k + 1], rr[k]] : [c, rr[k], rr[k + 1]]));
		}
	};
	return m;
}

/** Packs meshes into a GLB (glTF 2.0 binary). `parts`: [{ name, primitives: [{ mesh, material }] }]. */
function glb({ asset, materials, parts, sockets }) {
	const chunks = [];
	let offset = 0;
	const views = [],
		accessors = [];
	const push = (typed, target, count, type, compType, minmax) => {
		const bytes = Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength);
		const pad = (4 - (bytes.length % 4)) % 4;
		chunks.push(bytes, Buffer.alloc(pad));
		views.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length, target });
		offset += bytes.length + pad;
		const acc = { bufferView: views.length - 1, componentType: compType, count, type };
		if (minmax) Object.assign(acc, minmax);
		accessors.push(acc);
		return accessors.length - 1;
	};
	const meshes = [],
		nodes = [];
	for (const part of parts) {
		const prims = part.primitives.map(({ mesh, material }) => {
			const n = mesh.pos.length / 3;
			const min = [Infinity, Infinity, Infinity],
				max = [-Infinity, -Infinity, -Infinity];
			for (let i = 0; i < n; i++)
				for (let k = 0; k < 3; k++) {
					min[k] = Math.min(min[k], mesh.pos[i * 3 + k]);
					max[k] = Math.max(max[k], mesh.pos[i * 3 + k]);
				}
			const big = n > 65535;
			return {
				attributes: {
					POSITION: push(new Float32Array(mesh.pos), 34962, n, 'VEC3', 5126, { min, max }),
					NORMAL: push(new Float32Array(mesh.nor), 34962, n, 'VEC3', 5126),
					COLOR_0: push(new Float32Array(mesh.col), 34962, n, 'VEC4', 5126),
				},
				indices: push(
					big ? new Uint32Array(mesh.idx) : new Uint16Array(mesh.idx),
					34963,
					mesh.idx.length,
					'SCALAR',
					big ? 5125 : 5123,
				),
				material: materials.findIndex((m) => m.name === material),
				mode: 4,
			};
		});
		meshes.push({ name: part.name, primitives: prims });
		nodes.push({ name: part.name, mesh: meshes.length - 1 });
	}
	for (const s of sockets || []) nodes.push({ name: s.name, translation: s.at });
	const json = {
		asset: { version: '2.0', generator: 'windowling hollowsun-assets.mjs' },
		scene: 0,
		scenes: [{ name: asset, nodes: nodes.map((_, i) => i) }],
		nodes,
		meshes,
		materials: materials.map((m) => ({
			name: m.name,
			pbrMetallicRoughness: {
				baseColorFactor: m.color,
				metallicFactor: m.metal ?? 0,
				roughnessFactor: m.rough ?? 0.85,
			},
		})),
		accessors,
		bufferViews: views,
		buffers: [{ byteLength: offset }],
	};
	const bin = Buffer.concat(chunks);
	let js = Buffer.from(JSON.stringify(json));
	js = Buffer.concat([js, Buffer.alloc((4 - (js.length % 4)) % 4, 0x20)]);
	const header = Buffer.alloc(12);
	header.writeUInt32LE(0x46546c67, 0);
	header.writeUInt32LE(2, 4);
	header.writeUInt32LE(12 + 8 + js.length + 8 + bin.length, 8);
	const jh = Buffer.alloc(8);
	jh.writeUInt32LE(js.length, 0);
	jh.writeUInt32LE(0x4e4f534a, 4);
	const bh = Buffer.alloc(8);
	bh.writeUInt32LE(bin.length, 0);
	bh.writeUInt32LE(0x004e4942, 4);
	return Buffer.concat([header, jh, js, bh, bin]);
}

const tris = (m) => m.idx.length / 3;

/* ---------- DM_crypt_rS_X_a: 10 × 10 m room, walls 4 m, doors 4 m wide × 3 m high on every side */
function cryptRoom() {
	const stone = meshBuilder(),
		trim = meshBuilder();
	const H = 4,
		T = 0.5,
		S = 5,
		DOOR = 2,
		DH = 3; // half size, wall thickness, door half width, door height
	stone.box([-S, -0.2, -S], [S, 0, S], 1);
	// floor slabs: a 2 m grid of slightly raised tiles (the module's snap grid made visible)
	for (let x = -S; x < S; x += 2)
		for (let z = -S; z < S; z += 2)
			stone.box([x + 0.06, 0, z + 0.06], [x + 1.94, 0.04, z + 1.94], 1);
	// four walls, each split by a door opening with a lintel above
	for (const side of [0, 1, 2, 3]) {
		const segs = [
			[-S, -DOOR],
			[DOOR, S],
		];
		for (const [a, b] of segs) {
			const box =
				side < 2
					? [
							[a, 0, (side ? S : -S) - (side ? T : 0)],
							[b, H, (side ? S : -S) + (side ? 0 : T)],
						]
					: [
							[(side === 3 ? S : -S) - (side === 3 ? T : 0), 0, a],
							[(side === 3 ? S : -S) + (side === 3 ? 0 : T), H, b],
						];
			stone.box(box[0], box[1], H);
		}
		const lintel =
			side < 2
				? [
						[-DOOR, DH, (side ? S : -S) - (side ? T : 0)],
						[DOOR, H, (side ? S : -S) + (side ? 0 : T)],
					]
				: [
						[(side === 3 ? S : -S) - (side === 3 ? T : 0), DH, -DOOR],
						[(side === 3 ? S : -S) + (side === 3 ? 0 : T), H, DOOR],
					];
		trim.box(lintel[0], lintel[1], H);
	}
	// corner pillars, an ember trim along the top and a few rubble stones
	for (const [x, z] of [
		[-S, -S],
		[S, -S],
		[-S, S],
		[S, S],
	])
		trim.cyl(Math.sign(x) * (S - 0.45), Math.sign(z) * (S - 0.45), 0.45, 0, H + 0.4, 12, H);
	for (const [x, z, s] of [
		[2.6, -2.2, 0.5],
		[-3.1, 1.7, 0.35],
		[1.2, 3.4, 0.3],
	])
		stone.box([x - s, 0, z - s * 0.8], [x + s, s * 0.9, z + s * 0.8], 1);
	return {
		asset: 'DM_crypt_rS_X_a',
		materials: [
			{ name: 'M_crypt_stone', color: [0.36, 0.33, 0.31, 1] },
			{ name: 'M_crypt_trim', color: [0.42, 0.24, 0.14, 1], rough: 0.6 },
		],
		parts: [
			{
				name: 'DM_crypt_rS_X_a',
				primitives: [
					{ mesh: stone, material: 'M_crypt_stone' },
					{ mesh: trim, material: 'M_crypt_trim' },
				],
			},
		],
		// door sockets: centre of each door opening, on the 2 m grid, at floor level
		sockets: [
			{ name: 'socket_door_N', at: [0, 0, -S] },
			{ name: 'socket_door_S', at: [0, 0, S] },
			{ name: 'socket_door_W', at: [-S, 0, 0] },
			{ name: 'socket_door_E', at: [S, 0, 0] },
		],
		meta: { cells: [5, 5], cellSize: 2, size: [10, H, 10], trisBudget: 3000 },
	};
}

/* ---------- CH_ak_body: placeholder Ash Knight (static), three LODs ---------- */
function knight(seg) {
	const body = meshBuilder(),
		trim = meshBuilder();
	const limb = (m, x, z, r, y0, y1) => m.cyl(x, z, r, y0, y1, seg, 2);
	limb(body, -0.14, 0, 0.11, 0, 0.85); // legs
	limb(body, 0.14, 0, 0.11, 0, 0.85);
	limb(body, 0, 0, 0.27, 0.85, 1.45); // torso
	limb(body, 0, 0, 0.13, 1.5, 1.78); // head
	limb(body, -0.38, 0, 0.08, 0.85, 1.4); // arms
	limb(body, 0.38, 0, 0.08, 0.85, 1.4);
	limb(trim, -0.33, 0, 0.14, 1.32, 1.48); // pauldrons
	limb(trim, 0.33, 0, 0.14, 1.32, 1.48);
	limb(trim, 0, 0, 0.29, 1.0, 1.08); // belt
	// a big round shape keeps LOD0 near a realistic budget
	for (let i = 0; i < seg / 2; i++)
		limb(trim, 0, 0, 0.3 - i * 0.002, 1.08 + i * 0.01, 1.085 + i * 0.01);
	return { body, trim };
}
function knightAsset() {
	const lods = [
		[0, 64],
		[1, 24],
		[2, 10],
	].map(([l, seg]) => {
		const k = knight(seg);
		return {
			name: `CH_ak_body_LOD${l}`,
			primitives: [
				{ mesh: k.body, material: 'M_ak_steel' },
				{ mesh: k.trim, material: 'M_ak_ember' },
			],
		};
	});
	return {
		asset: 'CH_ak_body',
		materials: [
			{ name: 'M_ak_steel', color: [0.23, 0.25, 0.29, 1], metal: 0.6, rough: 0.45 },
			{ name: 'M_ak_ember', color: [0.93, 0.48, 0.23, 1], rough: 0.5 },
		],
		parts: lods,
		sockets: [{ name: 'socket_hand_R', at: [0.38, 0.9, 0] }],
		meta: { height: 1.78, trisBudget: [25000, 9000, 3000] },
	};
}

mkdirSync(OUT, { recursive: true });
const manifest = { generated: 'scripts/hollowsun-assets.mjs', assets: [] };
for (const a of [cryptRoom(), knightAsset()]) {
	const file = `${a.asset}.glb`;
	const buf = glb(a);
	writeFileSync(OUT + file, buf);
	manifest.assets.push({
		id: a.asset,
		file,
		bytes: buf.length,
		materials: a.materials.map((m) => m.name),
		parts: a.parts.map((p) => ({
			name: p.name,
			tris: p.primitives.reduce((s, x) => s + tris(x.mesh), 0),
		})),
		sockets: (a.sockets || []).map((s) => s.name),
		meta: a.meta,
	});
}
writeFileSync(OUT + 'manifest.json', JSON.stringify(manifest, null, '\t') + '\n');
for (const a of manifest.assets)
	console.log(a.id, a.bytes, 'B', a.parts.map((p) => `${p.name}:${p.tris}`).join(' '));
