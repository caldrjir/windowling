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
	/** Phone tilt drives gravity in the room. */
	tilt: boolean;
	/** Shaking the phone shakes the room. */
	shake: boolean;
}

const KEY = 'windowling:settings';
// Subtitles on by default: we can't tell whether the device actually plays the voice.
const DEFAULTS: Stored = {
	subtitles: 'always',
	voice: true,
	brain: 'auto',
	tilt: true,
	shake: true,
};

const bool = (value: unknown): boolean | undefined =>
	typeof value === 'boolean' ? value : undefined;

function load(): Stored {
	try {
		const raw = localStorage.getItem(KEY);
		if (!raw) return DEFAULTS;
		const parsed = JSON.parse(raw) as Partial<Stored>;
		const legacy = parsed as { sensors?: unknown };
		return {
			subtitles: ['off', 'auto', 'always'].includes(parsed.subtitles ?? '')
				? (parsed.subtitles as SubtitleMode)
				: DEFAULTS.subtitles,
			voice: typeof parsed.voice === 'boolean' ? parsed.voice : DEFAULTS.voice,
			// Before tilt and shake were separate there was one `sensors` switch.
			tilt: bool(parsed.tilt) ?? bool(legacy.sensors) ?? DEFAULTS.tilt,
			shake: bool(parsed.shake) ?? bool(legacy.sensors) ?? DEFAULTS.shake,
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
	tilt = $state(DEFAULTS.tilt);
	shake = $state(DEFAULTS.shake);

	/** Call once in the browser (onMount). */
	restore(): void {
		const stored = load();
		this.subtitles = stored.subtitles;
		this.voice = stored.voice;
		this.brain = stored.brain;
		this.tilt = stored.tilt;
		this.shake = stored.shake;
	}

	save(): void {
		try {
			localStorage.setItem(
				KEY,
				JSON.stringify({
					subtitles: this.subtitles,
					voice: this.voice,
					brain: this.brain,
					tilt: this.tilt,
					shake: this.shake,
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
