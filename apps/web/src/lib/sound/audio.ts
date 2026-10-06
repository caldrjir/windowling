let context: AudioContext | undefined;

/**
 * One shared AudioContext. Browsers only let it play after a user gesture,
 * so it is created/resumed from the first tap or key press (see unlockAudio).
 */
export function audio(): AudioContext | undefined {
	return context;
}

export function unlockAudio(): void {
	try {
		context ??= new AudioContext();
		if (context.state === 'suspended') void context.resume();
	} catch {
		// No audio on this device - everything still works silently.
	}
}
