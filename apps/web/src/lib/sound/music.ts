import { audio } from './audio';

/** A pentatonic scale (Hz) around middle C - nothing can sound wrong. */
const SCALE = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25];
/** I - vi - IV - V in C, as scale degrees for a soft pad. */
const CHORDS = [
	[130.81, 196.0, 261.63],
	[110.0, 164.81, 220.0],
	[87.31, 130.81, 174.61],
	[98.0, 146.83, 196.0],
];

/**
 * The character's music, generated in the browser (no recordings, no
 * licences): a soft chord pad and a wandering melody, low-passed so it sounds
 * like it comes from inside the flat, behind the glass.
 */
export class Radio {
	private timer: ReturnType<typeof setInterval> | undefined;
	private output: GainNode | undefined;
	private beat = 0;

	get playing(): boolean {
		return this.timer !== undefined;
	}

	start(): void {
		const ctx = audio();
		if (!ctx || this.timer) return;
		const filter = ctx.createBiquadFilter();
		filter.type = 'lowpass';
		filter.frequency.value = 1400; // muffled by the window
		this.output = ctx.createGain();
		this.output.gain.setValueAtTime(0, ctx.currentTime);
		this.output.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 2);
		this.output.connect(filter).connect(ctx.destination);
		this.beat = 0;
		this.timer = setInterval(() => this.tick(), 400);
	}

	stop(): void {
		clearInterval(this.timer);
		this.timer = undefined;
		const ctx = audio();
		const out = this.output;
		this.output = undefined;
		if (!ctx || !out) return;
		out.gain.cancelScheduledValues(ctx.currentTime);
		out.gain.setValueAtTime(out.gain.value, ctx.currentTime);
		out.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.5);
		setTimeout(() => out.disconnect(), 1_600);
	}

	private tick(): void {
		const ctx = audio();
		const out = this.output;
		if (!ctx || !out) return;
		const now = ctx.currentTime;
		// A new chord every 8 beats.
		if (this.beat % 8 === 0) {
			const chord = CHORDS[(this.beat / 8) % CHORDS.length] ?? CHORDS[0] ?? [];
			for (const frequency of chord) this.note(frequency, now, 3.2, 0.35, 'triangle');
		}
		// Melody: mostly steps, sometimes rests.
		if (Math.random() < 0.7) {
			const index = Math.floor(Math.random() * SCALE.length);
			const frequency = SCALE[index] ?? 440;
			this.note(frequency, now, 0.5, 0.5, 'sine');
		}
		this.beat++;
	}

	private note(
		frequency: number,
		at: number,
		length: number,
		volume: number,
		type: OscillatorType,
	): void {
		const ctx = audio();
		const out = this.output;
		if (!ctx || !out) return;
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();
		osc.type = type;
		osc.frequency.value = frequency;
		gain.gain.setValueAtTime(0, at);
		gain.gain.linearRampToValueAtTime(volume, at + 0.05);
		gain.gain.exponentialRampToValueAtTime(0.001, at + length);
		osc.connect(gain).connect(out);
		osc.start(at);
		osc.stop(at + length + 0.05);
	}
}
