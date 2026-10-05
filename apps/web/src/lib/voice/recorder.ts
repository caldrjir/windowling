/** Whisper wants 16 kHz mono. */
export const SPEECH_SAMPLE_RATE = 16_000;
/** Long enough for a sentence, short enough to stay snappy and cheap. */
export const MAX_RECORDING_SECONDS = 15;

/** Averages channels and linearly resamples to `toRate`. Pure, so it is unit-tested. */
export function toMono(
	channels: Float32Array[],
	fromRate: number,
	toRate = SPEECH_SAMPLE_RATE,
): Float32Array {
	const first = channels[0];
	if (!first || first.length === 0) return new Float32Array(0);
	const mono = new Float32Array(first.length);
	for (const channel of channels) {
		for (let i = 0; i < mono.length; i++)
			mono[i] = (mono[i] ?? 0) + (channel[i] ?? 0) / channels.length;
	}
	if (fromRate === toRate) return mono;
	const ratio = fromRate / toRate;
	const out = new Float32Array(Math.floor(mono.length / ratio));
	for (let i = 0; i < out.length; i++) {
		const position = i * ratio;
		const index = Math.floor(position);
		const t = position - index;
		const a = mono[index] ?? 0;
		const b = mono[Math.min(index + 1, mono.length - 1)] ?? a;
		out[i] = a + (b - a) * t;
	}
	return out;
}

/** True when the clip is basically silence (nothing worth transcribing). */
export function isSilent(audio: Float32Array, threshold = 0.01): boolean {
	if (audio.length === 0) return true;
	let sum = 0;
	for (const sample of audio) sum += sample * sample;
	return Math.sqrt(sum / audio.length) < threshold;
}

/**
 * Hold-to-talk microphone capture. The stream is opened on the first press
 * (that is when the browser asks for permission) and closed when released.
 */
export class Recorder {
	private stream: MediaStream | undefined;
	private recorder: MediaRecorder | undefined;
	private chunks: Blob[] = [];
	private limit: ReturnType<typeof setTimeout> | undefined;

	get recording(): boolean {
		return this.recorder?.state === 'recording';
	}

	async start(): Promise<void> {
		if (this.recording) return;
		this.stream = await navigator.mediaDevices.getUserMedia({
			audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
		});
		this.chunks = [];
		this.recorder = new MediaRecorder(this.stream);
		this.recorder.ondataavailable = (event) => {
			if (event.data.size > 0) this.chunks.push(event.data);
		};
		this.recorder.start();
		this.limit = setTimeout(() => this.recorder?.stop(), MAX_RECORDING_SECONDS * 1000);
	}

	/** Stops and returns 16 kHz mono PCM. */
	async stop(): Promise<Float32Array> {
		clearTimeout(this.limit);
		const recorder = this.recorder;
		if (!recorder) return new Float32Array(0);
		if (recorder.state !== 'inactive') {
			await new Promise<void>((resolve) => {
				recorder.addEventListener('stop', () => resolve(), { once: true });
				recorder.stop();
			});
		}
		for (const track of this.stream?.getTracks() ?? []) track.stop();
		this.stream = undefined;
		this.recorder = undefined;
		const blob = new Blob(this.chunks, { type: recorder.mimeType });
		this.chunks = [];
		if (blob.size === 0) return new Float32Array(0);
		const context = new AudioContext();
		try {
			const decoded = await context.decodeAudioData(await blob.arrayBuffer());
			const channels = Array.from({ length: decoded.numberOfChannels }, (_, i) =>
				decoded.getChannelData(i),
			);
			return toMono(channels, decoded.sampleRate);
		} finally {
			void context.close();
		}
	}
}
