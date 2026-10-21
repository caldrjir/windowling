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

	it('never answers two things at once, but never drops what the player said', async () => {
		const releases: Array<() => void> = [];
		const asked: Array<string | undefined> = [];
		const brain: Brain = {
			decide: (request) => {
				asked.push(request.playerUtterance);
				return new Promise((resolve) => releases.push(() => resolve(reply('ok'))));
			},
		};
		const c = new Conversation({
			brain,
			awareness: () => 'INTERACTING',
			onDecision: async () => {},
		});
		const first = c.handle('player_at_window');
		// Other events are skipped while it is busy...
		expect(await c.handle('player_silent')).toBe(false);
		// ...but the player's words wait for their turn (the latest of them).
		expect(await c.handle('player_said', 'hello?')).toBe(true);
		expect(await c.handle('player_said', 'are you there?')).toBe(true);
		expect(asked).toEqual([undefined]);
		releases[0]?.();
		await first;
		await new Promise((r) => setTimeout(r, 0));
		expect(asked).toEqual([undefined, 'are you there?']);
		releases[1]?.();
	});

	it('reacts to the player’s answer about money even while still talking', async () => {
		const releases: Array<() => void> = [];
		const events: Array<{ event: string; outcome?: string }> = [];
		const brain: Brain = {
			decide: (request) => {
				events.push({ event: request.event, outcome: request.moneyOutcome });
				return new Promise((resolve) => releases.push(() => resolve(reply('ok'))));
			},
		};
		const c = new Conversation({
			brain,
			awareness: () => 'INTERACTING',
			onDecision: async () => {},
		});
		const asking = c.handle('money_entrust', undefined, undefined, {
			moneyAsk: { kind: 'entrust', dollars: 300 },
		});
		expect(
			await c.handle('money_answered', undefined, undefined, { moneyOutcome: 'entrusted' }),
		).toBe(true);
		releases[0]?.();
		await asking;
		await new Promise((r) => setTimeout(r, 0));
		expect(events).toEqual([
			{ event: 'money_entrust', outcome: undefined },
			{ event: 'money_answered', outcome: 'entrusted' },
		]);
		releases[1]?.();
	});
});
