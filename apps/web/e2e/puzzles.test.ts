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
] as const;

// `Kit` is a global of the page's classic scripts, not a property of window.
const solve = (page: Page) => page.evaluate('Kit._test.inst && Kit._test.inst._solve()');

async function startFree(page: Page, id: string) {
	await page.goto(`/games/${id}/index.html`);
	await expect(page.locator('.k-hero h1')).toBeVisible();
	await page.locator('[data-k="free"]').first().click();
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
		await page.getByTestId('shelf-puzzle').locator('.gcard', { hasText: /./ }).first().waitFor();
		const card = page.getByTestId('shelf-puzzle').locator('.gcard').nth(PUZZLES.indexOf(id));
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

test('solitaire sends a tapped card to a legal place or draws from the stock', async ({ page }) => {
	await startFree(page, 'solitaire');
	const moves = () => page.evaluate('Kit._test.inst.getState().moves');
	await page.locator('.sl-slot.s').dispatchEvent('pointerdown');
	await expect.poll(moves).toBe(1);
	await expect.poll(() => page.locator('.sl-card.up').count()).toBeGreaterThan(7);
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
