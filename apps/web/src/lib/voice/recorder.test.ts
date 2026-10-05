import { describe, expect, it } from 'vitest';
import { isSilent, toMono } from './recorder';
import { cleanTranscript } from './stt';

describe('toMono', () => {
	it('averages channels', () => {
		const out = toMono([new Float32Array([1, 0.5]), new Float32Array([0, 0.5])], 16_000);
		expect(Array.from(out)).toEqual([0.5, 0.5]);
	});

	it('resamples 48 kHz to 16 kHz', () => {
		const second = new Float32Array(48_000).map((_, i) => Math.sin(i / 100));
		const out = toMono([second], 48_000);
		expect(out.length).toBe(16_000);
		expect(out[1000]).toBeCloseTo(second[3000] ?? 0, 5);
	});

	it('handles empty input', () => {
		expect(toMono([], 48_000).length).toBe(0);
	});
});

describe('isSilent', () => {
	it('tells silence from speech', () => {
		expect(isSilent(new Float32Array(1000))).toBe(true);
		expect(isSilent(new Float32Array(1000).map((_, i) => Math.sin(i) * 0.3))).toBe(false);
	});
});

describe('cleanTranscript', () => {
	it('drops Whisper non-speech tags and empty results', () => {
		expect(cleanTranscript(' [BLANK_AUDIO] ')).toBe('');
		expect(cleanTranscript('(music) ')).toBe('');
		expect(cleanTranscript(' Hi there!  (laughs) ')).toBe('Hi there!');
	});
});
