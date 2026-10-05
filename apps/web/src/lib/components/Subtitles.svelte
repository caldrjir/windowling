<script lang="ts">
	interface Props {
		/** The line being spoken, or null when nobody talks. */
		line: string | null;
		speaker: string;
		/** Off, or AUTO while the voice can be heard: the line is spoken but not shown. */
		visible: boolean;
	}

	let { line, speaker, visible }: Props = $props();
</script>

<div
	class="pointer-events-none absolute inset-x-0 bottom-[max(3.5rem,calc(env(safe-area-inset-bottom)+3rem))] flex justify-center px-4"
	aria-live="polite"
	data-testid="subtitles"
	data-line={line ?? ''}
>
	{#if line && visible}
		<p
			class="max-w-xl rounded-lg bg-black/60 px-4 py-2 text-center text-base text-white backdrop-blur"
		>
			<span class="sr-only">{speaker}:</span>
			{line}
		</p>
	{/if}
</div>
