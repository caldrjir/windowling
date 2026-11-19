#!/usr/bin/env node
// Which E2E tests a pull request can affect (CI, .github/workflows/ci.yml, job "E2E scope").
//
// A game's tests carry its tag (`test('…', { tag: '@voidborn' }, …)`); tests of the hub and shared
// code (sign-in, sync, the APIs…) are untagged. When a PR only changes games under
// apps/web/static/games/<id>/ (plus their tests and docs), CI runs just those games' tests: a game
// is a static page of its own, so it cannot break the hub or another game. Anything else (shared
// game files, the puzzle kit, the hub, the Worker, packages, config) runs the whole suite.
//
//   node apps/web/scripts/e2e-scope.mjs <base> <head>   compare two commits
//   node apps/web/scripts/e2e-scope.mjs --full           everything (manual runs)
//
// Writes full=<true|false> and tags=<games> to $GITHUB_OUTPUT (when set) and a short summary to
// stdout and $GITHUB_STEP_SUMMARY. Playwright runs only the tags in E2E_TAGS (playwright.config.ts).
import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });

const GAMES = readdirSync(path.join(root, 'apps/web/static/games'), { withFileTypes: true })
	.filter((d) => d.isDirectory() && d.name !== 'puzzle-kit')
	.map((d) => d.name);

// Tags in a test's options: '@x', ['@x', '@y'] or a template like `@${id}` (dynamic).
function tagsOf(text) {
	const m = /\btag:\s*(\[[^\]]*\]|'[^']*'|"[^"]*"|`[^`]*`)/.exec(text);
	if (!m) return [];
	if (m[1].includes('${')) return null;
	return [...m[1].matchAll(/@([\w-]+)/g)].map((t) => t[1]);
}

// Top-level statements of a prettier-formatted test file: a line starting at column 0 opens one
// (closing brackets and comments continue the previous). Tests and describes are "test" blocks.
function blocksOf(src) {
	const blocks = [];
	src.split('\n').forEach((line, i) => {
		if (/^[^\s})\]/]/.test(line)) {
			const isTest = /^(test(\.describe|\.skip|\.fixme|\.only)?\(|for \()/.test(line);
			blocks.push({ start: i + 1, end: i + 1, test: isTest, text: '' });
		}
		const b = blocks[blocks.length - 1];
		if (b) {
			b.end = i + 1;
			if (i + 1 - b.start < 8) b.text += line + '\n';
		}
	});
	for (const b of blocks) b.tags = b.test ? tagsOf(b.text) : [];
	return blocks;
}

// Lines of `file` that changed (new side of the diff; a pure deletion counts the line after it).
function changedLines(base, head, file) {
	const lines = [];
	for (const m of git('diff', '-U0', base, head, '--', file).matchAll(
		/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm,
	)) {
		const start = Number(m[1]),
			count = m[2] === undefined ? 1 : Number(m[2]);
		for (let i = 0; i < Math.max(1, count); i++) lines.push(start + i);
	}
	return lines;
}

function scope(base, head) {
	const files = git('diff', '--name-only', base, head).split('\n').filter(Boolean);
	const games = new Set();
	for (const f of files) {
		if (f.startsWith('docs/') || f.endsWith('.md')) continue;
		const g = /^apps\/web\/static\/games\/([^/]+)\//.exec(f);
		if (g && GAMES.includes(g[1])) {
			games.add(g[1]);
			continue;
		}
		const t = /^apps\/web\/e2e\/[^/]+\.test\.ts$/.test(f);
		if (!t) return { full: f };
		const abs = path.join(root, f);
		if (!existsSync(abs)) continue; // a deleted test file runs nothing
		const blocks = blocksOf(readFileSync(abs, 'utf8'));
		// Helpers and settings at the top of a file belong to all of its tests: fine if they all
		// test the same game(s), otherwise everything runs.
		const testTags = blocks.filter((b) => b.test).map((b) => b.tags);
		const fileTags =
			testTags.length && testTags.every((x) => x && x.length && x.join() === testTags[0].join())
				? testTags[0]
				: null;
		for (const line of changedLines(base, head, f)) {
			const b = blocks.find((x) => line >= x.start && line <= x.end);
			const tags = b && b.test ? b.tags : fileTags;
			if (tags === null) return { full: `${f}:${line}` };
			for (const tag of tags) games.add(tag);
		}
	}
	return { games };
}

const args = process.argv.slice(2);
let result =
	args[0] === '--full' || args.length < 2 ? { full: 'manual run' } : scope(args[0], args[1]);
// Many games at once: the whole suite in parallel shards is faster than one long job.
if (result.games && result.games.size > 6) result = { full: `${result.games.size} games` };
const tags = result.games ? [...result.games].sort() : [];
const summary = result.full
	? `E2E: everything, four shards (${result.full})`
	: tags.length
		? `E2E: only ${tags.join(', ')}`
		: 'E2E: nothing to run (no game or shared code changed)';

console.log(summary);
if (process.env.GITHUB_OUTPUT)
	appendFileSync(
		process.env.GITHUB_OUTPUT,
		`full=${Boolean(result.full)}\ntags=${tags.join(',')}\n`,
	);
if (process.env.GITHUB_STEP_SUMMARY)
	appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
