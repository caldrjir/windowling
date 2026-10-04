import { describe, expect, it } from 'vitest';
import { normalizeConnectionString } from './client.ts';

describe('normalizeConnectionString', () => {
	it('drops channel_binding but keeps sslmode', () => {
		expect(
			normalizeConnectionString(
				'postgresql://u:p@ep-x-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
			),
		).toBe('postgresql://u:p@ep-x-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require');
	});

	it('leaves plain urls untouched', () => {
		expect(normalizeConnectionString('postgres://u:p@localhost:5432/db')).toBe(
			'postgres://u:p@localhost:5432/db',
		);
	});

	it('preserves percent-encoded credentials', () => {
		expect(normalizeConnectionString('postgres://u:p%40ss@host/db?channel_binding=prefer')).toBe(
			'postgres://u:p%40ss@host/db',
		);
	});
});
