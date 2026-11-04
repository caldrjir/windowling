#!/usr/bin/env node
// HOLLOW SUN – asset pipeline (P0): runs scripts/blender/hollowsun_assets.py in Blender without a
// window and writes the GLB exports and manifest to static/games/hollowsun/assets/.
// Blender is found through the BLENDER environment variable, the PATH or the default install
// folders, e.g. on Windows: set BLENDER=D:\Blender\blender.exe (blender.exe, not the launcher).
// Every export must pass src/lib/games/hollowsun-assets.test.ts.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./blender/hollowsun_assets.py', import.meta.url));
const out = fileURLToPath(new URL('../static/games/hollowsun/assets/', import.meta.url));

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

const blender = findBlender();
if (!blender) {
	console.error('Blender not found - set BLENDER to the path of blender.exe (not the launcher).');
	process.exit(1);
}
const run = spawnSync(blender, ['-b', '--factory-startup', '--python', script, '--', out], {
	stdio: 'inherit',
});
process.exit(run.status ?? 1);
