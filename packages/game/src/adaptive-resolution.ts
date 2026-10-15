/** A frame slower than this (seconds) is "too slow" - under ~30 fps. */
const SLOW = 1 / 28;
/** Faster than this is comfortably smooth (~50 fps): there is headroom for more pixels. */
const FAST = 1 / 50;
/** How long frames must stay slow (or fast) before the resolution changes. */
const SLOW_FOR = 1.5;
const FAST_FOR = 8;
const STEP = 0.25;
/** Far too slow (under ~12 fps): react sooner and in bigger steps. */
const VERY_SLOW = 1 / 12;
const VERY_SLOW_FOR = 0.75;

/**
 * Dynamic resolution: a weak device draws fewer pixels instead of showing a
 * choppy room. Fed the time of every frame; answers the pixel ratio to use
 * when it should change (null otherwise). A ratio that proved too slow is
 * never tried again, so it doesn't oscillate.
 */
export class AdaptiveResolution {
	private average = 0;
	private slowFor = 0;
	private fastFor = 0;
	private ceiling: number;
	private _ratio: number;
	private lastStep: 'up' | 'down' | null = null;

	constructor(
		max: number,
		private readonly min = 0.75,
	) {
		this._ratio = max;
		this.ceiling = max;
	}

	get ratio(): number {
		return this._ratio;
	}

	update(frameSeconds: number): number | null {
		// A hiccup (tab switch, GC pause) says nothing about the device.
		const sample = Math.min(Math.max(frameSeconds, 0), 0.25);
		this.average = this.average === 0 ? sample : this.average * 0.9 + sample * 0.1;
		this.slowFor = this.average > SLOW ? this.slowFor + sample : 0;
		this.fastFor = this.average < FAST ? this.fastFor + sample : 0;

		const crawling = this.average > VERY_SLOW;
		if (this.slowFor >= (crawling ? VERY_SLOW_FOR : SLOW_FOR) && this._ratio > this.min) {
			// We went up to this ratio and it is too slow after all: don't try it again.
			if (this.lastStep === 'up') this.ceiling = Math.max(this.min, this._ratio - STEP);
			this.lastStep = 'down';
			return this.set(this._ratio - (crawling ? STEP * 2 : STEP));
		}
		if (this.fastFor >= FAST_FOR && this._ratio < this.ceiling) {
			this.lastStep = 'up';
			return this.set(this._ratio + STEP);
		}
		return null;
	}

	private set(ratio: number): number {
		this._ratio = Math.min(this.ceiling, Math.max(this.min, ratio));
		this.slowFor = 0;
		this.fastFor = 0;
		return this._ratio;
	}
}
