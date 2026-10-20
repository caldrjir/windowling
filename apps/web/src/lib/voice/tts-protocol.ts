/** Messages between the page and the neural-voice worker. */
export type TtsRequest =
	| {
			type: 'load';
			model: string;
			lexicon: string;
			voice: string;
			wasm: { mjs: string; wasm: string };
	  }
	| { type: 'voice'; voice: string }
	| { type: 'speak'; id: number; text: string; speed: number }
	| { type: 'cancel'; id: number };

export type TtsResponse =
	| { type: 'progress'; percent: number }
	| { type: 'ready' }
	| { type: 'error'; message: string; id?: number }
	/** One piece of the line (a sentence), in order; `last` ends the line. */
	| {
			type: 'audio';
			id: number;
			samples: Float32Array;
			last: boolean;
			/** How long making this piece took, in seconds. */
			took: number;
	  };
