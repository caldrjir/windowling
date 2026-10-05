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
		const fetchSpy = vi.fn();
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
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it('falls back to the cloud when the device model fails', async () => {
		const fetchSpy = vi.fn(async () =>
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
		expect(fetchSpy).toHaveBeenCalledOnce();
	});
});
