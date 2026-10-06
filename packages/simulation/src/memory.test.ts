import { describe, expect, it } from 'vitest';
import { DAY_MS } from './catch-up.ts';
import { howLongAgo, keywords, recall, tagsFor, type Memory } from './memory.ts';

const now = new Date('2026-10-10T12:00:00Z');
const ago = (days: number) => new Date(now.getTime() - days * DAY_MS);

const memories: Memory[] = [
	{
		kind: 'moment',
		note: 'Someone woke me up at 03:12 by knocking.',
		tags: tagsFor('woke knocking night', ['woken']),
		importance: 0.8,
		createdAt: ago(1),
	},
	{
		kind: 'moment',
		note: 'The player said they like pizza.',
		tags: tagsFor('player like pizza'),
		importance: 0.3,
		createdAt: ago(20),
	},
	{
		kind: 'fact',
		note: "The player's name is Jiri.",
		tags: tagsFor('player name jiri'),
		importance: 0.9,
		createdAt: ago(30),
	},
	{
		kind: 'moment',
		note: 'I watched the rain for a while.',
		tags: tagsFor('watched rain'),
		importance: 0.1,
		createdAt: ago(0.1),
	},
];

describe('keywords', () => {
	it('keeps content words only', () => {
		expect(keywords("Hey, what's your favourite PIZZA? I'm hungry")).toEqual([
			'hey',
			'favourite',
			'pizza',
			'hungry',
		]);
	});
});

describe('recall', () => {
	it('brings up what matters for the current moment', () => {
		const found = recall(memories, { now, cues: ['Do you like pizza?'] }, 2);
		expect(found.map((m) => m.note)).toContain('The player said they like pizza.');
	});

	it('remembers important recent events and facts without a cue', () => {
		const found = recall(memories, { now, cues: [] }, 2);
		expect(found.map((m) => m.note)).toEqual([
			"The player's name is Jiri.",
			'Someone woke me up at 03:12 by knocking.',
		]);
	});

	it('lets unimportant old moments fade behind fresh ones', () => {
		const old = { ...memories[3]!, createdAt: ago(60) };
		const fresh = { ...memories[3]!, note: 'fresh', createdAt: ago(0) };
		expect(recall([old, fresh], { now, cues: [] }, 1)[0]?.note).toBe('fresh');
	});
});

describe('howLongAgo', () => {
	it('places memories like a person would', () => {
		expect(howLongAgo(ago(0.2), now)).toBe('earlier today');
		expect(howLongAgo(ago(1), now)).toBe('yesterday');
		expect(howLongAgo(ago(3), now)).toBe('3 days ago');
		expect(howLongAgo(ago(30), now)).toBe('4 weeks ago');
	});
});
