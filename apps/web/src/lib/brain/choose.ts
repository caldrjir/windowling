import { LlmCharacterAI, type CharacterAIContext, type CharacterDecision } from '@windowling/ai';
import type { WorldSummary } from '@windowling/shared';
import { localClock, localTime, reviewAction } from '@windowling/simulation';
import type { Brain } from './conversation';
import { ServerBrain } from './conversation';

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
				return await this.decideOnDevice(world, request);
			} catch (error) {
				console.warn('On-device brain failed, asking the cloud', error);
			}
		}
		return this.server.decide(request);
	}

	private async decideOnDevice(
		world: WorldSummary,
		request: Parameters<Brain['decide']>[0],
	): Promise<CharacterDecision> {
		const now = new Date();
		const clock = localClock(now, world.timeZone);
		const { character } = world;
		const context: CharacterAIContext = {
			characterName: character.name,
			localTime: clock.time,
			weekday: clock.weekday,
			activity: request.event === 'woken_up' ? 'sleep' : character.activity.type,
			needs: { ...character.needs, mood: character.mood },
			awareness: request.awareness,
			event: request.event,
			playerUtterance: request.playerUtterance,
			recent: request.recent,
		};
		const ai = new LlmCharacterAI(this.options.device, {
			fallback: { decide: () => Promise.reject(new Error('on-device answer was unusable')) },
		});
		const decision = await ai.decide(context);
		const action = reviewAction(decision.action, {
			activity: character.activity.type,
			energy: character.needs.energy,
			hour: localTime(now, world.timeZone).hour,
		});
		return { ...decision, action };
	}
}
