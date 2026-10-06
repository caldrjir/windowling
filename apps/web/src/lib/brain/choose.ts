import {
	LlmCharacterAI,
	MockCharacterAI,
	type CharacterAIContext,
	type CharacterDecision,
} from '@windowling/ai';
import type { WorldSummary } from '@windowling/shared';
import {
	CAUGHT_DOING,
	localClock,
	localTime,
	personalityFor,
	reviewAction,
} from '@windowling/simulation';
import { ServerBrain, type Brain, type BrainSource } from './conversation';

export type BrainPreference = 'auto' | 'device' | 'cloud';

export interface DeviceModel {
	readonly usable: boolean;
	warmUp?(): void;
	complete: ConstructorParameters<typeof LlmCharacterAI>[0]['complete'];
}

/** Should this conversation use the on-device model? */
export function useDevice(preference: BrainPreference, device: { usable: boolean }): boolean {
	// "auto" uses it once it is downloaded and loaded; never triggers a download by itself.
	return preference !== 'cloud' && device.usable;
}

/**
 * The combination decided in #28: on-device model when available and wanted,
 * otherwise the cloud brain (which itself falls back to canned reactions).
 * On-device decisions get the same review by the simulation as server ones.
 */
export class CombinedBrain implements Brain {
	private readonly server = new ServerBrain();
	/** For the debug panel. */
	lastSource: BrainSource | null = null;
	lastError: string | null = null;

	constructor(
		private readonly options: {
			world: () => WorldSummary | null;
			preference: () => BrainPreference;
			device: DeviceModel;
		},
	) {}

	warmUp(): void {
		if (useDevice(this.options.preference(), this.options.device)) this.options.device.warmUp?.();
	}

	async decide(request: Parameters<Brain['decide']>[0]): Promise<CharacterDecision | null> {
		const world = this.options.world();
		if (world && useDevice(this.options.preference(), this.options.device)) {
			try {
				const decision = await this.decideOnDevice(world, request);
				this.lastSource = 'device';
				this.lastError = null;
				return decision;
			} catch (error) {
				console.warn('On-device brain failed, asking the cloud', error);
			}
		}
		const fromCloud = await this.server.decide(request);
		this.lastError = this.server.lastError;
		if (fromCloud) {
			this.lastSource = this.server.lastSource;
			return fromCloud;
		}
		// Offline or the server failed: the character still reacts, with a canned line.
		if (!world) return null;
		this.lastSource = 'local-canned';
		return new MockCharacterAI().decide(buildContext(world, request, new Date()));
	}

	private async decideOnDevice(
		world: WorldSummary,
		request: Parameters<Brain['decide']>[0],
	): Promise<CharacterDecision> {
		const now = new Date();
		const { character } = world;
		// Memories and the relationship live on the server, whichever brain thinks.
		const remembered = await fetchServerContext(request);
		const context = { ...buildContext(world, request, now), ...remembered };
		const ai = new LlmCharacterAI(this.options.device, {
			fallback: { decide: () => Promise.reject(new Error('on-device answer was unusable')) },
		});
		const decision = await ai.decide(context);
		const action = reviewAction(decision.action, {
			activity: character.activity.type,
			energy: character.needs.energy,
			hour: localTime(now, world.timeZone).hour,
		});
		const reviewed = { ...decision, action };
		void reportOutcome(request, reviewed);
		return reviewed;
	}
}

async function fetchServerContext(
	request: Parameters<Brain['decide']>[0],
): Promise<Pick<CharacterAIContext, 'memories' | 'relationship'>> {
	try {
		const response = await fetch('/api/ai/context', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(request),
		});
		if (!response.ok) return {};
		return (await response.json()) as Pick<CharacterAIContext, 'memories' | 'relationship'>;
	} catch {
		return {};
	}
}

async function reportOutcome(
	request: Parameters<Brain['decide']>[0],
	decision: CharacterDecision,
): Promise<void> {
	try {
		await fetch('/api/ai/outcome', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ ...request, decision }),
		});
	} catch (error) {
		console.warn('Could not save what happened', error);
	}
}

/** The same context the server builds, from what the page knows about the world. */
function buildContext(
	world: WorldSummary,
	request: Parameters<Brain['decide']>[0],
	now: Date,
): CharacterAIContext {
	const clock = localClock(now, world.timeZone);
	const { character } = world;
	return {
		characterName: character.name,
		localTime: clock.time,
		weekday: clock.weekday,
		activity: request.event === 'woken_up' ? 'sleep' : character.activity.type,
		needs: { ...character.needs, mood: character.mood },
		relationship: character.relationship,
		awareness: request.awareness,
		event: request.event,
		playerUtterance: request.playerUtterance,
		recent: request.recent,
		caughtDoing: request.caughtDoing ? CAUGHT_DOING[request.caughtDoing] : undefined,
		shyness: personalityFor(world.id).shy,
	};
}
