import type { CharacterAIContext } from '@windowling/ai';
import {
	catchUpWorld,
	findWorldByUserId,
	getRelationship,
	loadMemories,
	type Database,
	type WorldRecord,
} from '@windowling/database';
import {
	CAUGHT_DOING,
	howLongAgo,
	localClock,
	personalityFor,
	recall,
} from '@windowling/simulation';
import type { ConversationRequest } from '$lib/conversation-request';

/** How many memories the brain gets per moment - relevant ones, never the full history. */
const RECALLED = 6;

export interface ServerContext {
	world: WorldRecord;
	context: CharacterAIContext;
}

/**
 * Everything the brain may know right now, built on the server from the
 * database: the character's state, its relationship with the player and the
 * few memories that fit this moment.
 */
export async function buildServerContext(
	db: Database,
	userId: string,
	request: ConversationRequest,
	now: Date,
): Promise<ServerContext | null> {
	const found = await findWorldByUserId(db, userId);
	if (!found) return null;
	const world = await catchUpWorld(db, found, now);
	const [relationship, memories] = await Promise.all([
		getRelationship(db, world.id),
		loadMemories(db, world.id),
	]);
	const { life } = world.character;
	const clock = localClock(now, world.timeZone);
	const cues = [request.event.replace(/_/g, ' '), request.playerUtterance ?? ''];
	if (request.event === 'woken_up') cues.push('woke sleep night');
	const caughtDoing = request.caughtDoing ? CAUGHT_DOING[request.caughtDoing] : undefined;
	if (caughtDoing) cues.push(`caught ${caughtDoing}`);
	const recalled = recall(memories, { now, cues }, RECALLED);

	return {
		world,
		context: {
			characterName: world.character.name,
			localTime: clock.time,
			weekday: clock.weekday,
			activity: request.event === 'woken_up' ? 'sleep' : life.activity,
			needs: life.needs,
			awareness: request.awareness,
			event: request.event,
			playerUtterance: request.playerUtterance,
			recent: request.recent,
			relationship,
			caughtDoing,
			shyness: personalityFor(world.id).shy,
			memories: recalled.map((m) => ({ note: m.note, when: howLongAgo(m.createdAt, now) })),
		},
	};
}
