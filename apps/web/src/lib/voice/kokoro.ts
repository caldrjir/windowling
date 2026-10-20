/**
 * Kokoro-82M (https://huggingface.co/hexgrad/Kokoro-82M, Apache-2.0): the
 * neural voice. Pure helpers shared by the worker that runs it and the page.
 */

/** The model's input alphabet: phoneme or punctuation -> token id (0 pads both ends). */
const VOCAB: Record<string, number> = {
	';': 1,
	':': 2,
	',': 3,
	'.': 4,
	'!': 5,
	'?': 6,
	'—': 9,
	'…': 10,
	'"': 11,
	'(': 12,
	')': 13,
	'“': 14,
	'”': 15,
	' ': 16,
	'\u0303': 17,
	ʣ: 18,
	ʥ: 19,
	ʦ: 20,
	ʨ: 21,
	ᵝ: 22,
	'ꭧ': 23,
	A: 24,
	I: 25,
	O: 31,
	Q: 33,
	S: 35,
	T: 36,
	W: 39,
	Y: 41,
	ᵊ: 42,
	a: 43,
	b: 44,
	c: 45,
	d: 46,
	e: 47,
	f: 48,
	h: 50,
	i: 51,
	j: 52,
	k: 53,
	l: 54,
	m: 55,
	n: 56,
	o: 57,
	p: 58,
	q: 59,
	r: 60,
	s: 61,
	t: 62,
	u: 63,
	v: 64,
	w: 65,
	x: 66,
	y: 67,
	z: 68,
	ɑ: 69,
	ɐ: 70,
	ɒ: 71,
	æ: 72,
	β: 75,
	ɔ: 76,
	ɕ: 77,
	ç: 78,
	ɖ: 80,
	ð: 81,
	ʤ: 82,
	ə: 83,
	ɚ: 85,
	ɛ: 86,
	ɜ: 87,
	ɟ: 90,
	ɡ: 92,
	ɥ: 99,
	ɨ: 101,
	ɪ: 102,
	ʝ: 103,
	ɯ: 110,
	ɰ: 111,
	ŋ: 112,
	ɳ: 113,
	ɲ: 114,
	ɴ: 115,
	ø: 116,
	ɸ: 118,
	θ: 119,
	œ: 120,
	ɹ: 123,
	ɾ: 125,
	ɻ: 126,
	ʁ: 128,
	ɽ: 129,
	ʂ: 130,
	ʃ: 131,
	ʈ: 132,
	ʧ: 133,
	ʊ: 135,
	ʋ: 136,
	ʌ: 138,
	ɣ: 139,
	ɤ: 140,
	χ: 142,
	ʎ: 143,
	ʒ: 147,
	ʔ: 148,
	ˈ: 156,
	ˌ: 157,
	ː: 158,
	ʰ: 162,
	ʲ: 164,
	'↓': 169,
	'→': 171,
	'↗': 172,
	'↘': 173,
	ᵻ: 177,
};

export const KOKORO_SAMPLE_RATE = 24_000;
/** Values per style vector; a voice holds one per input length. */
const STYLE_SIZE = 256;
/** Longest input the model takes, in tokens (without the padding). */
export const KOKORO_MAX_TOKENS = 510;

/** The q8 model, ~92 MB, from the Hugging Face Hub (weights only; the runtime is ours). */
export const KOKORO_MODEL_URL =
	'https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/onnx/model_quantized.onnx';
export const KOKORO_DOWNLOAD_MB = 95;

/**
 * Voices per kind of person, best first (the voice grades of Kokoro's model
 * card). The character keeps one for good, picked from its seed.
 */
export const KOKORO_VOICES = {
	female: ['af_heart', 'af_bella', 'af_nicole'],
	male: ['am_michael', 'am_fenrir', 'am_puck'],
} as const;

export type KokoroVoiceId = (typeof KOKORO_VOICES)[keyof typeof KOKORO_VOICES][number];

export function kokoroVoice(gender: 'female' | 'male', seed: number): KokoroVoiceId {
	const voices = KOKORO_VOICES[gender];
	return voices[Math.abs(seed) % voices.length] ?? voices[0];
}

/** Phonemes -> token ids with the padding, unknown symbols dropped, cut to what fits. */
export function kokoroTokens(phonemes: string): number[] {
	const ids: number[] = [];
	for (const c of phonemes) {
		const id = VOCAB[c];
		if (id !== undefined) ids.push(id);
	}
	return [0, ...ids.slice(0, KOKORO_MAX_TOKENS), 0];
}

/** The voice's style for an input of this many tokens (with padding). */
export function kokoroStyle(voice: Float32Array, tokens: number): Float32Array {
	const rows = Math.floor(voice.length / STYLE_SIZE);
	const row = Math.min(Math.max(tokens - 2, 0), rows - 1);
	return voice.subarray(row * STYLE_SIZE, (row + 1) * STYLE_SIZE);
}

/**
 * Splits a line into pieces the model says well: the first sentence alone
 * (it starts playing while the rest is made), then as few pieces as fit in
 * `max` characters (each new piece risks a pause), long sentences cut at a
 * comma.
 */
export function splitForSpeech(text: string, max = 220): string[] {
	const sentences = text.match(/[^.!?…]+(?:[.!?…]+["”)]*|$)/g) ?? [text];
	const pieces: string[] = [];
	for (const raw of sentences) {
		let sentence = raw.trim();
		while (sentence.length > max) {
			const cut = Math.max(
				sentence.lastIndexOf(', ', max),
				sentence.lastIndexOf('; ', max),
				sentence.lastIndexOf(' — ', max),
			);
			const at = cut > max / 3 ? cut + 1 : sentence.lastIndexOf(' ', max);
			if (at <= 0) break;
			pieces.push(sentence.slice(0, at).trim());
			sentence = sentence.slice(at).trim();
		}
		if (!sentence) continue;
		const last = pieces.at(-1);
		if (pieces.length > 1 && last !== undefined && last.length + 1 + sentence.length <= max) {
			pieces[pieces.length - 1] = `${last} ${sentence}`;
		} else pieces.push(sentence);
	}
	return pieces;
}

/**
 * Seconds into the audio where a syllable starts (loudness rising after a
 * dip): the moments the mouth opens.
 */
export function syllableOnsets(samples: Float32Array, rate: number): number[] {
	const frame = Math.round(rate * 0.03);
	const levels: number[] = [];
	for (let at = 0; at + frame <= samples.length; at += frame) {
		let sum = 0;
		for (let i = at; i < at + frame; i++) sum += (samples[i] ?? 0) ** 2;
		levels.push(Math.sqrt(sum / frame));
	}
	const peak = Math.max(0, ...levels);
	if (peak === 0) return [];
	const onsets: number[] = [];
	let quiet = true;
	let lastOnset = -1;
	levels.forEach((level, i) => {
		const time = (i * frame) / rate;
		if (quiet && level > peak * 0.35 && time - lastOnset > 0.12) {
			onsets.push(time);
			lastOnset = time;
			quiet = false;
		} else if (level < peak * 0.18) quiet = true;
	});
	return onsets;
}
