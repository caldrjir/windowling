<script lang="ts">
	import { dollars, envelope } from '$lib/money/envelope.svelte';

	interface Props {
		characterName: string;
	}

	let { characterName }: Props = $props();
	let open = $state(false);
</script>

<!-- The savings the player keeps for the character: a paper envelope, not a balance. -->
{#if envelope.cents > 0}
	<div class="pointer-events-auto absolute top-14 left-[max(1rem,env(safe-area-inset-left))]">
		<button
			class="envelope relative grid h-10 w-14 place-items-center rounded-sm text-sm text-neutral-800 shadow-md"
			aria-label="The envelope you keep for {characterName}"
			aria-expanded={open}
			data-testid="envelope"
			data-cents={envelope.cents}
			onclick={() => (open = !open)}
		>
			<span class="hand relative z-10 -rotate-6">{dollars(envelope.cents)}</span>
		</button>
		{#if open}
			<div
				class="mt-2 w-56 rounded-xl bg-neutral-900/90 p-3 text-sm text-white shadow-lg backdrop-blur"
				role="dialog"
				aria-label="Envelope"
			>
				<p class="text-white/80">
					You're keeping {dollars(envelope.cents)} of {characterName}'s savings.
				</p>
				<button
					class="mt-2 rounded-md bg-white/15 px-2 py-1 hover:bg-white/25"
					disabled={envelope.busy}
					onclick={() => {
						open = false;
						void envelope.giveBack();
					}}>Give it all back</button
				>
			</div>
		{/if}
	</div>
{/if}

<style>
	.envelope {
		background:
			linear-gradient(155deg, transparent 49%, rgb(0 0 0 / 0.12) 50%, transparent 52%) top left /
				50% 60% no-repeat,
			linear-gradient(205deg, transparent 49%, rgb(0 0 0 / 0.12) 50%, transparent 52%) top right /
				50% 60% no-repeat,
			#f3e6c8;
	}

	.hand {
		font-family: 'Segoe Print', 'Bradley Hand', 'Comic Sans MS', cursive;
	}
</style>
