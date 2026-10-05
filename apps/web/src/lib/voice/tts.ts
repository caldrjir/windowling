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
		const english = speechSynthesis
			.getVoices()
			.filter((v) => v.lang.toLowerCase().startsWith('en'));
		const local = english.filter((v) => v.localService);
		const pool = local.length ? local : english;
		// Stable per character: the same voice every visit.
		this.voice = pool.length ? (pool[this.seed % pool.length] ?? null) : null;
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
