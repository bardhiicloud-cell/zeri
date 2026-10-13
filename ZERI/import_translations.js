/**
 * Import filled translations back into the cache and regenerate the TS module.
 *
 * Pairs with export_pending.js. Whatever process fills `translations/to-translate.json`
 * — a translator, the Gemini path, another machine without the rate limit —
 * hands the result here, and this writes it into the same cache the generator
 * uses, then rebuilds src/lib/newLanguageTranslations.ts.
 *
 * Entries left empty are skipped rather than imported as blank strings, so a
 * half-filled file is always safe to import.
 *
 * Usage:  node import_translations.js [--file=translations/to-translate.json]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dynamicTranslations } from './src/lib/dynamicTranslations.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const NEW_LANGS = ['ar', 'fr', 'it', 'pt', 'gsw', 'mk', 'sl', 'hr', 'sv', 'nb', 'nl', 'ja', 'ko', 'pl', 'bg'];
const CACHE_FILE = path.join(__dirname, '_translation_cache.json');
const OUT_FILE = path.join(__dirname, 'src', 'lib', 'newLanguageTranslations.ts');

// Proper-noun repairs, applied on import so an external translator cannot
// reintroduce the "Kosovo -> Kazakhstan" class of error.
const WRONG_SUBSTITUTIONS = [
  /\bkaza[cjksz][a-z]*stan\b/gi,
  /\bkaza[cjksz]h?st[ae]n\b/gi,
  /\bqazaqstan\b/gi,
];

function repair(text, lang) {
  let out = text;
  if (/kosov/i.test(out) || WRONG_SUBSTITUTIONS.some((re) => re.test(out))) {
    for (const re of WRONG_SUBSTITUTIONS) out = out.replace(re, '');
    const correct = { mk: 'Косово', sr: 'Косово', tr: 'Kosova', ar: 'كوسوفو', bg: 'Косово', ja: 'コソボ', ko: '코소보', pl: 'Kosowo' }[lang] || 'Kosovo';
    if (!out.toLowerCase().includes(correct.slice(0, 4).toLowerCase())) {
      out = `${correct} ${out}`.trim();
    }
    out = out.replace(/\s{2,}/g, ' ').replace(/\s+([.,!?])/g, '$1').trim();
  }
  return out;
}

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
  } catch { /* optional */ }
  return Array.from(strings);
}

function writeOutput(cache, strings) {
  const out = {};
  for (const src of strings) {
    const entry = {};
    for (const lang of NEW_LANGS) {
      const v = cache[lang] && cache[lang][src];
      if (v) entry[lang] = v;
    }
    if (Object.keys(entry).length > 0) out[src] = entry;
  }

  const header = `/**
 * Translations for the languages added on top of the original six.
 *
 * Generated file — do not edit by hand.
 *   Source   : _translation_cache.json (built by generate_new_languages.js,
 *              export_pending.js + import_translations.js)
 *   Consumed : src/lib/dt.ts, which checks this map before the original tables
 *
 * An entry here wins for its language; a string that is absent falls through to
 * the Albanian original, so a partial file is always safe to ship.
 *
 * Languages: ar, fr, it, pt, gsw, mk, sl, hr, sv, nb, nl, ja, ko, pl, bg
 */
`;
  fs.writeFileSync(
    OUT_FILE,
    header + 'export const newLanguageTranslations: Record<string, Record<string, string>> = ' +
    JSON.stringify(out, null, 2) + ';\n',
    'utf8'
  );
  return Object.keys(out).length;
}

function main() {
  const fileArg = process.argv.find((a) => a.startsWith('--file='));
  const inFile = fileArg ? fileArg.split('=')[1] : path.join('translations', 'to-translate.json');
  const inPath = path.isAbsolute(inFile) ? inFile : path.join(__dirname, inFile);

  if (!fs.existsSync(inPath)) {
    console.error(`No file at ${inPath}. Run export_pending.js first.`);
    process.exit(1);
  }

  const incoming = JSON.parse(fs.readFileSync(inPath, 'utf8'));
  const cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));

  let imported = 0;
  let skipped = 0;

  for (const [src, byLang] of Object.entries(incoming)) {
    if (!byLang || typeof byLang !== 'object') continue;
    for (const [lang, value] of Object.entries(byLang)) {
      if (!NEW_LANGS.includes(lang)) continue;
      if (typeof value !== 'string' || !value.trim()) { skipped++; continue; }
      cache[lang] = cache[lang] || {};
      if (cache[lang][src]) continue; // never overwrite existing work
      cache[lang][src] = repair(value.trim(), lang);
      imported++;
    }
  }

  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache), 'utf8');
  const strings = collectStrings();
  const entries = writeOutput(cache, strings);

  console.log(`Imported ${imported} translations (${skipped} empty entries skipped).`);
  console.log(`Wrote ${path.relative(__dirname, OUT_FILE)} with ${entries} entries.`);

  console.log('\nCoverage now:');
  for (const lang of NEW_LANGS) {
    const done = Object.keys(cache[lang] || {}).length;
    console.log(`  ${lang.padEnd(5)} ${done}/${strings.length} (${((done / strings.length) * 100).toFixed(1)}%)`);
  }
}

main();
