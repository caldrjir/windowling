<script lang="ts">
	import type { GameWorld } from '@windowling/game';
	import { onMount } from 'svelte';

	type Status = 'loading' | 'running' | 'unsupported';

	let canvas: HTMLCanvasElement;
	let status = $state<Status>('loading');

	// Svelte only mounts and unmounts the world. Frames are driven by the
	// game's own requestAnimationFrame loop, never by Svelte reactivity.
	onMount(() => {
		let world: GameWorld | undefined;
		let destroyed = false;

		const onVisibilityChange = () => {
			if (!world) return;
			if (document.hidden) world.pause();
			else world.start();
		};

		(async () => {
			// Statically false in the server build, so three.js and Rapier are
			// tree-shaken out of the Worker bundle entirely.
			if (import.meta.env.SSR) return;
			try {
				// Loaded lazily so the page shell renders before the 3D engine arrives.
				const { GameWorld } = await import('@windowling/game');
				const created = await GameWorld.create(canvas);
				if (destroyed) {
					created.dispose();
					return;
				}
				world = created;
				world.start();
				status = 'running';
			} catch (error) {
				console.error('Failed to start the game world', error);
				status = 'unsupported';
			}
		})();

		document.addEventListener('visibilitychange', onVisibilityChange);
		return () => {
			destroyed = true;
			document.removeEventListener('visibilitychange', onVisibilityChange);
			world?.dispose();
		};
	});
</script>

<canvas
	bind:this={canvas}
	data-testid="game-canvas"
	data-status={status}
	class="block h-full w-full touch-none select-none"
	aria-label="A window into someone's room"
></canvas>

{#if status === 'unsupported'}
	<p class="absolute inset-0 grid place-items-center p-6 text-center text-sm text-white/70">
		This window needs WebGL. Try a different browser or device.
	</p>
{/if}
