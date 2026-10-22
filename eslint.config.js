import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import ts from 'typescript-eslint';
import svelteConfig from './apps/web/svelte.config.js';

export default ts.config(
	{
		ignores: [
			'**/node_modules/',
			'**/.svelte-kit/',
			'**/build/',
			'**/dist/',
			'**/.wrangler/',
			'**/coverage/',
			'**/playwright-report/',
			'**/test-results/',
			'packages/database/drizzle/',
			// Self-contained static web games (plain scripts, not part of the app's modules).
			'apps/web/static/games/',
			'apps/web/static/service-worker.js',
		],
	},
	js.configs.recommended,
	...ts.configs.strict,
	...svelte.configs.recommended,
	prettier,
	...svelte.configs.prettier,
	{
		languageOptions: {
			globals: { ...globals.browser, ...globals.node },
		},
		rules: {
			'@typescript-eslint/no-unused-vars': [
				'error',
				{ argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
			],
			'@typescript-eslint/consistent-type-imports': 'error',
			// TypeScript already reports undefined identifiers, with better accuracy.
			'no-undef': 'off',
		},
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts'],
		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte'],
				parser: ts.parser,
				svelteConfig,
			},
		},
	},
	{
		files: ['**/*.test.ts', '**/e2e/**/*.ts', '**/test/**/*.ts'],
		rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
	},
	// Architecture boundary: SQL lives in packages/database only.
	{
		files: ['apps/web/**/*.ts', 'apps/web/**/*.svelte'],
		rules: {
			'no-restricted-imports': [
				'error',
				{
					patterns: [
						{
							group: ['drizzle-orm', 'drizzle-orm/*', 'postgres'],
							message: 'Use @windowling/database repositories instead of raw DB access.',
						},
					],
				},
			],
		},
	},
);
