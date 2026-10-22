#!/usr/bin/env node
// Prints SITE_PASSWORD_HASH for the site gate (apps/web/src/worker/gate.ts).
//   node apps/web/scripts/site-password.mjs
// Type a password (input is hidden) or press Enter to generate a random one.
// Store the printed hash as the secret SITE_PASSWORD_HASH in the GitHub `production`
// environment. The password itself is never stored anywhere.
import { pbkdf2Sync, randomBytes } from 'node:crypto';
import { createInterface } from 'node:readline';

const ITERATIONS = 30_000;

function ask(question) {
	const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
	// Hide what is typed.
	rl._writeToOutput = (text) => {
		if (text.startsWith(question)) process.stdout.write(question);
	};
	return new Promise((resolve) =>
		rl.question(question, (answer) => {
			rl.close();
			process.stdout.write('\n');
			resolve(answer);
		}),
	);
}

let password = await ask('Heslo / password (Enter = vygenerovat / generate): ');
const generated = password === '';
if (generated) password = randomBytes(15).toString('base64url');
if (password.length < 10) {
	console.error('Heslo musí mít aspoň 10 znaků / The password needs at least 10 characters.');
	process.exit(1);
}

const salt = randomBytes(16);
const hash = pbkdf2Sync(password, salt, ITERATIONS, 32, 'sha256');
if (generated) console.log(`\nHeslo / password: ${password}`);
console.log(
	`\nSITE_PASSWORD_HASH=pbkdf2-sha256$${ITERATIONS}$${salt.toString('base64')}$${hash.toString('base64')}`,
);
