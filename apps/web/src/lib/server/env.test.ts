import { describe, expect, it } from 'vitest';
import { EnvValidationError, parseServerEnv } from './env.ts';

const valid = {
	DATABASE_URL: 'postgres://u:p@localhost:5432/db',
	BETTER_AUTH_SECRET: 'x'.repeat(32),
	BETTER_AUTH_URL: 'http://localhost:5173/',
	PUBLIC_APP_URL: 'https://windowling.com',
};

describe('parseServerEnv', () => {
	it('accepts a minimal valid environment and normalizes urls', () => {
		const env = parseServerEnv(valid);
		expect(env.BETTER_AUTH_URL).toBe('http://localhost:5173');
		expect(env.google).toBeNull();
	});

	it('treats empty strings as unset', () => {
		const env = parseServerEnv({ ...valid, GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '' });
		expect(env.google).toBeNull();
	});

	it('enables Google when both credentials are present', () => {
		const env = parseServerEnv({
			...valid,
			GOOGLE_CLIENT_ID: 'id',
			GOOGLE_CLIENT_SECRET: 'secret',
		});
		expect(env.google).toEqual({ clientId: 'id', clientSecret: 'secret' });
	});

	it('rejects half-configured Google credentials', () => {
		expect(() => parseServerEnv({ ...valid, GOOGLE_CLIENT_ID: 'id' })).toThrow(EnvValidationError);
	});

	it('rejects a short auth secret without leaking it', () => {
		try {
			parseServerEnv({ ...valid, BETTER_AUTH_SECRET: 'hunter2' });
			expect.unreachable();
		} catch (error) {
			expect(error).toBeInstanceOf(EnvValidationError);
			expect((error as Error).message).toContain('BETTER_AUTH_SECRET');
			expect((error as Error).message).not.toContain('hunter2');
		}
	});

	it('rejects non-postgres database urls', () => {
		expect(() => parseServerEnv({ ...valid, DATABASE_URL: 'mysql://x' })).toThrow(
			EnvValidationError,
		);
	});

	it('reports all problems at once', () => {
		try {
			parseServerEnv({});
			expect.unreachable();
		} catch (error) {
			const message = (error as Error).message;
			expect(message).toContain('BETTER_AUTH_SECRET');
			expect(message).toContain('BETTER_AUTH_URL');
			expect(message).toContain('PUBLIC_APP_URL');
		}
	});
});
