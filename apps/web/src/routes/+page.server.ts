import {
	catchUpWorld,
	getOrCreateWorldForUser,
	getRelationship,
	updateWorldTimeZone,
} from '@windowling/database';
import type { WorldSummary } from '@windowling/shared';
import { moneySense } from '@windowling/simulation';
import { getServerEnv } from '$lib/server/config';
import { TIME_ZONE_COOKIE } from '$lib/time-zone';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, cookies }) => {
	const googleEnabled = getServerEnv().google !== null;
	if (!locals.user) {
		// No session yet: the browser creates an anonymous one after hydration.
		// Doing it here would mint users for every crawler hit.
		return { user: null, world: null, googleEnabled };
	}

	const deviceTimeZone = cookies.get(TIME_ZONE_COOKIE);
	let record = await getOrCreateWorldForUser(locals.db, locals.user.id, {
		timeZone: deviceTimeZone,
	});
	// The time while the app was closed is lived on the clock it was lived on;
	// a new device zone applies from now on.
	record = await catchUpWorld(locals.db, record);
	if (deviceTimeZone) record = await updateWorldTimeZone(locals.db, record, deviceTimeZone);

	const { life } = record.character;
	const relationship = await getRelationship(locals.db, record.id);
	const world: WorldSummary = {
		id: record.id,
		createdAt: record.createdAt.toISOString(),
		lastSimulatedAt: record.lastSimulatedAt.toISOString(),
		timeZone: record.timeZone,
		character: {
			id: record.character.id,
			name: record.character.name,
			activity: {
				type: life.activity,
				startedAt: life.activityStartedAt.toISOString(),
				endsAt: life.activityEndsAt.toISOString(),
			},
			mood: life.needs.mood,
			needs: { hunger: life.needs.hunger, energy: life.needs.energy },
			money: moneySense(life.money, new Date(), record.timeZone),
			envelope: record.character.envelope.cents,
			relationship,
		},
	};

	return {
		user: { name: locals.user.name, isAnonymous: Boolean(locals.user.isAnonymous) },
		world,
		googleEnabled,
	};
};
