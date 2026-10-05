import type { CharacterDecision, ConversationEvent, DialogueLine } from '@windowling/ai';
import type { AwarenessState } from '@windowling/shared';

/** Something that turns "what happened" into what the character says and does. */
export interface Brain {
	decide(request: {
		event: ConversationEvent;
		awareness: AwarenessState;
		playerUtterance?: string;
		recent: DialogueLine[];
	}): Promise<CharacterDecision | null>;
}

/** The cloud brain: the server knows the character's state and reviews the result. */
export class ServerBrain implements Brain {
	async decide(request: Parameters<Brain['decide']>[0]): Promise<CharacterDecision | null> {
		try {
			const response = await fetch('/api/ai/decide', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(request),
			});
			if (!response.ok) return null;
			const body = (await response.json()) as { decision?: CharacterDecision };
			return body.decision ?? null;
		} catch {
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

	constructor(private readonly options: ConversationOptions) {}

	get thinking(): boolean {
		return this.busy;
	}

	get recent(): readonly DialogueLine[] {
		return this.lines;
	}

	/** Something happened that may make the character talk. Returns false if busy. */
	async handle(event: ConversationEvent, playerUtterance?: string): Promise<boolean> {
		if (this.busy) return false;
		this.busy = true;
		try {
			const decision = await this.options.brain.decide({
				event,
				awareness: this.options.awareness(),
				playerUtterance,
				recent: [...this.lines],
			});
			if (playerUtterance) this.remember({ speaker: 'player', text: playerUtterance });
			if (!decision) return true;
			if (decision.speech) this.remember({ speaker: 'character', text: decision.speech });
			await this.options.onDecision(decision);
			return true;
		} finally {
			this.busy = false;
		}
	}

	/** The player left or the character turned away: start fresh next time. */
	reset(): void {
		this.lines = [];
	}

	private remember(line: DialogueLine): void {
		this.lines = [...this.lines, line].slice(-MAX_LINES);
	}
}
