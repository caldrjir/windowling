import {
	characterActionSchema,
	memoryKindSchema,
	type Activity,
	type AwarenessState,
	type Relationship,
	type MoneyAskKind,
	type MoneyOutcome,
	type MoneySense,
	type RoomBelongings,
} from '@windowling/shared';
import { z } from 'zod';

export const EMOTIONS = [
	'neutral',
	'happy',
	'sad',
	'angry',
	'annoyed',
	'surprised',
	'embarrassed',
	'tired',
	'nervous',
] as const;

/**
 * The only thing a reasoning model is allowed to produce. It is a request,
 * not a command: the simulation validates it against the current state
 * before anything happens.
 */
export const characterDecisionSchema = z.object({
	speech: z.string().max(500).optional(),
	emotion: z.enum(EMOTIONS),
	intensity: z.number().min(0).max(1),
	action: characterActionSchema,
	goal: z
		.string()
		.max(64)
		.regex(/^[a-z][a-z0-9_]*$/)
		.optional(),
	/**
	 * Something worth remembering from this moment, first person ("The player
	 * told me their name is Jiri."). The server decides whether to keep it.
	 */
	remember: z
		.object({ kind: memoryKindSchema, note: z.string().trim().min(3).max(160) })
		.optional(),
});

export type CharacterDecision = z.infer<typeof characterDecisionSchema>;

export const CONVERSATION_EVENTS = [
	/** The character just came to the window because it noticed the player. */
	'player_at_window',
	/** The player knocked the character awake. */
	'woken_up',
	/** The player said something (see `playerUtterance`). */
	'player_said',
	/** The character noticed the player but decided not to come over. */
	'ignoring_player',
	/** It came over or talked, and the player said nothing back. */
	'player_silent',
	/** The player shook the phone - the whole flat shook. */
	'shaken',
	/** It noticed the player in the middle of something private (see `caughtDoing`). */
	'caught',
	/** It came over to ask the player to keep some of its savings (see `moneyAsk`). */
	'money_entrust',
	/** It came over to ask for its entrusted money back (see `moneyAsk`). */
	'money_return',
	/** The player answered a question about money (see `moneyOutcome`). */
	'money_answered',
] as const;

export type ConversationEvent = (typeof CONVERSATION_EVENTS)[number];

export interface DialogueLine {
	speaker: 'character' | 'player';
	text: string;
}

/**
 * What the reasoning layer gets to see. Only what is relevant right now -
 * never the full history (memories arrive in Iteration 5).
 */
export interface CharacterAIContext {
	characterName: string;
	/** Local wall-clock time of the character, e.g. 03:12. */
	localTime: string;
	weekday: string;
	activity: Activity;
	/** 0..1 inner state; the prompt turns these into words, never shown to the player. */
	needs: { hunger: number; energy: number; mood: number };
	/** How its money feels (never an amount). */
	money?: MoneySense;
	/** What it asks about money right now (the server decided the amount). */
	moneyAsk?: { kind: MoneyAskKind; dollars: number };
	/** With `money_answered`: what the player chose. */
	moneyOutcome?: MoneyOutcome;
	/** Savings the player is keeping for it, in whole dollars. */
	entrustedDollars?: number;
	/** Its things: in the flat, a parcel by the door, ordered (Iteration 10). */
	home?: RoomBelongings;
	awareness: AwarenessState;
	event: ConversationEvent;
	/** What the player just said, if anything. */
	playerUtterance?: string;
	/** The last few lines of this conversation, oldest first. */
	recent: DialogueLine[];
	/** A few relevant memories (already selected - never the full history). */
	memories?: Array<{ note: string; when: string }>;
	/** How the character feels about the player. */
	relationship?: Relationship;
	/** For `caught`: what it was doing, in words ("dancing", "raging at a video game"). */
	caughtDoing?: string;
	/** 0..1, how easily it is embarrassed (personality). */
	shyness?: number;
}

export interface CharacterAI {
	decide(context: CharacterAIContext): Promise<CharacterDecision>;
}

/** Parses untrusted model output. Returns null instead of throwing so callers can fall back. */
export function parseCharacterDecision(raw: unknown): CharacterDecision | null {
	const result = characterDecisionSchema.safeParse(raw);
	return result.success ? result.data : null;
}
