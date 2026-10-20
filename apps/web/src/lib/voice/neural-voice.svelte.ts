import ortMjs from 'onnxruntime-web/ort-wasm-simd-threaded.mjs?url';
import ortWasm from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url';
import { audio } from '$lib/sound/audio';
import {
	KOKORO_MODEL_URL,
	KOKORO_SAMPLE_RATE,
	kokoroVoice,
	syllableOnsets,
	type KokoroVoiceId,
} from './kokoro';
import type { TtsRequest, TtsResponse } from './tts-protocol';
import { prosody, type SpeakOptions, type TextToSpeech, type VoiceGender } from './tts';

/**
 * The neural voice (Kokoro) on this device. The model (~95 MB) is downloaded
 * once after the player agrees and stays in the browser cache; while it is
 * missing, loading, or the device turns out too slow, the browser's own voice
 * speaks instead.
 */
export type NeuralVoiceStatus =
	| 'checking'
	| 'unsupported'
	| 'absent'
	| 'downloading'
	| 'loading'
	| 'ready'
	/** Works, but makes speech slower than it talks: the browser voice is used. */
	| 'slow'
	| 'error';

const CACHE = 'windowling-voice';
const LEXICON_URL = '/voice/lexicon-us.json';
const voiceUrl = (id: KokoroVoiceId) => `/voice/${id}.bin`;
/** Making speech this much slower than real time leaves pauses mid-line: too slow to talk with. */
const TOO_SLOW = 1.25;

class NeuralVoice {
	status = $state<NeuralVoiceStatus>('checking');
	/** 0..100 while downloading. */
	progress = $state(0);
	private worker: Worker | undefined;
	private loading: Promise<void> | undefined;
	private voice: KokoroVoiceId = 'af_heart';
	private detected: Promise<void> | undefined;
	private nextId = 1;
	private readonly lines = new Map<number, (message: TtsResponse) => void>();
	/** Lines that came out slower than real time, in a row. */
	private slowLines = 0;

	/** Whether this device can run it, and whether it was downloaded before (then it loads). */
	detect(): Promise<void> {
		this.detected ??= (async () => {
			if (typeof WebAssembly === 'undefined' || typeof caches === 'undefined') {
				this.status = 'unsupported';
				return;
			}
			try {
				const cache = await caches.open(CACHE);
				const cached = await cache.match(KOKORO_MODEL_URL);
				if (!cached) {
					this.status = 'absent';
					return;
				}
				this.status = 'loading';
				await this.load();
			} catch (error) {
				console.warn('Neural voice unavailable', error);
				if (this.status === 'checking') this.status = 'unsupported';
			}
		})();
		return this.detected;
	}

	/** Only ever called after the player agreed to the download. */
	async download(): Promise<void> {
		this.status = 'downloading';
		await this.load();
	}

	/** Who is speaking: a voice that fits the person, the same one every visit. */
	prefer(gender: VoiceGender, seed: number): void {
		const next = kokoroVoice(gender, seed);
		if (next === this.voice) return;
		this.voice = next;
		this.post({ type: 'voice', voice: voiceUrl(next) });
	}

	get usable(): boolean {
		return this.status === 'ready' && audio()?.state === 'running';
	}

	private load(): Promise<void> {
		this.loading ??= new Promise<void>((resolve, reject) => {
			const worker = new Worker(new URL('./tts.worker.ts', import.meta.url), { type: 'module' });
			this.worker = worker;
			worker.onmessage = (event: MessageEvent<TtsResponse>) => {
				const message = event.data;
				if (message.type === 'progress') {
					this.progress = message.percent;
					if (message.percent >= 99 && this.status === 'downloading') this.status = 'loading';
				} else if (message.type === 'ready') {
					this.status = 'ready';
					resolve();
				} else if (message.type === 'error' && message.id === undefined) {
					this.status = 'error';
					this.loading = undefined;
					worker.terminate();
					reject(new Error(message.message));
				} else if ('id' in message && message.id !== undefined) {
					this.lines.get(message.id)?.(message);
				}
			};
			this.post({
				type: 'load',
				model: KOKORO_MODEL_URL,
				lexicon: LEXICON_URL,
				voice: voiceUrl(this.voice),
				wasm: {
					mjs: new URL(ortMjs, location.href).href,
					wasm: new URL(ortWasm, location.href).href,
				},
			});
		});
		return this.loading;
	}

	private post(message: TtsRequest): void {
		this.worker?.postMessage(message);
	}

	/**
	 * Speaks a line: each piece plays as soon as it is made, the next one
	 * queued right after it. Resolves when the last piece has played.
	 */
	speak(text: string, { emotion, intensity, onWord }: SpeakOptions): Promise<void> {
		const context = audio();
		if (!context || !this.worker) return Promise.resolve();
		const id = this.nextId++;
		const { rate } = prosody(emotion, intensity);
		return new Promise<void>((resolve) => {
			let playUntil = context.currentTime + 0.05;
			let made = 0;
			let took = 0;
			const timers: number[] = [];
			const sources: AudioBufferSourceNode[] = [];
			const finish = () => {
				this.lines.delete(id);
				const left = Math.max(0, playUntil - context.currentTime);
				timers.push(window.setTimeout(resolve, left * 1000));
			};
			this.lines.set(id, (message) => {
				if (message.type === 'error') {
					finish();
					return;
				}
				if (message.type !== 'audio') return;
				const { samples } = message;
				if (samples.length > 0) {
					const buffer = context.createBuffer(1, samples.length, KOKORO_SAMPLE_RATE);
					buffer.getChannelData(0).set(samples);
					const source = context.createBufferSource();
					source.buffer = buffer;
					source.connect(context.destination);
					const start = Math.max(playUntil, context.currentTime + 0.02);
					source.start(start);
					sources.push(source);
					for (const onset of syllableOnsets(samples, KOKORO_SAMPLE_RATE)) {
						const delay = (start - context.currentTime + onset) * 1000;
						timers.push(window.setTimeout(() => onWord?.(), delay));
					}
					playUntil = start + buffer.duration;
					made += buffer.duration;
					took += message.took;
				}
				if (message.last) {
					this.judgeSpeed(made, took);
					finish();
				}
			});
			this.cancelLine = () => {
				this.post({ type: 'cancel', id });
				this.lines.delete(id);
				for (const timer of timers) clearTimeout(timer);
				for (const source of sources) source.stop();
				resolve();
			};
			this.post({ type: 'speak', id, text, speed: rate });
		});
	}

	private cancelLine: (() => void) | undefined;

	cancel(): void {
		this.cancelLine?.();
		this.cancelLine = undefined;
	}

	/** Two lines in a row made much slower than they talk: this device can't keep up. */
	private judgeSpeed(seconds: number, took: number): void {
		if (seconds <= 0) return;
		this.slowLines = took / seconds > TOO_SLOW ? this.slowLines + 1 : 0;
		if (this.slowLines >= 2) this.status = 'slow';
	}
}

export const neuralVoice = new NeuralVoice();

/**
 * The character's voice: the neural one when it is ready (and sound is
 * unlocked), otherwise the browser's - so it always says something.
 */
export class CharacterVoice implements TextToSpeech {
	constructor(
		private readonly fallback: TextToSpeech,
		private readonly seed: number,
	) {}

	get available(): boolean {
		return neuralVoice.usable || this.fallback.available;
	}

	prefer(gender: VoiceGender): void {
		this.fallback.prefer?.(gender);
		neuralVoice.prefer(gender, this.seed);
	}

	speak(text: string, options: SpeakOptions): Promise<void> {
		return neuralVoice.usable
			? neuralVoice.speak(text, options)
			: this.fallback.speak(text, options);
	}

	cancel(): void {
		neuralVoice.cancel();
		this.fallback.cancel();
	}
}
