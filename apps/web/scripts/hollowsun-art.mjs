#!/usr/bin/env node
// HOLLOW SUN visual art from Scenario (Game Design Bible D34).
//
//   pnpm --filter @windowling/web hollowsun:art -- --sheet
//       writes every prompt (style board, UI kit, menu art, item/skill/passive icons,
//       portraits) to <out>/hollowsun-art-prompts.md and .csv
//   pnpm --filter @windowling/web hollowsun:art -- --generate --set=style [--only=id,id] [--force]
//       generates the set through the Scenario API into <out>/raw/<set>/<id>_<n>.<ext>
//       and rebuilds the review gallery <out>/raw/index.html
//   pnpm --filter @windowling/web hollowsun:art -- --inputs [--set=style]
//       prints the inputs the set's model accepts
//
// <out> is the first non-flag argument, HOLLOWSUN_ART, or D:/hollowsun-art.
// The API key and secret come from SCENARIO_API_KEY / SCENARIO_API_SECRET in the environment
// or in apps/web/.env / .env (never printed, never in the repo).
// Sets ui, menu, icons and portraits need the custom style models trained on the chosen
// style board; put their ids under models in hollowsun-art.json first.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContext, runInContext } from 'node:vm';

const API = 'https://api.cloud.scenario.com/v1';
const cfgPath = fileURLToPath(new URL('./hollowsun-art.json', import.meta.url));
const dataPath = fileURLToPath(new URL('../static/games/hollowsun/js/data.js', import.meta.url));
const args = process.argv.slice(2);
const flag = (n) => (args.find((a) => a.startsWith(`--${n}=`)) || '').slice(n.length + 3);
const only = flag('only').split(',').filter(Boolean);
const out =
	args.find((a) => !a.startsWith('--')) || process.env.HOLLOWSUN_ART || 'D:/hollowsun-art';

const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
const ctx = {};
ctx.window = ctx;
createContext(ctx);
runInContext(readFileSync(dataPath, 'utf8'), ctx, { filename: 'data.js' });
const D = ctx.HS_DATA;

// English visual briefs for entities whose Bible text is Czech. A new skill, passive, NPC or
// enemy in data.js fails here until it gets a brief.
const SKILL = {
	ak_cleave: 'a wide glowing greatsword arc sweeping through ash',
	ak_brand: 'a blade branding a burning sigil onto an armoured foe',
	ak_charge: 'a knight charging forward in a trail of embers',
	ak_slam: 'a heavy weapon slamming the ground, molten cracks spreading',
	ak_bulwark: 'a wall of grey ash and embers forming a shield around a knight',
	ak_warcry: 'a knight roaring, a ring of fire bursting outwards',
};
const PASSIVE = {
	ak_p1: 'a heart of glowing ember wrapped in iron bands',
	ak_p2: 'a spark leaping from a struck anvil',
	ak_p3: 'a breastplate glowing red hot from within',
	ak_p4: 'a drop of ember blood falling into a crucible',
	ak_p5: 'two crossed blades over a forge flame',
	ak_p6: 'a flame that will not go out inside a stone hand',
};
const NPC = {
	np_teodor:
		'an elderly archivist in his seventies, grey beard, spectacles, warm candle light, hidden sorrow',
	np_oduin: 'a stern marshal in his fifties, scarred face, iron gorget and fur mantle, commanding',
	np_aldric: 'a monk-smith in a cracked ceramic kiln mask, molten light leaking from the seams',
	np_ysolde: 'a ghostly young woman made of pale echo light, calm wry smile, half transparent',
	np_brannoc:
		'a strong blacksmith woman in her forties, soot on her face, leather apron, forge glow',
};
const ENEMY = {
	en_thrall: 'a hunched ash-grey husk of a man with ember eyes',
	en_brute: 'a huge hulking brute with smouldering cracked skin and a chain',
	en_wisp: 'a floating wisp of fire and smoke with a skull-like face',
	en_hound: 'a lean hound made of charcoal and embers, mid leap',
	en_bowman: 'a charred archer in burnt leather drawing a flaming arrow',
	en_acolyte: 'a robed cultist holding a fireball, kiln mask, candles',
	bo_kiln: 'a towering armoured warden with a furnace in his chest and a giant hammer',
};
const CURRENCY = {
	cu_gold: 'a small stack of old worn gold coins stamped with an eclipse sun',
	cu_ember: 'a glowing shard of ember crystal',
	cu_dust: 'a pinch of shimmering ash dust in a small cloth pouch',
	cu_sunmote: 'a tiny floating mote of pure golden sunlight in a glass bead',
	cu_residue: 'a lump of grey ash residue with faint embers',
};

const need = (map, ids, what) => {
	for (const id of ids)
		if (!map[id]) throw new Error(`${what} ${id} has no brief in hollowsun-art.mjs`);
};
need(
	SKILL,
	D.skills.map((s) => s.id),
	'skill',
);
need(
	PASSIVE,
	D.passives.map((p) => p.id),
	'passive',
);
need(
	NPC,
	D.npcs.map((n) => n.id),
	'npc',
);
need(
	ENEMY,
	D.enemies.map((e) => e.id),
	'enemy',
);

const icon = (subject) =>
	`game item icon, ${subject}, dark vignette background, centred, single object`;
const bases = new Map(D.loot.bases.map((b) => [b.id, b]));
const gen = cfg.generated;
const sets = {
	...cfg.sets,
	icons: {
		...gen.icons,
		items: [
			...D.loot.bases.map((b) => ({
				id: `ic_${b.id}`,
				n: b.n,
				prompt: icon(`a ${b.n.toLowerCase()} (${b.cat.toLowerCase()})`),
			})),
			...D.loot.uniques.map((u) => {
				const b = bases.get(u.base);
				return {
					id: `ic_${u.id}`,
					n: u.n,
					prompt: icon(
						`a legendary ${b ? b.cat.toLowerCase() : 'artifact'} called ${u.n}, ornate, faint ember glow, one of a kind`,
					),
				};
			}),
			...Object.entries(CURRENCY).map(([id, s]) => ({ id: `ic_${id}`, n: id, prompt: icon(s) })),
			...D.skills.map((s) => ({
				id: `ic_${s.id}`,
				n: s.n,
				prompt: `game skill icon, ${SKILL[s.id]}, round composition, dark background, centred`,
			})),
			...D.passives.map((p) => ({
				id: `ic_${p.id}`,
				n: p.n,
				prompt: `game passive skill emblem, ${PASSIVE[p.id]}, round composition, dark background, centred`,
			})),
		],
	},
	portraits: {
		...gen.portraits,
		items: [
			...D.npcs.map((n) => ({
				id: `pt_${n.id}`,
				n: n.n,
				prompt: `character portrait bust, ${NPC[n.id]}, painted, dark background`,
			})),
			...D.enemies.map((e) => ({
				id: `pt_${e.id}`,
				n: e.n,
				prompt: `creature portrait bust for a bestiary, ${ENEMY[e.id]}, painted, dark background`,
			})),
		],
	},
};
const fullPrompt = (it) => `${it.prompt}. ${cfg.style}. No text, no letters, no watermark.`;
const sizeOf = (set, it) => it.size || set.size;

if (args.includes('--sheet')) {
	mkdirSync(out, { recursive: true });
	const md = [
		'# HOLLOW SUN art prompts (D34)',
		'',
		`Style: ${cfg.style}`,
		'',
		`Avoid: ${cfg.avoid}`,
		'',
	];
	const csv = ['set,id,name,model,width,height,nine,prompt'];
	let n = 0;
	for (const [name, set] of Object.entries(sets)) {
		md.push(
			`## ${name} (${set.items.length}, model ${set.model}: ${cfg.models[set.model] || 'not trained yet'})`,
			'',
		);
		for (const it of set.items) {
			const [w, h] = sizeOf(set, it);
			md.push(
				`- **${it.id}**${it.n ? ` ${it.n}` : ''} ${w}×${h}${it.nine ? `, 9-slice ${it.nine} px` : ''}: ${it.prompt}`,
			);
			csv.push(
				[name, it.id, it.n || '', set.model, w, h, it.nine || '', fullPrompt(it)]
					.map((v) => `"${String(v).replace(/"/g, '""')}"`)
					.join(','),
			);
			n++;
		}
		md.push('');
	}
	writeFileSync(join(out, 'hollowsun-art-prompts.md'), md.join('\n'));
	writeFileSync(join(out, 'hollowsun-art-prompts.csv'), '\ufeff' + csv.join('\r\n'));
	console.log(`${n} prompts in ${Object.keys(sets).length} sets -> ${out}`);
}

const envVar = (name) => {
	if (process.env[name]) return process.env[name].trim();
	for (const f of ['../.env', '../../../.env'].map((x) =>
		fileURLToPath(new URL(x, import.meta.url)),
	)) {
		if (!existsSync(f)) continue;
		const m = new RegExp(`^\\s*${name}\\s*=\\s*["']?([^"'\\r\\n]+)`, 'm').exec(
			readFileSync(f, 'utf8'),
		);
		if (m) return m[1].trim();
	}
	return '';
};
const api = async (path, init = {}) => {
	const key = envVar('SCENARIO_API_KEY');
	const secret = envVar('SCENARIO_API_SECRET');
	if (!key || !secret)
		throw new Error(
			'set SCENARIO_API_KEY and SCENARIO_API_SECRET in the environment or in apps/web/.env',
		);
	const res = await fetch(`${API}${path}`, {
		...init,
		headers: {
			Authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}`,
			'Content-Type': 'application/json',
			...init.headers,
		},
	});
	if (!res.ok)
		throw new Error(
			`${init.method || 'GET'} ${path}: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`,
		);
	return res.json();
};
const pickSet = () => {
	const name = flag('set') || 'style';
	const set = sets[name];
	if (!set) throw new Error(`unknown set ${name}; sets: ${Object.keys(sets).join(', ')}`);
	const model = flag('model') || cfg.models[set.model];
	if (!model)
		throw new Error(
			`set ${name} needs the ${set.model} style model; train it in Scenario and put its id under models in hollowsun-art.json`,
		);
	return { name, set, model };
};

if (args.includes('--inputs')) {
	const { model } = pickSet();
	console.log(JSON.stringify(await api(`/models/${model}`), null, 2).slice(0, 6000));
}

const gallery = () => {
	const root = join(out, 'raw');
	if (!existsSync(root)) return;
	const parts = [
		'<!doctype html><meta charset="utf-8"><title>HOLLOW SUN art review</title>',
		'<style>body{background:#0a0c11;color:#e7e2d6;font:14px system-ui;margin:24px}h2{color:#e3b964}figure{display:inline-block;margin:0 12px 16px 0;vertical-align:top}img{width:256px;height:256px;object-fit:contain;background:#141823;border:1px solid #2a3142}figcaption{font:12px monospace;color:#a39e8f}</style>',
	];
	for (const set of readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory())) {
		parts.push(`<h2>${set.name}</h2>`);
		for (const f of readdirSync(join(root, set.name))
			.filter((x) => /\.(png|jpe?g|webp)$/i.test(x))
			.sort())
			parts.push(
				`<figure><img src="${set.name}/${f}" loading="lazy"><figcaption>${f}</figcaption></figure>`,
			);
	}
	writeFileSync(join(root, 'index.html'), parts.join('\n'));
	console.log(`review gallery -> ${join(root, 'index.html')}`);
};

if (args.includes('--generate')) {
	const { name, set, model } = pickSet();
	const inputs = JSON.stringify(await api(`/models/${model}`));
	const has = (field) => inputs.includes(`"${field}"`);
	const dir = join(out, 'raw', name);
	mkdirSync(dir, { recursive: true });
	const items = set.items.filter((it) => !only.length || only.includes(it.id));
	for (const it of items) {
		if (!args.includes('--force') && readdirSync(dir).some((f) => f.startsWith(`${it.id}_`))) {
			console.log(`${it.id}: already generated (use --force)`);
			continue;
		}
		const [width, height] = sizeOf(set, it);
		const body = { prompt: fullPrompt(it), width, height };
		if (has('numSamples')) body.numSamples = set.samples;
		if (has('numOutputs')) body.numOutputs = set.samples;
		if (has('quality')) body.quality = 'high';
		if (has('negativePrompt')) body.negativePrompt = cfg.avoid;
		const { job } = await api(`/generate/custom/${model}`, {
			method: 'POST',
			body: JSON.stringify(body),
		});
		let done = null;
		for (let t = 0; t < 120 && !done; t++) {
			await new Promise((r) => setTimeout(r, 3000));
			const j = (await api(`/jobs/${job.jobId}`)).job;
			if (j.status === 'success') done = j;
			else if (['failure', 'failed', 'canceled'].includes(j.status))
				throw new Error(`${it.id}: job ${job.jobId} ${j.status}`);
		}
		if (!done) throw new Error(`${it.id}: job ${job.jobId} timed out`);
		const ids = (done.metadata && done.metadata.assetIds) || [];
		for (const [i, assetId] of ids.entries()) {
			const { asset } = await api(`/assets/${assetId}`);
			const img = await fetch(asset.url);
			if (!img.ok) throw new Error(`${it.id}: download HTTP ${img.status}`);
			const type = img.headers.get('content-type') || '';
			const ext = type.includes('webp') ? 'webp' : type.includes('jpeg') ? 'jpg' : 'png';
			writeFileSync(join(dir, `${it.id}_${i + 1}.${ext}`), Buffer.from(await img.arrayBuffer()));
		}
		console.log(`${it.id}: ${ids.length} image(s)`);
	}
	gallery();
}
