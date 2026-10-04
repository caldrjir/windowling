import { defineProject } from 'vitest/config';

export default defineProject({
	test: {
		name: 'database',
		globalSetup: ['./test/global-setup.ts'],
		// Integration tests share one database; keep files sequential.
		fileParallelism: false,
	},
});
