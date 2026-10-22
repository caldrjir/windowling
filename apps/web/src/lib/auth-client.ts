import { createAuthClient } from 'better-auth/svelte';

/** Better Auth in the browser: talks to /api/auth on our own origin (no keys here). */
export const authClient = createAuthClient();
