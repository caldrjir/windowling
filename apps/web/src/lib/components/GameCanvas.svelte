<script lang="ts">
	import type { GameWorld } from '@windowling/game';
	import type { Activity, AwarenessState, CharacterAction } from '@windowling/shared';
	import type { CharacterDecision, ConversationEvent } from '@windowling/ai';
	import type { AwarenessEvent } from '@windowling/simulation';
	import { Conversation, type Brain } from '$lib/brain/conversation';
	import { playKnock } from '$lib/knock';
	import { settings, showSubtitles } from '$lib/settings.svelte';
	import { BrowserSpeech, type TextToSpeech } from '$lib/voice/tts';
	import { sensorAccess } from '$lib/sensors/access.svelte';
	import { PhoneSensors } from '$lib/sensors/device';
	import { Watcher } from '$lib/watcher';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import Subtitles from './Subtitles.svelte';
	import TalkButton from './TalkButton.svelte';

	type Status = 'loading' | 'running' | 'unsupported';

	interface Props {
		/** What the simulation says the character is doing (null until a world exists). */
		activity: Activity | null;
		/** 0..1 from the simulation; only shows in body language. */
		mood: number;
		/** The player knocked the character awake; the server applies the consequences. */
		onWoken?: () => void;
		/** The player shook the phone; the server remembers it (and may wake a sleeper). */
		onShaken?: (intensity: number) => void;
		characterName: string;
		/** Turns events into what the character says and does. */
		brain: Brain;
		/** -1..1, how it feels about the player: decides whether it comes over. */
		affinity: number;
	}

	let { activity, mood, onWoken, onShaken, characterName, brain, affinity }: Props = $props();

	let canvas: HTMLCanvasElement;
	let status = $state<Status>('loading');
	let currentAction = $state('');
	let posture = $state('standing');
	let awareness = $state<AwarenessState>('UNKNOWN');
	let ripples = $state<Array<{ id: number; x: number; y: number }>>([]);
	let line = $state<string | null>(null);
	let voice: TextToSpeech | undefined;
	let voiceAvailable = $state(false);
	/** At the window and paying attention: the player may talk. */
	let listening = $state(false);
	let speakToCharacter: ((text: string) => void) | undefined;
	let shakeRoom: ((intensity: number) => void) | undefined;
	/** Whether tilt & shake are being listened to (for the debug panel and E2E). */
	let sensorsOn = $state(false);
	/** `?debug` shows what the character is thinking (for testing on real devices). */
	const debug = page.url.searchParams.has('debug');
	let lastSaid = $state('');
	let brainInfo = $state('');
	// Not reactive: imperative objects Svelte must not track.
	let world: GameWorld | undefined;
	let follow: ((activity: Activity | null) => void) | undefined;
	let watcher: Watcher | undefined;
	let rippleId = 0;
	/** Knocked awake locally; the server's answer arrives a moment later. */
	let wokenLocally = false;

	function describe(action: CharacterAction): string {
		return 'target' in action ? `${action.type}:${action.target}` : action.type;
	}

	// Svelte only mounts and unmounts the world. Frames are driven by the
	// game's own requestAnimationFrame loop, never by Svelte reactivity.
	onMount(() => {
		let destroyed = false;
		let dwellTimer: ReturnType<typeof setTimeout> | undefined;
		let glanceTimer: ReturnType<typeof setTimeout> | undefined;
		let unsubscribe: (() => void) | undefined;
		let conversation: Conversation | undefined;

		const onVisibilityChange = () => {
			if (!world) return;
			if (document.hidden) {
				world.pause();
				watcher?.stop();
			} else {
				world.start();
				watcher?.start();
			}
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
				const game = created;
				world = game;

				// The simulation decides what to do; the game world only carries it out.
				// While idle there is no fixed place, so the character wanders a little.
				const rng = createRng(Math.floor(Math.random() * 2 ** 32));
				let wandering = false;
				let dwellSeconds = 0;
				/** Busy with the player (coming over, waving): the daily life waits. */
				let engaged = false;
				let latest: Activity | null = null;

				const perform = (action: CharacterAction) => {
					currentAction = describe(action);
					game.perform(action);
				};
				const wander = (previous: CharacterAction | null) => {
					if (destroyed || !wandering || engaged) return;
					const choice = nextAmbientAction(rng, previous);
					dwellSeconds = choice.dwellSeconds;
					perform(choice.action);
				};
				const resume = () => {
					clearTimeout(dwellTimer);
					const action = latest ? actionForActivity(latest) : null;
					wandering = action === null;
					if (action) perform(action);
					else wander(null);
				};
				follow = (next) => {
					latest = next;
					if (next !== 'sleep') wokenLocally = false;
					if (!engaged) resume();
				};
				/** Knocked awake: the first words will be a complaint. */
				let justWoken = false;
				const tts = new BrowserSpeech(characterName.length);
				voice = tts;
				voiceAvailable = tts.available;

				const say = async (decision: CharacterDecision) => {
					lastSaid = decision.speech ?? '(nothing)';
					brainInfo = `${brain.lastSource ?? '?'}${brain.lastError ? ` · ${brain.lastError}` : ''}`;
					game.showEmotion(decision.emotion, decision.intensity);
					const { action } = decision;
					// Anything but looking/waving walks away from the window: the conversation ends.
					// Not at the window (brushing the player off): words only, life goes on.
					const leaving =
						engaged &&
						action.type !== 'lookAtPlayer' &&
						action.type !== 'idle' &&
						action.type !== 'wave';
					if ((engaged && action.type === 'wave') || leaving) perform(action);
					const speech = decision.speech;
					if (speech) {
						line = speech;
						game.setSpeaking(true);
						// Subtitles stay up at least as long as it takes to read them.
						const readingTime = new Promise((r) => setTimeout(r, 2_500 + speech.length * 65));
						const spoken =
							settings.voice && tts.available
								? tts.speak(speech, {
										emotion: decision.emotion,
										intensity: decision.intensity,
										onWord: () => game.pulseMouth(),
									})
								: Promise.resolve();
						await Promise.all([readingTime, spoken]);
						game.setSpeaking(false);
						line = null;
					}
					if (leaving) {
						listening = false;
						engaged = false;
						game.setAttention(false);
						conversation?.reset();
					}
				};
				conversation = new Conversation({
					brain,
					awareness: () => watcher?.state ?? 'UNKNOWN',
					onDecision: say,
				});
				const talk = (event: ConversationEvent) => {
					void conversation?.handle(event);
				};
				/** Set while a shake is being handled: its wake-up goes through the shake endpoint. */
				let shaking = false;
				shakeRoom = (intensity) => {
					game.shake(intensity);
					shaking = true;
					watcher?.shake(intensity);
					shaking = false;
					onShaken?.(intensity);
				};
				speakToCharacter = (text) => {
					watcher?.spoke();
					void conversation?.handle('player_said', text);
				};

				const glance = (seconds: number) => {
					clearTimeout(glanceTimer);
					game.setAttention(true);
					glanceTimer = setTimeout(() => {
						if (!engaged) game.setAttention(false);
					}, seconds * 1000);
				};

				const react = (event: AwarenessEvent) => {
					switch (event.type) {
						case 'suspected':
							glance(2.5);
							break;
						case 'stirred':
							glance(1.2);
							break;
						case 'woken':
							wokenLocally = true;
							justWoken = true;
							if (!shaking) onWoken?.();
							break;
						case 'shaken':
							// Not woken just now (that greeting comes at the window): it reacts on the spot.
							if (!justWoken) talk('shaken');
							break;
						case 'detected':
							if (event.response === 'ignore') {
								glance(1.5);
								// Doesn't come over, but may say so ("Not now.").
								talk('ignoring_player');
								break;
							}
							engaged = true;
							brain.warmUp?.();
							clearTimeout(dwellTimer);
							clearTimeout(glanceTimer);
							game.setAttention(true);
							perform({ type: 'walkTo', target: 'window' });
							break;
						case 'interacting':
							perform({ type: 'wave' });
							break;
						case 'ignoring':
						case 'dismissed':
							clearTimeout(glanceTimer);
							game.setAttention(false);
							conversation?.reset();
							// The player didn't answer - fine, they don't have to. It says so and moves on.
							if (event.type === 'ignoring' && event.reason === 'no_response') {
								talk('player_silent');
							}
							listening = false;
							if (engaged) {
								engaged = false;
								resume();
							}
							break;
					}
				};

				watcher = new Watcher({
					context: () => ({
						activity: wokenLocally ? 'idle' : (latest ?? 'idle'),
						mood,
						affinity,
					}),
					onEvent: react,
					onState: (state) => (awareness = state),
				});

				unsubscribe = game.onCharacterEvent((event) => {
					posture = game.characterState.posture;
					if (event.type === 'rejected') {
						console.warn('Character rejected an action', event.reason);
						if (wandering && !engaged) wander(null);
						return;
					}
					if (engaged) {
						if (event.action.type === 'walkTo' && event.action.target === 'window') {
							perform({ type: 'lookAtPlayer' });
							watcher?.arrived();
							listening = true;
							// The character speaks first - it came over for a reason.
							talk(justWoken ? 'woken_up' : 'player_at_window');
							justWoken = false;
						}
						return;
					}
					if (wandering) {
						dwellTimer = setTimeout(() => wander(event.action), dwellSeconds * 1000);
					}
				});

				// Dev-only handle for poking the world from the console / screenshot scripts.
				if (import.meta.env.DEV) {
					(window as unknown as { __windowling?: GameWorld }).__windowling = game;
				}

				game.start();
				watcher.start();
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
			clearTimeout(glanceTimer);
			unsubscribe?.();
			voice?.cancel();
			watcher?.stop();
			watcher = undefined;
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

	// The phone is the box the room lives in: tilt is gravity, shaking shakes it.
	$effect(() => {
		if (status !== 'running' || !settings.sensors || !sensorAccess.granted) return;
		const sensors = new PhoneSensors({
			onGravity: (gravity) => world?.setGravity(gravity),
			onShake: (intensity) => shakeRoom?.(intensity),
		});
		sensors.start();
		sensorsOn = true;
		return () => {
			sensors.stop();
			sensorsOn = false;
		};
	});

	let lastPointer: { x: number; y: number } | null = null;

	function onPointerMove(event: PointerEvent) {
		const diagonal = Math.hypot(window.innerWidth, window.innerHeight) || 1;
		if (lastPointer) {
			watcher?.moved(
				Math.hypot(event.clientX - lastPointer.x, event.clientY - lastPointer.y) / diagonal,
			);
		}
		lastPointer = { x: event.clientX, y: event.clientY };
	}

	/** Knocking on the glass: an opportunity, not a command - the character decides. */
	function onKnock(event: PointerEvent) {
		if (status !== 'running') return;
		playKnock();
		const id = ++rippleId;
		ripples = [...ripples, { id, x: event.clientX, y: event.clientY }];
		setTimeout(() => (ripples = ripples.filter((r) => r.id !== id)), 700);
		watcher?.knock();
	}
</script>

<canvas
	bind:this={canvas}
	data-testid="game-canvas"
	data-status={status}
	data-activity={activity ?? ''}
	data-awareness={awareness}
	data-sensors={sensorsOn ? 'on' : 'off'}
	data-character-action={currentAction}
	data-character-posture={posture}
	class="block h-full w-full touch-none select-none"
	aria-label="A window into someone's room. Tap to knock on the glass."
	onpointermove={onPointerMove}
	onpointerleave={() => (lastPointer = null)}
	onpointerdown={onKnock}
></canvas>

<TalkButton
	visible={listening}
	{characterName}
	onUtterance={(text) => speakToCharacter?.(text)}
	onActivity={() => watcher?.spoke()}
/>

<Subtitles
	{line}
	speaker={characterName}
	visible={showSubtitles(settings.subtitles, settings.voice && voiceAvailable)}
/>

{#each ripples as ripple (ripple.id)}
	<span class="knock" style:left="{ripple.x}px" style:top="{ripple.y}px" aria-hidden="true"></span>
{/each}

{#if debug}
	<dl
		class="pointer-events-none absolute top-14 left-4 grid grid-cols-[auto_1fr] gap-x-2 rounded-lg bg-black/70 px-3 py-2 font-mono text-[11px] text-white/80"
		data-testid="debug-panel"
	>
		<dt>activity</dt>
		<dd>{activity ?? '-'}</dd>
		<dt>awareness</dt>
		<dd>{awareness}</dd>
		<dt>action</dt>
		<dd>{currentAction || '-'}</dd>
		<dt>voice</dt>
		<dd>{voiceAvailable ? (settings.voice ? 'on' : 'muted') : 'unavailable'}</dd>
		<dt>brain</dt>
		<dd>{brainInfo || '-'}</dd>
		<dt>said</dt>
		<dd class="max-w-56 truncate">{lastSaid || '-'}</dd>
	</dl>
{/if}

{#if status === 'unsupported'}
	<p class="absolute inset-0 grid place-items-center p-6 text-center text-sm text-white/70">
		This window needs WebGL. Try a different browser or device.
	</p>
{/if}

<style>
	.knock {
		position: fixed;
		width: 56px;
		height: 56px;
		margin: -28px 0 0 -28px;
		border-radius: 9999px;
		border: 2px solid rgb(255 255 255 / 0.55);
		pointer-events: none;
		animation: knock 0.6s ease-out forwards;
	}

	@keyframes knock {
		from {
			transform: scale(0.3);
			opacity: 1;
		}
		to {
			transform: scale(1.4);
			opacity: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.knock {
			animation-duration: 0.01s;
		}
	}
</style>
