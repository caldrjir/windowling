import type { Activity } from '@windowling/shared';
import { describe, expect, it } from 'vitest';
import { createRng } from './ambient.ts';
import {
	chooseResponse,
	initialAwareness,
	stepAwareness,
	type Awareness,
	type AwarenessEvent,
	type AwarenessInput,
} from './awareness.ts';

function run(
	inputs: AwarenessInput[],
	activity: Activity = 'idle',
	mood = 0.6,
	start: Awareness = initialAwareness(),
	seed: number | (() => number) = 1,
) {
	const rng = typeof seed === 'number' ? createRng(seed) : seed;
	let awareness = start;
	const events: AwarenessEvent[] = [];
	for (const input of inputs) {
		const step = stepAwareness(awareness, input, { activity, mood }, rng);
		awareness = step.awareness;
		events.push(...step.events);
	}
	return { awareness, events };
}

const seconds = (n: number): AwarenessInput[] =>
	Array.from({ length: n * 4 }, () => ({ type: 'tick', dt: 0.25 }) as const);

/** Share of 200 seeds in which the character noticed the player within `secs`. */
const noticedShare = (activity: Activity, secs: number) => {
	let noticed = 0;
	for (let seed = 1; seed <= 200; seed++) {
		const { events } = run(seconds(secs), activity, 0.6, initialAwareness(), seed);
		if (events.some((e) => e.type === 'detected')) noticed++;
	}
	return noticed / 200;
};

describe('stepAwareness', () => {
	it('starts unaware - opening the app is not being noticed', () => {
		expect(initialAwareness().state).toBe('UNKNOWN');
		expect(run(seconds(10), 'work').awareness.state).toBe('UNKNOWN');
		expect(noticedShare('idle', 15)).toBe(0);
	});

	it('lets you watch a busy character unnoticed for a while, even keeping still', () => {
		expect(noticedShare('work', 30)).toBeLessThan(0.1);
		expect(noticedShare('gaming', 30)).toBeLessThan(0.1);
	});

	it('notices you by itself sooner or later - you do not have to do anything', () => {
		expect(noticedShare('idle', 3 * 60)).toBeGreaterThan(0.9);
		expect(noticedShare('work', 15 * 60)).toBeGreaterThan(0.9);
		expect(noticedShare('gaming', 15 * 60)).toBeGreaterThan(0.85);
	});

	it('never notices anyone while asleep', () => {
		expect(noticedShare('sleep', 30 * 60)).toBe(0);
	});

	it('suspects before it detects', () => {
		const { events } = run(seconds(240), 'idle');
		expect(events[0]).toEqual({ type: 'suspected' });
	});

	it('movement gets noticed much faster than stillness', () => {
		const moving: AwarenessInput[] = [];
		for (let i = 0; i < 20; i++) moving.push({ type: 'movement', amount: 0.1 }, ...seconds(1));
		expect(run(moving, 'idle').awareness.state).not.toBe('UNKNOWN');
		expect(run(moving, 'gaming').awareness.state).toBe('UNKNOWN');
	});

	it('suspicion fades when the player keeps still', () => {
		const inputs: AwarenessInput[] = [{ type: 'movement', amount: 2.5 }, ...seconds(300)];
		// An rng that never makes it look up on its own: only the movement counts here.
		const { awareness, events } = run(inputs, 'work', 0.6, initialAwareness(), () => 0.999);
		expect(events.map((e) => e.type)).toEqual(['suspected', 'dismissed']);
		expect(awareness.state).toBe('UNKNOWN');
	});

	it('a knock on the glass gets an awake idle character to notice', () => {
		const { awareness, events } = run([{ type: 'knock' }], 'idle');
		expect(['DETECTED', 'IGNORING']).toContain(awareness.state);
		expect(events.some((e) => e.type === 'detected')).toBe(true);
	});

	it('a gamer may need a second knock', () => {
		expect(run([{ type: 'knock' }], 'gaming').awareness.state).toBe('SUSPECTED');
		expect(run([{ type: 'knock' }, { type: 'knock' }], 'gaming').awareness.state).not.toBe(
			'SUSPECTED',
		);
	});

	it('a sleeping character stirs on one knock and wakes on several', () => {
		const once = run([{ type: 'knock' }], 'sleep');
		expect(once.events).toEqual([{ type: 'stirred' }]);
		expect(once.awareness.state).toBe('UNKNOWN');

		const thrice = run(
			[{ type: 'knock' }, ...seconds(1), { type: 'knock' }, { type: 'knock' }],
			'sleep',
		);
		expect(thrice.events.map((e) => e.type).slice(0, 4)).toEqual([
			'stirred',
			'stirred',
			'woken',
			'detected',
		]);
	});

	it('knocks spread out over time do not wake a sleeper', () => {
		const { events } = run(
			[{ type: 'knock' }, ...seconds(10), { type: 'knock' }, ...seconds(10), { type: 'knock' }],
			'sleep',
		);
		expect(events.every((e) => e.type === 'stirred')).toBe(true);
	});

	it('comes to the window, and waves when the player responds', () => {
		const detected: Awareness = { ...initialAwareness(), state: 'DETECTED', suspicion: 1 };
		const { awareness, events } = run(
			[{ type: 'arrived' }, ...seconds(2), { type: 'knock' }],
			'idle',
			0.6,
			detected,
		);
		expect(awareness.state).toBe('INTERACTING');
		expect(events).toEqual([{ type: 'interacting' }]);
	});

	it('talking to the character at the window starts an interaction', () => {
		const detected: Awareness = { ...initialAwareness(), state: 'DETECTED', suspicion: 1 };
		const { awareness } = run([{ type: 'arrived' }, { type: 'spoke' }], 'idle', 0.6, detected);
		expect(awareness.state).toBe('INTERACTING');
		expect(run([{ type: 'spoke' }], 'sleep').events).toEqual([]);
	});

	it('gives up at the window when nothing happens', () => {
		const detected: Awareness = { ...initialAwareness(), state: 'DETECTED', suspicion: 1 };
		const { awareness, events } = run([{ type: 'arrived' }, ...seconds(15)], 'idle', 0.6, detected);
		expect(awareness.state).toBe('IGNORING');
		expect(events).toEqual([{ type: 'ignoring', reason: 'no_response' }]);
	});

	it('the interaction ends after a long silence', () => {
		const interacting: Awareness = { ...initialAwareness(), state: 'INTERACTING', suspicion: 1 };
		const { awareness, events } = run(seconds(25), 'idle', 0.6, interacting);
		expect(awareness.state).toBe('IGNORING');
		expect(events).toEqual([{ type: 'ignoring', reason: 'no_response' }]);
	});

	it('enough knocking while ignored makes it come over after all', () => {
		const ignoring: Awareness = { ...initialAwareness(), state: 'IGNORING', suspicion: 1 };
		const { events } = run(
			[{ type: 'knock' }, { type: 'knock' }, { type: 'knock' }],
			'idle',
			0.6,
			ignoring,
		);
		expect(events).toEqual([{ type: 'detected', response: 'approach' }]);
	});

	it('forgets the player after ignoring them for long', () => {
		const ignoring: Awareness = { ...initialAwareness(), state: 'IGNORING', suspicion: 1 };
		expect(run(seconds(130), 'work', 0.6, ignoring).awareness.state).toBe('UNKNOWN');
	});

	it('resets when the player leaves', () => {
		const interacting: Awareness = { ...initialAwareness(), state: 'INTERACTING', suspicion: 1 };
		const { awareness, events } = run([{ type: 'away' }], 'idle', 0.6, interacting);
		expect(awareness).toEqual(initialAwareness());
		expect(events).toEqual([{ type: 'dismissed' }]);
	});
});

describe('shaking the room', () => {
	it('is always noticed by someone awake', () => {
		const { awareness, events } = run([{ type: 'shake', intensity: 0.3 }], 'work');
		expect(events[0]).toEqual({ type: 'shaken', intensity: 0.3 });
		expect(['DETECTED', 'IGNORING']).toContain(awareness.state);
	});

	it('rocks a sleeper gently, or throws them awake', () => {
		expect(run([{ type: 'shake', intensity: 0.3 }], 'sleep').events).toEqual([{ type: 'stirred' }]);
		const hard = run([{ type: 'shake', intensity: 0.8 }], 'sleep');
		expect(hard.events.map((e) => e.type).slice(0, 3)).toEqual(['woken', 'shaken', 'detected']);
	});
});

describe('nobody home', () => {
	it('knocks and shakes go unanswered while the character is out', () => {
		expect(run([{ type: 'knock' }, { type: 'knock' }, { type: 'knock' }], 'out').events).toEqual(
			[],
		);
		expect(run([{ type: 'shake', intensity: 1 }], 'shower').awareness.state).toBe('UNKNOWN');
		expect(noticedShare('out', 30 * 60)).toBe(0);
	});

	it('forgets the player when it leaves', () => {
		const interacting: Awareness = { ...initialAwareness(), state: 'INTERACTING', suspicion: 1 };
		const { awareness, events } = run([{ type: 'tick', dt: 1 }], 'out', 0.6, interacting);
		expect(awareness.state).toBe('UNKNOWN');
		expect(events).toEqual([{ type: 'dismissed' }]);
	});
});

describe('absorbed in a moment', () => {
	it('lets you watch a dancing character much longer', () => {
		const share = (absorbed: boolean) => {
			let noticed = 0;
			for (let seed = 1; seed <= 200; seed++) {
				const rng = createRng(seed);
				let a = initialAwareness();
				for (const input of seconds(120)) {
					const step = stepAwareness(a, input, { activity: 'music', mood: 0.8, absorbed }, rng);
					a = step.awareness;
					if (step.events.some((e) => e.type === 'detected')) {
						noticed++;
						break;
					}
				}
			}
			return noticed / 200;
		};
		expect(share(true)).toBeLessThan(share(false) / 2);
	});
});

describe('chooseResponse', () => {
	const share = (activity: Activity, mood: number, woken = false) => {
		const rng = createRng(9);
		let approaches = 0;
		for (let i = 0; i < 1000; i++)
			if (chooseResponse({ activity, mood }, rng, woken) === 'approach') approaches++;
		return approaches / 1000;
	};

	it('happy idle characters come over more often than grumpy working ones', () => {
		expect(share('idle', 0.9)).toBeGreaterThan(0.8);
		expect(share('work', 0.2)).toBeLessThan(0.2);
	});

	it('freshly woken characters mostly come to complain', () => {
		expect(share('sleep', 0.3, true)).toBeGreaterThan(0.75);
	});
});
