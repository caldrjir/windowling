import type { AwarenessState } from '@windowling/shared';
import {
	createRng,
	initialAwareness,
	stepAwareness,
	type Awareness,
	type AwarenessContext,
	type AwarenessEvent,
	type AwarenessInput,
} from '@windowling/simulation';

const TICK_MS = 250;

export interface WatcherOptions {
	/** What the character is doing right now and how it feels. */
	context: () => AwarenessContext;
	onEvent: (event: AwarenessEvent) => void;
	onState: (state: AwarenessState) => void;
}

/**
 * Feeds what the player does (being there, moving, knocking) into the
 * simulation's awareness model. Only collects signals - the model decides
 * whether the character noticed anything.
 */
export class Watcher {
	private awareness: Awareness = initialAwareness();
	private readonly rng = createRng(Math.floor(Math.random() * 2 ** 32));
	private timer: ReturnType<typeof setInterval> | undefined;
	private last = 0;
	private movement = 0;

	constructor(private readonly options: WatcherOptions) {}

	get state(): AwarenessState {
		return this.awareness.state;
	}

	start(): void {
		if (this.timer) return;
		this.last = performance.now();
		this.timer = setInterval(() => this.tick(), TICK_MS);
	}

	/** The player left (tab hidden): the next visit starts unnoticed again. */
	stop(): void {
		clearInterval(this.timer);
		this.timer = undefined;
		this.movement = 0;
		this.apply({ type: 'away' });
	}

	/** Pointer moved by `fraction` of the screen diagonal. */
	moved(fraction: number): void {
		this.movement += Math.max(0, fraction);
	}

	knock(): void {
		this.apply({ type: 'knock' });
	}

	/** The character got to the window after deciding to come over. */
	arrived(): void {
		this.apply({ type: 'arrived' });
	}

	private tick(): void {
		const now = performance.now();
		// Background tabs throttle timers; never let a long pause count as presence.
		const dt = Math.min((now - this.last) / 1000, 1);
		this.last = now;
		if (this.movement > 0.002) this.apply({ type: 'movement', amount: this.movement });
		this.movement = 0;
		this.apply({ type: 'tick', dt });
	}

	private apply(input: AwarenessInput): void {
		const before = this.awareness.state;
		const { awareness, events } = stepAwareness(
			this.awareness,
			input,
			this.options.context(),
			this.rng,
		);
		this.awareness = awareness;
		if (awareness.state !== before) this.options.onState(awareness.state);
		for (const event of events) this.options.onEvent(event);
	}
}
