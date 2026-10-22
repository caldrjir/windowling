import { request, type FullConfig } from '@playwright/test';
import { E2E_SITE_PASSWORD, GATE_STATE } from './gate';

/** Passes the site gate once; every test starts with that cookie. */
export default async function globalSetup(config: FullConfig) {
	const baseURL = config.projects[0]?.use.baseURL;
	const context = await request.newContext({ baseURL });
	const response = await context.post('/gate', {
		form: { password: E2E_SITE_PASSWORD, next: '/' },
		maxRedirects: 0,
	});
	if (response.status() !== 303) throw new Error(`Site gate login failed: ${response.status()}`);
	await context.storageState({ path: GATE_STATE });
	await context.dispose();
}
