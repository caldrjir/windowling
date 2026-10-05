import type { CharacterActionType } from './character-action.ts';

/**
 * What the character can do at a place in the room. The simulation decides
 * *whether* to use a target; the renderer only knows *where* it is.
 */
export type TargetAffordance = 'stand' | 'sit' | 'sleep' | 'eat' | 'work' | 'play';

export interface RoomTarget {
	id: string;
	affordances: readonly TargetAffordance[];
}

/**
 * The starter flat (Iteration 1, kitchenette since Iteration 2). Ids are stable contracts: renaming one is a
 * breaking change for saved state and AI prompts.
 */
export const STARTER_ROOM_TARGETS = [
	{ id: 'room.center', affordances: ['stand'] },
	// The window the player looks through (the screen / the phone glass).
	{ id: 'window', affordances: ['stand'] },
	{ id: 'sofa', affordances: ['sit', 'play'] },
	{ id: 'desk.chair', affordances: ['sit', 'work', 'play'] },
	{ id: 'bed', affordances: ['sit', 'sleep'] },
	{ id: 'kitchen.counter', affordances: ['stand', 'eat'] },
] as const satisfies readonly RoomTarget[];

export type StarterRoomTargetId = (typeof STARTER_ROOM_TARGETS)[number]['id'];

const AFFORDANCE_FOR_ACTION: Partial<Record<CharacterActionType, TargetAffordance>> = {
	walkTo: 'stand',
	sit: 'sit',
	sleep: 'sleep',
	eat: 'eat',
	work: 'work',
	play: 'play',
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
