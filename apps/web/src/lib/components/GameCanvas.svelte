<script lang="ts">
	import type { GameWorld } from '@windowling/game';
	import type { CharacterAction } from '@windowling/shared';
	import { onMount } from 'svelte';

	type Status = 'loading' | 'running' | 'unsupported';

	let canvas: HTMLCanvasElement;
	let status = $state<Status>('loading');
	let currentAction = $state('');
	let posture = $state('standing');

	// Svelte only mounts and unmounts the world. Frames are driven by the
	// game's own requestAnimationFrame loop, never by Svelte reactivity.
	onMount(() => {
		let world: GameWorld | undefined;
		let destroyed = false;
		let dwellTimer: ReturnType<typeof setTimeout> | undefined;
		let unsubscribe: (() => void) | undefined;

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
				const [{ GameWorld }, { createRng, nextAmbientAction }] = await Promise.all([
					import('@windowling/game'),
					import('@windowling/simulation'),
				]);
				const created = await GameWorld.create(canvas);
				if (destroyed) {
					created.dispose();
					return;
				}
				world = created;

				// Iteration 1 placeholder life: the simulation picks what to do next,
				// the game world only carries it out. Replaced by the scheduler in Iteration 2.
				const rng = createRng(Math.floor(Math.random() * 2 ** 32));
				let dwellSeconds = 0;
				const doNext = (previous: CharacterAction | null) => {
					if (!world || destroyed) return;
					const choice = nextAmbientAction(rng, previous);
					dwellSeconds = choice.dwellSeconds;
					currentAction =
						'target' in choice.action
							? `${choice.action.type}:${choice.action.target}`
							: choice.action.type;
					world.perform(choice.action);
				};
				unsubscribe = world.onCharacterEvent((event) => {
					posture = world?.characterState.posture ?? posture;
					if (event.type === 'completed') {
						dwellTimer = setTimeout(() => doNext(event.action), dwellSeconds * 1000);
					} else {
						console.warn('Character rejected an action', event.reason);
						doNext(null);
					}
				});

				// Dev-only handle for poking the world from the console / screenshot scripts.
				if (import.meta.env.DEV) {
					(window as unknown as { __windowling?: GameWorld }).__windowling = world;
				}

				world.start();
				status = 'running';
				doNext(null);
			} catch (error) {
				console.error('Failed to start the game world', error);
				status = 'unsupported';
			}
		})();

		document.addEventListener('visibilitychange', onVisibilityChange);
		return () => {
			destroyed = true;
			clearTimeout(dwellTimer);
			unsubscribe?.();
			document.removeEventListener('visibilitychange', onVisibilityChange);
			world?.dispose();
		};
	});
</script>

<canvas
	bind:this={canvas}
	data-testid="game-canvas"
	data-status={status}
	data-character-action={currentAction}
	data-character-posture={posture}
	class="block h-full w-full touch-none select-none"
	aria-label="A window into someone's room"
></canvas>

{#if status === 'unsupported'}
	<p class="absolute inset-0 grid place-items-center p-6 text-center text-sm text-white/70">
		This window needs WebGL. Try a different browser or device.
	</p>
{/if}
