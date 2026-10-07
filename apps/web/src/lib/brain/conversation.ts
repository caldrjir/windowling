import type { CharacterDecision, ConversationEvent, DialogueLine } from '@windowling/ai';
import type { AwarenessState } from '@windowling/shared';
import type { MomentKind } from '@windowling/simulation';

/** Something that turns "what happened" into what the character says and does. */
export interface Brain {
	decide(request: {
		event: ConversationEvent;
		awareness: AwarenessState;
		playerUtterance?: string;
		recent: DialogueLine[];
		/** With `caught`: the private moment it was caught in. */
		caughtDoing?: MomentKind;
	}): Promise<CharacterDecision | null>;
	/** A conversation is likely soon (the character is walking to the window). */
	warmUp?(): void;
	/** Diagnostics for the debug panel. */
	readonly lastSource?: BrainSource | null;
	readonly lastError?: string | null;
}

/** Where the last decision came from - shown in the debug panel (`?debug`). */
export type BrainSource = 'device' | 'cloud-llm' | 'cloud-canned' | 'local-canned';

/** The cloud brain: the server knows the character's state and reviews the result. */
export class ServerBrain implements Brain {
	lastSource: BrainSource | null = null;
	lastError: string | null = null;

	async decide(request: Parameters<Brain['decide']>[0]): Promise<CharacterDecision | null> {
		try {
			const response = await fetch('/api/ai/decide', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(request),
			});
			if (!response.ok) {
				this.lastError = `HTTP ${response.status}`;
				console.warn('The cloud brain did not answer', response.status);
				return null;
			}
			const body = (await response.json()) as { decision?: CharacterDecision; source?: string };
			this.lastError = null;
			this.lastSource = body.source === 'llm' ? 'cloud-llm' : 'cloud-canned';
			return body.decision ?? null;
		} catch (error) {
			this.lastError = String(error);
			console.warn('The cloud brain is unreachable', error);
			return null;
		}
	}
}

export interface ConversationOptions {
	brain: Brain;
	awareness: () => AwarenessState;
	/** Carry out a decision: speak, show the emotion, perform the action. */
	onDecision: (decision: CharacterDecision) => Promise<void>;
}

const MAX_LINES = 6;

/**
 * One conversation through the window. Keeps only the last few lines
 * (short-term; long-term memory arrives in Iteration 5) and never lets two
 * requests overlap - a person answers one thing at a time.
 */
export class Conversation {
	private lines: DialogueLine[] = [];
	private busy = false;
	/** What the player said while the character was still busy - answered next. */
	private waiting: string | null = null;

	constructor(private readonly options: ConversationOptions) {}

	get thinking(): boolean {
		return this.busy;
	}

	get recent(): readonly DialogueLine[] {
		return this.lines;
	}

	/**
	 * Something happened that may make the character talk. Returns false if
	 * busy - except for the player's words, which are never dropped: they are
	 * answered as soon as the character is done (the latest, if several).
	 */
	async handle(
		event: ConversationEvent,
		playerUtterance?: string,
		caughtDoing?: MomentKind,
	): Promise<boolean> {
		if (this.busy) {
			if (event !== 'player_said' || !playerUtterance) return false;
			this.waiting = playerUtterance;
			return true;
		}
		this.busy = true;
		try {
			const decision = await this.options.brain.decide({
				event,
				awareness: this.options.awareness(),
				playerUtterance,
				recent: [...this.lines],
				...(caughtDoing ? { caughtDoing } : {}),
			});
			if (playerUtterance) this.remember({ speaker: 'player', text: playerUtterance });
			if (!decision) return true;
			if (decision.speech) this.remember({ speaker: 'character', text: decision.speech });
			await this.options.onDecision(decision);
			return true;
		} finally {
			this.busy = false;
			const next = this.waiting;
			this.waiting = null;
			if (next) void this.handle('player_said', next);
		}
	}

	/** The player left or the character turned away: start fresh next time. */
	reset(): void {
		this.lines = [];
		this.waiting = null;
	}

	private remember(line: DialogueLine): void {
		this.lines = [...this.lines, line].slice(-MAX_LINES);
	}
}
