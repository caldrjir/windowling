// Builds the pronunciation dictionary for the neural voice (static/voice/lexicon-us.json)
// from Misaki's American English dictionaries (Apache-2.0, https://github.com/hexgrad/misaki):
// the "gold" entries win over the "silver" ones; JSON without indentation.
//
//   pip download misaki --no-deps && unzip misaki-*.whl -d misaki
//   node apps/web/scripts/voice-lexicon.mjs misaki/misaki/data
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [dir, out = 'apps/web/static/voice/lexicon-us.json'] = process.argv.slice(2);
if (!dir) throw new Error('Usage: node apps/web/scripts/voice-lexicon.mjs <misaki data dir> [out]');
const read = (name) => JSON.parse(readFileSync(join(dir, name), 'utf8'));
const lexicon = { ...read('us_silver.json'), ...read('us_gold.json') };
writeFileSync(out, JSON.stringify(lexicon));
console.log('wrote', out, Object.keys(lexicon).length, 'words');
