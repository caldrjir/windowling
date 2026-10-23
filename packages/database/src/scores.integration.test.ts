import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { getTestDatabaseUrl } from '../test/test-database.ts';
import { createDatabase } from './client.ts';
import { setNickname } from './cloud.ts';
import { playerProfile, score, user } from './schema/index.ts';
import { leaderboard, submitScores } from './scores.ts';

const url = getTestDatabaseUrl();

describe.skipIf(!url)('leaderboards', () => {
	const conn = url ? createDatabase(url, { max: 1 }) : null;
	const db = () => {
		if (!conn) throw new Error('no test database');
		return conn.db;
	};

	beforeEach(async () => {
		await db().delete(score);
		await db().delete(playerProfile);
		await db().delete(user);
		await db()
			.insert(user)
			.values(['a', 'b', 'c', 'd'].map((id) => ({ id, name: id, email: `${id}@example.com` })));
		for (const id of ['a', 'b', 'c']) await setNickname(db(), id, `Hráč ${id}`);
	});
	afterAll(async () => {
		await db().delete(score);
		await db().delete(playerProfile);
		await db().delete(user);
		await conn?.close();
	});

	it('keeps the best time (lower) and the best score (higher)', async () => {
		const day = 'daily:2026-10-23:time';
		await submitScores(db(), 'a', [{ game: 'sudoku', board: day, value: 90_000 }]);
		expect(await submitScores(db(), 'a', [{ game: 'sudoku', board: day, value: 120_000 }])).toEqual(
			[],
		);
		expect(await submitScores(db(), 'a', [{ game: 'sudoku', board: day, value: 80_000 }])).toEqual([
			`sudoku/${day}`,
		]);
		await submitScores(db(), 'a', [{ game: 'fuze', board: 'free:classic:score', value: 5000 }]);
		await submitScores(db(), 'a', [{ game: 'fuze', board: 'free:classic:score', value: 3000 }]);
		const fuze = await leaderboard(db(), 'fuze', 'free:classic:score');
		expect(fuze.entries[0]?.value).toBe(5000);
		expect((await leaderboard(db(), 'sudoku', day)).entries[0]?.value).toBe(80_000);
	});

	it('ranks players, shares places on ties and lists only players with a nickname', async () => {
		const board = 'level:12:time';
		await submitScores(db(), 'a', [{ game: 'kakuro', board, value: 50_000 }]);
		await submitScores(db(), 'b', [{ game: 'kakuro', board, value: 40_000 }]);
		await submitScores(db(), 'c', [{ game: 'kakuro', board, value: 50_000 }]);
		await submitScores(db(), 'd', [{ game: 'kakuro', board, value: 1_000 }]);
		const lb = await leaderboard(db(), 'kakuro', board, { userId: 'c' });
		expect(lb.entries.map((e) => [e.rank, e.nickname, e.me])).toEqual([
			[1, 'Hráč b', false],
			[2, 'Hráč a', false],
			[2, 'Hráč c', true],
		]);
		expect(lb.me).toEqual({ rank: 2, value: 50_000 });
		expect(lb.total).toBe(3);
		// Another board of the same game is separate.
		expect((await leaderboard(db(), 'kakuro', 'level:13:time')).total).toBe(0);
	});
});
