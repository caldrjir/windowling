import { expect, test, type Page } from '@playwright/test';

// Puzzle games on the shared puzzle kit (static/games/puzzle-kit).
test.use({ locale: 'cs-CZ' });

const PUZZLES = ['sudoku', 'nonogram', 'kakuro', 'souhvezdi'] as const;

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
