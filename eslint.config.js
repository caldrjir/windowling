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
	// Architecture boundaries: lower layers must never reach up.
	{
		files: ['packages/simulation/**/*.ts', 'packages/shared/**/*.ts', 'packages/ai/**/*.ts'],
		rules: {
			'no-restricted-imports': [
				'error',
				{
					patterns: [
						{
							group: ['three', 'three/*', '@dimforge/*', '@windowling/game', 'svelte', 'svelte/*'],
							message: 'Simulation, AI and shared code must stay renderer- and UI-independent.',
						},
						{
							group: ['@windowling/database', 'drizzle-orm', 'drizzle-orm/*', 'postgres'],
							message: 'Database access belongs in packages/database only.',
						},
					],
				},
			],
		},
	},
	{
		files: ['packages/game/**/*.ts'],
		rules: {
			'no-restricted-imports': [
				'error',
				{
					patterns: [
						{
							group: ['@windowling/database', '@windowling/ai', 'svelte', 'svelte/*'],
							message: 'The game package renders state; it does not own data, AI or UI.',
						},
					],
				},
			],
		},
	},
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
