import { catchUpWorld, getOrCreateWorldForUser } from '@windowling/database';
import type { WorldSummary } from '@windowling/shared';
import { getServerEnv } from '$lib/server/config';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const googleEnabled = getServerEnv().google !== null;
	if (!locals.user) {
		// No session yet: the browser creates an anonymous one after hydration.
		// Doing it here would mint users for every crawler hit.
		return { user: null, world: null, googleEnabled };
	}

	const record = await catchUpWorld(
		locals.db,
		await getOrCreateWorldForUser(locals.db, locals.user.id),
	);
	const world: WorldSummary = {
		id: record.id,
		createdAt: record.createdAt.toISOString(),
		lastSimulatedAt: record.lastSimulatedAt.toISOString(),
		character: record.character,
	};

	return {
		user: { name: locals.user.name, isAnonymous: Boolean(locals.user.isAnonymous) },
		world,
		googleEnabled,
	};
};
