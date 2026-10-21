import type { WorldSummary } from '@windowling/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CombinedBrain, useDevice, type DeviceModel } from './choose';

const world: WorldSummary = {
	id: 'w',
	createdAt: '2026-10-05T00:00:00.000Z',
	lastSimulatedAt: '2026-10-05T00:00:00.000Z',
	timeZone: 'Europe/Prague',
	character: {
		id: 'c',
		name: 'Riley',
		activity: {
			type: 'idle',
			startedAt: '2026-10-05T00:00:00.000Z',
			endsAt: '2026-10-05T01:00:00.000Z',
		},
		mood: 0.6,
		needs: { hunger: 0.2, energy: 0.9 },
		relationship: { affinity: 0, trust: 0.3, familiarity: 0 },
		money: { feeling: 'fine', justPaid: false, rentWorry: false },
		envelope: 0,
	},
};

const request = { event: 'player_at_window' as const, awareness: 'DETECTED' as const, recent: [] };

function device(answer: string | Error, usable = true): DeviceModel {
	return {
		usable,
		complete: async () => {
			if (answer instanceof Error) throw answer;
			return answer;
		},
	};
}

afterEach(() => vi.unstubAllGlobals());

describe('useDevice', () => {
	it('never uses the device model unless it is ready, and respects "cloud"', () => {
		expect(useDevice('auto', { usable: false })).toBe(false);
		expect(useDevice('auto', { usable: true })).toBe(true);
		expect(useDevice('cloud', { usable: true })).toBe(false);
	});
});

describe('CombinedBrain', () => {
	it('answers on the device and lets the simulation review the action', async () => {
		const fetchSpy = vi.fn(async (url: string) =>
			url === '/api/ai/context'
				? Response.json({ memories: [{ note: 'Someone woke me up.', when: 'yesterday' }] })
				: Response.json({ ok: true }),
		);
		vi.stubGlobal('fetch', fetchSpy);
		const brain = new CombinedBrain({
			world: () => world,
			preference: () => 'auto',
			device: device(
				'{"speech":"Hi.","emotion":"happy","intensity":0.5,"action":{"type":"sleep","target":"bed"}}',
			),
		});
		const decision = await brain.decide(request);
		expect(decision?.speech).toBe('Hi.');
		// Rested at whatever time the test runs? Not necessarily night - but never an invalid action.
		expect(['sleep', 'lookAtPlayer']).toContain(decision?.action.type);
		// Memories come from the server; what happened goes back to it - no cloud LLM call.
		const urls = fetchSpy.mock.calls.map((call) => call[0]);
		expect(urls).toContain('/api/ai/context');
		expect(urls).not.toContain('/api/ai/decide');
	});

	it('falls back to the cloud when the device model fails', async () => {
		const fetchSpy = vi.fn(async (_url: string) =>
			Response.json({
				decision: {
					speech: 'From the cloud.',
					emotion: 'neutral',
					intensity: 0.2,
					action: { type: 'lookAtPlayer' },
				},
			}),
		);
		vi.stubGlobal('fetch', fetchSpy);
		const brain = new CombinedBrain({
			world: () => world,
			preference: () => 'device',
			device: device(new Error('GPU lost')),
		});
		expect((await brain.decide(request))?.speech).toBe('From the cloud.');
		expect(fetchSpy.mock.calls.map((call) => call[0])).toContain('/api/ai/decide');
	});

	it('still says something when the server is unreachable', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response('down', { status: 503 })),
		);
		const brain = new CombinedBrain({
			world: () => world,
			preference: () => 'auto',
			device: device('', false),
		});
		const decision = await brain.decide(request);
		expect(decision?.speech).toBeTruthy();
		expect(brain.lastSource).toBe('local-canned');
		expect(brain.lastError).toBe('HTTP 503');
	});

	it('is embarrassed when caught mid-moment, even offline', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response('down', { status: 503 })),
		);
		const brain = new CombinedBrain({
			world: () => world,
			preference: () => 'auto',
			device: device('', false),
		});
		const decision = await brain.decide({ ...request, event: 'caught', caughtDoing: 'dance' });
		expect(decision?.emotion).toBe('embarrassed');
		expect(decision?.speech).toMatch(/standing there/);
	});
});
