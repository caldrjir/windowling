import { describe, expect, it } from 'vitest';
import { pickVoice, voiceQuality } from './tts';

const voice = (name: string, lang = 'en-US', localService = true) => ({ name, lang, localService });

describe('pickVoice', () => {
	it('never picks a joke voice, however many there are', () => {
		const mac = [
			'Albert',
			'Bad News',
			'Bahh',
			'Bells',
			'Boing',
			'Bubbles',
			'Cellos',
			'Good News',
			'Jester',
			'Organ',
			'Superstar',
			'Trinoids',
			'Whisper',
			'Wobble',
			'Zarvox',
			'Samantha',
		].map((name) => voice(name));
		for (let seed = 0; seed < 20; seed++) expect(pickVoice(mac, seed)?.name).toBe('Samantha');
	});

	it('prefers better voices on the device, and the device over the network', () => {
		const voices = [
			voice('Microsoft David - English (United States)'),
			voice('Ava (Premium)'),
			voice('Google US English', 'en-US', false),
		];
		expect(pickVoice(voices, 0)?.name).toBe('Ava (Premium)');
		expect(pickVoice([voice('Google US English', 'en-US', false)], 3)?.name).toBe(
			'Google US English',
		);
	});

	it('only speaks English and copes with no voices at all', () => {
		expect(voiceQuality(voice('Zuzana', 'cs-CZ'))).toBeNull();
		expect(pickVoice([voice('Zuzana', 'cs-CZ')], 0)).toBeNull();
		expect(pickVoice([], 0)).toBeNull();
	});

	it('keeps the same voice for the same character', () => {
		const voices = [voice('Karen', 'en-AU'), voice('Daniel', 'en-GB'), voice('Moira', 'en-IE')];
		expect(pickVoice(voices, 7)).toBe(pickVoice(voices, 7));
	});
});
