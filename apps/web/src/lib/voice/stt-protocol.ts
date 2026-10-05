/** Messages between the page and the speech-recognition worker. */
export type SttRequest =
	| { type: 'load'; model: string; wasm: { mjs: string; wasm: string } }
	| { type: 'transcribe'; id: number; audio: Float32Array };

export type SttResponse =
	| { type: 'progress'; percent: number }
	| { type: 'ready' }
	| { type: 'error'; message: string; id?: number }
	| { type: 'transcript'; id: number; text: string };
