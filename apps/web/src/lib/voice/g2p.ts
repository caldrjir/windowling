/**
 * English (US) text -> phonemes for the neural voice (Kokoro), without eSpeak
 * (GPL). A port of the dictionary path of Misaki (https://github.com/hexgrad/misaki,
 * Apache-2.0), the phonemizer Kokoro was trained with: its dictionaries,
 * stress rules and -s/-ed/-ing endings, numbers spelt out. Instead of a
 * part-of-speech tagger, the word before decides between homographs ("to
 * live" vs "a live show"); unknown words are split into known ones or spelt.
 */

/** Word -> phonemes, or per part of speech (`DEFAULT` always present). */
export type Lexicon = Record<string, string | Record<string, string | null>>;

const PRIMARY = 'ˈ';
const SECONDARY = 'ˌ';
const VOWELS = new Set('AIOQWYaiuæɑɒɔəɛɜɪʊʌᵻ');
const CONSONANTS = new Set('bdfhjklmnpstvwzðŋɡɹɾʃʒʤʧθ');
/** Vowels a "t" between them turns into a flap (water -> wɔɾəɹ). */
const US_TAUS = new Set('AIOWYiuæɑəɛɪɹʊʌ');
const SYMBOLS: Record<string, string> = { '%': 'percent', '&': 'and', '+': 'plus', '@': 'at' };

/** Moves or adds stress the way Misaki does: <-1 none, -1 secondary only, >1 primary. */
export function applyStress(ps: string, stress: number | null): string {
	if (stress === null) return ps;
	const hasPrimary = ps.includes(PRIMARY);
	const hasAny = hasPrimary || ps.includes(SECONDARY);
	const hasVowel = [...ps].some((c) => VOWELS.has(c));
	if (stress < -1) return ps.replaceAll(PRIMARY, '').replaceAll(SECONDARY, '');
	if (stress === -1 || ((stress === 0 || stress === -0.5) && hasPrimary)) {
		return ps.replaceAll(SECONDARY, '').replaceAll(PRIMARY, SECONDARY);
	}
	if ((stress === 0 || stress === 0.5 || stress === 1) && !hasAny) {
		return hasVowel ? restress(SECONDARY + ps) : ps;
	}
	if (stress >= 1 && !hasPrimary && ps.includes(SECONDARY))
		return ps.replaceAll(SECONDARY, PRIMARY);
	if (stress > 1 && !hasAny) return hasVowel ? restress(PRIMARY + ps) : ps;
	return ps;
}

/** Puts each stress mark right before the vowel it belongs to. */
function restress(ps: string): string {
	const chars = [...ps];
	const placed = chars.map((c, i) => {
		if (c !== PRIMARY && c !== SECONDARY) return { c, at: i };
		const vowel = chars.findIndex((v, j) => j > i && VOWELS.has(v));
		return { c, at: vowel < 0 ? i : vowel - 0.5 };
	});
	return placed
		.sort((a, b) => a.at - b.at)
		.map((p) => p.c)
		.join('');
}

// --- numbers -----------------------------------------------------------------

const ONES = [
	'zero',
	'one',
	'two',
	'three',
	'four',
	'five',
	'six',
	'seven',
	'eight',
	'nine',
	'ten',
	'eleven',
	'twelve',
	'thirteen',
	'fourteen',
	'fifteen',
	'sixteen',
	'seventeen',
	'eighteen',
	'nineteen',
];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const SCALES: [number, string][] = [
	[1e12, 'trillion'],
	[1e9, 'billion'],
	[1e6, 'million'],
	[1e3, 'thousand'],
];

/** 1234 -> "one thousand two hundred and thirty-four" (British "and", as num2words). */
export function cardinal(n: number): string {
	if (n < 0) return `minus ${cardinal(-n)}`;
	if (n < 20) return ONES[n] ?? '';
	if (n < 100) {
		const rest = n % 10;
		return `${TENS[Math.floor(n / 10)] ?? ''}${rest ? `-${ONES[rest] ?? ''}` : ''}`;
	}
	if (n < 1000) {
		const rest = n % 100;
		return `${ONES[Math.floor(n / 100)] ?? ''} hundred${rest ? ` and ${cardinal(rest)}` : ''}`;
	}
	for (const [size, name] of SCALES) {
		if (n >= size) {
			const rest = n % size;
			const tail = rest === 0 ? '' : rest < 100 ? ` and ${cardinal(rest)}` : ` ${cardinal(rest)}`;
			return `${cardinal(Math.floor(n / size))} ${name}${tail}`;
		}
	}
	return String(n);
}

const ORDINAL_WORDS: Record<string, string> = {
	one: 'first',
	two: 'second',
	three: 'third',
	five: 'fifth',
	eight: 'eighth',
	nine: 'ninth',
	twelve: 'twelfth',
};

/** 21 -> "twenty-first". */
export function ordinal(n: number): string {
	const words = cardinal(n);
	const match = /([a-z]+)$/.exec(words);
	const last = match?.[1] ?? '';
	const head = words.slice(0, words.length - last.length);
	const special = ORDINAL_WORDS[last];
	if (special) return head + special;
	if (last.endsWith('y')) return `${head}${last.slice(0, -1)}ieth`;
	return `${head}${last}th`;
}

/** 1984 -> "nineteen eighty-four", 2005 -> "two thousand and five". */
export function year(n: number): string {
	const high = Math.floor(n / 100);
	const low = n % 100;
	if (n % 1000 < 10 && n >= 2000) return cardinal(n);
	if (low === 0) return `${cardinal(high)} hundred`;
	return `${cardinal(high)} ${low < 10 ? `oh ${ONES[low] ?? ''}` : cardinal(low)}`;
}

// --- words -------------------------------------------------------------------

const isLower = (w: string) => w === w.toLowerCase();
const isUpper = (w: string) => w === w.toUpperCase();
const isAlpha = (w: string) => /^[A-Za-z]+$/.test(w);
const capitalize = (w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();

/** Words before a noun, and before a verb - instead of a part-of-speech tagger. */
const BEFORE_NOUN = new Set(
	'a an the my your his her our their its this that these those some any no every each'.split(' '),
);
const BEFORE_VERB = new Set(
	"to i you we they will would can could should must might may do does did don't didn't won't can't couldn't wouldn't shouldn't let's please gonna wanna i'll you'll we'll they'll".split(
		' ',
	),
);
const BEFORE_PARTICIPLE = new Set(
	"have has had i've you've we've they've having been was were is are be being".split(' '),
);

export type Tag = 'NOUN' | 'VERB' | 'VBN' | null;

/** What the word before suggests this one is. */
export function guessTag(previous: string | undefined): Tag {
	const word = previous?.toLowerCase().replaceAll('’', "'");
	if (word === undefined) return null;
	if (BEFORE_NOUN.has(word)) return 'NOUN';
	if (BEFORE_PARTICIPLE.has(word)) return 'VBN';
	if (BEFORE_VERB.has(word)) return 'VERB';
	return null;
}

interface Context {
	/** Does the next word start with a vowel? null at the end of a phrase. */
	futureVowel: boolean | null;
	/** Is the next word "to"? ("used to") */
	futureTo: boolean;
}

export class EnglishG2P {
	constructor(private readonly lexicon: Lexicon) {}

	/** "Hello, world!" -> "həlˈO, wˈɜɹld!" */
	phonemize(text: string): string {
		const tokens = tokenize(normalize(text));
		const out: string[] = new Array<string>(tokens.length).fill('');
		let ctx: Context = { futureVowel: null, futureTo: false };
		// Right to left: "the" and "to" depend on the next word's first sound.
		for (let i = tokens.length - 1; i >= 0; i--) {
			const token = tokens[i];
			if (token === undefined) continue;
			if (token.kind === 'punct') {
				out[i] = token.text;
				if (!'"“”()'.includes(token.text)) ctx = { futureVowel: null, futureTo: false };
				continue;
			}
			const previous = tokens[i - 1];
			const tag = previous?.kind === 'word' ? guessTag(previous.text) : null;
			const ps =
				token.kind === 'number'
					? this.number(token.text)
					: (this.word(token.text, tag, ctx) ?? this.unknown(token.text));
			out[i] = ps;
			const first = [...ps].find((c) => VOWELS.has(c) || CONSONANTS.has(c));
			ctx = {
				futureVowel: first === undefined ? ctx.futureVowel : VOWELS.has(first),
				futureTo: token.text.toLowerCase() === 'to',
			};
		}
		// Kokoro v1.0 was trained on Misaki's first phoneme set: T for the flap, t for the glottal stop.
		return join(tokens, out).replaceAll('ɾ', 'T').replaceAll('ʔ', 't');
	}

	private entry(word: string): Lexicon[string] | undefined {
		// Misaki also knows every lowercase word capitalised and vice versa.
		const exact = this.lexicon[word];
		if (exact !== undefined || word.length < 2) return exact;
		if (isLower(word)) return this.lexicon[capitalize(word)];
		if (word === capitalize(word)) return this.lexicon[word.toLowerCase()];
		return undefined;
	}

	private has(word: string): boolean {
		return this.entry(word) !== undefined;
	}

	private isKnown(word: string): boolean {
		if (this.has(word) || word in SYMBOLS) return true;
		if (!/^[A-Za-z'-]+$/.test(word) || !isAlpha(word.replaceAll("'", ''))) return false;
		if (word.length === 1) return true;
		if (isUpper(word) && this.has(word.toLowerCase())) return true;
		return word.slice(1) === word.slice(1).toUpperCase();
	}

	private lookup(
		word: string,
		tag: Tag,
		stress: number | null,
		ctx: Context | null,
	): string | null {
		const w = isUpper(word) && !this.has(word) ? word.toLowerCase() : word;
		const entry = this.entry(w);
		let ps: string | null | undefined;
		if (typeof entry === 'object') {
			const forms = entry;
			let key: string = tag ?? 'DEFAULT';
			if (ctx && ctx.futureVowel === null && 'None' in forms) key = 'None';
			// At the end of a phrase "that" points at something: stressed.
			else if (ctx && ctx.futureVowel === null && 'DT' in forms) key = 'DT';
			else if (tag === 'VBN' && !(tag in forms)) key = 'VERB';
			ps = forms[key] ?? forms.DEFAULT ?? null;
		} else ps = entry;
		if (ps === undefined || ps === null) return this.spell(w);
		return applyStress(ps, stress);
	}

	/** Letter by letter, the way initials are said: "TV" -> tˌivˈi. */
	private spell(word: string): string | null {
		const letters = [...word].filter((c) => /[A-Za-z]/.test(c));
		const parts = letters.map((c) => this.lexicon[c.toUpperCase()]);
		if (!parts.length || parts.some((p) => typeof p !== 'string')) return null;
		const ps = applyStress((parts as string[]).join(''), 0);
		const cut = ps.lastIndexOf(SECONDARY);
		return cut < 0 ? ps : ps.slice(0, cut) + PRIMARY + ps.slice(cut + 1);
	}

	private special(word: string, tag: Tag, stress: number | null, ctx: Context): string | null {
		if (word in SYMBOLS) return this.lookup(SYMBOLS[word] ?? '', null, null, ctx);
		if (word === 'AM' || word === 'PM') return this.spell(word);
		if (word === 'a' || word === 'A') return 'ɐ';
		if (word === 'am' || word === 'Am') {
			return ctx.futureVowel === null || (stress ?? 0) > 0
				? this.lookup('am', null, null, null)
				: 'ɐm';
		}
		if (word === 'an' || word === 'An') return 'ɐn';
		if (word === 'I') return `${SECONDARY}I`;
		if (word === 'to' || word === 'To' || word === 'TO') {
			if (ctx.futureVowel === null) return this.lookup('to', null, null, null);
			return ctx.futureVowel ? 'tʊ' : 'tə';
		}
		if (word === 'in' || word === 'In' || word === 'IN') {
			return (ctx.futureVowel === null ? PRIMARY : '') + 'ɪn';
		}
		if (word === 'the' || word === 'The' || word === 'THE') return ctx.futureVowel ? 'ði' : 'ðə';
		if (/^vs\.?$/i.test(word)) return this.lookup('versus', null, null, ctx);
		if (word === 'used' || word === 'Used' || word === 'USED') {
			const forms = this.lexicon.used;
			if (typeof forms === 'object') return (ctx.futureTo ? forms.VBD : forms.DEFAULT) ?? null;
		}
		return null;
	}

	/** A word's phonemes, or null when no dictionary path explains it. */
	word(text: string, tag: Tag, ctx: Context): string | null {
		let word = text.replaceAll('’', "'");
		// A capital letter asks for a bit more stress; all caps for full stress.
		const stress = isLower(word) ? null : isUpper(word) ? 2 : 0.5;
		const special = this.special(word, tag, stress, ctx);
		if (special !== null) return special;
		const lower = word.toLowerCase();
		if (
			word.length > 1 &&
			isAlpha(word.replaceAll("'", '')) &&
			!isLower(word) &&
			!this.has(word) &&
			(isUpper(word) || word.slice(1) === word.slice(1).toLowerCase()) &&
			(this.has(lower) || this.stemmed(lower, tag, stress, ctx) !== null)
		) {
			word = lower;
		}
		if (this.isKnown(word)) return this.lookup(word, tag, stress, ctx);
		if (word.endsWith("s'") && this.isKnown(`${word.slice(0, -2)}'s`)) {
			return this.lookup(`${word.slice(0, -2)}'s`, tag, stress, ctx);
		}
		if (word.endsWith("'") && this.isKnown(word.slice(0, -1))) {
			return this.lookup(word.slice(0, -1), tag, stress, ctx);
		}
		return this.stemmed(word, tag, stress, ctx);
	}

	private stemmed(word: string, tag: Tag, stress: number | null, ctx: Context): string | null {
		return (
			this.stemS(word, tag, stress, ctx) ??
			this.stemEd(word, tag, stress, ctx) ??
			this.stemIng(word, tag, stress ?? 0.5, ctx)
		);
	}

	private stemS(word: string, tag: Tag, stress: number | null, ctx: Context): string | null {
		if (word.length < 3 || !word.endsWith('s')) return null;
		let stem: string;
		if (!word.endsWith('ss') && this.isKnown(word.slice(0, -1))) stem = word.slice(0, -1);
		else if (
			(word.endsWith("'s") || (word.length > 4 && word.endsWith('es') && !word.endsWith('ies'))) &&
			this.isKnown(word.slice(0, -2))
		) {
			stem = word.slice(0, -2);
		} else if (word.length > 4 && word.endsWith('ies') && this.isKnown(`${word.slice(0, -3)}y`)) {
			stem = `${word.slice(0, -3)}y`;
		} else return null;
		return plural(this.lookup(stem, tag, stress, ctx));
	}

	private stemEd(word: string, tag: Tag, stress: number | null, ctx: Context): string | null {
		if (word.length < 4 || !word.endsWith('d')) return null;
		let stem: string;
		if (!word.endsWith('dd') && this.isKnown(word.slice(0, -1))) stem = word.slice(0, -1);
		else if (
			word.length > 4 &&
			word.endsWith('ed') &&
			!word.endsWith('eed') &&
			this.isKnown(word.slice(0, -2))
		) {
			stem = word.slice(0, -2);
		} else return null;
		return past(this.lookup(stem, tag, stress, ctx));
	}

	private stemIng(word: string, tag: Tag, stress: number | null, ctx: Context): string | null {
		if (word.length < 5 || !word.endsWith('ing')) return null;
		let stem: string;
		if (word.length > 5 && this.isKnown(word.slice(0, -3))) stem = word.slice(0, -3);
		else if (this.isKnown(`${word.slice(0, -3)}e`)) stem = `${word.slice(0, -3)}e`;
		else if (
			word.length > 5 &&
			/([bcdgklmnprstvxz])\1ing$|cking$/.test(word) &&
			this.isKnown(word.slice(0, -4))
		) {
			stem = word.slice(0, -4);
		} else return null;
		return progressive(this.lookup(stem, tag, stress, ctx));
	}

	/** Not in the dictionary: known pieces ("windowling" = window + ling), else spelt out. */
	private unknown(text: string): string {
		const word = text.replaceAll('’', "'").replaceAll("'", '');
		const pieces = this.segment(word.toLowerCase());
		if (pieces) {
			return pieces.map((p, i) => applyStress(p, i === 0 ? null : -1)).join('');
		}
		// Initials are spelt; anything else (names) is read by the letters' usual sounds.
		if (isUpper(word) || !/[aeiouy]/i.test(word)) return this.spell(word) ?? '';
		return soundOut(word.toLowerCase());
	}

	/**
	 * Splits a word into as few known words (3+ letters) as possible, longer
	 * pieces first ("windowling" = window + ling, not wind + owling).
	 */
	private segment(word: string): string[] | null {
		const best: ({ ps: string[]; first: number } | null)[] = new Array<{
			ps: string[];
			first: number;
		} | null>(word.length + 1).fill(null);
		best[0] = { ps: [], first: 0 };
		for (let end = 3; end <= word.length; end++) {
			for (let start = Math.max(0, end - 20); start <= end - 3; start++) {
				const before = best[start];
				if (!before) continue;
				const entry = this.entry(word.slice(start, end));
				const ps = typeof entry === 'object' ? entry.DEFAULT : entry;
				if (typeof ps !== 'string') continue;
				const candidate = { ps: [...before.ps, ps], first: start === 0 ? end : before.first };
				const current = best[end];
				if (
					!current ||
					candidate.ps.length < current.ps.length ||
					(candidate.ps.length === current.ps.length && candidate.first > current.first)
				) {
					best[end] = candidate;
				}
			}
		}
		const result = best[word.length];
		return result && result.ps.length > 0 ? result.ps : null;
	}

	/** Digits, with ordinals ("21st"), years ("1984") and decimals. */
	number(text: string): string {
		const match = /^(-?)([\d,]*\.?\d+)(st|nd|rd|th|s|'s)?$/.exec(text);
		if (!match) return '';
		const [, minus, digits = '', suffix] = match;
		const plain = digits.replaceAll(',', '');
		let words: string;
		if (suffix && ['st', 'nd', 'rd', 'th'].includes(suffix)) words = ordinal(Number(plain));
		else if (/^\d{4}$/.test(plain) && !minus && digits === plain) words = year(Number(plain));
		else if (plain.includes('.')) {
			const [whole = '0', fraction = ''] = plain.split('.');
			words = `${cardinal(Number(whole || '0'))} point ${[...fraction].map((d) => ONES[Number(d)] ?? '').join(' ')}`;
		} else if (plain.length > 15) words = [...plain].map((d) => ONES[Number(d)] ?? '').join(' ');
		else words = cardinal(Number(plain));
		if (minus) words = `minus ${words}`;
		const ps = words
			.split(/[^a-z]+/)
			.filter(Boolean)
			.map((w) => this.lookup(w, null, w === 'point' ? -2 : null, null) ?? '')
			.join(' ');
		return suffix === 's' || suffix === "'s" ? (plural(ps) ?? ps) : ps;
	}
}

/** -s: cats (s), dogs (z), horses (ᵻz). */
function plural(stem: string | null): string | null {
	if (!stem) return null;
	const last = stem.at(-1) ?? '';
	if ('ptkfθ'.includes(last)) return `${stem}s`;
	if ('szʃʒʧʤ'.includes(last)) return `${stem}ᵻz`;
	return `${stem}z`;
}

/** -ed: walked (t), played (d), wanted (ᵻd), "batted" with a flap. */
function past(stem: string | null): string | null {
	if (!stem) return null;
	const last = stem.at(-1) ?? '';
	if ('pkfθʃsʧ'.includes(last)) return `${stem}t`;
	if (last === 'd') return `${stem}ᵻd`;
	if (last !== 't') return `${stem}d`;
	if (stem.length < 2) return `${stem}ɪd`;
	if (US_TAUS.has(stem.at(-2) ?? '')) return `${stem.slice(0, -1)}ɾᵻd`;
	return `${stem}ᵻd`;
}

/** -ing, with a flap after a vowel: "getting" -> ɡɛɾɪŋ. */
function progressive(stem: string | null): string | null {
	if (!stem) return null;
	if (stem.length > 1 && stem.at(-1) === 't' && US_TAUS.has(stem.at(-2) ?? '')) {
		return `${stem.slice(0, -1)}ɾɪŋ`;
	}
	return `${stem}ɪŋ`;
}

/**
 * A rough reading by the letters' usual sounds, for names no dictionary has
 * ("Jiri" -> ʤˈɪɹi): longest spelling first, a silent final e, a magic e
 * lengthening the vowel before it, stress on the first vowel.
 */
const SPELLINGS: [string, string][] = [
	['tion', 'ʃən'],
	['sion', 'ʒən'],
	['ough', 'O'],
	['igh', 'I'],
	['tch', 'ʧ'],
	['sch', 'sk'],
	['ch', 'ʧ'],
	['sh', 'ʃ'],
	['th', 'θ'],
	['ph', 'f'],
	['ck', 'k'],
	['ng', 'ŋ'],
	['qu', 'kw'],
	['wh', 'w'],
	['kn', 'n'],
	['ee', 'i'],
	['ea', 'i'],
	['ie', 'i'],
	['oo', 'u'],
	['ai', 'A'],
	['ay', 'A'],
	['ei', 'A'],
	['ey', 'A'],
	['oa', 'O'],
	['ow', 'O'],
	['ou', 'W'],
	['oi', 'Y'],
	['oy', 'Y'],
	['au', 'ɔ'],
	['aw', 'ɔ'],
	['ar', 'ɑɹ'],
	['or', 'ɔɹ'],
	['er', 'əɹ'],
	['ir', 'ɜɹ'],
	['ur', 'ɜɹ'],
];
const LETTERS: Record<string, string> = {
	a: 'æ',
	b: 'b',
	c: 'k',
	d: 'd',
	e: 'ɛ',
	f: 'f',
	g: 'ɡ',
	h: 'h',
	i: 'ɪ',
	j: 'ʤ',
	k: 'k',
	l: 'l',
	m: 'm',
	n: 'n',
	o: 'ɑ',
	p: 'p',
	q: 'k',
	r: 'ɹ',
	s: 's',
	t: 't',
	u: 'ʌ',
	v: 'v',
	w: 'w',
	x: 'ks',
	y: 'j',
	z: 'z',
};
const LONG: Record<string, string> = { a: 'A', e: 'i', i: 'I', o: 'O', u: 'u' };

export function soundOut(word: string): string {
	let ps = '';
	let i = 0;
	while (i < word.length) {
		const rest = word.slice(i);
		const spelling = SPELLINGS.find(([letters]) => rest.startsWith(letters));
		if (spelling) {
			ps += spelling[1];
			i += spelling[0].length;
			continue;
		}
		const c = word.charAt(i);
		const next = word.charAt(i + 1);
		const end = i === word.length - 1;
		if (c === 'e' && end && ps.length > 1) break;
		if (c in LONG && /^[^aeiouy][e]$/.test(word.slice(i + 1))) ps += LONG[c] ?? '';
		else if (c === 'c' && 'eiy'.includes(next) && next) ps += 's';
		else if (c === 'y') ps += i === 0 ? 'j' : end ? 'i' : 'ɪ';
		else if (c === 'i' && end) ps += 'i';
		else if (c === 'o' && end) ps += 'O';
		else if (c === next) {
			i += 1;
			continue;
		} else ps += LETTERS[c] ?? '';
		i += 1;
	}
	const first = [...ps].findIndex((c) => VOWELS.has(c));
	return first < 0 ? ps : `${ps.slice(0, first)}${PRIMARY}${ps.slice(first)}`;
}

// --- text --------------------------------------------------------------------

interface Token {
	kind: 'word' | 'number' | 'punct';
	text: string;
	/** Space before it in the text. */
	space: boolean;
}

/** Plain quotes and dashes; stage directions (*sighs*) are acted, not read out. */
function normalize(text: string): string {
	return text
		.normalize('NFKC')
		.replace(/[‘’`]/g, "'")
		.replace(CURRENCY, money)
		.replace(CLOCK, clock)
		.replace(/\s+[-–]\s+/g, ' — ')
		.replace(/\*[^*]*\*/g, ' ')
		.replace(/[*_~#[\]{}<>|\\^]/g, ' ');
}

const CURRENCY = /([$£€])(\d[\d,]*)(?:\.(\d\d))?\b/g;
const UNITS: Record<string, [string, string]> = {
	$: ['dollar', 'cent'],
	'£': ['pound', 'penny'],
	'€': ['euro', 'cent'],
};

/** "$12.50" -> "12 dollars and 50 cents". */
function money(_: string, symbol: string, whole: string, cents: string | undefined): string {
	const [unit, small] = UNITS[symbol] ?? ['dollar', 'cent'];
	const count = (n: number, name: string) =>
		`${String(n)} ${n === 1 ? name : name === 'penny' ? 'pence' : `${name}s`}`;
	const big = Number(whole.replaceAll(',', ''));
	const little = Number(cents ?? '0');
	if (!little) return count(big, unit);
	if (!big) return count(little, small);
	return `${count(big, unit)} and ${count(little, small)}`;
}

const CLOCK = /\b(\d{1,2}):(\d\d)\b/g;

/** "7:30" -> "7 30", "7:05" -> "7 oh 5", "7:00" -> "7 o'clock". */
function clock(_: string, hours: string, minutes: string): string {
	const h = String(Number(hours));
	const m = Number(minutes);
	if (m === 0) return `${h} o'clock`;
	return m < 10 ? `${h} oh ${String(m)}` : `${h} ${String(m)}`;
}

const TOKEN =
	/(\s*)(?:(-?\d+(?:,\d{3})*(?:\.\d+)?(?:st|nd|rd|th|'s|s)?)|([A-Za-z]+(?:['][A-Za-z]+)*'?)|([%&+@])|([;:,.!?—…"“”()]))/g;

function tokenize(text: string): Token[] {
	const tokens: Token[] = [];
	for (const m of text.matchAll(TOKEN)) {
		const space = (m[1] ?? '').length > 0;
		if (m[2]) tokens.push({ kind: 'number', text: m[2], space });
		else if (m[3]) {
			// "hand-made", "well-known": hyphenated parts are separate words.
			tokens.push({ kind: 'word', text: m[3], space });
		} else if (m[4]) tokens.push({ kind: 'word', text: m[4], space });
		else if (m[5]) tokens.push({ kind: 'punct', text: m[5], space });
	}
	return tokens;
}

/** Words separated by spaces, punctuation stuck to the word it belongs to. */
function join(tokens: readonly Token[], phonemes: readonly string[]): string {
	let out = '';
	let opened = false;
	tokens.forEach((token, i) => {
		const ps = phonemes[i] ?? '';
		if (!ps) return;
		const punct = token.kind === 'punct';
		const opening = punct && ('“('.includes(token.text) || (token.text === '"' && token.space));
		const glued = opened || (punct && !opening);
		if (out && !glued && !out.endsWith(' ')) out += ' ';
		out += ps;
		opened = opening;
	});
	return out;
}
