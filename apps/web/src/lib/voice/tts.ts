/** How a line should sound. Mirrors the decision's emotion. */
export interface SpeakOptions {
	emotion: string;
	/** 0..1 */
	intensity: number;
	/** A new word starts (drives the mouth). */
	onWord?: () => void;
}

/**
 * The character's voice. Swappable: the browser's built-in voices today,
 * a neural voice later.
 *
 * TODO(#32): replace the default with the best possible neural voice
 * (natural, emotional, local and free) once licensing and self-hosting are
 * solved - see https://github.com/caldrjir/windowling/issues/32.
 */
export interface TextToSpeech {
	/** False when this device cannot speak at all (subtitles take over). */
	readonly available: boolean;
	speak(text: string, options: SpeakOptions): Promise<void>;
	cancel(): void;
}

/** Voice character per emotion: a bit slower when sad or tired, faster when angry. */
const PROSODY: Record<string, { rate: number; pitch: number }> = {
	happy: { rate: 1.05, pitch: 1.1 },
	sad: { rate: 0.88, pitch: 0.9 },
	tired: { rate: 0.85, pitch: 0.92 },
	angry: { rate: 1.1, pitch: 0.95 },
	annoyed: { rate: 1.05, pitch: 0.97 },
	surprised: { rate: 1.08, pitch: 1.15 },
	embarrassed: { rate: 0.95, pitch: 1.05 },
	nervous: { rate: 1.1, pitch: 1.05 },
};

/** Joke voices some systems ship (macOS: Bubbles, Bells, Zarvox...) - never a person's voice. */
const NOVELTY =
	/\b(albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|fred|good news|grandma|grandpa|hysterical|jester|junior|kathy|organ|princess|ralph|rocko|sandy|shelley|superstar|trinoids|whisper|wobble|zarvox|eddy|flo|reed)\b/i;

type VoiceInfo = Pick<SpeechSynthesisVoice, 'name' | 'lang' | 'localService'>;

/**
 * How good a voice is likely to sound as a person, or null when it must not
 * be used (not English, a joke voice). Names are all browsers give us.
 */
export function voiceQuality(voice: VoiceInfo): number | null {
	if (!voice.lang.toLowerCase().startsWith('en') || NOVELTY.test(voice.name)) return null;
	let score = 0;
	if (/natural|neural/i.test(voice.name)) score += 6;
	if (/premium|enhanced|siri/i.test(voice.name)) score += 5;
	if (/google/i.test(voice.name)) score += 4;
	// Decent built-in voices on Apple devices and Windows.
	if (/samantha|daniel|karen|moira|tessa|serena|alex|ava|zoe|aria|jenny|guy/i.test(voice.name)) {
		score += 2;
	}
	if (/espeak|robot/i.test(voice.name)) score -= 4;
	if (/^en[-_](us|gb)/i.test(voice.lang)) score += 1;
	return score;
}

/**
 * The voice for this character: on-device voices first (nothing is sent
 * anywhere), the best-sounding of those, the same one every visit (`seed`
 * picks among equally good ones).
 */
export function pickVoice<V extends VoiceInfo>(voices: readonly V[], seed: number): V | null {
	const usable = voices.filter((v) => voiceQuality(v) !== null);
	const local = usable.filter((v) => v.localService);
	const pool = local.length ? local : usable;
	const best = Math.max(...pool.map((v) => voiceQuality(v) ?? 0));
	const top = pool.filter((v) => voiceQuality(v) === best);
	return top[seed % Math.max(1, top.length)] ?? null;
}

/**
 * `speechSynthesis` with an English voice, preferring ones that run on the
 * device (`localService`). No download, but quality depends on the OS.
 */
export class BrowserSpeech implements TextToSpeech {
	private voice: SpeechSynthesisVoice | null = null;

	constructor(private readonly seed = 0) {
		if (!this.available) return;
		this.pickVoice();
		speechSynthesis.addEventListener('voiceschanged', () => this.pickVoice());
	}

	get available(): boolean {
		return typeof window !== 'undefined' && 'speechSynthesis' in window;
	}

	private pickVoice(): void {
		this.voice = pickVoice(speechSynthesis.getVoices(), this.seed);
	}

	speak(text: string, { emotion, intensity, onWord }: SpeakOptions): Promise<void> {
		if (!this.available) return Promise.resolve();
		return new Promise((resolve) => {
			const utterance = new SpeechSynthesisUtterance(text);
			utterance.lang = this.voice?.lang ?? 'en-US';
			if (this.voice) utterance.voice = this.voice;
			const prosody = PROSODY[emotion] ?? { rate: 1, pitch: 1 };
			const k = Math.min(1, Math.max(0, intensity));
			utterance.rate = 1 + (prosody.rate - 1) * k;
			utterance.pitch = 1 + (prosody.pitch - 1) * k;
			utterance.onboundary = (event) => {
				if (event.name === 'word') onWord?.();
			};
			// Some engines (headless, broken voices) never fire `end`: don't hang the conversation.
			const guard = setTimeout(resolve, 4_000 + text.length * 120);
			const done = () => {
				clearTimeout(guard);
				resolve();
			};
			utterance.onend = done;
			utterance.onerror = done;
			speechSynthesis.cancel();
			speechSynthesis.speak(utterance);
		});
	}

	cancel(): void {
		if (this.available) speechSynthesis.cancel();
	}
}
