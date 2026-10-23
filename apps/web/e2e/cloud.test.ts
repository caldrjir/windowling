import { expect, test } from '@playwright/test';
import { createTestUser, deleteTestUsers } from './auth';
import { GATE_STATE } from './gate';

// Cloud saves: progress made on one device shows up on another after signing in, and the
// nickname picked after the first sign-in is used by the games.
test.use({ locale: 'cs-CZ' });

const users: string[] = [];
test.afterAll(async () => {
	await deleteTestUsers(users);
});

test('progress follows a signed-in player to another device', async ({
	browser,
	baseURL,
}, info) => {
	test.skip(info.project.name !== 'desktop-chromium', 'one run is enough for the server');
	const base = baseURL ?? '';
	const ann = await createTestUser('Ann Example');
	users.push(ann.id);

	// Device A: first sign-in asks for a nickname.
	const a = await browser.newContext({ storageState: GATE_STATE, locale: 'cs-CZ' });
	await ann.signIn(a, base);
	const pa = await a.newPage();
	const errors: string[] = [];
	pa.on('pageerror', (e) => errors.push(e.message));
	await pa.goto('/');
	const nick = `Ann${Date.now() % 100000}`;
	await pa.getByTestId('nick-input').fill(nick);
	await pa.getByRole('button', { name: 'Uložit' }).click();
	await expect(pa.getByTestId('account')).toContainText(nick);
	await expect(pa.getByTestId('cloud')).toHaveClass(/ok/);

	// Solve a sudoku on device A; going back to the center saves it to the account.
	await pa.goto('/games/sudoku/index.html');
	await pa.locator('[data-k="free"]').first().click();
	await expect(pa.locator('.k-gen')).toHaveCount(0, { timeout: 20_000 });
	await pa.evaluate('Kit._test.inst._solve()');
	await expect(pa.locator('.k-result')).toBeVisible();
	await pa.evaluate('GCSync.sync()');
	const stored = await pa.request.get('/api/sync');
	const body = (await stored.json()) as { saves: { key: string; data: string | null }[] };
	expect(body.saves.map((s) => s.key)).toContain('gamecenter.stats.sudoku');
	expect(body.saves.find((s) => s.key === 'gamecenter.puzzles')?.data).toContain(nick);

	// Device B: a fresh browser with the same account gets the progress and the nickname.
	const b = await browser.newContext({ storageState: GATE_STATE, locale: 'cs-CZ' });
	await ann.signIn(b, base);
	const pb = await b.newPage();
	pb.on('pageerror', (e) => errors.push(e.message));
	await pb.goto('/');
	await expect(pb.getByTestId('cloud')).toHaveClass(/ok/);
	await expect(pb.getByTestId('nick-input')).toHaveCount(0);
	const solved = await pb.evaluate(
		() =>
			(
				JSON.parse(localStorage.getItem('gamecenter.stats.sudoku') ?? '{}') as {
					stats?: { solved?: number };
				}
			).stats?.solved,
	);
	expect(solved).toBe(1);
	await pb.goto('/games/sudoku/index.html');
	await expect(pb.locator('.k-links')).toContainText('Úspěchy');
	expect(await pb.evaluate('Kit._test.save.stats.solved')).toBe(1);

	// Device C opens the game straight from a link: it reloads once into the account's progress.
	const c = await browser.newContext({ storageState: GATE_STATE, locale: 'cs-CZ' });
	await ann.signIn(c, base);
	const pc = await c.newPage();
	pc.on('pageerror', (e) => errors.push(e.message));
	await pc.goto('/games/sudoku/index.html');
	await expect
		// The page reloads once while this polls.
		.poll(
			() =>
				pc.evaluate('typeof Kit !== "undefined" && Kit._test.save.stats.solved').catch(() => -1),
			{
				timeout: 15_000,
			},
		)
		.toBe(1);

	// Opening the game on a new device must not overwrite the account with an empty save.
	await pc.evaluate('GCSync.sync()');
	const after = (await (await pc.request.get('/api/sync')).json()) as {
		saves: { key: string; data: string | null }[];
	};
	expect(after.saves.find((s) => s.key === 'gamecenter.stats.sudoku')?.data).toContain(
		'"solved":1',
	);

	expect(errors).toEqual([]);
	await a.close();
	await b.close();
	await c.close();
});

test('nicknames are unique and the cloud is for signed-in players only', async ({
	browser,
	baseURL,
	request,
}, info) => {
	test.skip(info.project.name !== 'desktop-chromium', 'one run is enough for the server');
	expect((await request.get('/api/sync')).status()).toBe(401);
	expect((await request.post('/api/profile', { data: { nickname: 'Nikdo' } })).status()).toBe(401);

	const one = await createTestUser('One');
	const two = await createTestUser('Two');
	users.push(one.id, two.id);
	const nick = `Kometa${Date.now() % 100000}`;
	for (const [u, status] of [
		[one, 200],
		[two, 409],
	] as const) {
		const ctx = await browser.newContext({ storageState: GATE_STATE });
		await u.signIn(ctx, baseURL ?? '');
		const res = await ctx.request.post('/api/profile', { data: { nickname: nick.toUpperCase() } });
		expect(res.status()).toBe(status);
		expect((await ctx.request.post('/api/profile', { data: { nickname: '<x>' } })).status()).toBe(
			400,
		);
		const bad = await ctx.request.put('/api/sync', {
			data: { saves: [{ key: 'evil', data: 'x', t: 1 }] },
		});
		expect(bad.status()).toBe(400);
		await ctx.close();
	}
});
