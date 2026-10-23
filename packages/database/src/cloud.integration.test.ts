import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { getTestDatabaseUrl } from '../test/test-database.ts';
import { createDatabase } from './client.ts';
import { getNickname, listSaves, MAX_SAVE_VALUE, putSaves, setNickname } from './cloud.ts';
import { gameSave, playerProfile, user } from './schema/index.ts';

const url = getTestDatabaseUrl();

describe.skipIf(!url)('cloud saves and nicknames', () => {
	const conn = url ? createDatabase(url, { max: 1 }) : null;
	const db = () => {
		if (!conn) throw new Error('no test database');
		return conn.db;
	};

	beforeEach(async () => {
		await db().delete(gameSave);
		await db().delete(playerProfile);
		await db().delete(user);
		await db()
			.insert(user)
			.values([
				{ id: 'u1', name: 'Ann', email: 'ann@example.com' },
				{ id: 'u2', name: 'Bob', email: 'bob@example.com' },
			]);
	});
	afterAll(async () => {
		await db().delete(gameSave);
		await db().delete(playerProfile);
		await db().delete(user);
		await conn?.close();
	});

	it('keeps the newest write per key and per player', async () => {
		await putSaves(db(), 'u1', [
			{ key: 'sudoku.save.v1', data: '{"xp":10}', t: 100 },
			{ key: 'gamecenter.lang', data: 'cs', t: 100 },
		]);
		// An older write from another device does not overwrite a newer one.
		const older = await putSaves(db(), 'u1', [
			{ key: 'sudoku.save.v1', data: '{"xp":5}', t: 50 },
			{ key: 'gamecenter.lang', data: 'en', t: 200 },
		]);
		expect(older.stored).toEqual(['gamecenter.lang']);
		await putSaves(db(), 'u2', [{ key: 'sudoku.save.v1', data: '{"xp":99}', t: 1 }]);

		const saves = await listSaves(db(), 'u1');
		expect(saves.sort((a, b) => a.key.localeCompare(b.key))).toEqual([
			{ key: 'gamecenter.lang', data: 'en', t: 200 },
			{ key: 'sudoku.save.v1', data: '{"xp":10}', t: 100 },
		]);
	});

	it('remembers removed keys and refuses accounts that grow too large', async () => {
		await putSaves(db(), 'u1', [{ key: 'driftwood.save.v1', data: 'x', t: 1 }]);
		await putSaves(db(), 'u1', [{ key: 'driftwood.save.v1', data: null, t: 2 }]);
		expect(await listSaves(db(), 'u1')).toEqual([{ key: 'driftwood.save.v1', data: null, t: 2 }]);

		const big = 'x'.repeat(MAX_SAVE_VALUE);
		const entries = [...Array(9)].map((_, i) => ({ key: `k${i}`, data: big, t: 5 }));
		expect((await putSaves(db(), 'u1', entries)).rejected).toBe('too-large');
	});

	it('gives every nickname to one player only, whatever the letter case', async () => {
		expect(await getNickname(db(), 'u1')).toBeNull();
		expect(await setNickname(db(), 'u1', 'Hvězdář')).toBe(true);
		expect(await setNickname(db(), 'u2', 'hvězdář')).toBe(false);
		expect(await setNickname(db(), 'u1', 'Kometa')).toBe(true);
		expect(await getNickname(db(), 'u1')).toBe('Kometa');
		expect(await setNickname(db(), 'u2', 'Hvězdář')).toBe(true);
	});
});
