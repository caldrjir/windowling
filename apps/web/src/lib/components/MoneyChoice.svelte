<script lang="ts">
	import { dollars, envelope } from '$lib/money/envelope.svelte';

	interface Props {
		/** Only while the character is at the window, waiting for the answer. */
		visible: boolean;
		characterName: string;
		/** The player is answering: the character keeps waiting. */
		onActivity: () => void;
	}

	let { visible, characterName, onActivity }: Props = $props();

	function onAnswer(yes: boolean) {
		onActivity();
		void envelope.answer(yes);
	}
	const question = $derived(visible ? envelope.question : null);
</script>

{#if question}
	<div
		class="pointer-events-auto absolute inset-x-0 bottom-[max(11rem,calc(env(safe-area-inset-bottom)+10.5rem))] flex justify-center gap-2 px-4"
		role="group"
		aria-label="Your answer"
		data-testid="money-choice"
		data-kind={question.kind}
	>
		{#if question.kind === 'entrust'}
			<button
				class="rounded-full bg-amber-200/90 px-4 py-2 text-sm font-medium text-neutral-900 shadow-lg hover:bg-amber-100"
				disabled={envelope.busy}
				onclick={() => onAnswer(true)}>Keep {dollars(question.cents)} for {characterName}</button
			>
			<button
				class="rounded-full bg-white/15 px-4 py-2 text-sm text-white backdrop-blur hover:bg-white/25"
				disabled={envelope.busy}
				onclick={() => onAnswer(false)}>No, keep it</button
			>
		{:else}
			<button
				class="rounded-full bg-amber-200/90 px-4 py-2 text-sm font-medium text-neutral-900 shadow-lg hover:bg-amber-100"
				disabled={envelope.busy}
				onclick={() => onAnswer(true)}>Give back {dollars(question.cents)}</button
			>
			<button
				class="rounded-full bg-white/15 px-4 py-2 text-sm text-white backdrop-blur hover:bg-white/25"
				disabled={envelope.busy}
				onclick={() => onAnswer(false)}>Not yet</button
			>
		{/if}
	</div>
{/if}
