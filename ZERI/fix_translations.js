/**
 * Correct hand-checked terms that a machine translation got wrong.
 *
 * The coverage run left the UI at 99%+, but runtime verification
 * (qa/verify-translations.mjs) surfaced a small set of real errors that the
 * automated quality gate could not judge because they are plausible-looking
 * output rather than malformed output:
 *
 *   "Ballina"  ->  "Балина"    (Macedonian)  transliterated, not translated
 *   "Ballina"  ->  "Բալինա"    (Armenian)    transliterated, not translated
 *   "Ballina"  ->  "Balina"    (Croatian)    transliterated, not translated
 *   "Tema"     ->  "Tematică"  (Romanian)    wrong sense (subject vs. theme)
 *
 * These are the navigation labels a citizen reads on every screen, so they are
 * corrected here by hand and this file is the record of why.
 *
 * Unlike fill_by_hand.js this OVERWRITES, because the previous value is known to
 * be wrong. Use it only for reviewed corrections.
 *
 * Usage:  node fix_translations.js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_FILE = path.join(__dirname, '_translation_cache.json');

/**
 * source -> language -> corrected value.
 * Every entry here was read by a human and judged wrong.
 */
const CORRECTIONS = {
  'Ballina': {
    mk: 'Дома',        // was Балина — transliteration of the Albanian, not a translation
    hy: 'Գլխավոր',     // was Բալինա — same problem
    hr: 'Početna',     // was Balina
    sl: 'Domov',       // already correct, kept for completeness
    ro: 'Acasă',
    sr: 'Почетна',
    bs: 'Početna',
  },
  'Tema': {
    ro: 'Temă',        // was Tematică — that means "thematic", not "topic"
    it: 'Argomento',   // "Tema" in Italian is a false friend; Argomento is "topic"
    es: 'Tema',
    pt: 'Tema',
  },
  'Ballina (Dashboard)': {
    mk: 'Дома (Табла)',
    hy: 'Գլխավոր (Վահանակ)',
    hr: 'Početna (Nadzorna ploča)',
    ro: 'Acasă (Panou)',
    sr: 'Почетна (Табла)',
    bs: 'Početna (Nadzorna ploča)',
  },
};

function main() {
  const cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));

  let changed = 0;
  let absent = 0;

  for (const [source, byLang] of Object.entries(CORRECTIONS)) {
    for (const [lang, correct] of Object.entries(byLang)) {
      cache[lang] = cache[lang] || {};
      const previous = cache[lang][source];

      if (previous === undefined) {
        // Not present at all: add it, but say so, because that means the string
        // was never translated rather than mistranslated.
        cache[lang][source] = correct;
        absent++;
        console.log(`  ADD  ${lang.padEnd(4)} "${source}" -> "${correct}"`);
        continue;
      }

      if (previous === correct) continue;

      cache[lang][source] = correct;
      changed++;
      console.log(`  FIX  ${lang.padEnd(4)} "${source}"  "${previous}" -> "${correct}"`);
    }
  }

  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache), 'utf8');
  console.log(`\nCorrected ${changed}, added ${absent}.`);
  console.log('Now run:  node merge_shards.js');
}

main();
