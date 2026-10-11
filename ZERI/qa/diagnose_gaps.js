/**
 * Diagnostic: find which strings Argos refuses to translate.
 *
 * Five languages finished at 97-99% with "+0" on their final pass, meaning Argos
 * returned the input unchanged for ~40-60 strings each. Those are the real
 * remaining gap, so this lists them with enough context to see the pattern.
 *
 * Usage:  node qa/diagnose_gaps.js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dynamicTranslations } from '../src/lib/dynamicTranslations.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function collectStrings() {
  const uiSrc = fs.readFileSync(path.join(root, 'src', 'lib', 'uiTranslations.ts'), 'utf8');
  const uiKeys = new Set();
  const keyRe = /^\s{2}'((?:[^'\\]|\\.)*)':\s*\{/gm;
  let m;
  while ((m = keyRe.exec(uiSrc)) !== null) uiKeys.add(m[1].replace(/\\'/g, "'"));

  const strings = new Set(Object.keys(dynamicTranslations));
  for (const k of uiKeys) strings.add(k);
  try {
    const pageStrings = JSON.parse(fs.readFileSync(path.join(root, '_page_strings.json'), 'utf8'));
    for (const s of pageStrings) strings.add(s);
  } catch { /* optional */ }
  return Array.from(strings);
}

const cache = JSON.parse(fs.readFileSync(path.join(root, '_translation_cache.json'), 'utf8'));
const strings = collectStrings();

// Classify every missing string so the fix targets the real cause.
const categories = {
  properNounOnly: [],   // just a name/code, correctly left alone
  acronymOnly: [],      // initials, units, codes
  escapeOnly: [],       // strings made of punctuation/format tokens
  realText: [],         // genuine prose that SHOULD have translated
};

function classify(s) {
  const trimmed = s.trim();
  if (/^[A-Z0-9\s\-–—/&.()'"]+$/.test(trimmed)) return 'acronymOnly';
  if (/^[^A-Za-zÀ-ÿ\u0400-\u04FF\u0530-\u058F\u0600-\u06FF]*$/.test(trimmed)) return 'escapeOnly';
  if (/^(Kosov|Prishtin|Prizren|Pej|Gjakov|Mitrovic|Ferizaj|Gjilan|Vushtrri|Podujev|Rahovec|Suharek|Malishev|Kamenic|Deçan|Istog|Klin|Skenderaj|Dragash|Kaçanik|Junik|Mamush|Ranillug|Partesh|Kllokot|ZERI|Zëri)/i.test(trimmed)
    && trimmed.split(/\s+/).length <= 3) return 'properNounOnly';
  return 'realText';
}

for (const lang of ['en', 'de', 'gsw', 'ar', 'tr', 'bs', 'sr', 'hr', 'mk', 'hy']) {
  const have = cache[lang] || {};
  const missing = strings.filter((s) => !have[s]);
  const counts = { properNounOnly: 0, acronymOnly: 0, escapeOnly: 0, realText: 0 };
  for (const s of missing) counts[classify(s)]++;
  console.log(`${lang.padEnd(5)} missing ${String(missing.length).padStart(4)}  ::  real text ${counts.realText}, acronym ${counts.acronymOnly}, escape ${counts.escapeOnly}, name ${counts.properNounOnly}`);
}

// Show the genuine prose left in English, which is the part worth fixing.
console.log('\n=== Real prose still missing for English ===');
const en = cache.en || {};
const enMissing = strings.filter((s) => !en[s] && classify(s) === 'realText');
for (const s of enMissing.slice(0, 30)) console.log('  ' + JSON.stringify(s).slice(0, 110));

console.log(`\nTotal English prose missing: ${enMissing.length}`);
