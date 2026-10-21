<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import AccountMenu from '$lib/components/AccountMenu.svelte';
	import GameCanvas from '$lib/components/GameCanvas.svelte';
	import SettingsMenu from '$lib/components/SettingsMenu.svelte';
	import { settings } from '$lib/settings.svelte';
	import { sensorAccess } from '$lib/sensors/access.svelte';
	import { CombinedBrain } from '$lib/brain/choose';
	import { deviceBrain } from '$lib/brain/device-brain.svelte';
	import { authClient } from '$lib/auth-client';
	import { deviceTimeZone, rememberTimeZone } from '$lib/time-zone';
	import { onMount } from 'svelte';

	let { data } = $props();
	let failed = $state(false);

	// On-device model when downloaded and wanted, else the cloud (#28, #31).
	const brain = new CombinedBrain({
		world: () => data.world,
		preference: () => settings.brain,
		device: deviceBrain,
	});

	const RECHECK_AFTER_MS = 2_000;
	/** When the server still reports an ended activity (clock skew), don't hammer it. */
	const RETRY_AFTER_MS = 30_000;

	onMount(async () => {
		settings.restore();
		sensorAccess.init();
		void deviceBrain.detect();
		const timeZone = deviceTimeZone();
		rememberTimeZone(timeZone);
		if (data.user) {
			// The device moved to another zone since the last visit: let the server know.
			if (data.world && data.world.timeZone !== timeZone) await invalidateAll();
			return;
		}
		// First visit: become an anonymous player, which creates the world on the server.
		const { error } = await authClient.signIn.anonymous();
		if (error) {
			console.error('Anonymous sign-in failed', error);
			failed = true;
			return;
		}
		await invalidateAll();
	});

	/** Knocked awake: the server checks it was really asleep and applies the consequences. */
	async function wake() {
		try {
			const response = await fetch('/api/world/wake', { method: 'POST' });
			if (response.ok) await invalidateAll();
		} catch (error) {
			console.warn('Could not report waking the character', error);
		}
	}

	/** Shaken: remembered on the server; a hard shake may have woken it up. */
	async function shaken(intensity: number) {
		try {
			const response = await fetch('/api/world/shake', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ intensity }),
			});
			if (response.ok && ((await response.json()) as { woken?: boolean }).woken) {
				await invalidateAll();
			}
		} catch (error) {
			console.warn('Could not report the shake', error);
		}
	}

	// The server owns the life. When the current activity is over, ask it what comes next.
	let lastCheckedEndsAt = '';
	$effect(() => {
		const endsAt = data.world?.character.activity.endsAt;
		if (!endsAt) return;
		const dueIn = Date.parse(endsAt) - Date.now() + RECHECK_AFTER_MS;
		const delay = endsAt === lastCheckedEndsAt ? Math.max(dueIn, RETRY_AFTER_MS) : dueIn;
		const recheck = () => {
			lastCheckedEndsAt = endsAt;
			void invalidateAll();
		};
		const timer = setTimeout(recheck, Math.min(Math.max(delay, 0), 2 ** 31 - 1));
		// Timers stall in background tabs and sleeping phones: check again on return.
		const onVisible = () => {
			if (!document.hidden && Date.now() >= Date.parse(endsAt)) recheck();
		};
		document.addEventListener('visibilitychange', onVisible);
		return () => {
			clearTimeout(timer);
			document.removeEventListener('visibilitychange', onVisible);
		};
	});
</script>

<main class="relative h-dvh w-full overflow-hidden">
	<GameCanvas
		activity={data.world?.character.activity.type ?? null}
		mood={data.world?.character.mood ?? 0.6}
		onWoken={wake}
		onShaken={shaken}
		characterName={data.world?.character.name ?? 'Someone'}
		{brain}
		affinity={data.world?.character.relationship.affinity ?? 0}
		energy={data.world?.character.needs.energy ?? 0.7}
		hunger={data.world?.character.needs.hunger ?? 0.3}
		money={data.world?.character.money}
		worldId={data.world?.id ?? null}
	/>

	<header
		class="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-4 px-[max(1rem,env(safe-area-inset-left))] pt-[max(1rem,env(safe-area-inset-top))]"
	>
		<h1 class="text-sm font-medium tracking-[0.2em] text-white/60 uppercase">Windowling</h1>
		<div class="pointer-events-auto flex items-start gap-2">
			<AccountMenu user={data.user} googleEnabled={data.googleEnabled} />
			<SettingsMenu />
		</div>
	</header>

	<footer
		class="pointer-events-none absolute inset-x-0 bottom-0 px-[max(1rem,env(safe-area-inset-left))] pb-[max(1rem,env(safe-area-inset-bottom))] text-xs text-white/50"
		data-testid="world-status"
		data-world-id={data.world?.id ?? ''}
		data-time-zone={data.world?.timeZone ?? ''}
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
