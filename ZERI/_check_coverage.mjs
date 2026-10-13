/**
 * Report per-language coverage in the overlay module.
 *
 * Answers one question at a time: which languages are actually populated in
 * src/lib/newLanguageTranslations.ts, and how complete are they against the
 * source-string total. Nothing here mutates anything — it is a read-only probe
 * used while adding languages, so a half-finished generation run is visible
 * rather than guessed at.
 *
 * Usage:  node _check_coverage.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TS = path.join(__dirname, 'src', 'lib', 'newLanguageTranslations.ts');
const CACHE = path.join(__dirname, '_translation_cache.json');

const LANGS = ['ar', 'fr', 'it', 'pt', 'gsw', 'mk', 'sl', 'hr', 'sv', 'nb', 'nl', 'ja', 'ko', 'pl', 'bg'];

const cache = JSON.parse(fs.readFileSync(CACHE, 'utf8'));

const src = fs.readFileSync(TS, 'utf8');
const keys = /\n  "((?:[^"\\]|\\.)*)": \{/g;
let total = 0;
const withLang = {};
for (const l of LANGS) withLang[l] = 0;

let m;
while ((m = keys.exec(src)) !== null) {
  total += 1;
  const blockStart = m.index + m[0].length;
  const blockEnd = src.indexOf('\n  },', blockStart);
  const block = src.slice(blockStart, blockEnd === -1 ? undefined : blockEnd);
  for (const l of LANGS) {
    if (block.includes('"' + l + '":')) withLang[l] += 1;
  }
}

console.log('--- overlay module ---');
console.log('source strings with any entry :', total);
for (const l of LANGS) {
  const pct = ((withLang[l] / total) * 100).toFixed(1);
  console.log(`  ${l.padEnd(4)} ${String(withLang[l]).padStart(5)}  ${pct.padStart(5)}%`);
}

console.log('\n--- translation cache ---');
for (const l of LANGS) {
  console.log(`  ${l.padEnd(4)} ${String(Object.keys(cache[l] || {}).length).padStart(5)}`);
}
