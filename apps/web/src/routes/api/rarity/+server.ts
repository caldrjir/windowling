import { error, json } from '@sveltejs/kit';
import { keyCounts } from '@windowling/database';
import type { RequestHandler } from './$types';

/**
 * How many signed-in players have each achievement of a game, counted from their cloud saves, so
 * the game can show how rare an achievement is. Only the games listed here: the save key and the
 * object in it whose properties are counted.
 */
const SOURCES = new Map([['voidborn', { key: 'voidborn.save.v1', field: 'achievements' }]]);

export const GET: RequestHandler = async ({ url, locals }) => {
	const src = SOURCES.get(url.searchParams.get('game') ?? '');
	if (!src) error(400, 'Unknown game');
	const counts = await keyCounts(locals.db, src.key, src.field);
	// the same for everyone: a few minutes old is fine
	return json(counts, { headers: { 'cache-control': 'public, max-age=300' } });
};
