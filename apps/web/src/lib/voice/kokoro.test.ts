import { describe, expect, it } from 'vitest';
import {
	KOKORO_MAX_TOKENS,
	KOKORO_VOICES,
	kokoroStyle,
	kokoroTokens,
	kokoroVoice,
	splitForSpeech,
	syllableOnsets,
} from './kokoro';

describe('Kokoro input', () => {
	it('turns phonemes into padded token ids, dropping what the model does not know', () => {
		expect(kokoroTokens('həlˈO!')).toEqual([0, 50, 83, 54, 156, 31, 5, 0]);
		expect(kokoroTokens('a€b')).toEqual([0, 43, 44, 0]);
		expect(kokoroTokens('a'.repeat(600))).toHaveLength(KOKORO_MAX_TOKENS + 2);
	});

	it('takes the style row for the input length', () => {
		const voice = new Float32Array(510 * 256).map((_, i) => Math.floor(i / 256));
		expect(kokoroStyle(voice, 12)[0]).toBe(10);
		expect(kokoroStyle(voice, 2)[0]).toBe(0);
		expect(kokoroStyle(voice, 9999)[0]).toBe(509);
		expect(kokoroStyle(voice, 12)).toHaveLength(256);
	});

	it('keeps one voice per person', () => {
		expect(kokoroVoice('female', 7)).toBe(kokoroVoice('female', 7));
		expect(KOKORO_VOICES.male).toContain(kokoroVoice('male', 4));
	});
});

describe('splitForSpeech', () => {
	it('says the first sentence alone, the rest in one go', () => {
		expect(splitForSpeech('Oh! You scared me. Did you knock?')).toEqual([
			'Oh!',
			'You scared me. Did you knock?',
		]);
		expect(splitForSpeech('No punctuation at all')).toEqual(['No punctuation at all']);
	});

	it('breaks long sentences at a comma, never mid-word', () => {
		const long = `${'word '.repeat(30)}, ${'more '.repeat(30)}and the end.`;
		const pieces = splitForSpeech(long, 120);
		expect(pieces.length).toBeGreaterThan(1);
		for (const piece of pieces) expect(piece.length).toBeLessThanOrEqual(120);
		expect(pieces.join(' ').replace(/\s+/g, ' ')).toBe(long.trim().replace(/\s+/g, ' '));
	});
});

describe('syllableOnsets', () => {
	it('finds where the sound swells after a dip', () => {
		const rate = 1000;
		const samples = new Float32Array(rate); // 1 s
		for (const at of [0.1, 0.5]) {
			for (let i = 0; i < 150; i++) samples[Math.round(at * rate) + i] = Math.sin(i);
		}
		const onsets = syllableOnsets(samples, rate);
		expect(onsets).toHaveLength(2);
		expect(onsets[0]).toBeCloseTo(0.09, 1);
		expect(onsets[1]).toBeCloseTo(0.48, 1);
		expect(syllableOnsets(new Float32Array(rate), rate)).toEqual([]);
	});
});
