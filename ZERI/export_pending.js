/**
 * Export the strings that still need translating, in a format any translator can
 * fill in.
 *
 * The live public translation endpoints rate-limit this machine's address, so
 * the remaining work cannot be finished by hammering them. This script writes
 * whatever is still missing to `translations/to-translate.json`, shaped as
 *   { "<albanian source>": { "ar": "...", "fr": "...", ... } }
 * which is:
 *   - readable and editable by a human translator
 *   - fillable by the project's own Gemini key via `npm run translate:ai`
 *   - valid input for `npm run translate:import`
 *
 * It also reports coverage per language, which is the number that answers
 * "is it 100% yet?".
 *
 * Usage:  node export_pending.js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dynamicTranslations } from './src/lib/dynamicTranslations.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const NEW_LANGS = ['ar', 'fr', 'it', 'pt', 'gsw', 'mk', 'sl', 'hr', 'sv', 'nb', 'nl', 'ja', 'ko', 'pl', 'bg'];
const CACHE_FILE = path.join(__dirname, '_translation_cache.json');
const OUT_DIR = path.join(__dirname, 'translations');
const OUT_FILE = path.join(OUT_DIR, 'to-translate.json');
const REPORT_FILE = path.join(OUT_DIR, 'coverage.json');

/** Every source string the app can render, from all three sources. */
function collectStrings() {
  const uiSrc = fs.readFileSync(path.join(__dirname, 'src', 'lib', 'uiTranslations.ts'), 'utf8');
  const uiKeys = new Set();
  const keyRe = /^\s{2}'((?:[^'\\]|\\.)*)':\s*\{/gm;
  let m;
  while ((m = keyRe.exec(uiSrc)) !== null) uiKeys.add(m[1].replace(/\\'/g, "'"));

  const strings = new Set(Object.keys(dynamicTranslations));
  for (const k of uiKeys) strings.add(k);

  try {
    const pageStrings = JSON.parse(fs.readFileSync(path.join(__dirname, '_page_strings.json'), 'utf8'));
    for (const s of pageStrings) strings.add(s);
  } catch {
    // Extraction has not been run; the two bundled tables still ship.
  }
  return Array.from(strings);
}

function main() {
  const cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  const strings = collectStrings();

  console.log(`Total source strings: ${strings.length}`);
  console.log(`Languages: ${NEW_LANGS.length}\n`);

  const pending = {};
  const coverage = { totalStrings: strings.length, languages: {} };

  for (const lang of NEW_LANGS) {
    const have = cache[lang] || {};
    let done = 0;
    const missing = [];

    for (const src of strings) {
      if (have[src]) {
        done++;
      } else {
        missing.push(src);
        if (!pending[src]) pending[src] = {};
        pending[src][lang] = '';
      }
    }

    const pct = ((done / strings.length) * 100).toFixed(2);
    coverage.languages[lang] = { done, missing: missing.length, percent: Number(pct) };
    console.log(`${lang.padEnd(5)} ${String(done).padStart(5)}/${strings.length}  ${pct.padStart(6)}%  (missing ${missing.length})`);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(pending, null, 2), 'utf8');
  fs.writeFileSync(REPORT_FILE, JSON.stringify(coverage, null, 2), 'utf8');

  const totalMissing = Object.values(coverage.languages).reduce((a, l) => a + l.missing, 0);
  console.log(`\nStrings still needing translation: ${totalMissing}`);
  console.log(`Written: ${path.relative(__dirname, OUT_FILE)}`);
  console.log(`Written: ${path.relative(__dirname, REPORT_FILE)}`);
  console.log('\nFill to-translate.json (by hand, by any service, or via npm run translate:ai)');
  console.log('then run:  node import_translations.js');
}

main();
