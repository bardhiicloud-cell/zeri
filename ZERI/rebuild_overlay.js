/**
 * Rebuild src/lib/newLanguageTranslations.{ts,js} from _translation_cache.json.
 *
 * `import_translations.js` writes only the .ts file, because the client bundles
 * that one. But qa/verify-i18n.mjs runs under Node, which cannot import a .ts
 * module, so it reads a .js twin. Keeping the two in lockstep by hand is how a
 * language ends up present in one and missing from the other, which fails QA for
 * a reason that has nothing to do with the translation itself.
 *
 * The overlay only contains languages that do NOT live in the original tables
 * (dynamicTranslations + uiTranslations). Albanian, English and the other five
 * original languages are resolved from those, so writing them here would ship a
 * second copy that can drift.
 *
 * Usage:  node rebuild_overlay.js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dynamicTranslations } from './src/lib/dynamicTranslations.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Languages carried by the overlay, matching generate_new_languages.js. */
const NEW_LANGS = ['ar', 'fr', 'it', 'pt', 'gsw', 'mk', 'sl', 'hr', 'sv', 'nb', 'nl', 'ja', 'ko', 'pl', 'bg'];

const CACHE_FILE = path.join(__dirname, '_translation_cache.json');
const TS_FILE = path.join(__dirname, 'src', 'lib', 'newLanguageTranslations.ts');
const JS_FILE = path.join(__dirname, 'src', 'lib', 'newLanguageTranslations.js');

/** Every Albanian source string, from both tables plus the extracted page strings. */
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
  } catch { /* optional: only present after i18n:extract */ }

  return Array.from(strings);
}

function build(cache, strings) {
  const out = {};
  const counts = {};
  for (const lang of NEW_LANGS) counts[lang] = 0;

  for (const src of strings) {
    const entry = {};
    for (const lang of NEW_LANGS) {
      const value = cache[lang] && cache[lang][src];
      if (value) {
        entry[lang] = value;
        counts[lang] += 1;
      }
    }
    if (Object.keys(entry).length > 0) out[src] = entry;
  }
  return { out, counts };
}

function main() {
  const cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  const strings = collectStrings();
  const { out, counts } = build(cache, strings);

  const banner = (lines) => `/**
${lines.map((l) => (l ? ` * ${l}` : ' *')).join('\n')}
 *
 * Generated content — do not edit by hand.
 *   Source   : _translation_cache.json
 *   Rebuild  : node rebuild_overlay.js
 *   Consumed : src/lib/dt.ts, which checks this map before the original tables
 *
 * An entry here wins for its language; a string that is absent falls through to
 * the Albanian original, so a partial file is always safe to ship.
 *
 * Languages: ${NEW_LANGS.join(', ')}
 */
`;

  fs.writeFileSync(
    TS_FILE,
      banner(['Translations for the languages added on top of the original six.']) +
        'export const newLanguageTranslations: Record<string, Record<string, string>> = ' +
        JSON.stringify(out, null, 2) + ';\n',
      'utf8'
    );

  fs.writeFileSync(
    JS_FILE,
    banner([
      'JavaScript twin of src/lib/newLanguageTranslations.ts.',
      '',
      'The client bundles the .ts module. This copy exists for Node-side tooling',
      '(qa/verify-i18n.mjs), which cannot import a .ts file at runtime.',
    ]) +
    'export const newLanguageTranslations = ' +
    JSON.stringify(out, null, 2) + ';\n',
    'utf8'
  );

  console.log(`Source strings : ${strings.length}`);
  console.log(`Entries written: ${Object.keys(out).length}`);
  console.log('Per language:');
  for (const lang of NEW_LANGS) {
    const pct = ((counts[lang] / strings.length) * 100).toFixed(1);
    console.log(`  ${lang.padEnd(4)} ${String(counts[lang]).padStart(5)}/${strings.length}  ${pct.padStart(5)}%`);
  }
}

main();
