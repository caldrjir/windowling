/// <reference lib="webworker" />
import { env, pipeline, type AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers';
import type { SttRequest, SttResponse } from './stt-protocol';

// Speech recognition runs here, off the main thread, so the room keeps rendering.
// Audio never leaves the device; only the model weights are downloaded (once, then cached).
const scope = self as unknown as DedicatedWorkerGlobalScope;
let recognizer: Promise<AutomaticSpeechRecognitionPipeline> | undefined;

function post(message: SttResponse) {
	scope.postMessage(message);
}

scope.onmessage = async (event: MessageEvent<SttRequest>) => {
	const message = event.data;
	if (message.type === 'load') {
		env.allowLocalModels = false;
		// Our own copy of the ONNX runtime - never fetched from a third-party CDN.
		env.useWasmCache = false;
		const onnx = env.backends.onnx;
		if (onnx.wasm) onnx.wasm.wasmPaths = { mjs: message.wasm.mjs, wasm: message.wasm.wasm };
		recognizer ??= pipeline('automatic-speech-recognition', message.model, {
			device: 'wasm',
			dtype: 'q8',
			progress_callback: (info) => {
				if (info.status === 'progress_total') post({ type: 'progress', percent: info.progress });
			},
		}) as Promise<AutomaticSpeechRecognitionPipeline>;
		try {
			await recognizer;
			post({ type: 'ready' });
		} catch (error) {
			recognizer = undefined;
			post({ type: 'error', message: String(error) });
		}
		return;
	}

	try {
		if (!recognizer) throw new Error('speech recognition is not loaded');
		const asr = await recognizer;
		const result = await asr(message.audio);
		const text = (Array.isArray(result) ? result[0]?.text : result.text) ?? '';
		post({ type: 'transcript', id: message.id, text: text.trim() });
	} catch (error) {
		post({ type: 'error', id: message.id, message: String(error) });
	}
};
