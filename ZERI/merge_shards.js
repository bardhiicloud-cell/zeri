/**
 * Merge shard caches into the main cache and rebuild newLanguageTranslations.ts.
 *
 * Run after run_shards.js finishes (or at any point to bank partial progress).
 * The main cache is the union of what was already there plus every shard, so
 * re-running is always safe.
 *
 * Usage:  node merge_shards.js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dynamicTranslations } from './src/lib/dynamicTranslations.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ALL_LANGS = ['ar', 'fr', 'it', 'es', 'pt', 'gsw', 'mk', 'sl', 'hr', 'ro', 'sv', 'nb', 'hy', 'nl'];
const MAIN_CACHE = path.join(__dirname, '_translation_cache.json');
const SHARD_DIR = path.join(__dirname, '_shards');
const OUT_FILE = path.join(__dirname, 'src', 'lib', 'newLanguageTranslations.ts');

/** Same wrong-substitution repairs the importer applies. */
const WRONG = [/\bkaza[cjksz][a-z]*stan\b/gi, /\bkaza[cjksz]h?st[ae]n\b/gi, /\bqazaqstan\b/gi];
function repair(text, lang) {
  let out = text;
  if (/kosov/i.test(out) || WRONG.some((re) => re.test(out))) {
    for (const re of WRONG) out = out.replace(re, '');
    const correct = { mk: 'Косово', sr: 'Косово', tr: 'Kosova', ar: 'كوسوفو', hy: 'Կոսովո' }[lang] || 'Kosovo';
    if (!out.toLowerCase().includes(correct.slice(0, 4).toLowerCase())) out = `${correct} ${out}`.trim();
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

function main() {
  const main = JSON.parse(fs.readFileSync(MAIN_CACHE, 'utf8'));
  let merged = 0;

  if (fs.existsSync(SHARD_DIR)) {
    for (const lang of ALL_LANGS) {
      const f = path.join(SHARD_DIR, `cache_${lang}.json`);
      if (!fs.existsSync(f)) continue;
      let shard;
      try {
        shard = JSON.parse(fs.readFileSync(f, 'utf8'));
      } catch {
        console.warn(`  skipping unreadable shard cache: ${lang}`);
        continue;
      }
      const fromShard = shard[lang] || {};
      main[lang] = main[lang] || {};
      for (const [src, val] of Object.entries(fromShard)) {
        if (main[lang][src]) continue;
        if (typeof val !== 'string' || !val.trim()) continue;
        main[lang][src] = repair(val.trim(), lang);
        merged++;
      }
    }
  }

  fs.writeFileSync(MAIN_CACHE, JSON.stringify(main), 'utf8');

  const strings = collectStrings();
  const out = {};
  for (const src of strings) {
    const entry = {};
    for (const lang of ALL_LANGS) {
      const v = main[lang] && main[lang][src];
      if (v) entry[lang] = v;
    }
    if (Object.keys(entry).length > 0) out[src] = entry;
  }

  const header = `/**
 * Translations for the languages added on top of the original six.
 *
 * Generated file — do not edit by hand.
 *   Source   : _translation_cache.json (union of the per-language shard caches)
 *   Consumed : src/lib/dt.ts, which checks this map before the original tables
 *
 * An entry here wins for its language; a string that is absent falls through to
 * the Albanian original, so a partial file is always safe to ship.
 *
 * Languages: ar, fr, it, es, pt, gsw, mk, sl, hr, ro, sv, nb, hy, nl
 */
`;
  fs.writeFileSync(
    OUT_FILE,
    header + 'export const newLanguageTranslations: Record<string, Record<string, string>> = ' +
    JSON.stringify(out, null, 2) + ';\n',
    'utf8'
  );

  console.log(`Merged ${merged} new entries from shards.`);
  console.log(`Wrote ${path.relative(__dirname, OUT_FILE)} with ${Object.keys(out).length} entries.\n`);

  let totalMissing = 0;
  for (const lang of ALL_LANGS) {
    const done = Object.keys(main[lang] || {}).length;
    const missing = strings.length - done;
    totalMissing += missing;
    console.log(`  ${lang.padEnd(5)} ${String(done).padStart(5)}/${strings.length}  ${((done / strings.length) * 100).toFixed(1)}%`);
  }
  console.log(`\nTotal still missing: ${totalMissing}`);
}

main();
