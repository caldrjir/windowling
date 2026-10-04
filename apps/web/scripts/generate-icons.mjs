// Generates placeholder PWA icons (a lit window on a night background).
// Usage: node scripts/generate-icons.mjs  - replace with real artwork later.
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const NIGHT = [0x1b, 0x1d, 0x2a];
const LAMP = [0xff, 0xe2, 0xb8];

function crc32(buf) {
	let c = ~0;
	for (const byte of buf) {
		c ^= byte;
		for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
	}
	return ~c >>> 0;
}

function chunk(type, data) {
	const len = Buffer.alloc(4);
	len.writeUInt32BE(data.length);
	const body = Buffer.concat([Buffer.from(type), data]);
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(body));
	return Buffer.concat([len, body, crc]);
}

/** `inset` is the safe-zone padding (maskable icons need ~10%+). */
function icon(size, inset) {
	const raw = Buffer.alloc((size * 3 + 1) * size);
	const pad = size * inset;
	const x0 = pad + (size - 2 * pad) * 0.22;
	const x1 = size - x0;
	const y0 = pad + (size - 2 * pad) * 0.19;
	const y1 = size - y0;
	const bar = Math.max(1, size * 0.06);
	const midX = size / 2;
	const midY = (y0 + y1) / 2;
	for (let y = 0; y < size; y++) {
		raw[y * (size * 3 + 1)] = 0;
		for (let x = 0; x < size; x++) {
			const inWindow = x >= x0 && x < x1 && y >= y0 && y < y1;
			const onFrame = Math.abs(x + 0.5 - midX) < bar / 2 || Math.abs(y + 0.5 - midY) < bar / 2;
			const color = inWindow && !onFrame ? LAMP : NIGHT;
			raw.set(color, y * (size * 3 + 1) + 1 + x * 3);
		}
	}
	const header = Buffer.alloc(13);
	header.writeUInt32BE(size, 0);
	header.writeUInt32BE(size, 4);
	header.set([8, 2, 0, 0, 0], 8); // 8-bit RGB
	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk('IHDR', header),
		chunk('IDAT', deflateSync(raw)),
		chunk('IEND', Buffer.alloc(0)),
	]);
}

const out = new URL('../static/icons/', import.meta.url);
writeFileSync(new URL('icon-192.png', out), icon(192, 0));
writeFileSync(new URL('icon-512.png', out), icon(512, 0));
writeFileSync(new URL('icon-maskable-512.png', out), icon(512, 0.12));
writeFileSync(new URL('apple-touch-icon.png', out), icon(180, 0.06));
console.log('icons written to static/icons');
