import { invalidateAll } from '$app/navigation';
import type { ItemId, MoneyAskKind, MoneyOutcome } from '@windowling/shared';

/** What the character asks about money, as the server decided it. */
export interface MoneyQuestion {
	kind: MoneyAskKind;
	cents: number;
}

async function post<T>(body: unknown): Promise<T | null> {
	try {
		const response = await fetch('/api/world/money', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body),
		});
		return response.ok ? ((await response.json()) as T) : null;
	} catch (error) {
		console.warn('Money request failed', error);
		return null;
	}
}

/**
 * The player's envelope (#70): savings the character left with them, and the
 * question it is asking right now. The server keeps the books; this only
 * mirrors them for the UI.
 */
class Envelope {
	/** What the player keeps for it, in cents. */
	cents = $state(0);
	/** The question waiting for the player's answer. */
	question = $state<MoneyQuestion | null>(null);
	/** An answer is on its way (no double clicks). */
	busy = $state(false);
	private readonly listeners = new Set<(outcome: MoneyOutcome) => void>();

	/** Hear what came of every answer (the character reacts). Returns a way to stop listening. */
	listen(listener: (outcome: MoneyOutcome) => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	/** It came to the window: does it bring money up? */
	async moment(): Promise<MoneyQuestion | null> {
		const result = await post<{ ask: MoneyQuestion | null; envelope: number }>({ type: 'moment' });
		if (!result) return null;
		this.cents = result.envelope;
		this.question = result.ask ? { kind: result.ask.kind, cents: result.ask.cents } : null;
		return this.question;
	}

	/** The player's answer; null when there was nothing (any more) to answer. */
	answer(yes: boolean): Promise<MoneyOutcome | null> {
		return this.settle({ type: 'answer', yes });
	}

	/** Hand everything back, unasked. */
	giveBack(): Promise<MoneyOutcome | null> {
		return this.settle({ type: 'give_back' });
	}

	/**
	 * Buy it something from the envelope (#74). The server prices it and keeps
	 * the books; true when it is on its way.
	 */
	async buyGift(item: ItemId): Promise<boolean> {
		if (this.busy) return false;
		this.busy = true;
		try {
			const response = await fetch('/api/world/gift', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ item }),
			});
			const result = (await response.json().catch(() => null)) as {
				ok?: boolean;
				envelope?: number;
			} | null;
			if (!response.ok || !result?.ok || result.envelope === undefined) return false;
			this.cents = result.envelope;
			// Its things changed (a parcel is on the way): refresh what the page knows.
			await invalidateAll();
			return true;
		} catch (error) {
			console.warn('Could not buy the gift', error);
			return false;
		} finally {
			this.busy = false;
		}
	}

	/** The character walked off: an unanswered question lapses. */
	forget(): void {
		this.question = null;
	}

	private async settle(body: unknown): Promise<MoneyOutcome | null> {
		if (this.busy) return null;
		this.busy = true;
		try {
			const result = await post<{ outcome: MoneyOutcome; envelope: number }>(body);
			this.question = null;
			if (!result) return null;
			this.cents = result.envelope;
			for (const listener of this.listeners) listener(result.outcome);
			return result.outcome;
		} finally {
			this.busy = false;
		}
	}
}

export const envelope = new Envelope();

/** "$300" - for the envelope and the buttons. */
export function dollars(cents: number): string {
	return `$${String(Math.round(cents / 100))}`;
}
