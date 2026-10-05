let audio: AudioContext | undefined;

/**
 * A knuckle on glass, synthesised (no audio assets): a short low thump with
 * a bright click on top. Created on the first knock, which is a user gesture,
 * so browsers allow the audio context to start.
 */
export function playKnock(): void {
	try {
		audio ??= new AudioContext();
		const ctx = audio;
		const now = ctx.currentTime;

		const thump = ctx.createOscillator();
		const thumpGain = ctx.createGain();
		thump.type = 'sine';
		thump.frequency.setValueAtTime(190, now);
		thump.frequency.exponentialRampToValueAtTime(70, now + 0.09);
		thumpGain.gain.setValueAtTime(0.5, now);
		thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
		thump.connect(thumpGain).connect(ctx.destination);
		thump.start(now);
		thump.stop(now + 0.13);

		const click = ctx.createOscillator();
		const clickGain = ctx.createGain();
		click.type = 'triangle';
		click.frequency.setValueAtTime(1800, now);
		clickGain.gain.setValueAtTime(0.12, now);
		clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);
		click.connect(clickGain).connect(ctx.destination);
		click.start(now);
		click.stop(now + 0.03);
	} catch {
		// No audio (autoplay policy, old browser): the knock still counts.
	}
}
