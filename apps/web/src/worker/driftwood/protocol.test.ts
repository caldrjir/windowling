import { describe, expect, it } from 'vitest';
import {
	cleanNick,
	CODE_RE,
	makeCode,
	MAX_CHAT,
	parseClientMessage,
	parseCreate,
} from './protocol';

const msg = (m: unknown) => parseClientMessage(JSON.stringify(m));

describe('driftwood protocol', () => {
	it('makes readable room codes', () => {
		for (let i = 0; i < 50; i++) expect(makeCode()).toMatch(CODE_RE);
		expect(CODE_RE.test('ABC10O')).toBe(false);
	});

	it('cleans nicknames', () => {
		expect(cleanNick('  Pepa\u0000  z   Depa ')).toBe('Pepa z Depa');
		expect(cleanNick('x'.repeat(50))).toHaveLength(20);
		expect(cleanNick('')).toBe('Trosečník');
		expect(cleanNick(42)).toBe('Trosečník');
	});

	it('accepts valid messages and bounds them', () => {
		expect(msg({ t: 'hello', nick: 'Ann', look: { skin: 2, hair: 99, extra: 1 } })).toEqual({
			t: 'hello',
			nick: 'Ann',
			look: { skin: 2, hair: 0, shirt: 0, pants: 0 },
		});
		expect(
			msg({ t: 's', x: 1, y: 2, z: 3, yaw: 0.5, pitch: 0.1, m: true, w: 0.4, it: 'stoneAxe' }),
		).toEqual({
			t: 's',
			x: 1,
			y: 2,
			z: 3,
			yaw: 0.5,
			pitch: 0.1,
			m: true,
			sp: false,
			sw: false,
			g: true,
			w: 0.4,
			it: 'stoneAxe',
		});
		expect(msg({ t: 'chat', text: `  ${'a'.repeat(500)}` })).toEqual({
			t: 'chat',
			text: 'a'.repeat(MAX_CHAT),
		});
		expect(msg({ t: 'node', k: 'tree', i: 12, r: 90 })).toEqual({
			t: 'node',
			k: 'tree',
			i: 12,
			r: 90,
		});
		expect(msg({ t: 'build', type: 'campfire', x: 3, z: -4, rot: 1 })).toEqual({
			t: 'build',
			type: 'campfire',
			x: 3,
			z: -4,
			rot: 1,
		});
		expect(msg({ t: 'time', hour: 13.5, day: 3 })).toEqual({ t: 'time', hour: 13.5, day: 3 });
	});

	it('rejects malformed and hostile messages', () => {
		expect(parseClientMessage('not json')).toBeNull();
		expect(parseClientMessage('x'.repeat(3000))).toBeNull();
		expect(msg({ t: 'nope' })).toBeNull();
		expect(msg({ t: 's', x: Infinity, y: 0, z: 0, yaw: 0, pitch: 0 })).toBeNull();
		expect(msg({ t: 's', x: 5000, y: 0, z: 0, yaw: 0, pitch: 0 })).toBeNull();
		expect(msg({ t: 'chat', text: '   ' })).toBeNull();
		expect(msg({ t: 'node', k: '<script>', i: 1, r: 1 })).toBeNull();
		expect(msg({ t: 'node', k: 'tree', i: 1.5, r: 1 })).toBeNull();
		expect(msg({ t: 'build', type: 'a b', x: 0, z: 0, rot: 0 })).toBeNull();
		expect(msg({ t: 'time', hour: 30, day: 1 })).toBeNull();
		// An unknown held item is dropped, not trusted.
		expect(msg({ t: 's', x: 0, y: 0, z: 0, yaw: 0, pitch: 0, it: '"><img>' })).toMatchObject({
			it: null,
		});
	});

	it('validates new worlds', () => {
		expect(parseCreate({ seed: 123, mode: 'normal', nick: 'Ann' })).toEqual({
			seed: 123,
			mode: 'normal',
			host: 'Ann',
			name: 'Ann',
		});
		expect(parseCreate({ seed: -1, mode: 'normal' })).toBeNull();
		expect(parseCreate({ seed: 1, mode: 'NOT VALID' })).toBeNull();
	});
});
