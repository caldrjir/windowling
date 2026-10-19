import { describe, expect, it } from 'vitest';
import { pickVoice, voiceGender, voiceQuality } from './tts';

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

describe('voiceGender', () => {
	const voice = (name: string) => ({ name, lang: 'en-US', localService: true });

	it('tells voices apart by their names', () => {
		expect(voiceGender(voice('Samantha'))).toBe('female');
		expect(voiceGender(voice('Google UK English Female'))).toBe('female');
		expect(voiceGender(voice('Google UK English Male'))).toBe('male');
		expect(voiceGender(voice('Daniel (Enhanced)'))).toBe('male');
		expect(voiceGender(voice('Microsoft Zira - English (United States)'))).toBe('female');
		expect(voiceGender(voice('Nicky'))).toBeNull();
	});

	it('picks a voice that fits the person, if the device has one', () => {
		const voices = [voice('Samantha'), voice('Daniel'), voice('Nicky')];
		expect(pickVoice(voices, 0, 'male')?.name).toBe('Daniel');
		expect(pickVoice(voices, 0, 'female')?.name).toBe('Samantha');
		// Nothing that fits: one we can't tell, rather than the wrong one.
		expect(pickVoice([voice('Samantha'), voice('Nicky')], 0, 'male')?.name).toBe('Nicky');
		// Only the wrong one: better than silence.
		expect(pickVoice([voice('Samantha')], 0, 'male')?.name).toBe('Samantha');
	});
});
