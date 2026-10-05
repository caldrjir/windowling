import ortMjs from 'onnxruntime-web/ort-wasm-simd-threaded.mjs?url';
import ortWasm from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url';
import type { SttRequest, SttResponse } from './stt-protocol';

/** Turns the player's recorded voice into text. Runs entirely on the device. */
export interface SpeechToText {
	/** Downloads/initialises the model; `onProgress` gets 0..100. */
	load(onProgress?: (percent: number) => void): Promise<void>;
	/** 16 kHz mono PCM -> text ('' when nothing was understood). */
	transcribe(audio: Float32Array): Promise<string>;
	dispose(): void;
}

/** Small English Whisper: ~40 MB once, good enough for short spoken lines. */
export const WHISPER_MODEL = 'Xenova/whisper-tiny.en';
export const WHISPER_DOWNLOAD_MB = 40;

export class WhisperInBrowser implements SpeechToText {
	private worker: Worker | undefined;
	private loading: Promise<void> | undefined;
	private nextId = 1;
	private readonly pending = new Map<
		number,
		{ resolve: (text: string) => void; reject: (error: Error) => void }
	>();

	load(onProgress?: (percent: number) => void): Promise<void> {
		this.loading ??= new Promise<void>((resolve, reject) => {
			const worker = new Worker(new URL('./stt.worker.ts', import.meta.url), { type: 'module' });
			this.worker = worker;
			worker.onmessage = (event: MessageEvent<SttResponse>) => {
				const message = event.data;
				if (message.type === 'progress') onProgress?.(message.percent);
				else if (message.type === 'ready') resolve();
				else if (message.type === 'transcript') this.settle(message.id, message.text);
				else if (message.type === 'error') {
					if (message.id === undefined) {
						this.loading = undefined;
						reject(new Error(message.message));
					} else this.settle(message.id, new Error(message.message));
				}
			};
			const request: SttRequest = {
				type: 'load',
				model: WHISPER_MODEL,
				wasm: {
					mjs: new URL(ortMjs, location.href).href,
					wasm: new URL(ortWasm, location.href).href,
				},
			};
			worker.postMessage(request);
		});
		return this.loading;
	}

	async transcribe(audio: Float32Array): Promise<string> {
		await this.load();
		const worker = this.worker;
		if (!worker) throw new Error('speech recognition worker is gone');
		const id = this.nextId++;
		return new Promise<string>((resolve, reject) => {
			this.pending.set(id, { resolve, reject });
			const request: SttRequest = { type: 'transcribe', id, audio };
			worker.postMessage(request, [audio.buffer]);
		});
	}

	dispose(): void {
		this.worker?.terminate();
		this.worker = undefined;
		this.loading = undefined;
		for (const { reject } of this.pending.values()) reject(new Error('disposed'));
		this.pending.clear();
	}

	private settle(id: number, result: string | Error): void {
		const entry = this.pending.get(id);
		if (!entry) return;
		this.pending.delete(id);
		if (result instanceof Error) entry.reject(result);
		else entry.resolve(result);
	}
}

/**
 * Whisper hallucinates on silence ("Thank you.", "[BLANK_AUDIO]", "(music)").
 * Returns the cleaned line, or '' when nothing real was said.
 */
export function cleanTranscript(text: string): string {
	const cleaned = text
		.replace(/\[[^\]]*\]|\([^)]*\)|\*[^*]*\*/g, '')
		.replace(/\s+/g, ' ')
		.trim();
	if (!/[a-z0-9]/i.test(cleaned)) return '';
	return cleaned.slice(0, 300);
}
