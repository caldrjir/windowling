#!/usr/bin/env node
// HOLLOW SUN – music pipeline (P1): turns the downloaded tracks (Suno, D32) into the game's music.
// For every track in scripts/hollowsun-music.json that has a `src`:
//   1. cut it from `start` to an exact loop length of `bars` × 4 beats at `bpm` (loops close on a
//      bar line; tracks of one `group` – explore/combat, the boss phases – get one length so the
//      game can play them in sync and crossfade), or to at most `max` seconds for a stinger;
//   2. normalise to −16 LUFS integrated, −1 dBTP (Game Design Bible, audio mix), two-pass loudnorm;
//   3. encode Opus 128 kb/s stereo (Bible G.AUDIO_FMT.music) into static/games/hollowsun/assets/music/.
// The manifest there lists what exists, with the measured loudness and the Suno link.
// Input folder: argument, HOLLOWSUN_AUDIO, or D:/hollowsun-audio. ffmpeg: FFMPEG or the PATH.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const cfgPath = fileURLToPath(new URL('./hollowsun-music.json', import.meta.url));
const out = fileURLToPath(new URL('../static/games/hollowsun/assets/music/', import.meta.url));
const input = process.argv[2] || process.env.HOLLOWSUN_AUDIO || 'D:/hollowsun-audio';
const ffmpeg = process.env.FFMPEG || 'ffmpeg';
const TARGET = { I: -16, TP: -1, LRA: 11 };

const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
const run = (args) => {
	const r = spawnSync(ffmpeg, ['-hide_banner', '-nostats', ...args], {
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
const loopLength = (t) => (t.bars * 4 * 60) / t.bpm;

const groups = {};
for (const t of cfg.tracks)
	if (t.group && t.loop) (groups[t.group] ||= new Set()).add(loopLength(t).toFixed(6));
for (const [g, lens] of Object.entries(groups))
	if (lens.size > 1) throw new Error(`group ${g}: tracks must share one loop length (bars × bpm)`);

mkdirSync(out, { recursive: true });
const manifest = { generated: 'scripts/hollowsun-music.mjs', target: TARGET, tracks: [] };
const missing = [];
for (const t of cfg.tracks) {
	if (!t.src) {
		missing.push(t.id);
		continue;
	}
	const src = join(input, t.src);
	if (!existsSync(src)) throw new Error(`${t.id}: ${src} not found`);
	const dur = t.loop ? loopLength(t) : t.max;
	const cut = ['-ss', String(t.start || 0), '-t', dur.toFixed(6), '-i', src];
	// short fades at the cut points prevent clicks; a loop's 10 ms fades are inaudible at the bar line
	const fade = t.loop
		? `afade=t=in:d=0.01,afade=t=out:st=${(dur - 0.01).toFixed(6)}:d=0.01`
		: `afade=t=out:st=${Math.max(0, dur - 0.4).toFixed(3)}:d=0.4`;
	const m = lastJson(
		run([
			...cut,
			'-af',
			`${fade},loudnorm=I=${TARGET.I}:TP=${TARGET.TP}:LRA=${TARGET.LRA}:print_format=json`,
			'-f',
			'null',
			'-',
		]),
	);
	const norm = `loudnorm=I=${TARGET.I}:TP=${TARGET.TP}:LRA=${TARGET.LRA}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true:print_format=json`;
	const file = `${t.id}.ogg`;
	const res = lastJson(
		run([
			...cut,
			'-af',
			`${fade},${norm}`,
			'-ar',
			'48000',
			'-ac',
			'2',
			'-c:a',
			'libopus',
			'-b:a',
			'128k',
			'-y',
			join(out, file),
		]),
	);
	const entry = {
		id: t.id,
		n: t.n,
		file,
		seconds: +dur.toFixed(3),
		loop: !!t.loop,
		bytes: statSync(join(out, file)).size,
		lufs: +Number(res.output_i).toFixed(1),
		tp: +Number(res.output_tp).toFixed(1),
		src: t.src,
		suno: t.suno || null,
	};
	if (t.group) entry.group = t.group;
	if (t.loop) Object.assign(entry, { bpm: t.bpm, bars: t.bars });
	manifest.tracks.push(entry);
	console.log(
		`${t.id}: ${entry.seconds} s, ${entry.lufs} LUFS, ${Math.round(entry.bytes / 1024)} kB`,
	);
}
writeFileSync(join(out, 'manifest.json'), JSON.stringify(manifest, null, '\t') + '\n');
if (missing.length) console.log(`no source yet: ${missing.join(', ')}`);
