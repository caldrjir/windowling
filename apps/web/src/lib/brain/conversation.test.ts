import type { CharacterDecision } from '@windowling/ai';
import { describe, expect, it } from 'vitest';
import { Conversation, type Brain } from './conversation';

const reply = (speech: string): CharacterDecision => ({
	speech,
	emotion: 'neutral',
	intensity: 0.3,
	action: { type: 'lookAtPlayer' },
});

describe('Conversation', () => {
	it('remembers the last lines and passes them to the brain', async () => {
		const seen: unknown[] = [];
		const brain: Brain = {
			decide: async (request) => {
				seen.push(request.recent);
				return reply(`echo ${request.playerUtterance ?? 'hi'}`);
			},
		};
		const done: CharacterDecision[] = [];
		const c = new Conversation({
			brain,
			awareness: () => 'INTERACTING',
			onDecision: async (d) => void done.push(d),
		});
		await c.handle('player_at_window');
		await c.handle('player_said', 'how are you?');
		expect(done.map((d) => d.speech)).toEqual(['echo hi', 'echo how are you?']);
		expect(seen[1]).toEqual([{ speaker: 'character', text: 'echo hi' }]);
		expect(c.recent).toHaveLength(3);
	});

	it('never answers two things at once', async () => {
		let release: () => void = () => {};
		const brain: Brain = {
			decide: () => new Promise((resolve) => (release = () => resolve(reply('ok')))),
		};
		const c = new Conversation({
			brain,
			awareness: () => 'INTERACTING',
			onDecision: async () => {},
		});
		const first = c.handle('player_at_window');
		expect(await c.handle('player_said', 'hello?')).toBe(false);
		release();
		expect(await first).toBe(true);
	});
});
