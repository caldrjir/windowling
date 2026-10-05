/**
 * Per-viewer preferences (this browser only). Stored in localStorage, which
 * may be unavailable (private mode) - the defaults then simply apply.
 */
export type SubtitleMode = 'off' | 'auto' | 'always';

interface Stored {
	subtitles: SubtitleMode;
	voice: boolean;
}

const KEY = 'windowling:settings';
const DEFAULTS: Stored = { subtitles: 'auto', voice: true };

function load(): Stored {
	try {
		const raw = localStorage.getItem(KEY);
		if (!raw) return DEFAULTS;
		const parsed = JSON.parse(raw) as Partial<Stored>;
		return {
			subtitles: ['off', 'auto', 'always'].includes(parsed.subtitles ?? '')
				? (parsed.subtitles as SubtitleMode)
				: DEFAULTS.subtitles,
			voice: typeof parsed.voice === 'boolean' ? parsed.voice : DEFAULTS.voice,
		};
	} catch {
		return DEFAULTS;
	}
}

class Settings {
	subtitles = $state<SubtitleMode>(DEFAULTS.subtitles);
	voice = $state(DEFAULTS.voice);

	/** Call once in the browser (onMount). */
	restore(): void {
		const stored = load();
		this.subtitles = stored.subtitles;
		this.voice = stored.voice;
	}

	save(): void {
		try {
			localStorage.setItem(KEY, JSON.stringify({ subtitles: this.subtitles, voice: this.voice }));
		} catch {
			// Not persisted - fine, it still applies for this visit.
		}
	}
}

export const settings = new Settings();

/** AUTO: show the words when the voice can't be heard. */
export function showSubtitles(mode: SubtitleMode, voiceAudible: boolean): boolean {
	return mode === 'always' || (mode === 'auto' && !voiceAudible);
}
