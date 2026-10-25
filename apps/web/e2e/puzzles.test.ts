import { expect, test, type Page } from '@playwright/test';

// Puzzle games on the shared puzzle kit (static/games/puzzle-kit).
test.use({ locale: 'cs-CZ' });

const PUZZLES = [
	'sudoku',
	'nonogram',
	'kakuro',
	'souhvezdi',
	'pulsar',
	'fuze',
	'miny',
	'omalovanky',
	'solitaire',
	'mahjong',
	'skladacka',
	'sachy',
	'piskvorky',
	'sokoban',
	'clickomania',
	'rybky',
	'mlsoun',
	'had',
	'impakt',
	'skladnik',
	'tanky',
	'cervici',
	'bubliny',
	'letni',
	'zlatokop',
] as const;

// `Kit` is a global of the page's classic scripts, not a property of window.
const solve = (page: Page) => page.evaluate('Kit._test.inst && Kit._test.inst._solve()');

async function startFree(page: Page, id: string, diff?: string) {
	await page.goto(`/games/${id}/index.html`);
	await expect(page.locator('.k-hero h1')).toBeVisible();
	await page
		.locator(diff ? `[data-k="free"][data-diff="${diff}"]` : '[data-k="free"]')
		.first()
		.click();
	await expect(page.locator('.k-gen')).toHaveCount(0, { timeout: 20_000 });
}

for (const id of PUZZLES) {
	test(`${id}: a puzzle can be solved and the center sees the progress`, async ({ page }) => {
		const errors: string[] = [];
		page.on('pageerror', (error) => errors.push(error.message));
		await startFree(page, id);
		await expect(page.locator('#kTimer')).toBeVisible();
		// The board fits the screen.
		const box = await page.locator('#kBoard').boundingBox();
		const width = page.viewportSize()?.width ?? 0;
		expect(box && box.x >= 0 && box.x + box.width <= width + 1).toBe(true);

		await solve(page);
		await expect(page.locator('.k-result')).toBeVisible({ timeout: 10_000 });
		await expect(page.locator('.k-result')).toContainText('XP');
		const stats = await page.evaluate(
			(key) => JSON.parse(localStorage.getItem(key) ?? 'null') as { stats: { solved: number } },
			`gamecenter.stats.${id}`,
		);
		expect(stats.stats.solved).toBe(1);
		await page.locator('#kHome').click();
		await expect(page.locator('.k-hero h1')).toBeVisible();

		// The center shows the stats the puzzle wrote.
		await page.goto('/');
		const card = page.locator(`.gslot[data-game="${id}"] .gcard`).first();
		await card.click();
		await expect(page.locator('.stats')).toContainText('Vyřešeno');
		expect(errors).toEqual([]);
	});
}

test('sudoku takes digits from the keyboard and counts a wrong one as a mistake', async ({
	page,
	isMobile,
}) => {
	test.skip(isMobile, 'keyboard input');
	await startFree(page, 'sudoku');
	const empty = page.locator('.sd-c:not(.given)').first();
	await empty.click();
	// Try digits until one is accepted as correct; every wrong one is a mistake.
	let mistakes = 0;
	for (let d = 1; d <= 9; d++) {
		await page.keyboard.press(String(d));
		if (!(await empty.evaluate((el) => el.classList.contains('wrong')))) break;
		mistakes++;
	}
	await expect(empty).toHaveClass(/user/);
	await expect(page.locator('#kTimer')).toContainText(mistakes ? String(mistakes) : ':');
});

test('nonogram cells are filled by tapping', async ({ page }) => {
	await startFree(page, 'nonogram');
	const cell = page.locator('.ng-c').first();
	await cell.click();
	await expect(cell).toHaveClass(/ f| x/);
});

test('constellation lines are drawn between two stars', async ({ page }) => {
	await startFree(page, 'souhvezdi');
	// Find two stars that are neighbours in the puzzle and connect them.
	const pair = await page.evaluate(() => {
		const stars = [...document.querySelectorAll<SVGGElement>('.hs-s')];
		for (const a of stars) {
			const [ax, ay] = (a.getAttribute('transform') ?? '').match(/[\d.]+/g)?.map(Number) ?? [];
			for (const b of stars) {
				if (a === b) continue;
				const [bx, by] = (b.getAttribute('transform') ?? '').match(/[\d.]+/g)?.map(Number) ?? [];
				if (ax === bx || ay === by) return [a.dataset.i, b.dataset.i];
			}
		}
		return null;
	});
	expect(pair).not.toBeNull();
	await page.locator(`.hs-s[data-i="${pair?.[0]}"]`).click();
	await page.locator(`.hs-s[data-i="${pair?.[1]}"]`).click();
	// Either a line appears or the move counts as a mistake (when the pair is not in the solution).
	await expect
		.poll(
			async () =>
				(await page.locator('.hs-l').count()) + (await page.locator('#kTimer em').count()),
		)
		.toBeGreaterThan(0);
});

test('the daily puzzle builds a streak shared with the calendar', async ({ page }) => {
	await page.goto('/games/kakuro/index.html');
	await page.locator('[data-k="daily"]').click();
	await expect(page.locator('.k-gen')).toHaveCount(0, { timeout: 20_000 });
	await solve(page);
	await expect(page.locator('.k-result')).toContainText('série 1');
	await page.locator('#kHome').click();
	await expect(page.locator('.k-daily')).toHaveClass(/done/);
	await page.locator('[data-k="calendar"]').click();
	await expect(page.locator('.k-day.today')).toHaveClass(/done/);
	// Weekly quests are shared by all puzzle games.
	await page.goto('/games/sudoku/index.html');
	await expect(page.locator('.k-quests')).toBeVisible();
	const quests = await page.evaluate(
		() =>
			JSON.parse(localStorage.getItem('gamecenter.puzzles') ?? '{}') as {
				quests: { list: unknown[] };
			},
	);
	expect(quests.quests.list).toHaveLength(3);
});

test('pulsar drops pieces from the keyboard', async ({ page, isMobile }) => {
	test.skip(isMobile, 'keyboard input');
	await startFree(page, 'pulsar');
	for (let i = 0; i < 3; i++) await page.keyboard.press('Space');
	const pieces = await page.evaluate('Kit._test.inst.getState().pieces');
	expect(pieces).toBe(3);
});

test('pulsar can be played with the touch buttons', async ({ page, isMobile }) => {
	test.skip(!isMobile, 'touch buttons are for phones');
	await startFree(page, 'pulsar');
	await page.locator('[data-b="hard"]').dispatchEvent('pointerdown');
	await expect.poll(() => page.evaluate('Kit._test.inst.getState().pieces')).toBe(1);
});

test('fuze slides bodies with a swipe or the arrows', async ({ page, isMobile }) => {
	await startFree(page, 'fuze');
	const moves = () => page.evaluate('Kit._test.inst.getState().moves');
	for (const key of ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown']) {
		if (isMobile) {
			const box = await page.locator('.fz-board').boundingBox();
			if (!box) throw new Error('no board');
			const [dx, dy] = {
				ArrowLeft: [-1, 0],
				ArrowUp: [0, -1],
				ArrowRight: [1, 0],
				ArrowDown: [0, 1],
			}[key] ?? [0, 0];
			const cx = box.x + box.width / 2;
			const cy = box.y + box.height / 2;
			await page
				.locator('.fz-board')
				.dispatchEvent('pointerdown', { clientX: cx, clientY: cy, pointerId: 1 });
			await page
				.locator('.fz-board')
				.dispatchEvent('pointerup', { clientX: cx + dx * 80, clientY: cy + dy * 80, pointerId: 1 });
		} else await page.keyboard.press(key);
	}
	await expect.poll(moves).toBeGreaterThan(0);
});

test('miny starts on the marked cell and opens an area', async ({ page }) => {
	await startFree(page, 'miny');
	const start = page.locator('.mn-c.start');
	await expect(start).toHaveCount(1);
	await start.dispatchEvent('pointerdown');
	await start.dispatchEvent('pointerup');
	await expect.poll(() => page.locator('.mn-c.o').count()).toBeGreaterThan(8);
});

test('omalovanky paints a cell with the selected colour', async ({ page }) => {
	await startFree(page, 'omalovanky');
	// Zoom in, then paint the first cell with its own colour.
	await page.locator('[data-t="find"]').click();
	const painted = await page.evaluate(() => {
		const cv = document.querySelector<HTMLCanvasElement>('.om-cv');
		if (!cv) return false;
		const r = cv.getBoundingClientRect();
		const opts = {
			clientX: r.left + r.width / 2,
			clientY: r.top + r.height / 2,
			pointerId: 1,
			bubbles: true,
		};
		cv.dispatchEvent(new PointerEvent('pointerdown', opts));
		cv.dispatchEvent(new PointerEvent('pointerup', opts));
		return true;
	});
	expect(painted).toBe(true);
	await expect
		.poll(() => page.evaluate('Kit._test.inst.getState().paint.filter((p) => p >= 0).length'))
		.toBeGreaterThan(0);
});

test('omalovanky bucket fills a whole region and moves on to the next colour', async ({ page }) => {
	await startFree(page, 'omalovanky');
	await page.locator('[data-t="bucket"]').click();
	await expect(page.locator('[data-t="bucket"]')).toHaveClass(/on/);
	// Fill every region of the rarest colour with the bucket; the palette then moves on.
	const res = (await page.evaluate(`(() => {
		const inst = Kit._test.inst, map = inst._info().map, last = Math.max(...map);
		for (let i = 0; i < map.length; i++) if (map[i] === last && inst.getState().paint[i] !== last) inst._tap(i, last, 'bucket');
		const info = inst._info();
		return { col: info.col, last, painted: info.painted, count: map.filter((c) => c === last).length };
	})()`)) as { col: number; last: number; painted: number; count: number };
	expect(res.painted).toBe(res.count);
	expect(res.col).not.toBe(res.last);
	await expect(page.locator('.om-sw.done')).toHaveCount(1);
});

test('solitaire sends a tapped card to a legal place or draws from the stock', async ({ page }) => {
	await startFree(page, 'solitaire');
	const moves = () => page.evaluate('Kit._test.inst.getState().moves');
	await page.locator('.sl-slot.s').dispatchEvent('pointerdown');
	await expect.poll(moves).toBe(1);
	await expect.poll(() => page.locator('.sl-card.up').count()).toBeGreaterThan(7);
});

test('solitaire finishes by itself once no card is face down', async ({ page }) => {
	await page.goto('/games/solitaire/index.html');
	// A Klondike game with every card but the kings home and the kings face up in the tableau.
	await page.evaluate(`(() => {
		const f = [0, 1, 2, 3].map((s) => [...Array(12)].map((_, k) => ({ id: s * 13 + k, s, r: k + 1, up: true })));
		const t = [0, 1, 2, 3].map((s) => [{ id: s * 13 + 12, s, r: 13, up: true }]).concat([[], [], []]);
		Kit._test.save.cur = { kind: 'free', key: null, diff: 'klondike1', seed: 1, time: 10, mistakes: 0, hints: 0,
			state: { S: { mode: 'klondike1', stock: [], waste: [], f, t, cells: [], draw: 1 }, hist: [], moves: 5 } };
	})()`);
	await page.reload();
	await page.locator('[data-k="resume"]').click();
	await expect(page.locator('#kModal:not([hidden]) .k-result')).toBeVisible({ timeout: 8000 });
});

test('mahjong sends tapped tiles to the tray where a matching pair vanishes', async ({ page }) => {
	await startFree(page, 'mahjong');
	const left = Number(await page.locator('.mj-left').textContent());
	await page.locator('[data-t="hint"]').click();
	const ids = await page.evaluate(() =>
		[...document.querySelectorAll<HTMLElement>('.mj-t.hint:not([hidden])')].map((e) => e.dataset.i),
	);
	expect(ids).toHaveLength(2);
	// Tiles overlap: send the click to the tile itself, not to whatever lies on top at its centre.
	await page.locator(`.mj-t[data-i="${ids[0]}"]`).dispatchEvent('click');
	await expect(page.locator('.mj-slot .mj-mini')).toHaveCount(1);
	await expect(page.locator(`.mj-t[data-i="${ids[0]}"]`)).toBeHidden();
	await page.locator(`.mj-t[data-i="${ids[1]}"]`).dispatchEvent('click');
	await expect(page.locator('.mj-left')).toHaveText(String(left - 2));
	await expect(page.locator('.mj-slot .mj-mini')).toHaveCount(0);
	// Undo brings the pair back: one on the board, one in the tray.
	await page.locator('[data-t="undo"]').click();
	await expect(page.locator('.mj-slot .mj-mini')).toHaveCount(1);
	await expect(page.locator('.mj-left')).toHaveText(String(left));
});

test('mahjong face-down tiles turn over when tapped', async ({ page }) => {
	await page.goto('/games/mahjong/index.html');
	await page.locator('[data-k="free"][data-diff="tower"]').click();
	await expect(page.locator('.mj-t').first()).toBeVisible();
	const down = page.locator('.mj-t.down:not([hidden])');
	expect(await down.count()).toBeGreaterThan(0);
	// Tap face-down tiles until a free one turns over (blocked ones only shake).
	const flipped = (await page.evaluate(`(() => {
		const opened = () => Kit._test.inst.getState().open.filter(Boolean).length;
		const before = opened();
		for (const el of document.querySelectorAll('.mj-t.down:not([hidden])')) {
			el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
			if (opened() > before) return el.dataset.i;
		}
		return null;
	})()`)) as string | null;
	expect(flipped).not.toBeNull();
	await expect(page.locator(`.mj-t[data-i="${flipped}"]`)).not.toHaveClass(/down/);
	await expect(page.locator(`.mj-t[data-i="${flipped}"]`)).toBeVisible();
});

test('skladacka snaps a piece dragged to its place', async ({ page }) => {
	await startFree(page, 'skladacka');
	await page.locator('[data-t="hint"]').click();
	await expect(page.locator('.jg-count')).toHaveText(/^1 \//);
});

test('skladacka joins matching loose pieces and picks a piece under another', async ({ page }) => {
	await startFree(page, 'skladacka');
	const I = <T>(s: string) => page.evaluate(`Kit._test.inst.${s}`) as Promise<T>;
	const drag = async (from: number[], to: number[]) => {
		await page.mouse.move(from[0], from[1]);
		await page.mouse.down();
		await page.mouse.move((from[0] + to[0]) / 2, (from[1] + to[1]) / 2, { steps: 4 });
		await page.mouse.move(to[0], to[1], { steps: 4 });
		await page.mouse.up();
	};
	// piece 1 dropped next to piece 0 joins it; the pair then moves together
	await drag(await I<number[]>('_center(1)'), await I<number[]>('_target(1, 0)'));
	expect(await I<number>('_group(0)')).toBeGreaterThanOrEqual(2);
	const before = await I<number[]>('_center(1)');
	const c0 = await I<number[]>('_center(0)');
	await drag(c0, [c0[0] + 30, c0[1] + 20]);
	const after = await I<number[]>('_center(1)');
	expect(Math.hypot(after[0] - before[0], after[1] - before[1])).toBeGreaterThan(10);
	// a piece whose transparent corner covers another one does not steal the click
	// 24 pieces: 160 px bodies, 54 px canvas margin. Piece 3 lies over the empty board, away from its
	// home; the transparent corner of piece 5 (drawn above it) covers the centre of piece 3.
	await page.evaluate('Kit._test.inst._put(3, 700, 300); Kit._test.inst._put(5, 818, 418)');
	const c3 = await I<number[]>('_center(3)');
	await drag(c3, [c3[0] + 25, c3[1] + 25]);
	const c3b = await I<number[]>('_center(3)');
	expect(c3b[0] - c3[0]).toBeGreaterThan(10);
});

test('letni runs the 100 m by alternating feet and scores points', async ({ page }) => {
	await startFree(page, 'letni', 'sprint');
	await expect(page.locator('.lh-cv')).toBeVisible();
	// The same foot twice does not count, alternating does.
	await page.waitForTimeout(2600);
	await page.keyboard.press('ArrowLeft');
	await page.keyboard.press('ArrowLeft');
	const one = (await page.evaluate('Kit._test.inst._state()')) as { v: number };
	await page.keyboard.press('ArrowRight');
	const two = (await page.evaluate('Kit._test.inst._state()')) as { v: number };
	expect(two.v).toBeGreaterThan(one.v);
	await page.evaluate('Kit._test.inst._auto(true)');
	await expect(page.locator('.k-result')).toBeVisible({ timeout: 30_000 });
	await expect(page.locator('.k-result')).toContainText(/bod/);
});

test('zlatokop drops the claw, hauls a catch and pays for it', async ({ page }) => {
	await startFree(page, 'zlatokop', 'spech');
	await expect(page.locator('.zk-cv')).toBeVisible();
	await page.locator('.zk-btn.go').click();
	const out = (await page.evaluate('Kit._test.inst._state()')) as { hook: string };
	expect(out.hook).toBe('out');
	await page.evaluate('Kit._test.inst._auto(true); Kit._test.inst._speed(8)');
	await expect
		.poll(
			async () => ((await page.evaluate('Kit._test.inst._state()')) as { money: number }).money,
			{
				timeout: 20_000,
			},
		)
		.toBeGreaterThan(0);
	await expect(page.locator('.k-result')).toBeVisible({ timeout: 30_000 });
	await expect(page.locator('.k-result')).toContainText('$');
});

test('sachy lets the player pick the promotion piece', async ({ page }) => {
	await startFree(page, 'sachy', 'duo');
	const go = async (from: string, to: string) => {
		for (const n of [from, to]) {
			const s = await page.evaluate(
				`Chess.sq(${'abcdefgh'.indexOf(n[0] ?? 'a')}, ${Number(n[1]) - 1})`,
			);
			await page.locator(`.ch-sq[data-s="${s}"]`).dispatchEvent('pointerdown');
		}
	};
	for (const [f, t] of [
		['a2', 'a4'],
		['b7', 'b5'],
		['a4', 'b5'],
		['a7', 'a6'],
		['b5', 'a6'],
		['h7', 'h6'],
		['a6', 'a7'],
		['g8', 'f6'],
		['a7', 'b8'],
	] as const)
		await go(f, t);
	await expect(page.locator('.ch-promo')).toBeVisible();
	await page.locator('.ch-promo [data-k="2"]').click();
	await expect(page.locator('.ch-moves span').last()).toHaveText('axb8=N');
});

test('sachy plays a knight move and the computer answers', async ({ page }) => {
	await startFree(page, 'sachy');
	const moves = () => page.evaluate('Kit._test.inst.getState().moves.length') as Promise<number>;
	// The board is flipped when the player has black; then the computer opens.
	const white = (await page.locator('.ch-sq').first().getAttribute('data-s')) === '21';
	if (!white) await expect.poll(moves, { timeout: 15_000 }).toBe(1);
	const [from, to] = white ? [97, 76] : [27, 46];
	const before = await moves();
	await page.locator(`.ch-sq[data-s="${from}"]`).dispatchEvent('pointerdown');
	await page.locator(`.ch-sq[data-s="${to}"]`).dispatchEvent('pointerdown');
	await expect.poll(moves, { timeout: 15_000 }).toBe(before + 2);
});

test('piskvorky places a star and the opponent answers', async ({ page }) => {
	await startFree(page, 'piskvorky');
	const stones = () => page.evaluate('Kit._test.inst.getState().hist.length') as Promise<number>;
	// The opponent may open; wait for the player's turn.
	await expect(page.locator('.gm-status')).toContainText(/Jsi na tahu|Your move/);
	const before = await stones();
	const free = await page.evaluate(() =>
		[...document.querySelectorAll<HTMLElement>('.gm-c')].findIndex(
			(c, i) => !c.innerHTML && Math.abs((i % 15) - 7) + Math.abs(Math.floor(i / 15) - 7) === 1,
		),
	);
	await page.locator(`.gm-c[data-i="${free}"]`).click();
	await expect.poll(stones).toBe(before + 2);
});

test('sokoban: the keeper pushes crates, undo takes a push back, a hint plays the next push', async ({
	page,
}) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await startFree(page, 'sokoban');
	await expect(page.locator('.sk-box')).toHaveCount(2);
	const state = () => page.evaluate('Kit._test.inst.getState().m') as Promise<string>;

	// A hint walks to the next push of the solution and pushes.
	await page.locator('[data-t="hint"]').click();
	await expect.poll(() => state()).toMatch(/[UDLR]$/);
	const after = await state();
	await page.locator('[data-t="undo"]').click();
	expect(await state()).toBe(after.slice(0, -1));

	// Arrow keys move the keeper (or bump into a wall without a move).
	const before = (await state()).length;
	for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'])
		await page.keyboard.press(key);
	expect((await state()).length).toBeGreaterThan(before);
	await page.locator('[data-t="restart"]').click();
	expect(await state()).toBe('');
	expect(errors).toEqual([]);
});

test('clickomania: a group bursts, undo brings it back, a hint follows the solution', async ({
	page,
}) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await startFree(page, 'clickomania');
	await expect(page.locator('.cm-b')).toHaveCount(64);
	const left = () => page.locator('#cmLeft').textContent();

	// The hint lights the next group of the stored solution; clicking it removes the group.
	await page.locator('[data-t="hint"]').click();
	const group = page.locator('.cm-b.hint');
	expect(await group.count()).toBeGreaterThanOrEqual(2);
	const size = await group.count();
	await group.first().click();
	await expect.poll(left).toBe(String(64 - size));
	await page.locator('[data-t="undo"]').click();
	await expect.poll(left).toBe('64');
	expect(errors).toEqual([]);
});

test('rybky: the fish follow the hint, switch, undo and get out', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await startFree(page, 'rybky');
	await expect(page.locator('.rb-f')).toHaveCount(2);
	const moves = () => page.evaluate('Kit._test.inst.getState().m.length') as Promise<number>;

	// A hint plays one move of the stored solution; undo takes it back.
	await page.locator('[data-t="hint"]').click();
	expect(await moves()).toBe(1);
	await page.locator('[data-t="undo"]').click();
	expect(await moves()).toBe(0);
	// The button switches to the other fish.
	const active = page.locator('.rb-f.active');
	const before = await active.getAttribute('data-f');
	await page.locator('[data-t="swap"]').click();
	await expect(active).toHaveAttribute('data-f', before === '1' ? '0' : '1');
	// Hints alone lead both fish out of the cave.
	for (let i = 0; i < 200 && !(await page.locator('.k-result').isVisible()); i++) {
		await page.evaluate('Kit._test.inst._hint()');
	}
	await expect(page.locator('.k-result')).toBeVisible({ timeout: 10_000 });
	expect(errors).toEqual([]);
});

test('mlsoun: the muncher eats dots, pauses, and ghosts leave their house', async ({
	page,
	isMobile,
}) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await startFree(page, 'mlsoun');
	type MlState = {
		state: string;
		eaten: number;
		score: number;
		lives: number;
		ghosts: { st: string }[];
	};
	const state = () => page.evaluate('Kit._test.inst._state()') as Promise<MlState>;
	// "Ready!" first, then play.
	await expect.poll(async () => (await state()).state, { timeout: 5000 }).toBe('play');
	// Steer with the arrows (or the pad on phones): the muncher eats dots along the corridor.
	// (The maze is random: try the four ways out of the start until one is open.)
	for (const [d, key] of [
		['l', 'ArrowLeft'],
		['r', 'ArrowRight'],
		['u', 'ArrowUp'],
		['d', 'ArrowDown'],
	]) {
		if (isMobile) await page.locator(`.ml-pad [data-d="${d}"]`).tap();
		else await page.keyboard.press(key ?? '');
		await page.waitForTimeout(700);
		if ((await state()).eaten > 1) break;
	}
	expect((await state()).eaten).toBeGreaterThan(1);
	expect((await state()).score).toBeGreaterThanOrEqual(20);
	await expect(page.locator('.ml-score')).not.toHaveText('0');
	// Ghosts come out of the house one by one.
	await expect
		.poll(async () => (await state()).ghosts.filter((g) => g.st !== 'house').length, {
			timeout: 8000,
		})
		.toBeGreaterThanOrEqual(2);
	// Pause stops the game.
	await page.locator('.ml-pause').click();
	await expect(page.locator('.ml-over')).toBeVisible();
	const frozen = (await state()).eaten;
	await page.waitForTimeout(600);
	expect((await state()).eaten).toBe(frozen);
	await page.locator('.ml-over [data-b="resume"]').click();
	await expect(page.locator('.ml-over')).toBeHidden();
	expect(errors).toEqual([]);
});

test('had: the snake waits for a direction, eats a fruit, grows and pauses', async ({
	page,
	isMobile,
}) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await startFree(page, 'had');
	type HadState = {
		started: boolean;
		eaten: number;
		score: number;
		len: number;
		head: [number, number];
	};
	const state = () => page.evaluate('Kit._test.inst._state()') as Promise<HadState>;
	await expect(page.locator('.hd-hint')).toBeVisible();
	expect((await state()).started).toBe(false);
	// A fruit right in front of the head; the first direction starts the snake.
	const [x, y] = (await state()).head;
	await page.evaluate(`Kit._test.inst._food(${x + 1}, ${y})`);
	if (isMobile) await page.locator('.hd-pad [data-d="r"]').tap();
	else await page.keyboard.press('ArrowRight');
	await expect(page.locator('.hd-hint')).toBeHidden();
	await expect.poll(async () => (await state()).eaten, { timeout: 5000 }).toBe(1);
	await expect.poll(async () => (await state()).len).toBe(5);
	expect((await state()).score).toBeGreaterThan(0);
	await expect(page.locator('.hd-goal')).toHaveText('1 / 25');
	// Pause while still in the free start row: the snake stops.
	await page.locator('.hd-pause').click();
	await expect(page.locator('.hd-over')).toBeVisible();
	const frozen = (await state()).head;
	await page.waitForTimeout(500);
	expect((await state()).head).toEqual(frozen);
	await page.locator('.hd-over [data-b="resume"]').click();
	await expect(page.locator('.hd-over')).toBeHidden();
	expect(errors).toEqual([]);
});

test('impakt: the ship moves and fires, enemies come, a special weapon and the boss work', async ({
	page,
	isMobile,
}) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await startFree(page, 'impakt');
	type IpState = {
		ship: { x: number; y: number };
		shots: number;
		foes: number;
		boss: { hp: number } | null;
		special: string | null;
		charges: number;
		retro: boolean;
	};
	const state = () => page.evaluate('Kit._test.inst._state()') as Promise<IpState>;
	// (Enemies must not end the run while the test looks at the controls.)
	await page.evaluate('Kit._test.inst._god()');
	// The ship fires on its own and enemy waves arrive.
	await expect.poll(async () => (await state()).shots, { timeout: 5000 }).toBeGreaterThan(0);
	await expect.poll(async () => (await state()).foes, { timeout: 8000 }).toBeGreaterThan(0);
	// Moving: keys on computers, dragging on phones.
	const y0 = (await state()).ship.y;
	if (isMobile) {
		const box = await page.locator('.ip-board').boundingBox();
		if (!box) throw new Error('no board');
		await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
		await page.mouse.down();
		await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - 40, { steps: 5 });
		await page.mouse.up();
	} else {
		await page.keyboard.down('ArrowUp');
		await page.waitForTimeout(400);
		await page.keyboard.up('ArrowUp');
	}
	expect((await state()).ship.y).toBeLessThan(y0);
	// A carrier's bonus gives the special weapon; Space (or the button) fires it.
	await page.evaluate("Kit._test.inst._give('missile')");
	await expect.poll(async () => (await state()).special).toBe('missile');
	if (isMobile) await page.locator('.ip-fire').tap();
	else await page.keyboard.press(' ');
	await expect.poll(async () => (await state()).charges).toBe(2);
	// The boss comes at the end of the sector.
	await page.evaluate('Kit._test.inst._boss()');
	await expect
		.poll(async () => (await state()).boss?.hp ?? 0, { timeout: 5000 })
		.toBeGreaterThan(0);
	// The retro screen switch.
	await page.locator('.ip-retro').click();
	await expect(page.locator('.ip-wrap')).toHaveClass(/retro/);
	expect((await state()).retro).toBe(true);
	expect(errors).toEqual([]);
});

test('skladnik: the worker pushes a crate, jumps onto it, and a full row disappears', async ({
	page,
	isMobile,
}) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await startFree(page, 'skladnik');
	type SkState = { worker: { c: number; r: number }; rows: number; score: number };
	const I = 'Kit._test.inst';
	const state = () => page.evaluate(`${I}._state()`) as Promise<SkState>;
	const row = (y: number) => page.evaluate(`${I}._row(${y})`) as Promise<string>;
	const right = () =>
		isMobile ? page.locator('.sk-pad [data-m="1"]').tap() : page.keyboard.press('ArrowRight');
	const jump = () =>
		isMobile ? page.locator('.sk-pad [data-j]').tap() : page.keyboard.press('ArrowUp');
	// An empty warehouse with no cranes, the worker on the floor and a crate next to him.
	await page.evaluate(`${I}._calm(); ${I}._clear(5, 10); ${I}._place(6, 10)`);
	await right();
	await expect.poll(() => row(10)).toBe('.......b....');
	await expect.poll(async () => (await state()).worker.c).toBe(6);
	// Jump and step onto the crate.
	await jump();
	await page.waitForTimeout(60);
	await right();
	await expect.poll(async () => (await state()).worker).toEqual({ c: 7, r: 9, dead: 0 });
	// Jumping while holding a direction lands again (no walking on air).
	await page.evaluate(`${I}._clear(2, 10)`);
	if (isMobile) {
		await page.locator('.sk-pad [data-j]').tap();
		await page.locator('.sk-pad [data-m="1"]').dispatchEvent('pointerdown');
		await page.waitForTimeout(900);
		await page.locator('.sk-pad [data-m="1"]').dispatchEvent('pointerup');
	} else {
		await page.keyboard.press('ArrowUp');
		await page.keyboard.down('ArrowRight');
		await page.waitForTimeout(900);
		await page.keyboard.up('ArrowRight');
	}
	await expect.poll(async () => (await state()).worker.r).toBe(10);
	// (moved right at least one cell; how far depends on the frame rate)
	expect((await state()).worker.c).toBeGreaterThan(2);
	// A full row disappears and scores.
	await page.evaluate(
		`${I}._clear(5, 9); for (let x = 0; x < 12; x++) ${I}._place(x, 10); ${I}._check()`,
	);
	await expect.poll(async () => (await state()).rows).toBe(1);
	expect(await row(10)).toBe('............');
	expect((await state()).score).toBeGreaterThan(0);
	await expect(page.locator('.sk-rows')).toHaveText('1 / 8');
	expect(errors).toEqual([]);
});

test('tanky: two players on one device take turns, and a resignation names the winner', async ({
	page,
}) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await page.goto('/games/tanky/index.html');
	await page.locator('[data-k="free"][data-diff="duo"]').click();
	await expect(page.locator('.tk-board')).toBeVisible();
	type TkState = {
		active: number;
		phase: string;
		turn: number;
		tanks: { ang: number; pw: number }[];
	};
	const state = () => page.evaluate('Kit._test.inst._state()') as Promise<TkState>;
	await expect.poll(async () => (await state()).phase).toBe('aim');
	// The sliders aim the active tank.
	await page.locator('.tk-ang').fill('60');
	await page.locator('.tk-pw').fill('70');
	expect((await state()).tanks[0]).toMatchObject({ ang: 60, pw: 70 });
	await page.locator('.tk-fire').click();
	await expect.poll(async () => (await state()).phase).not.toBe('aim');
	// Then it is player 2's turn, on the same controls.
	await expect.poll(async () => (await state()).active, { timeout: 15_000 }).toBe(1);
	await expect.poll(async () => (await state()).phase).toBe('aim');
	await expect(page.locator('.tk-fire')).toBeEnabled();
	await page.locator('[data-c="resign"]').click();
	await expect(page.locator('.k-result')).toContainText('Vyhrál Hráč 1');
	expect(errors).toEqual([]);
});

test('cervici: two teams take turns on one device; a shot changes the island', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await page.goto('/games/cervici/index.html');
	await page.locator('[data-k="free"][data-diff="duo"]').click();
	await expect(page.locator('.cv-board')).toBeVisible();
	type CvState = { team: number; phase: string; turn: number; cur: number; moves: number };
	const state = () => page.evaluate('Kit._test.inst._state()') as Promise<CvState>;
	await expect.poll(async () => (await state()).phase).toBe('move');
	expect((await state()).team).toBe(0);
	// Walk a bit, then a bazooka shot; after the retreat time the other team plays.
	await page.locator('.cv-pad [data-c="r"]').dispatchEvent('pointerdown');
	await page.waitForTimeout(300);
	await page.locator('.cv-pad [data-c="r"]').dispatchEvent('pointerup');
	await page.evaluate('Kit._test.inst._aim(35, 0.6); Kit._test.inst._fire()');
	await expect.poll(async () => (await state()).phase).not.toBe('move');
	await expect.poll(async () => (await state()).team, { timeout: 20_000 }).toBe(1);
	await expect.poll(async () => (await state()).phase).toBe('move');
	expect((await state()).moves).toBe(1);
	// Ending a turn without firing passes it on as well.
	await page.locator('[data-c="skip"]').click();
	await expect.poll(async () => (await state()).turn, { timeout: 15_000 }).toBe(2);
	await page.locator('[data-c="resign"]').click();
	await expect(page.locator('.k-result')).toContainText('Vyhrál Hráč 2');
	expect(errors).toEqual([]);
});

test('bubliny: a shot sticks to the cluster, swap and pause work', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await startFree(page, 'bubliny');
	type BbState = { shots: number; left: number; flying: boolean; ammo: number[] };
	const state = () => page.evaluate('Kit._test.inst._state()') as Promise<BbState>;
	const before = await state();
	// Swap exchanges the cannon bubble with the next one.
	await page.locator('[data-b="swap"]').click();
	expect((await state()).ammo).toEqual([before.ammo[1], before.ammo[0]]);
	// A shot straight up flies and lands in the cluster (it sticks or pops a group).
	await page.evaluate('Kit._test.inst._aim(90); Kit._test.inst._shoot()');
	await expect.poll(async () => (await state()).shots).toBe(1);
	await expect.poll(async () => (await state()).flying).toBe(false);
	expect((await state()).left).not.toBe(before.left);
	await page.locator('[data-b="pause"]').click();
	await expect(page.locator('.bb-over')).toBeVisible();
	await page.locator('.bb-over [data-b="resume"]').click();
	await expect(page.locator('.bb-over')).toBeHidden();
	expect(errors).toEqual([]);
});
