<script lang="ts">
	import { isSilent, Recorder } from '$lib/voice/recorder';
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
	}

	let { visible, characterName, onUtterance, onActivity }: Props = $props();

	type State = 'off' | 'consent' | 'loading' | 'ready' | 'recording' | 'listening' | 'error';
	const CONSENT_KEY = 'windowling:stt-consent';

	let phase = $state<State>('off');
	let percent = $state(0);
	let heard = $state('');
	let stt: SpeechToText | undefined;
	const recorder = new Recorder();

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
		} catch (error) {
			console.warn('Microphone unavailable', error);
			phase = 'error';
		}
	}

	async function release() {
		if (phase !== 'recording') return;
		phase = 'listening';
		try {
			const audio = await recorder.stop();
			if (isSilent(audio) || !stt) {
				phase = 'ready';
				return;
			}
			const text = cleanTranscript(await stt.transcribe(audio));
			if (text) {
				heard = text;
				setTimeout(() => (heard = ''), 4_000);
				onUtterance(text);
			}
		} catch (error) {
			console.warn('Could not understand that', error);
		}
		phase = 'ready';
	}

	// Desktop: hold Space to talk.
	function onKey(event: KeyboardEvent, down: boolean) {
		if (!visible || event.code !== 'Space' || event.repeat) return;
		if (
			event.target instanceof HTMLElement &&
			event.target.closest('input, textarea, select, button')
		)
			return;
		event.preventDefault();
		if (down) void press();
		else void release();
	}

	onDestroy(() => {
		void recorder.stop();
		stt?.dispose();
	});

	const LABEL: Record<State, string> = {
		off: 'Talk',
		consent: 'Talk',
		loading: 'Getting ready…',
		ready: 'Hold to talk',
		recording: 'Listening…',
		listening: 'Thinking…',
		error: "Couldn't hear you · tap to retry",
	};
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
				data-testid="talk-button"
				data-phase={phase}
				disabled={phase === 'loading' || phase === 'listening'}
				onpointerdown={(e) => {
					e.stopPropagation();
					void press();
				}}
				onpointerup={() => void release()}
				onpointerleave={() => void release()}
				onpointercancel={() => void release()}
				oncontextmenu={(e) => e.preventDefault()}
			>
				<svg viewBox="0 0 24 24" class="size-4" fill="currentColor" aria-hidden="true">
					<path
						d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z"
					/>
				</svg>
				{phase === 'loading' ? `${LABEL.loading} ${percent}%` : LABEL[phase]}
			</button>
		{/if}
	</div>
{/if}
