import { getNickname } from '@windowling/database';
import { getServerEnv } from '$lib/server/config';
import type { PageServerLoad } from './$types';

/** Who is signed in (if anyone) - read on the server, from the session cookie. */
export const load: PageServerLoad = async ({ locals }) => ({
	user: locals.user
		? {
				name: locals.user.name,
				image: locals.user.image ?? null,
				nickname: await getNickname(locals.db, locals.user.id),
			}
		: null,
	googleEnabled: getServerEnv().google !== null,
});
