import { describe, expect, it } from 'vitest';
import {
	cleanNick,
	CODE_RE,
	makeCode,
	parseClientMessage,
	parseCreate,
	parseGame,
	seatToMove,
	standings,
} from './protocol';

const msg = (m: unknown) => parseClientMessage(JSON.stringify(m));
const PID = 'abcdefABCDEF123456';

describe('duel protocol', () => {
	it('makes readable room codes', () => {
		for (let i = 0; i < 50; i++) expect(makeCode()).toMatch(CODE_RE);
		expect(CODE_RE.test('AB1O0')).toBe(false);
	});

	it('cleans nicknames', () => {
		expect(cleanNick('  Ája\u0000  ze   hvězd ')).toBe('Ája ze hvězd');
		expect(cleanNick('')).toBe('Hvězdář');
	});

	it('accepts valid messages and bounds them', () => {
		expect(msg({ t: 'hello', pid: PID, nick: 'Ann' })).toEqual({
			t: 'hello',
			pid: PID,
			nick: 'Ann',
		});
		expect(msg({ t: 'move', n: 3, m: '85-65-0' })).toEqual({ t: 'move', n: 3, m: '85-65-0' });
		expect(msg({ t: 'end', winner: -1, why: 'stalemate' })).toEqual({
			t: 'end',
			winner: -1,
			why: 'stalemate',
		});
		expect(msg({ t: 'resign', extra: 1 })).toEqual({ t: 'resign' });
		expect(msg({ t: 'start', diff: 'hard' })).toEqual({ t: 'start', diff: 'hard' });
		expect(msg({ t: 'start' })).toEqual({ t: 'start', diff: null });
		expect(msg({ t: 'prog', p: 0.5 })).toEqual({ t: 'prog', p: 0.5 });
		expect(msg({ t: 'done', ok: true, mistakes: 2 })).toEqual({
			t: 'done',
			ok: true,
			mistakes: 2,
			score: null,
		});
		expect(msg({ t: 'done', ok: 'yes', score: 1200 })).toEqual({
			t: 'done',
			ok: false,
			mistakes: 0,
			score: 1200,
		});
	});

	it('rejects malformed messages', () => {
		expect(parseClientMessage('nope')).toBeNull();
		expect(parseClientMessage('x'.repeat(2000))).toBeNull();
		expect(msg({ t: 'hello', pid: 'short', nick: 'A' })).toBeNull();
		expect(msg({ t: 'move', n: -1, m: 'e4' })).toBeNull();
		expect(msg({ t: 'move', n: 1, m: '<script>' })).toBeNull();
		expect(msg({ t: 'end', winner: 2, why: 'mate' })).toBeNull();
		expect(msg({ t: 'prog', p: 1.5 })).toBeNull();
		expect(msg({ t: 'chat', text: '   ' })).toBeNull();
		expect(msg({ t: 'teleport' })).toBeNull();
	});

	it('validates new rooms', () => {
		expect(parseCreate({ game: 'sachy', kind: 'turn', diff: 'online', nick: 'Eva' })).toEqual({
			game: 'sachy',
			kind: 'turn',
			diff: 'online',
			host: 'Eva',
			open: true,
		});
		expect(parseCreate({ game: 'sudoku', kind: 'race', diff: 'easy', open: false })?.open).toBe(
			false,
		);
		expect(parseCreate({ game: 'sudoku', kind: 'solo', diff: 'easy' })).toBeNull();
		expect(parseCreate({ game: '../x', kind: 'race', diff: 'easy' })).toBeNull();
		expect(parseGame('piskvorky')).toBe('piskvorky');
		expect(parseGame(null)).toBeNull();
	});

	it('swaps who moves first every round', () => {
		expect([0, 1, 2].map((n) => seatToMove(0, n))).toEqual([0, 1, 0]);
		expect([0, 1, 2].map((n) => seatToMove(1, n))).toEqual([1, 0, 1]);
	});

	it('ranks a race: solved by time, then progress, then the ones who are out', () => {
		expect(
			standings({
				out: { p: 0.9, time: 50, ok: false },
				slow: { p: 1, time: 900, ok: true },
				fast: { p: 1, time: 300, ok: true },
				half: { p: 0.5 },
				most: { p: 0.8 },
			}),
		).toEqual(['fast', 'slow', 'most', 'half', 'out']);
	});
});
