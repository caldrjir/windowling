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

	it('has no cloud brain unless configured', () => {
		expect(parseServerEnv(valid).ai).toBeNull();
		expect(parseServerEnv({ ...valid, AI_API_URL: '' }).ai).toBeNull();
	});

	it('requires a key for hosted AI but not for a local Ollama', () => {
		const hosted = 'https://api.cloudflare.com/client/v4/accounts/abc/ai/v1';
		expect(parseServerEnv({ ...valid, AI_API_URL: hosted }).ai).toBeNull();
		expect(parseServerEnv({ ...valid, AI_API_URL: hosted, AI_API_KEY: 'k' }).ai).toEqual({
			baseUrl: hosted,
			apiKey: 'k',
			model: '@cf/meta/llama-3.1-8b-instruct-fp8',
			dailyLimit: 60,
		});
		const ollama = parseServerEnv({
			...valid,
			AI_API_URL: 'http://localhost:11434/v1/',
			AI_MODEL: 'llama3.2',
			AI_DAILY_LIMIT: '500',
		}).ai;
		expect(ollama).toMatchObject({
			baseUrl: 'http://localhost:11434/v1',
			model: 'llama3.2',
			dailyLimit: 500,
		});
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
