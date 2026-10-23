import { describe, expect, it } from 'vitest';
import { BOARD_RE, cleanNickname, SYNC_KEY_RE } from './cloud';

describe('cloud saves', () => {
	it('keeps only the keys games use for progress', () => {
		for (const key of [
			'gamecenter.lang',
			'gamecenter.music',
			'gamecenter.puzzles',
			'gamecenter.stats.voidborn',
			'sudoku.save.v1',
			'driftwood.save.v1',
			'driftwood.nick',
			'driftwood.mp.worlds',
		])
			expect(SYNC_KEY_RE.test(key)).toBe(true);
		for (const key of [
			'gamecenter.pid',
			'gamecenter.presence',
			'other',
			'x.save.v2',
			'better-auth',
		])
			expect(SYNC_KEY_RE.test(key)).toBe(false);
	});

	it('cleans nicknames', () => {
		expect(cleanNickname('  Hvězdná   Ája ')).toBe('Hvězdná Ája');
		expect(cleanNickname('Bob_42')).toBe('Bob_42');
		expect(cleanNickname('ab')).toBeNull();
		expect(cleanNickname('x'.repeat(21))).toBeNull();
		expect(cleanNickname('<script>')).toBeNull();
		expect(cleanNickname(42)).toBeNull();
	});

	it('accepts only comparable leaderboard boards', () => {
		for (const b of [
			'daily:2026-10-23:time',
			'level:37:time',
			'free:sprint:time',
			'free:classic:score',
			'best:floor',
			'online:wins',
			'total:played',
		])
			expect(BOARD_RE.test(b)).toBe(true);
		for (const b of ['daily:today:time', 'level:1:speed', 'free:Hard:time', 'x:time', 'best'])
			expect(BOARD_RE.test(b)).toBe(false);
	});
});
