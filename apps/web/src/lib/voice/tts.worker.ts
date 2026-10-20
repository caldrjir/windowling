/// <reference lib="webworker" />
import { InferenceSession, Tensor, env } from 'onnxruntime-web/wasm';
import { EnglishG2P, type Lexicon } from './g2p';
import { kokoroStyle, kokoroTokens, splitForSpeech } from './kokoro';
import type { TtsRequest, TtsResponse } from './tts-protocol';

// The neural voice runs here, off the main thread, so the room keeps rendering.
// Text never leaves the device; the weights are downloaded once and cached.
const scope = self as unknown as DedicatedWorkerGlobalScope;
const CACHE = 'windowling-voice';

let session: Promise<InferenceSession> | undefined;
let g2p: EnglishG2P | undefined;
let voice: Promise<Float32Array> | undefined;
/** Lines cancelled before all their pieces were made. */
const cancelled = new Set<number>();
/** One line at a time: the next waits for the previous one. */
let queue: Promise<void> = Promise.resolve();

function post(message: TtsResponse, transfer: Transferable[] = []) {
	scope.postMessage(message, transfer);
}

/** From the cache, or downloaded (counting bytes) and then cached. */
async function cachedFetch(url: string, onBytes: (bytes: number) => void): Promise<ArrayBuffer> {
	const cache = await caches.open(CACHE).catch(() => null);
	const hit = await cache?.match(url);
	if (hit) {
		const buffer = await hit.arrayBuffer();
		onBytes(buffer.byteLength);
		return buffer;
	}
	const response = await fetch(url);
	if (!response.ok || !response.body) throw new Error(`${url}: HTTP ${String(response.status)}`);
	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let size = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		chunks.push(value);
		size += value.byteLength;
		onBytes(size);
	}
	const buffer = new Uint8Array(size);
	let at = 0;
	for (const chunk of chunks) {
		buffer.set(chunk, at);
		at += chunk.byteLength;
	}
	await cache?.put(url, new Response(buffer)).catch(() => undefined);
	return buffer.buffer;
}

const loadVoice = (url: string) =>
	cachedFetch(url, () => undefined).then((buffer) => new Float32Array(buffer));

async function load(message: Extract<TtsRequest, { type: 'load' }>): Promise<void> {
	// Our own copy of the ONNX runtime - never fetched from a third-party CDN.
	env.wasm.wasmPaths = { mjs: message.wasm.mjs, wasm: message.wasm.wasm };
	env.wasm.numThreads = 1;
	// The model is nearly all of the download; report progress by its size.
	const expected = 92_361_000;
	const model = cachedFetch(message.model, (bytes) =>
		post({ type: 'progress', percent: Math.min(99, Math.round((bytes / expected) * 100)) }),
	);
	const lexicon = cachedFetch(message.lexicon, () => undefined).then(
		(buffer) => JSON.parse(new TextDecoder().decode(buffer)) as Lexicon,
	);
	voice = loadVoice(message.voice);
	session = model.then((bytes) =>
		InferenceSession.create(bytes, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' }),
	);
	g2p = new EnglishG2P(await lexicon);
	await Promise.all([session, voice]);
}

async function speak(id: number, text: string, speed: number): Promise<void> {
	if (!session || !g2p || !voice) throw new Error('the voice is not loaded');
	const model = await session;
	const style = await voice;
	const pieces = splitForSpeech(text);
	for (const [i, piece] of pieces.entries()) {
		if (cancelled.has(id)) break;
		const started = performance.now();
		const tokens = kokoroTokens(g2p.phonemize(piece));
		// Exports name the token input differently ("input_ids", "tokens").
		const idsName = model.inputNames.find((n) => n !== 'style' && n !== 'speed') ?? 'input_ids';
		const result = await model.run({
			[idsName]: new Tensor('int64', BigInt64Array.from(tokens, BigInt), [1, tokens.length]),
			style: new Tensor('float32', kokoroStyle(style, tokens.length).slice(), [1, 256]),
			speed: new Tensor('float32', [speed], [1]),
		});
		const output = result[model.outputNames[0] ?? 'waveform'];
		const samples = new Float32Array(output?.data as Float32Array);
		post(
			{
				type: 'audio',
				id,
				samples,
				last: i === pieces.length - 1,
				took: (performance.now() - started) / 1000,
			},
			[samples.buffer],
		);
	}
	if (cancelled.has(id) || pieces.length === 0) {
		post({ type: 'audio', id, samples: new Float32Array(0), last: true, took: 0 });
	}
	cancelled.delete(id);
}

scope.onmessage = (event: MessageEvent<TtsRequest>) => {
	const message = event.data;
	switch (message.type) {
		case 'load':
			load(message).then(
				() => post({ type: 'ready' }),
				(error: unknown) => {
					session = undefined;
					post({ type: 'error', message: String(error) });
				},
			);
			return;
		case 'voice':
			voice = loadVoice(message.voice);
			return;
		case 'cancel':
			cancelled.add(message.id);
			return;
		case 'speak':
			queue = queue.then(() =>
				speak(message.id, message.text, message.speed).catch((error: unknown) => {
					cancelled.delete(message.id);
					post({ type: 'error', id: message.id, message: String(error) });
				}),
			);
			return;
	}
};
