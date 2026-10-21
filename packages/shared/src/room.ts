import type { CharacterActionType } from './character-action.ts';

/**
 * What the character can do at a place in the room. The simulation decides
 * *whether* to use a target; the renderer only knows *where* it is.
 */
export type TargetAffordance =
	| 'stand'
	| 'sit'
	| 'sleep'
	| 'eat'
	| 'work'
	| 'play'
	| 'cook'
	| 'watch'
	| 'read'
	| 'listen'
	| 'call'
	| 'exercise'
	| 'dance'
	| 'leave'
	| 'unpack';

export interface RoomTarget {
	id: string;
	affordances: readonly TargetAffordance[];
}

/**
 * The starter flat (Iteration 1, kitchenette since Iteration 2, door since Iteration 7). Ids are stable contracts: renaming one is a
 * breaking change for saved state and AI prompts.
 */
export const STARTER_ROOM_TARGETS = [
	{ id: 'room.center', affordances: ['stand', 'exercise', 'dance'] },
	// The window the player looks through (the screen / the phone glass).
	{ id: 'window', affordances: ['stand', 'call'] },
	{ id: 'sofa', affordances: ['sit', 'play', 'watch', 'read', 'listen'] },
	{ id: 'desk.chair', affordances: ['sit', 'work', 'play', 'listen'] },
	{ id: 'bed', affordances: ['sit', 'sleep', 'read'] },
	{ id: 'kitchen.counter', affordances: ['stand', 'eat', 'cook'] },
	// To the bathroom and the rest of the world.
	{ id: 'door', affordances: ['stand', 'leave', 'unpack'] },
] as const satisfies readonly RoomTarget[];

export type StarterRoomTargetId = (typeof STARTER_ROOM_TARGETS)[number]['id'];

const AFFORDANCE_FOR_ACTION: Partial<Record<CharacterActionType, TargetAffordance>> = {
	walkTo: 'stand',
	sit: 'sit',
	sleep: 'sleep',
	eat: 'eat',
	work: 'work',
	play: 'play',
	cook: 'cook',
	watch: 'watch',
	read: 'read',
	listen: 'listen',
	call: 'call',
	exercise: 'exercise',
	dance: 'dance',
	leave: 'leave',
	unpack: 'unpack',
};

/** True when `actionType` can be performed at `targetId` in the starter room. */
export function targetSupports(targetId: string, actionType: CharacterActionType): boolean {
	const required = AFFORDANCE_FOR_ACTION[actionType];
	if (!required) return false;
	const target = STARTER_ROOM_TARGETS.find((t) => t.id === targetId);
	if (!target) return false;
	// Walking up to something is always possible, even if you can't stand *on* it.
	if (actionType === 'walkTo') return true;
	return (target.affordances as readonly TargetAffordance[]).includes(required);
}
