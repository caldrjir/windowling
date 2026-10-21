<script lang="ts">
	import { dollars, envelope } from '$lib/money/envelope.svelte';
	import { ITEM_IDS, ITEMS, type ItemId, type RoomBelongings } from '@windowling/shared';

	interface Props {
		characterName: string;
		/** What it has (or waits for): no presents it already owns. */
		belongings?: RoomBelongings;
	}

	let { characterName, belongings }: Props = $props();
	let open = $state(false);
	let sent = $state<ItemId | null>(null);
	const owned = $derived(
		new Set<ItemId>([
			...(belongings?.items ?? []),
			...(belongings?.parcels ?? []),
			...(belongings?.ordered ?? []),
			...(belongings?.stored ?? []),
		]),
	);
	const gifts = $derived(ITEM_IDS.filter((id) => !owned.has(id)));

	async function give(item: ItemId) {
		if (await envelope.buyGift(item)) sent = item;
	}
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
				{#if sent}
					<p class="mt-3 text-white/70" data-testid="gift-sent">
						{ITEMS[sent].name} is on its way to {characterName}.
					</p>
				{:else if gifts.length}
					<p class="mt-3 text-white/60">Or buy {characterName} something with it:</p>
					<ul class="mt-1 space-y-1" data-testid="gifts">
						{#each gifts as id (id)}
							<li>
								<button
									class="flex w-full justify-between gap-2 rounded-md px-2 py-1 text-left hover:bg-white/15 disabled:opacity-40"
									disabled={envelope.busy || ITEMS[id].price > envelope.cents}
									onclick={() => void give(id)}
									><span>{ITEMS[id].name}</span><span class="text-white/60"
										>{dollars(ITEMS[id].price)}</span
									></button
								>
							</li>
						{/each}
					</ul>
				{/if}
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
