<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import AccountMenu from '$lib/components/AccountMenu.svelte';
	import GameCanvas from '$lib/components/GameCanvas.svelte';
	import { authClient } from '$lib/auth-client';
	import { onMount } from 'svelte';

	let { data } = $props();
	let failed = $state(false);

	// First visit: become an anonymous player, which creates the world on the server.
	onMount(async () => {
		if (data.user) return;
		const { error } = await authClient.signIn.anonymous();
		if (error) {
			console.error('Anonymous sign-in failed', error);
			failed = true;
			return;
		}
		await invalidateAll();
	});
</script>

<main class="relative h-dvh w-full overflow-hidden">
	<GameCanvas />

	<header
		class="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-4 px-[max(1rem,env(safe-area-inset-left))] pt-[max(1rem,env(safe-area-inset-top))]"
	>
		<h1 class="text-sm font-medium tracking-[0.2em] text-white/60 uppercase">Windowling</h1>
		<div class="pointer-events-auto">
			<AccountMenu user={data.user} googleEnabled={data.googleEnabled} />
		</div>
	</header>

	<footer
		class="pointer-events-none absolute inset-x-0 bottom-0 px-[max(1rem,env(safe-area-inset-left))] pb-[max(1rem,env(safe-area-inset-bottom))] text-xs text-white/50"
		data-testid="world-status"
		data-world-id={data.world?.id ?? ''}
	>
		{#if data.world}
			{data.world.character.name}'s place
		{:else if failed}
			Could not open the window. Try reloading.
		{:else}
			Looking for someone…
		{/if}
	</footer>
</main>
