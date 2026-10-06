import type { Activity } from '@windowling/shared';
import type { Needs } from './needs.ts';
import type { Personality } from './personality.ts';

/**
 * Small emergent moments inside an activity. Nothing here is a scripted
 * scene: each moment arises only from a combination of state - the activity,
 * how the character feels, who it is. Session-only and visual; what matters
 * persistently (being caught) is recorded by the server.
 */
export const MOMENT_KINDS = ['dance', 'sing', 'rage', 'cheer', 'doze', 'mutter', 'yawn'] as const;
export type MomentKind = (typeof MOMENT_KINDS)[number];

export interface Moment {
	kind: MomentKind;
	seconds: number;
	/** Embarrassing to be seen doing - it is caught if it notices the player meanwhile. */
	private: boolean;
	/** Something said to itself (subtitled in brackets), from a fixed list. */
	line?: string;
}

export interface MomentContext {
	activity: Activity;
	needs: Needs;
	personality: Personality;
}

const MUTTERINGS = [
	'Where did I put that...',
	'Okay. Okay. One thing at a time.',
	'Why is it always me?',
	'Note to self: buy milk.',
	'Hmm. Not bad, actually.',
	'Right. Focus.',
];
const RAGE_LINES = ['Come ON!', 'That was NOT fair!', 'Are you kidding me?!', 'Unbelievable!'];
const CHEER_LINES = ['Yes! YES!', 'Get in!', 'Who is the best? Me.'];
const SINGING = ['♪ la la la ♪', '♪ mm-hmm, mm-hmm ♪', '♪ ...and I said hey... ♪'];

const pick = (lines: readonly string[], rng: () => number) =>
	lines[Math.floor(rng() * lines.length)] ?? lines[0];

/** What each moment needs, how likely it is per check (~every 20 s), and how it plays. */
const RULES: ReadonlyArray<{
	kind: MomentKind;
	chance: (ctx: MomentContext) => number;
	seconds: [number, number];
	private: boolean;
	line?: (rng: () => number) => string | undefined;
}> = [
	{
		// music + good mood + exuberant (+ some energy) -> dancing
		kind: 'dance',
		chance: ({ activity, needs, personality }) =>
			activity === 'music' && needs.mood > 0.6 && needs.energy > 0.35
				? 0.15 + 0.5 * personality.exuberant
				: 0,
		seconds: [15, 40],
		private: true,
	},
	{
		kind: 'sing',
		chance: ({ activity, needs, personality }) =>
			(activity === 'music' || activity === 'cook' || activity === 'clean') && needs.mood > 0.55
				? 0.1 + 0.3 * personality.exuberant
				: 0,
		seconds: [8, 15],
		private: true,
		line: (rng) => pick(SINGING, rng),
	},
	{
		// gaming + losing (the dice) + competitive -> rage
		kind: 'rage',
		chance: ({ activity, personality, needs }) =>
			activity === 'gaming'
				? 0.08 + 0.35 * personality.competitive + (needs.mood < 0.45 ? 0.1 : 0)
				: 0,
		seconds: [4, 7],
		private: true,
		line: (rng) => pick(RAGE_LINES, rng),
	},
	{
		kind: 'cheer',
		chance: ({ activity, personality }) =>
			activity === 'gaming' ? 0.08 + 0.2 * personality.exuberant : 0,
		seconds: [3, 5],
		private: false,
		line: (rng) => pick(CHEER_LINES, rng),
	},
	{
		// tired + sitting with something passive -> nodding off
		kind: 'doze',
		chance: ({ activity, needs }) =>
			(activity === 'tv' || activity === 'read' || activity === 'work') && needs.energy < 0.3
				? 0.25 + (0.3 - needs.energy)
				: 0,
		seconds: [25, 60],
		private: true,
	},
	{
		kind: 'mutter',
		chance: ({ activity, personality }) =>
			activity === 'idle' || activity === 'cook' || activity === 'clean' || activity === 'work'
				? 0.05 + 0.25 * personality.chatty
				: 0,
		seconds: [3, 5],
		private: true,
		line: (rng) => pick(MUTTERINGS, rng),
	},
	{
		kind: 'yawn',
		chance: ({ activity, needs }) =>
			activity !== 'sleep' && activity !== 'shower' && activity !== 'out' && needs.energy < 0.35
				? 0.2
				: 0,
		seconds: [3, 4],
		private: false,
	},
];

/**
 * Maybe a moment now. Each rule rolls on its own; the first that fires wins
 * (rules are ordered from the most to the least remarkable).
 */
export function nextMoment(ctx: MomentContext, rng: () => number): Moment | null {
	for (const rule of RULES) {
		const chance = Math.min(0.9, rule.chance(ctx));
		if (chance > 0 && rng() < chance) {
			const [min, max] = rule.seconds;
			return {
				kind: rule.kind,
				seconds: min + rng() * (max - min),
				private: rule.private,
				line: rule.line?.(rng),
			};
		}
	}
	return null;
}

/** Words for what it was caught doing (memories, prompts). */
export const CAUGHT_DOING: Record<MomentKind, string> = {
	dance: 'dancing',
	sing: 'singing to myself',
	rage: 'raging at a video game',
	cheer: 'cheering at a video game',
	doze: 'dozing off',
	mutter: 'talking to myself',
	yawn: 'yawning',
};
