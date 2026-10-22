import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/** Games are static pages that return to the center via `../../index.html`. */
export const GET: RequestHandler = () => redirect(308, '/');
