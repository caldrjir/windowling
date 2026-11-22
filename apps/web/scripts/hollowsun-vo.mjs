#!/usr/bin/env node
// HOLLOW SUN – voice pipeline (P1): turns the downloaded voice lines (ElevenLabs, D32) into the game's VO.
// The lines are D.vo in static/games/hollowsun/js/data.js (exported from the Bible's G.DIALOGS and
// G.WHISPERS, English from G.DIALOGS_EN / G.WHISPERS_EN): one file per line and language, named by its
// id (AU_vo_q1_02_03, AU_vo_wh_05), in assets/vo/<lang>/. The game is voiced in English (--lang=en, the
// default); Czech players read Czech subtitles. --lang=cs is ready for Czech voices later.
//   pnpm --filter @windowling/web hollowsun:vo --sheet [folder]  writes the lines to record
//       (hollowsun-vo-lines.csv for a spreadsheet, hollowsun-vo-lines.md grouped by role) into the folder
//   pnpm --filter @windowling/web hollowsun:vo [folder]          processes <id>.mp3|wav|ogg|m4a found there:
//       1. trims silence at both ends (keeps 0.15 s);
//       2. normalises to −16 LUFS integrated, −1 dBTP (the same mix target as the music), two-pass loudnorm;
//       3. encodes Opus 48 kb/s mono (Bible G.AUDIO_FMT.vo) into static/games/hollowsun/assets/vo/<lang>/.
//   pnpm --filter @windowling/web hollowsun:vo --generate [--only=id,id] [--force]  first generates the
//       missing lines through the ElevenLabs API (voices named "HS …" in the account, model
//       eleven_multilingual_v2) into the folder, then processes them. The API key comes from
//       ELEVENLABS_API_KEY in the environment or in apps/web/.env / .env (never printed, never in the repo).
// D32: every processed line's role must have its designed voice recorded in scripts/hollowsun-vo.json,
// and recorded.<lang> holds the plan and generation date. Folder: argument, HOLLOWSUN_VO/<lang>, or
// D:/hollowsun-audio/vo/<lang>.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContext, runInContext } from 'node:vm';

const cfgPath = fileURLToPath(new URL('./hollowsun-vo.json', import.meta.url));
const dataPath = fileURLToPath(new URL('../static/games/hollowsun/js/data.js', import.meta.url));
const args = process.argv.slice(2);
const lang = (args.find((a) => a.startsWith('--lang=')) || '--lang=en').slice(7);
if (!['en', 'cs'].includes(lang)) throw new Error('use --lang=en or --lang=cs');
const out = fileURLToPath(new URL(`../static/games/hollowsun/assets/vo/${lang}/`, import.meta.url));
const sheet = args.includes('--sheet');
const generate = args.includes('--generate');
const force = args.includes('--force');
const only = (args.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const input =
	args.find((a) => !a.startsWith('--')) ||
	(process.env.HOLLOWSUN_VO
		? join(process.env.HOLLOWSUN_VO, lang)
		: `D:/hollowsun-audio/vo/${lang}`);
const ffmpeg = process.env.FFMPEG || 'ffmpeg';
const TARGET = { I: -16, TP: -1, LRA: 11 };

const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
const ctx = {};
ctx.window = ctx;
createContext(ctx);
runInContext(readFileSync(dataPath, 'utf8'), ctx, { filename: 'data.js' });
const lines = ctx.HS_DATA.vo;
const voices = new Map(cfg.voices.map((v) => [v.role, v]));
for (const l of lines)
	if (!voices.has(l.role))
		throw new Error(`${l.id}: role ${l.role} has no voice in hollowsun-vo.json`);
const roleName = (r) => voices.get(r).n;
const textOf = (l) => (lang === 'en' ? l.en : l.text);
const sceneOf = (l) => (lang === 'en' ? l.atEn : l.at) || 'Whisper';
const choiceOf = (l) => (lang === 'en' ? l.choiceEn : l.choice) || '';
const rec = (cfg.recorded || {})[lang] || {};

if (sheet) {
	mkdirSync(input, { recursive: true });
	const csv = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
	const rows = [['file', 'role', 'scene', 'choice', 'text', 'seconds'].join(',')];
	for (const l of lines)
		rows.push(
			[l.id + '.mp3', roleName(l.role), sceneOf(l), choiceOf(l), textOf(l), l.dur]
				.map(csv)
				.join(','),
		);
	writeFileSync(join(input, 'hollowsun-vo-lines.csv'), '\ufeff' + rows.join('\r\n') + '\r\n');
	const md = [
		`# HOLLOW SUN – Act I voice lines (${lang})`,
		'',
		`${lines.length} lines. Save each download as the file name shown.`,
		'',
	];
	for (const v of cfg.voices) {
		const ls = lines.filter((l) => l.role === v.role);
		if (!ls.length) continue;
		md.push(`## ${v.n}`, '', `Voice Design: ${v.prompt}`, '');
		for (const l of ls)
			md.push(
				`- \`${l.id}.mp3\` (${sceneOf(l)}${choiceOf(l) ? ', ' + choiceOf(l) : ''}, ~${l.dur} s): ${textOf(l)}`,
			);
		md.push('');
	}
	writeFileSync(join(input, 'hollowsun-vo-lines.md'), md.join('\n'));
	console.log(`wrote ${lines.length} lines to ${join(input, 'hollowsun-vo-lines.csv')} and .md`);
	process.exit(0);
}

// ElevenLabs API: chybějící repliky (nebo --only / --force) vygeneruje hlasem své role do vstupní složky
if (generate) {
	const envKey = () => {
		if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY.trim();
		for (const f of ['../.env', '../../../.env'].map((x) =>
			fileURLToPath(new URL(x, import.meta.url)),
		)) {
			if (!existsSync(f)) continue;
			const m = /^\s*ELEVENLABS_API_KEY\s*=\s*["']?([^"'\r\n]+)/m.exec(readFileSync(f, 'utf8'));
			if (m) return m[1].trim();
		}
		return null;
	};
	const key = envKey();
	if (!key) throw new Error('set ELEVENLABS_API_KEY in the environment or in apps/web/.env');
	const api = 'https://api.elevenlabs.io';
	const vr = await fetch(`${api}/v1/voices`, { headers: { 'xi-api-key': key } });
	if (!vr.ok) throw new Error(`ElevenLabs voices: HTTP ${vr.status}`);
	const ids = new Map((await vr.json()).voices.map((v) => [v.name, v.voice_id]));
	mkdirSync(input, { recursive: true });
	let made = 0;
	for (const l of lines) {
		const file = join(input, `${l.id}.mp3`);
		if (only.length ? !only.includes(l.id) : existsSync(file) && !force) continue;
		const v = voices.get(l.role);
		const voiceId = v.voice && ids.get(v.voice);
		if (!voiceId)
			throw new Error(`${l.id}: voice "${v.voice}" of ${v.n} not found in the ElevenLabs account`);
		const r = await fetch(`${api}/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
			method: 'POST',
			headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
			body: JSON.stringify({
				text: textOf(l),
				model_id: 'eleven_multilingual_v2',
				voice_settings: {
					stability: 0.5,
					similarity_boost: 0.75,
					style: 0,
					use_speaker_boost: true,
				},
			}),
		});
		if (!r.ok)
			throw new Error(
				`${l.id}: ElevenLabs text-to-speech HTTP ${r.status} ${(await r.text()).slice(0, 200)}`,
			);
		writeFileSync(file, Buffer.from(await r.arrayBuffer()));
		made++;
		console.log(`generated ${l.id} (${v.voice}, ${textOf(l).length} chars)`);
	}
	console.log(`generated ${made} line(s) into ${input}`);
}

const run = (a) => {
	const r = spawnSync(ffmpeg, ['-hide_banner', '-nostats', ...a], {
		encoding: 'utf8',
		maxBuffer: 1 << 26,
	});
	if (r.status !== 0)
		throw new Error(`ffmpeg failed: ${(r.stderr || '').split('\n').slice(-6).join('\n')}`);
	return r.stderr || '';
};
const lastJson = (text) => {
	const i = text.lastIndexOf('{');
	return JSON.parse(text.slice(i, text.indexOf('}', i) + 1));
};
const TRIM =
	'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.15,areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.15,areverse';

mkdirSync(out, { recursive: true });
const manifest = {
	generated: 'scripts/hollowsun-vo.mjs',
	lang,
	target: TARGET,
	service: cfg.service,
	plan: rec.plan || null,
	date: rec.date || null,
	lines: [],
};
const missing = [];
for (const l of lines) {
	const src = ['mp3', 'wav', 'ogg', 'm4a']
		.map((e) => join(input, `${l.id}.${e}`))
		.find((f) => existsSync(f));
	if (!src) {
		missing.push(l.id);
		continue;
	}
	const v = voices.get(l.role);
	if (!v.voice || !rec.plan || !rec.date)
		throw new Error(
			`${l.id}: record the voice of ${v.n} and recorded.${lang} (plan, date) in hollowsun-vo.json first (D32)`,
		);
	const m = lastJson(
		run([
			'-i',
			src,
			'-af',
			`${TRIM},loudnorm=I=${TARGET.I}:TP=${TARGET.TP}:LRA=${TARGET.LRA}:print_format=json`,
			'-f',
			'null',
			'-',
		]),
	);
	const norm = `loudnorm=I=${TARGET.I}:TP=${TARGET.TP}:LRA=${TARGET.LRA}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true:print_format=json`;
	const file = `${l.id}.ogg`;
	const res = lastJson(
		run([
			'-i',
			src,
			'-af',
			`${TRIM},${norm}`,
			'-ar',
			'48000',
			'-ac',
			'1',
			'-c:a',
			'libopus',
			'-b:a',
			'48k',
			'-y',
			join(out, file),
		]),
	);
	const probe =
		spawnSync(ffmpeg, ['-hide_banner', '-i', join(out, file), '-f', 'null', '-'], {
			encoding: 'utf8',
		}).stderr || '';
	const t = /time=(\d+):(\d+):([\d.]+)/g;
	let sec = 0;
	for (let x; (x = t.exec(probe));) sec = Number(x[1]) * 3600 + Number(x[2]) * 60 + Number(x[3]);
	manifest.lines.push({
		id: l.id,
		role: l.role,
		voice: v.voice,
		file,
		seconds: +sec.toFixed(2),
		bytes: statSync(join(out, file)).size,
		lufs: +Number(res.output_i).toFixed(1),
		tp: +Number(res.output_tp).toFixed(1),
	});
	console.log(`${l.id}: ${sec.toFixed(1)} s, ${Number(res.output_i).toFixed(1)} LUFS`);
}
writeFileSync(join(out, 'manifest.json'), JSON.stringify(manifest, null, '\t') + '\n');
console.log(
	`${manifest.lines.length} / ${lines.length} lines${missing.length ? `; not recorded yet: ${missing.length}` : ''}`,
);
