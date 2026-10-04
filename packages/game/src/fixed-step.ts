/**
 * Fixed-timestep accumulator. Physics must step at a constant rate
 * regardless of display refresh rate; rendering interpolates in between.
 */
export interface FixedStepOptions {
	/** Seconds per physics step. */
	step: number;
	/** Clamp for huge frame gaps (tab switch, debugger) to avoid a spiral of death. */
	maxFrameTime: number;
}

export class FixedStepAccumulator {
	private accumulator = 0;

	constructor(private readonly options: FixedStepOptions = { step: 1 / 60, maxFrameTime: 0.25 }) {}

	/**
	 * Feed real elapsed seconds; returns how many fixed steps to run now and
	 * the interpolation factor (0..1) for rendering between the last two states.
	 */
	advance(frameTime: number): { steps: number; alpha: number } {
		const { step, maxFrameTime } = this.options;
		this.accumulator += Math.min(Math.max(frameTime, 0), maxFrameTime);

		let steps = 0;
		while (this.accumulator >= step) {
			this.accumulator -= step;
			steps++;
		}
		return { steps, alpha: this.accumulator / step };
	}

	reset(): void {
		this.accumulator = 0;
	}
}
