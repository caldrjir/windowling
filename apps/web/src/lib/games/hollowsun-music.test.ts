import { existsSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * HOLLOW SUN music (P1): the tracks made by scripts/hollowsun-music.mjs must follow the Game Design
 * Bible's audio rules (Opus, −16 LUFS, loops on bar lines, synced layers of one length) and D32
 * (an AI track names its source – the Suno link). Skipped until the first tracks exist.
 */
const dir = fileURLToPath(
	new URL('../../../static/games/hollowsun/assets/music/', import.meta.url),
);
const cfgPath = fileURLToPath(new URL('../../../scripts/hollowsun-music.json', import.meta.url));

interface Track {
	id: string;
	file: string;
	seconds: number;
	loop: boolean;
	bytes: number;
	lufs: number;
	tp: number;
	suno: string | null;
	group?: string;
	bpm?: number;
	bars?: number;
}
interface Config {
	tracks: { id: string; group?: string; bpm?: number; bars?: number; loop?: boolean }[];
}
const cfg = JSON.parse(readFileSync(cfgPath, 'utf8')) as Config;
const manifestPath = dir + 'manifest.json';
const tracks: Track[] = existsSync(manifestPath)
	? (JSON.parse(readFileSync(manifestPath, 'utf8')) as { tracks: Track[] }).tracks
	: [];

describe('HOLLOW SUN music config', () => {
	it('synced groups share one loop length', () => {
		const lens: Record<string, Set<string>> = {};
		for (const t of cfg.tracks)
			if (t.group && t.loop && t.bars && t.bpm)
				(lens[t.group] ??= new Set()).add(((t.bars * 240) / t.bpm).toFixed(6));
		for (const [g, l] of Object.entries(lens)) expect(l.size, g).toBe(1);
	});
});

describe.runIf(tracks.length > 0)('HOLLOW SUN music tracks', () => {
	it.each(tracks)('$id', (t) => {
		const bytes = new Uint8Array(readFileSync(dir + t.file));
		expect(statSync(dir + t.file).size).toBe(t.bytes);
		expect(new TextDecoder().decode(bytes.subarray(0, 4))).toBe('OggS');
		expect(new TextDecoder().decode(bytes.subarray(28, 36))).toBe('OpusHead');
		expect(Math.abs(t.lufs + 16)).toBeLessThanOrEqual(1);
		expect(t.tp).toBeLessThanOrEqual(-0.5);
		if (t.loop && t.bars && t.bpm) expect(t.seconds).toBeCloseTo((t.bars * 240) / t.bpm, 2);
		expect(t.suno, 'D32: the Suno link of an AI track').toMatch(/^https:\/\/(www\.)?suno\.com\//);
	});
});
