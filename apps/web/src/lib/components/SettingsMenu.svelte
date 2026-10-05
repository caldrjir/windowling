<script lang="ts">
	import { settings, type SubtitleMode } from '$lib/settings.svelte';

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
		</div>
	{/if}
</div>
