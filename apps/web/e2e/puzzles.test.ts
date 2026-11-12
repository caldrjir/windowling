import { expect, test, type Page } from '@playwright/test';

// Puzzle games on the shared puzzle kit (static/games/puzzle-kit).
test.use({ locale: 'cs-CZ' });

const PUZZLES = [
	'sudoku',
	'nonogram',
	'kakuro',
	'pulsar',
	'fuze',
	'miny',
	'omalovanky',
	'mahjong',
	'skladacka',
	'sachy',
	'piskvorky',
	'sokoban',
	'clickomania',
	'rybky',
	'mlsoun',
	'had',
	'tanky',
	'cervici',
	'skokan',
	'vlak',
	'bombardak',
	'dama',
	'lode',
	'clovece',
	'osadnici',
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

		// The center selects the game played last and shows the stats it wrote. (Clicking the
		// selected card would launch the game, so the test only checks the selection.)
		await page.goto('/');
		await expect(page.locator(`.gslot[data-game="${id}"] .gcard`).first()).toHaveClass(/\bsel\b/);
		// Puzzles count solves, board games wins and arcade games finished runs.
		await expect(page.locator('.stats')).toContainText(/Vyřešeno|Výhry|Dokončeno/);
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

test('skokan bounces off platforms and climbs while steering', async ({ page }) => {
	await startFree(page, 'skokan', 'klasik');
	await expect(page.locator('.sk-cv')).toBeVisible();
	await page.waitForTimeout(600);
	const before = (await page.evaluate('Kit._test.inst._state()')) as { x: number };
	await page.locator('.sk-btn[data-b="r"]').dispatchEvent('pointerdown');
	await page.waitForTimeout(300);
	await page.locator('.sk-btn[data-b="r"]').dispatchEvent('pointerup');
	const after = (await page.evaluate('Kit._test.inst._state()')) as { x: number };
	expect(after.x).not.toBe(before.x);
	await page.evaluate('Kit._test.inst._auto(true); Kit._test.inst._speed(4)');
	await expect
		.poll(
			async () => ((await page.evaluate('Kit._test.inst._state()')) as { score: number }).score,
			{
				timeout: 20_000,
			},
		)
		.toBeGreaterThan(1500);
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

test("vlak plays the first original scene with the author's solution", async ({ page }) => {
	await page.goto('/games/vlak/index.html');
	await expect(page.locator('.k-hero h1')).toBeVisible();
	await page.evaluate("Kit._test.start('level', 1)");
	await expect(page.locator('.vl-cv')).toBeVisible();
	await expect(page.locator('.vl-scene')).toContainText('GOLEM');
	await page.evaluate('Kit._test.inst._auto(true); Kit._test.inst._speed(6)');
	await expect(page.locator('.k-result')).toBeVisible({ timeout: 40_000 });
	await expect(page.locator('.k-result')).toContainText('KRONE');
});

test('vlak drives the generated route, collects every item and leaves through the gate', async ({
	page,
}) => {
	await startFree(page, 'vlak', 'lehka');
	await expect(page.locator('.vl-cv')).toBeVisible();
	await page.evaluate('Kit._test.inst._auto(true); Kit._test.inst._speed(4)');
	await expect(page.locator('.k-result')).toBeVisible({ timeout: 40_000 });
	await expect(page.locator('.k-result')).toContainText(/Vlak dojel|The train made it/);
});

test('bombardak battle runs to the end with the autopilot', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await startFree(page, 'bombardak', 'souboj');
	await expect(page.locator('.bb-cv')).toBeVisible();
	await page.evaluate('Kit._test.inst._auto(true); Kit._test.inst._speed(8)');
	await expect(page.locator('.k-result')).toBeVisible({ timeout: 60_000 });
	await expect(page.locator('.k-result')).toContainText(/Vítězství|Vyřazen|Remíza/);
	expect(errors).toEqual([]);
});

test('bombardak: standing on your own bomb costs a life and restarts the arena', async ({
	page,
}) => {
	await startFree(page, 'bombardak', 'vyprava');
	await expect(page.locator('.bb-cv')).toBeVisible();
	await page.waitForFunction('Kit._test.inst._state().phase === "play"');
	await page.evaluate('Kit._test.inst._input(null, true)');
	await page.waitForFunction('Kit._test.inst._state().bombs === 1');
	await page.waitForFunction('Kit._test.inst._state().lives === 2', null, { timeout: 6_000 });
	await page.waitForFunction('Kit._test.inst._state().phase === "play"', null, { timeout: 6_000 });
	await expect(page.locator('.bb-hearts i')).toHaveCount(2);
});

test('lode: ships are dragged from the harbour onto the sea and turned by a tap', async ({
	page,
	isMobile,
}) => {
	test.skip(isMobile, 'mouse drag');
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	// Lodě has only the game against the computer, online and the score: no daily, Path or quests.
	await page.goto('/games/lode/index.html');
	await expect(page.locator('.k-score')).toBeVisible();
	await expect(page.locator('.k-daily, .k-path, .k-quests')).toHaveCount(0);
	await startFree(page, 'lode', 'ai1');
	await expect(page.locator('.ld-dship')).toHaveCount(5);
	await expect(page.locator('[data-b="ready"]')).toBeDisabled();
	const fleet = () =>
		page.evaluate('Kit._test.inst._state().fleet') as Promise<
			({ len: number; v: boolean; x: number; y: number } | null)[]
		>;
	const water = await page.locator('.ld-mine .ld-water').boundingBox();
	const hull = await page.locator('.ld-dship[data-i="0"] .ld-dhull').boundingBox();
	if (!water || !hull) throw new Error('the sea and the harbour are laid out');
	const cell = water.width / 10;
	// drag the carrier by its stern onto B2
	await page.mouse.move(hull.x + cell * 0.5, hull.y + hull.height / 2);
	await page.mouse.down();
	await page.mouse.move(water.x + cell * 1.5, water.y + cell * 1.5, { steps: 10 });
	await page.mouse.up();
	await expect(page.locator('.ld-dship')).toHaveCount(4);
	expect((await fleet())[0]).toEqual({ len: 5, v: false, x: 1, y: 1 });
	// a tap on it turns it around the tapped square
	await page.mouse.click(water.x + cell * 1.5, water.y + cell * 1.5);
	expect((await fleet())[0]).toEqual({ len: 5, v: true, x: 1, y: 1 });
	// the rest at random, then to battle; resigning counts as a loss to the cadet
	await page.locator('[data-b="shuffle"]').click();
	await expect(page.locator('[data-b="ready"]')).toBeEnabled();
	await page.locator('[data-b="ready"]').click();
	await expect(page.locator('.ld-enemy .ld-c.aim').first()).toBeVisible();
	await page.locator('[data-t="resign"]').click();
	await expect(page.locator('.k-result')).toBeVisible();
	await page.locator('#kHome').click();
	await expect(page.locator('.k-score tr')).not.toHaveCount(0);
	expect(errors).toEqual([]);
});
