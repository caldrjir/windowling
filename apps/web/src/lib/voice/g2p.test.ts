import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { kokoroTokens } from './kokoro';
import { EnglishG2P, applyStress, cardinal, ordinal, soundOut, year, type Lexicon } from './g2p';

const lexicon = JSON.parse(
	readFileSync(new URL('../../../static/voice/lexicon-us.json', import.meta.url), 'utf8'),
) as Lexicon;
const g2p = new EnglishG2P(lexicon);

describe('EnglishG2P', () => {
	// Expected values are Misaki's own output (misaki 0.9.4 with spaCy), the phonemes Kokoro learnt.
	it.each([
		['Hello, world!', 'həlˈO, wˈɜɹld!'],
		['Okay... never mind.', 'ˌOkˈA... nˈɛvəɹ mˈInd.'],
		['You are eating at the kitchen counter.', 'jˌu ɑɹ ˈiTɪŋ æt ðə kˈɪʧᵊn kˈWntəɹ.'],
		['Fine. Be like that.', 'fˈIn. bˌi lˈIk ðˈæt.'],
		[
			'I spent $12.50 on coffee this week.',
			'ˌI spˈɛnt twˈɛlv dˈɑləɹz ænd fˈɪfti sˈɛnts ˌɔn kˈɔfi ðɪs wˈik.',
		],
	])('says %j like Misaki', (text, phonemes) => {
		expect(g2p.phonemize(text)).toBe(phonemes);
	});

	it('says "the" and "to" by the next sound', () => {
		expect(g2p.phonemize('the apple and the cat')).toMatch(/^ði .* ðə /);
		expect(g2p.phonemize('to eat, to go')).toMatch(/^tʊ .* tə /);
	});

	it('picks a homograph by the word before it', () => {
		expect(g2p.phonemize('I live here.')).toContain('lˈɪv');
		expect(g2p.phonemize('a live show')).toContain('lˈIv');
		expect(g2p.phonemize('Can you close the door?')).toContain('klˈOz');
		expect(g2p.phonemize("I've read it.")).toContain('ɹˈɛd');
	});

	it('builds words from their endings', () => {
		expect(g2p.phonemize('snorkeled')).toMatch(/d$/);
		expect(g2p.phonemize('windowsills')).toMatch(/z$/);
	});

	it('reads numbers, times and years', () => {
		expect(g2p.phonemize('7:30')).toBe('sˈɛvən θˈɜɹTi');
		expect(g2p.phonemize('It was 1984.')).toContain('nˌIntˈin ˈATi fˈɔɹ');
		expect(g2p.phonemize('the 2nd one')).toContain('sˈɛkənd');
	});

	it('acts stage directions instead of reading them', () => {
		expect(g2p.phonemize('Fine. *sighs*')).toBe('fˈIn.');
	});

	it('reads unknown words from known pieces, initials letter by letter, names by sound', () => {
		expect(g2p.phonemize('Windowling')).toBe('wˈɪndOlˌɪŋ');
		expect(g2p.phonemize('XQZ')).toMatch(/ˈ/);
		expect(g2p.phonemize('Jiri')).toBe(soundOut('jiri'));
	});

	it('reads everything into symbols the voice knows', () => {
		const out = g2p.phonemize('Wait — what?! "No way" (really) 100% & more; 3.14, -5, 21st…');
		expect(out).toBe(
			'wˈAt— wˌʌt?! "nˈO wˈA" (ɹˈiᵊli) wˈʌn hˈʌndɹəd pəɹsˈɛnt ænd mˈɔɹ; θɹˈi pYnt wˈʌn fˈɔɹ, mˈInəs fˈIv, twˈɛnti fˈɜɹst...',
		);
		expect(kokoroTokens(out)).toHaveLength([...out].length + 2);
	});
});

describe('numbers', () => {
	it('spells them out like num2words', () => {
		expect(cardinal(0)).toBe('zero');
		expect(cardinal(21)).toBe('twenty-one');
		expect(cardinal(105)).toBe('one hundred and five');
		expect(cardinal(2_500_003)).toBe('two million five hundred thousand and three');
		expect(ordinal(1)).toBe('first');
		expect(ordinal(22)).toBe('twenty-second');
		expect(ordinal(30)).toBe('thirtieth');
		expect(year(1984)).toBe('nineteen eighty-four');
		expect(year(1905)).toBe('nineteen oh five');
		expect(year(2005)).toBe('two thousand and five');
		expect(year(1900)).toBe('nineteen hundred');
	});
});

describe('applyStress', () => {
	it('demotes, removes and adds stress', () => {
		expect(applyStress('həlˈO', -1)).toBe('həlˌO');
		expect(applyStress('həlˈO', -2)).toBe('həlO');
		expect(applyStress('kæt', 2)).toBe('kˈæt');
		expect(applyStress('kæt', null)).toBe('kæt');
	});
});
