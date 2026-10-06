/**
 * Per-viewer preferences (this browser only). Stored in localStorage, which
 * may be unavailable (private mode) - the defaults then simply apply.
 */
import type { BrainPreference } from './brain/choose';

export type SubtitleMode = 'off' | 'auto' | 'always';

interface Stored {
	subtitles: SubtitleMode;
	voice: boolean;
	brain: BrainPreference;
	/** Tilt and shake (phones). */
	sensors: boolean;
}

const KEY = 'windowling:settings';
// Subtitles on by default: we can't tell whether the device actually plays the voice.
const DEFAULTS: Stored = { subtitles: 'always', voice: true, brain: 'auto', sensors: true };

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
			sensors: typeof parsed.sensors === 'boolean' ? parsed.sensors : DEFAULTS.sensors,
			brain: ['auto', 'device', 'cloud'].includes(parsed.brain ?? '')
				? (parsed.brain as BrainPreference)
				: DEFAULTS.brain,
		};
	} catch {
		return DEFAULTS;
	}
}

class Settings {
	subtitles = $state<SubtitleMode>(DEFAULTS.subtitles);
	voice = $state(DEFAULTS.voice);
	brain = $state<BrainPreference>(DEFAULTS.brain);
	sensors = $state(DEFAULTS.sensors);

	/** Call once in the browser (onMount). */
	restore(): void {
		const stored = load();
		this.subtitles = stored.subtitles;
		this.voice = stored.voice;
		this.brain = stored.brain;
		this.sensors = stored.sensors;
	}

	save(): void {
		try {
			localStorage.setItem(
				KEY,
				JSON.stringify({
					subtitles: this.subtitles,
					voice: this.voice,
					brain: this.brain,
					sensors: this.sensors,
				}),
			);
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
