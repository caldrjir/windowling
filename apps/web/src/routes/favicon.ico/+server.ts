import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/** Browsers ask for /favicon.ico on pages without an icon link; the icon is an SVG. */
export const GET: RequestHandler = () => redirect(308, '/favicon.svg');
