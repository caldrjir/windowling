import type { MemoryKind } from '@windowling/shared';
import { DAY_MS } from './catch-up.ts';

/**
 * Something the character remembers. Notes are first person ("Someone woke
 * me up at 03:12."), short, and only ever shown to the brain - never to the
 * player as data.
 */
export interface Memory {
	kind: MemoryKind;
	note: string;
	tags: string[];
	/** 0..1 */
	importance: number;
	createdAt: Date;
}

export interface RecallQuery {
	now: Date;
	/** What is happening right now, as words (event, what the player said...). */
	cues: string[];
}

/** Moments fade: after this long they count half as "recent". */
export const MEMORY_HALF_LIFE_DAYS = 3;

const STOPWORDS = new Set(
	'the and you your for are was were that this with have has had not but what when where who how why can just its it’s i’m dont don’t about into from they them then than there their our out all any too very really yeah okay well'.split(
		' ',
	),
);

/** Lowercase content words (3+ letters), deduplicated. */
export function keywords(text: string): string[] {
	const words = text.toLowerCase().match(/[a-z]{3,}/g) ?? [];
	return [...new Set(words.filter((w) => !STOPWORDS.has(w)))];
}

/** Tags for a new memory: its keywords plus explicit ones (e.g. the event type). */
export function tagsFor(note: string, extra: string[] = []): string[] {
	return [...new Set([...extra.map((t) => t.toLowerCase()), ...keywords(note)])].slice(0, 16);
}

/**
 * Generative-agents style score: importance, recency and relevance, each
 * 0..1. Facts don't fade - you don't forget someone's name after a week.
 */
export function scoreMemory(memory: Memory, query: RecallQuery, cueWords: Set<string>): number {
	const ageDays = Math.max(0, query.now.getTime() - memory.createdAt.getTime()) / DAY_MS;
	const recency = memory.kind === 'fact' ? 1 : 0.5 ** (ageDays / MEMORY_HALF_LIFE_DAYS);
	const overlap = memory.tags.filter((tag) => cueWords.has(tag)).length;
	const relevance = cueWords.size === 0 ? 0 : Math.min(1, overlap / Math.min(3, cueWords.size));
	return memory.importance * 0.3 + recency * 0.2 + relevance * 0.5;
}

/** The few memories worth bringing up right now, best first. */
export function recall<T extends Memory>(memories: T[], query: RecallQuery, limit = 6): T[] {
	const cueWords = new Set(query.cues.flatMap((cue) => keywords(cue)));
	return memories
		.map((memory) => ({ memory, score: scoreMemory(memory, query, cueWords) }))
		.sort((a, b) => b.score - a.score)
		.slice(0, limit)
		.map(({ memory }) => memory);
}

/** "3 days ago", "yesterday", "earlier today" - how a person places a memory. */
export function howLongAgo(then: Date, now: Date): string {
	const days = Math.floor((now.getTime() - then.getTime()) / DAY_MS);
	if (days <= 0) return 'earlier today';
	if (days === 1) return 'yesterday';
	if (days < 7) return `${days} days ago`;
	if (days < 14) return 'last week';
	if (days < 60) return `${Math.round(days / 7)} weeks ago`;
	return 'a long time ago';
}
