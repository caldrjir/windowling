<script lang="ts">
	import type { GameWorld } from '@windowling/game';
	import {
		isAway,
		type Activity,
		type AwarenessState,
		type CharacterAction,
	} from '@windowling/shared';
	import type { CharacterDecision, ConversationEvent } from '@windowling/ai';
	import {
		MOMENT_KINDS,
		type AwarenessEvent,
		type Moment,
		type MomentKind,
	} from '@windowling/simulation';
	import { Conversation, type Brain } from '$lib/brain/conversation';
	import { playKnock } from '$lib/knock';
	import { settings, showSubtitles } from '$lib/settings.svelte';
	import { BrowserSpeech, type TextToSpeech } from '$lib/voice/tts';
	import { sensorAccess } from '$lib/sensors/access.svelte';
	import { PhoneSensors } from '$lib/sensors/device';
	import { unlockAudio } from '$lib/sound/audio';
	import { Radio } from '$lib/sound/music';
	import { Watcher } from '$lib/watcher';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import Subtitles from './Subtitles.svelte';
	import TalkButton from './TalkButton.svelte';

	type Status = 'loading' | 'running' | 'unsupported';

	/** How often a moment may arise (each check rolls the dice, most do nothing). */
	const MOMENT_CHECK_MS = 20_000;
	const isMomentKind = (value: string): value is MomentKind =>
		(MOMENT_KINDS as readonly string[]).includes(value);

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
		/** 0 exhausted .. 1 rested, and 0 full .. 1 starving: moments arise from them. */
		energy: number;
		hunger: number;
		/** Who it is (personality) is derived from the world. */
		worldId: string | null;
	}

	let {
		activity,
		mood,
		onWoken,
		onShaken,
		characterName,
		brain,
		affinity,
		energy,
		hunger,
		worldId,
	}: Props = $props();

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
	/** Which sensors are being listened to: 'off', 'tilt', 'shake' or 'tilt,shake' (debug, E2E). */
	let sensorsOn = $state('off');
	/** `?debug` shows what the character is thinking (for testing on real devices). */
	const debug = page.url.searchParams.has('debug');
	/** The moment playing right now (dancing, singing...), for debug and E2E. */
	let momentKind = $state('');
	let lastSaid = $state('');
	let brainInfo = $state('');
	// Not reactive: imperative objects Svelte must not track.
	let world: GameWorld | undefined;
	/** Loads the person who lives in the world (once the world is known). */
	let showPerson: ((worldId: string) => void) | undefined;
	let shownFor: string | null = null;
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
		let momentTimer: ReturnType<typeof setTimeout> | undefined;
		let momentClock: ReturnType<typeof setInterval> | undefined;
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
				const [
					{ GameWorld, characterModelUrl, lookFor },
					{ actionForActivity, createRng, nextAmbientAction, nextMoment, personalityFor },
				] = await Promise.all([import('@windowling/game'), import('@windowling/simulation')]);
				const created = await GameWorld.create(canvas);
				if (destroyed) {
					created.dispose();
					return;
				}
				const game = created;
				world = game;

				// Who lives here: a realistic person, the same one every visit to this world.
				showPerson = (id) => {
					const look = lookFor(id);
					voice?.prefer?.(look.voice);
					game.loadCharacter(characterModelUrl(look)).catch((error: unknown) => {
						console.warn('Could not load the character model', error);
					});
				};

				// The simulation decides what to do; the game world only carries it out.
				// While idle there is no fixed place, so the character wanders a little.
				const rng = createRng(Math.floor(Math.random() * 2 ** 32));
				let wandering = false;
				let dwellSeconds = 0;
				/** Busy with the player (coming over, waving): the daily life waits. */
				let engaged = false;
				let latest: Activity | null = null;
				/** `?debug&moment=...`: plays that moment once the character is home and awake. */
				let playForced = () => {};

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
					if (next !== latest) endMoment(false);
					latest = next;
					if (next !== 'sleep') wokenLocally = false;
					if (!engaged) resume();
					if (next) setTimeout(() => playForced(), 1_500);
				};
				/** Knocked awake: the first words will be a complaint. */
				let justWoken = false;
				const tts = new BrowserSpeech(characterName.length);
				if (worldId) tts.prefer(lookFor(worldId).voice);
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
				const talk = (event: ConversationEvent, caught?: MomentKind) => {
					void conversation?.handle(event, undefined, caught);
				};

				// Emergent moments (Iteration 8): now and then something small arises from
				// what it is doing, how it feels and who it is - dancing to the radio,
				// raging at a game. Some are private: being seen is embarrassing.
				const momentRng = createRng(Math.floor(Math.random() * 2 ** 32));
				let moment: Moment | null = null;
				/** Caught mid-moment: what it says next is about that. */
				let caughtDoing: MomentKind | null = null;
				let selfTalk: string | null = null;
				const clearSelfTalk = () => {
					if (selfTalk !== null && line === selfTalk) line = null;
					selfTalk = null;
				};
				/** Ends the current moment; `backToLife` resumes the activity it interrupted. */
				function endMoment(backToLife: boolean) {
					if (!moment) return;
					const ended = moment;
					moment = null;
					momentKind = '';
					clearTimeout(momentTimer);
					game.setMoment(null);
					clearSelfTalk();
					if (ended.kind === 'dance' && backToLife && !engaged) resume();
				}
				const startMoment = (next: Moment) => {
					moment = next;
					momentKind = next.kind;
					if (next.kind === 'dance') perform({ type: 'dance', target: 'room.center' });
					else game.setMoment(next.kind);
					if (next.line && line === null) {
						// Said to itself - subtitled in brackets, never voiced at the player.
						const said = `(${next.line})`;
						selfTalk = said;
						line = said;
						setTimeout(
							() => {
								if (selfTalk === said) clearSelfTalk();
							},
							Math.min(next.seconds, 4) * 1000,
						);
					}
					momentTimer = setTimeout(() => endMoment(true), next.seconds * 1000);
				};
				const personality = personalityFor(worldId ?? 'nobody');
				const maybeMoment = () => {
					if (destroyed || engaged || moment || !latest || wokenLocally || line !== null) return;
					if (conversation?.thinking || game.characterState.busy) return;
					const next = nextMoment(
						{ activity: latest, needs: { hunger, energy, mood }, personality },
						momentRng,
					);
					if (next) startMoment(next);
				};
				momentClock = setInterval(maybeMoment, MOMENT_CHECK_MS);
				// `?debug&moment=dance` plays one right away (testing on real devices, E2E).
				const forced = debug ? page.url.searchParams.get('moment') : null;
				let forcedMoment = forced && isMomentKind(forced) ? forced : null;
				playForced = () => {
					if (!forcedMoment || destroyed || engaged || moment) return;
					if (!latest || latest === 'sleep' || isAway(latest)) return;
					startMoment({
						kind: forcedMoment,
						seconds: 60,
						private: forcedMoment !== 'cheer' && forcedMoment !== 'yawn',
					});
					forcedMoment = null;
				};
				setTimeout(() => playForced(), 1_500);
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
							endMoment(false);
							wokenLocally = true;
							justWoken = true;
							if (!shaking) onWoken?.();
							break;
						case 'shaken':
							endMoment(true);
							// Not woken just now (that greeting comes at the window): it reacts on the spot.
							if (!justWoken) talk('shaken');
							break;
						case 'detected': {
							// Seen in the middle of something private: it freezes, mortified.
							const caught = moment?.private ? moment.kind : null;
							endMoment(event.response === 'ignore');
							if (caught) game.showEmotion('embarrassed', 0.5 + 0.5 * personality.shy);
							if (event.response === 'ignore') {
								glance(1.5);
								// Doesn't come over, but may say so ("Not now." - or about being caught).
								if (caught) talk('caught', caught);
								else talk('ignoring_player');
								break;
							}
							caughtDoing = caught;
							engaged = true;
							brain.warmUp?.();
							clearTimeout(dwellTimer);
							clearTimeout(glanceTimer);
							game.setAttention(true);
							perform({ type: 'walkTo', target: 'window' });
							break;
						}
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
						// Lost in a private moment, it notices less.
						absorbed: moment?.private === true,
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
							if (justWoken) talk('woken_up');
							else if (caughtDoing) talk('caught', caughtDoing);
							else talk('player_at_window');
							justWoken = false;
							caughtDoing = null;
						}
						return;
					}
					if (wandering) {
						dwellTimer = setTimeout(() => wander(event.action), dwellSeconds * 1000);
					} else if (event.action.type === 'clean' && latest === 'clean') {
						// Another round with the broom, after a short breather.
						dwellTimer = setTimeout(resume, 2_000 + Math.random() * 3_000);
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
			clearTimeout(momentTimer);
			clearInterval(momentClock);
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

	$effect(() => {
		if (status !== 'running' || !worldId || worldId === shownFor) return;
		shownFor = worldId;
		showPerson?.(worldId);
	});

	// Music from inside the flat while it listens to music (generated, see sound/music.ts).
	const radio = new Radio();
	let audioReady = $state(false);
	$effect(() => {
		const shouldPlay =
			status === 'running' && activity === 'music' && settings.sounds && audioReady;
		if (shouldPlay && !radio.playing) radio.start();
		if (!shouldPlay && radio.playing) radio.stop();
	});
	// It turns the music down to talk to you.
	$effect(() => {
		radio.duck(listening || line !== null);
	});
	$effect(() => () => radio.stop());

	/** Browsers only allow sound after a gesture: the first tap or key unlocks it. */
	function enableAudio() {
		unlockAudio();
		audioReady = true;
	}

	// The phone is the box the room lives in: tilt is gravity, shaking shakes it.
	$effect(() => {
		const use = { tilt: settings.tilt, shake: settings.shake };
		if (status !== 'running' || !sensorAccess.granted || (!use.tilt && !use.shake)) return;
		const sensors = new PhoneSensors(
			{
				onGravity: (gravity) => world?.setGravity(gravity),
				onShake: (intensity) => shakeRoom?.(intensity),
			},
			use,
		);
		sensors.start();
		sensorsOn = [use.tilt && 'tilt', use.shake && 'shake'].filter(Boolean).join(',');
		return () => {
			sensors.stop();
			sensorsOn = 'off';
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

<svelte:window onpointerdown={enableAudio} onkeydown={enableAudio} />

<canvas
	bind:this={canvas}
	data-testid="game-canvas"
	data-status={status}
	data-activity={activity ?? ''}
	data-awareness={awareness}
	data-sensors={sensorsOn}
	data-character-action={currentAction}
	data-character-posture={posture}
	data-moment={momentKind}
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
	onListening={() => voice?.cancel()}
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
		<dt>moment</dt>
		<dd>{momentKind || '-'}</dd>
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
