<script lang="ts">
	import {
		isSilent,
		microphoneProblem,
		Recorder,
		type MicrophoneProblem,
	} from '$lib/voice/recorder';
	import {
		cleanTranscript,
		WHISPER_DOWNLOAD_MB,
		WhisperInBrowser,
		type SpeechToText,
	} from '$lib/voice/stt';
	import { onDestroy } from 'svelte';

	interface Props {
		/** Only offered while the character is at the window, paying attention. */
		visible: boolean;
		characterName: string;
		onUtterance: (text: string) => void;
		/** The player is busy answering (pressing, downloading): the character keeps waiting. */
		onActivity: () => void;
		/** The microphone is on: the character stops talking and listens. */
		onListening?: () => void;
	}

	let { visible, characterName, onUtterance, onActivity, onListening }: Props = $props();

	type State = 'off' | 'consent' | 'loading' | 'ready' | 'recording' | 'listening' | 'error';
	const CONSENT_KEY = 'windowling:stt-consent';

	let phase = $state<State>('off');
	let percent = $state(0);
	let heard = $state('');
	/** Nothing understandable came through - say so instead of silently doing nothing. */
	let missed = $state(false);
	let missedTimer: ReturnType<typeof setTimeout> | undefined;
	/** Why the last attempt failed - the label tells the player what to do. */
	let problem = $state<MicrophoneProblem | 'loading'>('failed');
	let stt: SpeechToText | undefined;
	const recorder = new Recorder();
	recorder.onLimit = () => void release();

	function consented(): boolean {
		try {
			return localStorage.getItem(CONSENT_KEY) === 'yes';
		} catch {
			return false;
		}
	}

	async function prepare() {
		try {
			localStorage.setItem(CONSENT_KEY, 'yes');
		} catch {
			// Asked again next visit - fine.
		}
		phase = 'loading';
		stt ??= new WhisperInBrowser();
		const keepWaiting = setInterval(onActivity, 5_000);
		try {
			await stt.load((p) => (percent = Math.round(p)));
			phase = 'ready';
		} catch (error) {
			console.error('Speech recognition failed to load', error);
			stt?.dispose();
			stt = undefined;
			problem = 'loading';
			phase = 'error';
		} finally {
			clearInterval(keepWaiting);
		}
	}

	async function press() {
		onActivity();
		if (phase === 'error') phase = stt ? 'ready' : 'off';
		if (phase === 'off') {
			if (consented()) await prepare();
			else phase = 'consent';
			return;
		}
		if (phase !== 'ready') return;
		try {
			await recorder.start();
			phase = 'recording';
			missed = false;
			onListening?.();
		} catch (error) {
			console.warn('Microphone unavailable', error);
			problem = microphoneProblem(error);
			phase = 'error';
		}
	}

	async function release() {
		if (phase !== 'recording') return;
		phase = 'listening';
		try {
			const audio = await recorder.stop();
			const text = isSilent(audio) || !stt ? '' : cleanTranscript(await stt.transcribe(audio));
			if (text) {
				heard = text;
				setTimeout(() => (heard = ''), 4_000);
				onUtterance(text);
			} else showMissed();
		} catch (error) {
			console.warn('Could not understand that', error);
			showMissed();
		}
		phase = 'ready';
	}

	function showMissed() {
		missed = true;
		clearTimeout(missedTimer);
		missedTimer = setTimeout(() => (missed = false), 3_000);
	}

	let button = $state<HTMLButtonElement>();

	// Desktop: hold Space to talk (also when the talk button itself has focus).
	function onKey(event: KeyboardEvent, down: boolean) {
		if (!visible || event.code !== 'Space' || event.repeat) return;
		if (
			event.target instanceof HTMLElement &&
			event.target !== button &&
			event.target.closest('input, textarea, select, button')
		)
			return;
		event.preventDefault();
		if (down) void press();
		else void release();
	}

	onDestroy(() => {
		clearTimeout(missedTimer);
		void recorder.stop();
		stt?.dispose();
	});

	const LABEL: Record<State, string> = {
		off: 'Talk',
		consent: 'Talk',
		loading: 'Getting ready…',
		ready: 'Tap to talk',
		recording: 'Listening… tap when done',
		listening: 'Thinking…',
		error: "Couldn't hear you · tap to retry",
	};

	const PROBLEM: Record<MicrophoneProblem | 'loading', string> = {
		loading: "Couldn't load speech recognition · tap to retry",
		denied: 'Microphone blocked - allow it for this site, then tap',
		unsupported: "This browser can't use the microphone - open the page in Chrome or Safari",
		failed: "Couldn't start the microphone · tap to retry",
	};

	/** Tap to start talking, tap again to stop (holding works too - see onpointerup). */
	let pressedAt = 0;
	function onPointerDown(event: PointerEvent) {
		event.stopPropagation();
		pressedAt = performance.now();
		if (phase === 'recording') void release();
		else void press();
	}
	function onPointerUp() {
		// A long press means "hold to talk": releasing ends it. A tap keeps recording.
		if (phase === 'recording' && performance.now() - pressedAt > 600) void release();
	}
</script>

<svelte:window onkeydown={(e) => onKey(e, true)} onkeyup={(e) => onKey(e, false)} />

{#if visible}
	<div
		class="pointer-events-auto absolute inset-x-0 bottom-[max(6.5rem,calc(env(safe-area-inset-bottom)+6rem))] flex flex-col items-center gap-2 px-4"
	>
		{#if heard}
			<p class="max-w-md rounded-lg bg-white/15 px-3 py-1 text-sm text-white/90 backdrop-blur">
				<span class="text-white/60">You:</span>
				{heard}
			</p>
		{/if}

		{#if phase === 'consent'}
			<div
				class="max-w-sm rounded-xl bg-neutral-900/90 p-4 text-sm text-white shadow-lg backdrop-blur"
				role="dialog"
				aria-label="Let them hear you"
			>
				<p>
					Let {characterName} hear you? This downloads speech recognition once (~{WHISPER_DOWNLOAD_MB}
					MB). Your voice stays on this device.
				</p>
				<div class="mt-3 flex justify-end gap-2">
					<button
						class="rounded-full px-3 py-1.5 text-white/70 hover:bg-white/10"
						onclick={() => (phase = 'off')}>Not now</button
					>
					<button class="rounded-full bg-white/20 px-3 py-1.5 hover:bg-white/30" onclick={prepare}
						>Allow</button
					>
				</div>
			</div>
		{:else}
			<button
				class="flex touch-none items-center gap-2 rounded-full px-5 py-3 text-sm text-white backdrop-blur transition select-none {phase ===
				'recording'
					? 'bg-red-500/70'
					: 'bg-white/15 hover:bg-white/25'}"
				bind:this={button}
				data-testid="talk-button"
				data-phase={phase}
				data-missed={missed}
				disabled={phase === 'loading' || phase === 'listening'}
				data-problem={phase === 'error' ? problem : ''}
				onpointerdown={onPointerDown}
				onpointerup={onPointerUp}
				oncontextmenu={(e) => e.preventDefault()}
			>
				<svg viewBox="0 0 24 24" class="size-4" fill="currentColor" aria-hidden="true">
					<path
						d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z"
					/>
				</svg>
				{phase === 'loading'
					? `${LABEL.loading} ${percent}%`
					: phase === 'error'
						? PROBLEM[problem]
						: phase === 'ready' && missed
							? "Didn't catch that · tap to talk"
							: LABEL[phase]}
			</button>
		{/if}
	</div>
{/if}
