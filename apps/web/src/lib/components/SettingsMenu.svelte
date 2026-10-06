<script lang="ts">
	import type { BrainPreference } from '$lib/brain/choose';
	import { DEVICE_MODEL_DOWNLOAD_GB, deviceBrain } from '$lib/brain/device-brain.svelte';
	import { settings, type SubtitleMode } from '$lib/settings.svelte';
	import { sensorAccess } from '$lib/sensors/access.svelte';

	let open = $state(false);

	const MODES: Array<{ value: SubtitleMode; label: string }> = [
		{ value: 'off', label: 'Off' },
		{ value: 'auto', label: 'Auto' },
		{ value: 'always', label: 'Always' },
	];

	function setSubtitles(mode: SubtitleMode) {
		settings.subtitles = mode;
		settings.save();
	}

	const BRAINS: Array<{ value: BrainPreference; label: string }> = [
		{ value: 'auto', label: 'Auto' },
		{ value: 'device', label: 'Device' },
		{ value: 'cloud', label: 'Cloud' },
	];

	function setBrain(brain: BrainPreference) {
		settings.brain = brain;
		settings.save();
	}

	async function downloadBrain() {
		try {
			await deviceBrain.download();
		} catch (error) {
			console.error('Could not set up the on-device brain', error);
		}
	}

	/** Tilt and shake can be switched separately. */
	async function toggleSensor(which: 'tilt' | 'shake', event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		// What the player sees: on only when both wanted and allowed.
		const on = !(settings[which] && sensorAccess.granted);
		// Browsers that gate motion (iOS, newer Chromium) ask now - it has to come from this tap.
		if (on && !sensorAccess.granted) await sensorAccess.request();
		settings[which] = on;
		settings.save();
		input.checked = settings[which] && sensorAccess.granted;
	}

	function toggleVoice() {
		settings.voice = !settings.voice;
		settings.save();
	}
</script>

<div class="relative">
	<button
		class="grid size-9 place-items-center rounded-full bg-white/10 text-white/80 backdrop-blur transition hover:bg-white/20"
		aria-label="Settings"
		aria-expanded={open}
		onclick={() => (open = !open)}
	>
		<svg viewBox="0 0 24 24" class="size-5" fill="none" stroke="currentColor" stroke-width="1.8">
			<path d="M4 7h10M18 7h2M4 17h4M12 17h8" stroke-linecap="round" />
			<circle cx="16" cy="7" r="2" />
			<circle cx="10" cy="17" r="2" />
		</svg>
	</button>

	{#if open}
		<div
			class="absolute right-0 mt-2 w-56 rounded-xl bg-neutral-900/90 p-3 text-sm text-white shadow-lg backdrop-blur"
			role="dialog"
			aria-label="Settings"
		>
			<label class="flex items-center justify-between gap-3 py-1">
				<span>Voice</span>
				<input type="checkbox" checked={settings.voice} onchange={toggleVoice} />
			</label>
			{#if sensorAccess.available}
				<label class="flex items-center justify-between gap-3 py-1">
					<span>Tilt the room</span>
					<input
						type="checkbox"
						data-testid="tilt-toggle"
						checked={settings.tilt && sensorAccess.granted}
						onchange={(e) => toggleSensor('tilt', e)}
					/>
				</label>
				<label class="flex items-center justify-between gap-3 py-1">
					<span>Shake the room</span>
					<input
						type="checkbox"
						data-testid="shake-toggle"
						checked={settings.shake && sensorAccess.granted}
						onchange={(e) => toggleSensor('shake', e)}
					/>
				</label>
			{/if}
			<div class="pt-2">
				<span class="text-white/70">Subtitles</span>
				<div class="mt-1 flex gap-1" role="radiogroup" aria-label="Subtitles">
					{#each MODES as mode (mode.value)}
						<button
							role="radio"
							aria-checked={settings.subtitles === mode.value}
							class="flex-1 rounded-md px-2 py-1 transition {settings.subtitles === mode.value
								? 'bg-white/25'
								: 'bg-white/5 hover:bg-white/15'}"
							onclick={() => setSubtitles(mode.value)}>{mode.label}</button
						>
					{/each}
				</div>
			</div>
			<div class="pt-3">
				<span class="text-white/70">Brain</span>
				<div class="mt-1 flex gap-1" role="radiogroup" aria-label="Brain">
					{#each BRAINS as brain (brain.value)}
						<button
							role="radio"
							aria-checked={settings.brain === brain.value}
							class="flex-1 rounded-md px-2 py-1 transition {settings.brain === brain.value
								? 'bg-white/25'
								: 'bg-white/5 hover:bg-white/15'}"
							onclick={() => setBrain(brain.value)}>{brain.label}</button
						>
					{/each}
				</div>
				<p
					class="mt-2 text-xs text-white/60"
					data-testid="device-brain"
					data-status={deviceBrain.status}
				>
					{#if deviceBrain.status === 'unsupported'}
						This device can't run the brain locally (needs WebGPU) - the cloud is used.
					{:else if deviceBrain.status === 'absent'}
						Thinks on this device, privately and offline-ready.
						<button
							class="mt-1 block rounded-md bg-white/15 px-2 py-1 text-white hover:bg-white/25"
							onclick={downloadBrain}>Download (~{DEVICE_MODEL_DOWNLOAD_GB} GB, once)</button
						>
					{:else if deviceBrain.status === 'downloading' || deviceBrain.status === 'loading'}
						Getting the brain ready… {deviceBrain.progress}%
					{:else if deviceBrain.status === 'ready' || deviceBrain.status === 'downloaded'}
						On-device brain ready.
					{:else if deviceBrain.status === 'error'}
						Couldn't start the on-device brain - the cloud is used.
					{:else}
						Checking this device…
					{/if}
				</p>
			</div>
		</div>
	{/if}
</div>
