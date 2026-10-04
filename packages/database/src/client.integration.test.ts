import { describe, expect, it } from 'vitest';
import { getTestDatabaseUrl } from '../test/test-database.ts';
import { createDatabase } from './client.ts';
import { pingDatabase } from './health.ts';

const url = getTestDatabaseUrl();

describe.skipIf(!url)('createDatabase (postgres)', () => {
	it('connects with a Neon-style url that carries channel_binding', async () => {
		const withChannelBinding = new URL(url!);
		withChannelBinding.searchParams.set('channel_binding', 'require');
		const conn = createDatabase(withChannelBinding.toString(), { max: 1 });
		try {
			await expect(pingDatabase(conn.db)).resolves.toBeUndefined();
		} finally {
			await conn.close();
		}
	});
});
