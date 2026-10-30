import { expect, test } from '@playwright/test';
import { GAMES } from '../src/lib/games/registry';
import { E2E_SITE_PASSWORD } from './gate';

// The center picks its language from the browser; the tests start in Czech.
test.use({ locale: 'cs-CZ' });

test('the game center opens with its library', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));

	await page.goto('/');
	await expect(page).toHaveTitle('Windowling Game Center');
	await expect(page.locator('.brand')).toContainText('WINDOWLING');
	await expect(page.locator('.hero-title')).toHaveText('VOIDBORN');
	// The three big games on top, no empty slots.
	await expect(page.getByTestId('shelf').locator('.gcard')).toHaveCount(3);
	// The rest of the library, sorted into genre shelves.
	const library = page.getByTestId('library');
	await expect(library.locator('.gcard')).toHaveCount(
		GAMES.filter((g) => g.group === 'puzzle').length,
	);
	await expect(page.getByTestId('shelf-logic')).toContainText('SUDOKU');
	await expect(page.getByTestId('shelf-board')).toContainText('ŠACHY');
	// How many people use the site.
	await expect(page.getByTestId('online')).toHaveText(/^\d+$/);
	expect(errors).toEqual([]);
});

test('switches language and keeps it for the games', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'EN', exact: true }).click();
	await expect(page.locator('.lib-head h2').first()).toHaveText('Featured games');
	await expect(page.getByTestId('play')).toContainText('PLAY');
	expect(await page.evaluate(() => localStorage.getItem('gamecenter.lang'))).toBe('en');
	await page.reload();
	await expect(page.locator('.lib-head h2').first()).toHaveText('Featured games');
	await page.getByRole('button', { name: 'CS', exact: true }).click();
	await expect(page.locator('.lib-head h2').first()).toHaveText('Hlavní hry');
});

test('launches VOIDBORN and comes back to the center', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await page.goto('/');
	await page.getByTestId('play').click();
	// Workers assets serve index.html as the directory URL.
	await page.waitForURL('**/games/voidborn/**');
	await expect(page).toHaveTitle('VOIDBORN');
	await expect(page.locator('#s-title')).not.toBeEmpty();
	expect(errors).toEqual([]);
	// The game returns via ../../index.html: that lands on the center.
	await page.goto('/index.html');
	await expect(page).toHaveURL(/\/$/);
	await expect(page).toHaveTitle('Windowling Game Center');
});

for (const [game, canvas] of [
	['voidborn', 'cv'],
	['starspire', 'fx'],
] as const) {
	test(`right-click in ${game} does not open the browser menu`, async ({ page }) => {
		await page.goto(`/games/${game}/index.html`);
		await expect(page.locator('#s-title')).not.toBeEmpty();
		const prevented = await page.evaluate(
			(id) =>
				!document
					.getElementById(id)
					?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })),
			canvas,
		);
		expect(prevented).toBe(true);
	});
}

test('launches STARSPIRE from the center and plays a card', async ({ page, isMobile }) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await page.goto('/');
	// First tap selects the card on the shelf, the second one launches it.
	const card = page.getByTestId('shelf').locator('.gcard').nth(1);
	await card.click();
	await expect(page.locator('.hero-title')).toHaveText('STARSPIRE');
	await card.click();
	await page.waitForURL('**/games/starspire/**');
	await expect(page).toHaveTitle('STARSPIRE');

	const tap = (selector: string) =>
		isMobile
			? page.locator(selector).first().tap({ force: true })
			: page.locator(selector).first().click({ force: true });
	await page.locator('#s-title').click();
	await tap('[data-go="heroes"]');
	await tap('[data-act="startRun"]');
	await tap('.node.avail');
	await expect(page.locator('#hand .card')).toHaveCount(5);
	await expect(page.locator('#endTurn')).toBeInViewport();
	// Tap a card, then the enemy: the card is played and costs energy.
	await tap('#hand .card');
	await tap('.enemy:not(.dead)');
	await expect(page.locator('#hand .card')).toHaveCount(4);
	expect(errors).toEqual([]);
});

test('STARSPIRE: Star Atlas, the Act IV summit and the Endless Spire', async ({
	page,
	isMobile,
}) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	const tap = (selector: string) =>
		isMobile
			? page.locator(selector).first().tap({ force: true })
			: page.locator(selector).first().click({ force: true });
	await page.goto('/games/starspire/index.html');
	await page.evaluate('SAVE.dust = 100; persist()');
	await page.locator('#s-title').click();

	// Stardust buys permanent upgrades.
	await tap('[data-go="atlas"]');
	await tap('[data-perk="vit"]');
	await expect(page.locator('.dust-bank b')).toHaveText('60');
	await tap('[data-go="menu"]');
	await tap('[data-go="heroes"]');
	await tap('[data-act="startRun"]');
	expect(await page.evaluate('R.maxHp')).toBe(85);

	// Straight to the boss of the fourth act.
	await page.evaluate(
		'R.act = 3; R.map = Run.genMap(3); R.row = 11; R.col = 0; Run.save(); UI.go("menu")',
	);
	await tap('[data-act="continue"]');
	await expect(page.locator('.map-head p')).toContainText('4 / 4');
	await tap('.node.boss');
	await expect(page.locator('.enemy')).toHaveCount(1);
	await page.evaluate(
		'B.enemies[0].block = 0; Battle.hitEnemy(B.enemies[0], 99999); Battle.finish()',
	);
	await tap('[data-act="rwDone"]');
	if (await page.locator('[data-act="skipBossRelic"]').count())
		await tap('[data-act="skipBossRelic"]');

	// The summit counts as a victory; the climb goes on into the Endless Spire.
	await expect(page.locator('.summit')).toBeVisible();
	expect(await page.evaluate('SAVE.stats.victories')).toBe(1);
	await tap('[data-act="summitGo"]');
	await tap('[data-omen]');
	expect(await page.evaluate('[R.loop, R.act, R.omens.length]')).toEqual([1, 0, 1]);
	await expect(page.locator('.tb-floor')).toContainText('52');

	await tap('[data-act="pause"]');
	await tap('[data-act="abandon"]');
	await expect(page.locator('.dust-gain')).toContainText('+');
	expect(await page.evaluate('SAVE.dust')).toBeGreaterThan(60);
	expect(errors).toEqual([]);
});

test('STARSPIRE Saga: one deck through the levels, retry after a fall', async ({
	page,
	isMobile,
}) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	const tap = (selector: string) =>
		isMobile
			? page.locator(selector).first().tap({ force: true })
			: page.locator(selector).first().click({ force: true });
	await page.goto('/games/starspire/index.html');
	await page.locator('#s-title').click();
	await tap('[data-go="heroes"]');
	await tap('[data-mode="saga"]');
	await tap('[data-act="startRun"]');
	await expect(page.locator('.map-head p')).toContainText('1');

	// Win the level with a bigger deck: the next level keeps it, on Eclipse 1.
	await page.evaluate(
		'Run.addCard("bash", true); Run.checkpoint(); R.act = 3; R.map = Run.genMap(3); R.row = 11; R.col = 0; Run.save(); UI.go("menu")',
	);
	await tap('[data-act="continueSaga"]');
	await tap('.node.boss');
	await expect(page.locator('.enemy')).toHaveCount(1);
	await page.evaluate(
		'B.enemies[0].block = 0; Battle.hitEnemy(B.enemies[0], 99999); Battle.finish()',
	);
	await tap('[data-act="rwDone"]');
	if (await page.locator('[data-act="skipBossRelic"]').count())
		await tap('[data-act="skipBossRelic"]');
	await tap('[data-act="sagaGo"]');
	expect(await page.evaluate('[R.level, R.eclipse, R.act, R.deck.length]')).toEqual([1, 1, 0, 11]);

	// A fall is not the end: the level starts again with the same deck.
	await tap('.node.avail');
	await expect(page.locator('.enemy').first()).toBeVisible();
	await page.evaluate('Battle.hurtPlayer(9999, false); Battle.finish()');
	await tap('[data-act="sagaRetry"]');
	expect(await page.evaluate('[R.level, R.hp === R.maxHp, R.deck.length]')).toEqual([1, true, 11]);
	expect(errors).toEqual([]);
});

test('background music: a default playlist per game, your own playlist, or none', async ({
	page,
}) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await page.goto('/games/sudoku/index.html');
	// The generated default playlist starts with the first touch of the page.
	await page.locator('#kMusic').click();
	await expect(page.getByTestId('music-settings')).toBeVisible();
	await expect
		.poll(() => page.evaluate('window.GCGen ? [GCGen.playing, GCGen.tracks.length] : []'))
		.toEqual([true, 4]);
	expect(await page.evaluate('GCMusic.gameMusic')).toBe(true);

	// Your own playlist: an unknown link is refused, a YouTube link is kept.
	await page.locator('[data-src="own"]').click();
	const link = page.locator('.gcm-own input[type=url]');
	await link.fill('https://example.com/song');
	await expect(page.locator('.gcm-hint')).toHaveClass(/bad/);
	await link.fill('https://www.youtube.com/playlist?list=PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG');
	await expect(page.locator('.gcm-svc i.on')).toHaveText('YouTube');
	await page.locator('[data-a="save"]').click();
	await expect(page.getByTestId('music')).toBeVisible();
	expect(await page.evaluate('[GCGen.playing, GCMusic.gameMusic]')).toEqual([false, false]);

	// The setting follows to the other games: the action games keep only their sounds.
	await page.goto('/games/voidborn/index.html');
	await expect(page.getByTestId('music')).toBeVisible();
	expect(await page.evaluate('[GCMusic.gameMusic, GCMusic.level]')).toEqual([false, 1]);

	// No music at all, set from the hub.
	await page.goto('/');
	await page.getByTestId('music-btn').click();
	await page.locator('[data-src="off"]').click();
	await page.locator('[data-a="save"]').click();
	await expect(page.getByTestId('music')).toHaveCount(0);
	expect(
		await page.evaluate(
			() => JSON.parse(localStorage.getItem('gamecenter.music') ?? '{}') as object,
		),
	).toMatchObject({ src: 'off' });
	expect(errors).toEqual([]);
});

test('VOIDBORN can be played by touch', async ({ page, context, isMobile }) => {
	test.skip(!isMobile, 'touch controls are for phones');
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await page.goto('/games/voidborn/index.html');
	await page.touchscreen.tap(100, 100);
	await page.locator('[data-go="hangar"]').tap();
	await page.locator('#startBtn').tap();
	await expect(page.locator('#dashBtn')).toBeVisible();

	// Drag a floating stick to the right: the ship follows.
	const cdp = await context.newCDPSession(page);
	const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', x = 0, y = 0) =>
		cdp.send('Input.dispatchTouchEvent', {
			type,
			touchPoints: type === 'touchEnd' ? [] : [{ x, y }],
		});
	await touch('touchStart', 120, 500);
	for (let i = 1; i <= 8; i++) await touch('touchMove', 120 + i * 8, 500);
	await expect
		// The game's state is a top-level `const G` (not on window).
		.poll(() => page.evaluate<number>('G.p.x'))
		.toBeGreaterThan(50);
	await touch('touchEnd');
	expect(errors).toEqual([]);
});

test('shows the stats a game saved in this browser', async ({ page }) => {
	await page.goto('/');
	await page.evaluate(() =>
		localStorage.setItem(
			'gamecenter.stats.voidborn',
			JSON.stringify({
				playTime: 3725,
				lastPlayed: Date.now() - 60_000,
				progress: 0.25,
				stats: { kills: 1234, sectors: 2 },
			}),
		),
	);
	await page.reload();
	await expect(page.getByTestId('play')).toContainText('POKRAČOVAT');
	await expect(page.locator('.stats')).toContainText('1');
	await expect(page.locator('.stats')).toContainText('Dobyté sektory');
	await expect(page.locator('.prog')).toContainText('25');
	await expect(page.locator('.foot')).toContainText('1 h 2 min');
});

test('signing in is offered only when Google is configured, and nobody is signed in by default', async ({
	page,
	request,
}) => {
	await page.goto('/');
	// E2E runs without Google credentials: no sign-in button, no user.
	await expect(page.getByTestId('account')).not.toContainText('Odhlásit');
	await expect(page.getByTestId('account').getByRole('button')).toHaveCount(0);
	const session = await request.get('/api/auth/get-session');
	expect(session.ok()).toBe(true);
	expect(await session.json()).toBeNull();
});

test('the service worker only cleans up caches', async ({ request }) => {
	const sw = await request.get('/service-worker.js');
	expect(sw.ok()).toBe(true);
	expect(await sw.text()).toContain('unregister');
});

test('health endpoint reports the database', async ({ request }) => {
	const response = await request.get('/api/health');
	expect(response.ok()).toBe(true);
	expect(await response.json()).toEqual({ status: 'ok', database: 'ok' });
});

test.describe('without the site password', () => {
	test.use({ storageState: { cookies: [], origins: [] } });

	test('the hub, the games and the API are locked', async ({ page, request }) => {
		await page.goto('/games/voidborn/index.html');
		await expect(page).toHaveURL(/\/gate\?next=%2Fgames%2Fvoidborn%2Findex\.html$/);
		await expect(page.locator('input[type=password]')).toBeVisible();
		expect((await request.get('/games/voidborn/js/game.js')).status()).toBe(401);
		expect((await request.get('/api/auth/get-session')).status()).toBe(401);
		expect((await request.get('/tajne/ruzek/')).status()).toBe(401);
		// The deploy smoke test still works.
		expect((await request.get('/api/health')).ok()).toBe(true);
	});

	test('the right password lets you in and back to where you were going', async ({ page }) => {
		await page.goto('/games/voidborn/index.html');
		await page.locator('input[type=password]').fill('not the password');
		await page.locator('button[type=submit]').click();
		await expect(page.getByRole('alert')).toBeVisible();

		await page.locator('input[type=password]').fill(E2E_SITE_PASSWORD);
		await page.locator('button[type=submit]').click();
		await expect(page).toHaveTitle('VOIDBORN');
		await page.goto('/');
		await expect(page).toHaveTitle('Windowling Game Center');
	});
});

test('the center shows who is playing a game right now', async ({ context, page, request }) => {
	// Another tab opens VOIDBORN; the game tells the center it is being played.
	const game = await context.newPage();
	const heartbeat = game.waitForResponse(
		(r) => r.url().endsWith('/api/presence') && r.request().method() === 'POST',
	);
	await game.goto('/games/voidborn/index.html');
	expect((await heartbeat).status()).toBe(204);

	const res = await request.get('/api/presence');
	expect(res.ok()).toBe(true);
	const { games, site } = (await res.json()) as {
		games: Record<string, { signedIn: number; anonymous: number }>;
		site: { online: number; visitors: { month: number; total: number }; accounts: number };
	};
	// Other tests play in parallel, so at least this tab is counted (nobody is signed in in E2E).
	expect(games.voidborn?.anonymous).toBeGreaterThanOrEqual(1);
	expect(Object.keys(games).sort()).toEqual(GAMES.map((g) => g.id).sort());
	// The site counts people, not tabs: this visitor is online and has been here.
	expect(site.online).toBeGreaterThanOrEqual(1);
	expect(site.visitors.total).toBeGreaterThanOrEqual(site.visitors.month);
	expect(site.visitors.month).toBeGreaterThanOrEqual(1);

	await page.goto('/');
	await expect(page.getByTestId('live')).toContainText('Právě hraje');
	await expect(page.getByTestId('live')).toContainText('anonymní');
	await expect(page.getByTestId('shelf').locator('.gc-live').first()).toBeVisible();
	// VOIDBORN is among the games played right now.
	await expect(page.getByTestId('hot')).toContainText('VOIDBORN');

	// Unknown games and malformed heartbeats are rejected.
	const bad = await request.post('/api/presence', {
		data: { client: 'abcdefgh1234', game: 'not-a-game' },
	});
	expect(bad.status()).toBe(400);
});

test('DRIFTWOOD runs on computers and is blocked on phones', async ({
	page,
	request,
	isMobile,
}) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await page.goto('/');
	const card = page.getByTestId('shelf').locator('.gcard').nth(2);
	await card.click();
	await expect(page.locator('.hero-title')).toHaveText('DRIFTWOOD');
	await expect(card.locator('.gc-badges span').first()).toHaveText('PC');

	if (isMobile) {
		await expect(page.getByTestId('play')).toBeDisabled();
		await expect(page.getByTestId('play')).toHaveText('JEN NA POČÍTAČI');
		// A second tap on the card does not launch it either, and a direct link goes back.
		await card.click();
		await expect(page).toHaveURL(/\/$/);
		await page.goto('/games/driftwood/index.html');
		await page.waitForURL((url) => url.pathname === '/');
		await expect(page).toHaveTitle('Windowling Game Center');
	} else {
		// The 3D game itself is not rendered here: headless Chrome on GPU-less CI runners
		// crashes in WebGL. The hub must launch it, and the game must be served.
		const game = await request.get('/games/driftwood/index.html');
		expect(game.ok()).toBe(true);
		expect(await game.text()).toContain('<title>DRIFTWOOD</title>');
		await page.route('**/games/driftwood/**', (route) =>
			route.fulfill({ contentType: 'text/html', body: '<title>DRIFTWOOD</title>' }),
		);
		await page.getByTestId('play').click();
		await page.waitForURL('**/games/driftwood/**');
		await expect(page).toHaveTitle('DRIFTWOOD');
	}
	expect(errors).toEqual([]);
});

test('/favicon.ico points browsers at the SVG icon', async ({ request }) => {
	const res = await request.get('/favicon.ico', { maxRedirects: 0 });
	expect(res.status()).toBe(308);
	expect(res.headers().location).toBe('/favicon.svg');
});

test('the hidden corner opens at /tajne/ruzek, unlinked and kept out of search engines', async ({
	page,
}) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await page.goto('/tajne/ruzek');
	await expect(page).toHaveURL(/\/tajne\/ruzek\/?$/);
	await expect(page).toHaveTitle('Růžek');
	await expect(page.locator('meta[name=robots]')).toHaveAttribute('content', 'noindex, nofollow');
	expect(errors).toEqual([]);
	// Nothing in the center points to it.
	await page.goto('/');
	await expect(page.locator('.brand')).toContainText('WINDOWLING');
	await expect(page.locator('a[href*="tajne"]')).toHaveCount(0);
});

test('the library filters by genre, finds games and keeps favourites', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await page.goto('/');
	const library = page.getByTestId('library');
	await expect(library.locator('.gcard').first()).toBeVisible();

	// A genre chip shows just that genre.
	await library.locator('[data-filter="board"]').click();
	await expect(library.locator('.sub')).toHaveCount(1);
	await expect(page.getByTestId('shelf-board')).toContainText('MAHJONG');
	await expect(library).not.toContainText('SUDOKU');
	await library.getByRole('tab', { name: 'Vše' }).click();

	// Search ignores case and diacritics.
	await page.getByTestId('search').fill('sachy');
	await expect(page.getByTestId('shelf-search').locator('.gcard')).toHaveCount(1);
	await expect(page.getByTestId('shelf-search')).toContainText('ŠACHY');
	await page.getByTestId('search').fill('');

	// Favourites: the star on a card, its own shelf on top and the filter; kept after reload.
	await library.locator('.gslot[data-game="sokoban"] .gc-fav').click();
	await expect(page.getByTestId('shelf-fav')).toContainText('SOKOBAN');
	await expect(library.locator('.sub').first()).toHaveAttribute('data-group', 'fav');
	expect(await page.evaluate(() => localStorage.getItem('gamecenter.favorites'))).toBe(
		'["sokoban"]',
	);
	// The big games can be favourites too, from the hero.
	await page.getByTestId('fav').click();
	await expect(page.getByTestId('fav')).toHaveAttribute('aria-pressed', 'true');
	await library.locator('[data-filter="fav"]').click();
	await expect(page.getByTestId('shelf-fav').locator('.gcard')).toHaveCount(2);
	await page.reload();
	await expect(library.locator('[data-filter="fav"]')).toHaveAttribute('aria-selected', 'true');
	await expect(page.getByTestId('shelf-fav').locator('.gcard')).toHaveCount(2);
	await library.locator('.gslot[data-game="sokoban"] .gc-fav').click();
	await expect(page.getByTestId('shelf-fav').locator('.gcard')).toHaveCount(1);

	// Sorting by name.
	await library.getByRole('tab', { name: 'Vše' }).click();
	await page.getByTestId('sort').selectOption('name');
	await expect(page.getByTestId('shelf-arcade').locator('h3').first()).toHaveText('BOMBARĎÁK');
	expect(errors).toEqual([]);
});
