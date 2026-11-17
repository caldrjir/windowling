#!/usr/bin/env node
// HOLLOW SUN – asset pipeline (P0):
//   1. scripts/blender/hollowsun_assets.py runs in Blender without a window and exports raw GLBs
//      plus a manifest to a temporary folder;
//   2. gltfpack (meshoptimizer) quantizes and compresses them (EXT_meshopt_compression +
//      KHR_mesh_quantization) into static/games/hollowsun/assets/, keeping named nodes and materials;
//   3. the manifest gets the compressed sizes and is written next to them.
// Blender is found through the BLENDER environment variable, the PATH or the default install
// folders, e.g. on Windows: set BLENDER=D:\Blender\blender.exe (blender.exe, not the launcher).
// --char=<ID>=<source.glb> (repeatable) rebuilds only those characters from Scenario/Meshy meshes
// (scripts/blender/hollowsun_char.py, D34: CH_ak_knight, EN_*, BO_*) and replaces their entries in
// the existing manifest.
// Every export must pass src/lib/games/hollowsun-assets.test.ts.
import { spawnSync } from 'node:child_process';
import {
	existsSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const chars = process.argv
	.filter((a) => a.startsWith('--char='))
	.map((a) => {
		const [id, ...src] = a.slice(7).split('=');
		return { id, src: src.join('=') };
	});
const blenderDir = fileURLToPath(new URL('./blender/', import.meta.url));
const out = fileURLToPath(new URL('../static/games/hollowsun/assets/', import.meta.url));
const gltfpack = createRequire(import.meta.url).resolve('gltfpack/cli.js');

function findBlender() {
	if (process.env.BLENDER) return process.env.BLENDER;
	if (spawnSync('blender', ['--version'], { stdio: 'ignore' }).status === 0) return 'blender';
	const roots = ['C:/Program Files/Blender Foundation', '/Applications/Blender.app/Contents/MacOS'];
	for (const root of roots) {
		if (!existsSync(root)) continue;
		if (existsSync(join(root, 'Blender'))) return join(root, 'Blender');
		for (const dir of readdirSync(root).sort().reverse()) {
			const exe = join(root, dir, 'blender.exe');
			if (existsSync(exe)) return exe;
		}
	}
	return null;
}

function run(cmd, args) {
	const r = spawnSync(cmd, args, { stdio: 'inherit' });
	if (r.status !== 0) throw new Error(`${cmd} failed with exit code ${r.status}`);
}

const blender = findBlender();
if (!blender) {
	console.error('Blender not found - set BLENDER to the path of blender.exe (not the launcher).');
	process.exit(1);
}
const raw = mkdtempSync(join(tmpdir(), 'hollowsun-raw-'));
try {
	const manifest = { generated: '', assets: [] };
	const jobs = chars.length
		? chars.map((c) => ({ script: 'hollowsun_char.py', args: [c.id, c.src] }))
		: [{ script: 'hollowsun_assets.py', args: [] }];
	for (const job of jobs) {
		const dir = mkdtempSync(join(raw, 'b-'));
		run(blender, [
			'-b',
			'--factory-startup',
			'--python',
			join(blenderDir, job.script),
			'--',
			dir,
			...job.args,
		]);
		const m = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
		manifest.generated = m.generated;
		for (const a of m.assets) {
			// -cc: higher compression, -kn/-km: keep named nodes (LODs, sockets) and materials
			run(process.execPath, [
				gltfpack,
				'-i',
				join(dir, a.file),
				'-o',
				join(out, a.file),
				'-cc',
				'-kn',
				'-km',
			]);
			a.rawBytes = a.bytes;
			a.bytes = statSync(join(out, a.file)).size;
			a.compression = ['EXT_meshopt_compression', 'KHR_mesh_quantization'];
			if (chars.length) a.compression.push('EXT_texture_webp'); // textures as WebP from Blender
			console.log(`${a.id}: ${a.rawBytes} -> ${a.bytes} bytes`);
			manifest.assets.push(a);
		}
	}
	manifest.generated += ' + gltfpack -cc -kn -km';
	if (chars.length) {
		// keep the other assets, replace (or add) the rebuilt characters
		const prev = JSON.parse(readFileSync(join(out, 'manifest.json'), 'utf8'));
		const ids = new Set(manifest.assets.map((a) => a.id));
		manifest.assets = [...prev.assets.filter((a) => !ids.has(a.id)), ...manifest.assets];
		manifest.generated = prev.generated;
	}
	writeFileSync(join(out, 'manifest.json'), JSON.stringify(manifest, null, '\t') + '\n');
} finally {
	rmSync(raw, { recursive: true, force: true });
}
