import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createContext, runInContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

/**
 * HOLLOW SUN voices (P1): every voiced line of Act I (the Bible's dialogs and whispers, D.vo in
 * data.js) has a file name, an English text (the game is voiced in English; Czech players read Czech
 * subtitles) and a role with a designed voice in scripts/hollowsun-vo.json; the
 * recordings made by scripts/hollowsun-vo.mjs follow the audio rules (Opus, −16 LUFS) and D32 (the
 * voice of each role, the plan and the date are recorded). Recording checks run once lines exist.
 */
const web = (p: string) => fileURLToPath(new URL('../../../' + p, import.meta.url));
interface Line {
	id: string;
	role: string;
	text: string;
	en: string;
	atEn?: string;
	at?: string;
	dur: number;
	q?: string;
	wh?: string;
}
interface Voice {
	role: string;
	n: string;
	prompt: string;
	voice: string | null;
}
interface Recorded {
	id: string;
	role: string;
	voice: string;
	file: string;
	seconds: number;
	bytes: number;
	lufs: number;
}
const ctx: Record<string, unknown> = {};
ctx.window = ctx;
createContext(ctx);
runInContext(readFileSync(web('static/games/hollowsun/js/data.js'), 'utf8'), ctx);
const data = ctx.HS_DATA as { vo: Line[]; whispers: { id: string }[] };
const cfg = JSON.parse(readFileSync(web('scripts/hollowsun-vo.json'), 'utf8')) as {
	recorded: Record<string, { plan: string | null; date: string | null }>;
	voices: Voice[];
};
interface Manifest {
	lang: string;
	plan?: string | null;
	date?: string | null;
	lines: Recorded[];
}
const sets = ['en', 'cs'].map((lang) => {
	const dir = web(`static/games/hollowsun/assets/vo/${lang}/`);
	return {
		lang,
		dir,
		manifest: JSON.parse(readFileSync(dir + 'manifest.json', 'utf8')) as Manifest,
	};
});
const recorded = sets.flatMap((x) =>
	x.manifest.lines.map((r) => ({ ...r, lang: x.lang, dir: x.dir })),
);

describe('HOLLOW SUN voice lines', () => {
	it('every line has a unique Bible-style file name and a role with a voice prompt', () => {
		const ids = data.vo.map((l) => l.id);
		expect(new Set(ids).size).toBe(ids.length);
		for (const l of data.vo) expect(l.id).toMatch(/^AU_vo_(q1_0\d_\d\d|wh_\d\d)$/);
		const roles = new Map(cfg.voices.map((v) => [v.role, v]));
		for (const l of data.vo) expect(roles.get(l.role)?.prompt.length, l.role).toBeGreaterThan(10);
		// English text for every line, English scene names for the dialog lines
		for (const l of data.vo) {
			expect(l.en.length, l.id).toBeGreaterThan(5);
			if (l.at) expect(l.atEn, l.id).toBeTruthy();
		}
		for (const x of sets) expect(x.manifest.lang).toBe(x.lang);
		// all Act I whispers are voiced
		expect(data.vo.filter((l) => l.wh).map((l) => l.wh)).toEqual(data.whispers.map((w) => w.id));
	});
});

describe.runIf(recorded.length > 0)('HOLLOW SUN voice recordings', () => {
	const voices = new Map(cfg.voices.map((v) => [v.role, v]));
	it('record the plan and date per language (D32)', () => {
		for (const x of sets.filter((y) => y.manifest.lines.length)) {
			expect(x.manifest.plan, x.lang).toBeTruthy();
			expect(x.manifest.date, x.lang).toBeTruthy();
		}
	});
	it.each(recorded)('$lang $id', (r) => {
		const dir = r.dir;
		const line = data.vo.find((l) => l.id === r.id);
		expect(line?.role).toBe(r.role);
		expect(voices.get(r.role)?.voice).toBe(r.voice);
		const bytes = new Uint8Array(readFileSync(dir + r.file));
		expect(statSync(dir + r.file).size).toBe(r.bytes);
		expect(String.fromCharCode(...bytes.slice(0, 4))).toBe('OggS');
		expect(r.lufs).toBeGreaterThan(-17.5);
		expect(r.lufs).toBeLessThan(-14.5);
		expect(r.seconds).toBeGreaterThan(0.3);
	});
});
