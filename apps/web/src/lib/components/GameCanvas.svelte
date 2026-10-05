<script lang="ts">
	import type { GameWorld } from '@windowling/game';
	import type { Activity, CharacterAction } from '@windowling/shared';
	import { onMount } from 'svelte';

	type Status = 'loading' | 'running' | 'unsupported';

	interface Props {
		/** What the simulation says the character is doing (null until a world exists). */
		activity: Activity | null;
		/** 0..1 from the simulation; only shows in body language. */
		mood: number;
	}

	let { activity, mood }: Props = $props();

	let canvas: HTMLCanvasElement;
	let status = $state<Status>('loading');
	let currentAction = $state('');
	let posture = $state('standing');
	// Not reactive: the world is an imperative object Svelte must not track.
	let world: GameWorld | undefined;
	let follow: ((activity: Activity | null) => void) | undefined;

	function describe(action: CharacterAction): string {
		return 'target' in action ? `${action.type}:${action.target}` : action.type;
	}

	// Svelte only mounts and unmounts the world. Frames are driven by the
	// game's own requestAnimationFrame loop, never by Svelte reactivity.
	onMount(() => {
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
				const [{ GameWorld }, { actionForActivity, createRng, nextAmbientAction }] =
					await Promise.all([import('@windowling/game'), import('@windowling/simulation')]);
				const created = await GameWorld.create(canvas);
				if (destroyed) {
					created.dispose();
					return;
				}
				world = created;

				// The simulation decides what to do; the game world only carries it out.
				// While idle there is no fixed place, so the character wanders a little.
				const rng = createRng(Math.floor(Math.random() * 2 ** 32));
				let wandering = false;
				let dwellSeconds = 0;
				const perform = (action: CharacterAction) => {
					currentAction = describe(action);
					world?.perform(action);
				};
				const wander = (previous: CharacterAction | null) => {
					if (!world || destroyed || !wandering) return;
					const choice = nextAmbientAction(rng, previous);
					dwellSeconds = choice.dwellSeconds;
					perform(choice.action);
				};
				follow = (next) => {
					clearTimeout(dwellTimer);
					const action = next ? actionForActivity(next) : null;
					wandering = action === null;
					if (action) perform(action);
					else wander(null);
				};
				unsubscribe = world.onCharacterEvent((event) => {
					posture = world?.characterState.posture ?? posture;
					if (event.type === 'rejected') {
						console.warn('Character rejected an action', event.reason);
						if (wandering) wander(null);
					} else if (wandering) {
						dwellTimer = setTimeout(() => wander(event.action), dwellSeconds * 1000);
					}
				});

				// Dev-only handle for poking the world from the console / screenshot scripts.
				if (import.meta.env.DEV) {
					(window as unknown as { __windowling?: GameWorld }).__windowling = world;
				}

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
			follow = undefined;
			clearTimeout(dwellTimer);
			unsubscribe?.();
			document.removeEventListener('visibilitychange', onVisibilityChange);
			world?.dispose();
			world = undefined;
		};
	});

	// Re-runs when the simulation moves on to another activity (or the world starts).
	$effect(() => {
		if (status !== 'running') return;
		follow?.(activity);
	});

	$effect(() => {
		if (status !== 'running') return;
		world?.setMood(mood);
	});
</script>

<canvas
	bind:this={canvas}
	data-testid="game-canvas"
	data-status={status}
	data-activity={activity ?? ''}
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
