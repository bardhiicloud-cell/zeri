/**
 * Report real translation coverage across all 20 languages.
 *
 * Distinguishes three kinds of "missing" so the number is honest:
 *   - prose        : genuine sentences that SHOULD be translated
 *   - identifier   : acronyms, units, codes, HTML snippets that must stay as-is
 *   - properNoun   : place and brand names, correctly left alone
 *
 * A language at 97% with the remainder being identifiers and proper nouns is
 * effectively complete; one at 97% with prose outstanding is not.
 *
 * Usage:  node qa/coverage_report.js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dynamicTranslations } from '../src/lib/dynamicTranslations.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const ALL_LANGS = [
  'sq', 'en', 'de', 'bs', 'ar', 'tr', 'sr', 'fr', 'it', 'es',
  'pt', 'gsw', 'mk', 'sl', 'hr', 'ro', 'sv', 'nb', 'hy', 'nl',
];

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

/** Classify a source string so "missing" can be judged. */
function classify(s) {
  const t = s.trim();
  // Pure identifiers: acronyms, units, codes, numbers, HTML fragments.
  if (/^[A-Z0-9\s\-–—/&.()'"]+$/.test(t)) return 'identifier';
  if (/^[^A-Za-zÀ-ÿ\u0400-\u04FF\u0530-\u058F\u0600-\u06FF]*$/.test(t)) return 'identifier';
  if (/^<[^>]+>/.test(t)) return 'identifier';
  if (/^https?:/.test(t)) return 'identifier';
  // Short place/brand names.
  if (t.split(/\s+/).length <= 3 &&
    /^(Kosov|Prishtin|Prizren|Pej|Gjakov|Mitrovic|Ferizaj|Gjilan|Vushtrri|Podujev|Rahovec|Suharek|Malishev|Kamenic|Deçan|Istog|Klin|Skenderaj|Dragash|Kaçanik|Junik|Mamush|Ranillug|Partesh|Kllokot|ZERI|Zëri|Zeri|Firebase|Google|GDPR|e-Kosova|e-Komuna)/i.test(t)) {
    return 'properNoun';
  }
  return 'prose';
}

const strings = collectStrings();
const main = JSON.parse(fs.readFileSync(path.join(root, '_translation_cache.json'), 'utf8'));

// Merge the multilingual cache too, so the report reflects work in flight.
let mul = {};
try {
  mul = JSON.parse(fs.readFileSync(path.join(root, '_mul_cache.json'), 'utf8'));
} catch { /* not started */ }

const merged = {};
for (const lang of ALL_LANGS) {
  merged[lang] = { ...(main[lang] || {}), ...(mul[lang] || {}) };
}

console.log(`Source strings: ${strings.length}\n`);
console.log('lang   coverage    prose missing   verdict');
console.log('----   --------    -------------   -------');

let totalProseMissing = 0;

for (const lang of ALL_LANGS) {
  if (lang === 'sq') {
    console.log('sq     100.0%      -               source language');
    continue;
  }
  const have = merged[lang];
  const missing = strings.filter((s) => !have[s]);
  const prose = missing.filter((s) => classify(s) === 'prose');
  totalProseMissing += prose.length;

  const done = strings.length - missing.length;
  const pct = ((done / strings.length) * 100).toFixed(1);

  let verdict;
  if (prose.length === 0) verdict = 'COMPLETE';
  else if (prose.length <= 20) verdict = 'near complete';
  else if (pct === '0.0') verdict = 'not started';
  else verdict = 'in progress';

  console.log(`${lang.padEnd(6)} ${pct.padStart(6)}%     ${String(prose.length).padStart(6)}        ${verdict}`);
}

console.log(`\nTotal untranslated prose sentences across all languages: ${totalProseMissing}`);

// Breakdown of what is left for the worst language.
const worst = ALL_LANGS
  .filter((l) => l !== 'sq')
  .map((l) => ({ lang: l, prose: strings.filter((s) => !merged[l][s] && classify(s) === 'prose').length }))
  .sort((a, b) => b.prose - a.prose)[0];

if (worst && worst.prose > 0) {
  console.log(`\nMost outstanding prose: ${worst.lang} (${worst.prose})`);
  const sample = strings.filter((s) => !merged[worst.lang][s] && classify(s) === 'prose').slice(0, 12);
  for (const s of sample) console.log('  ' + JSON.stringify(s).slice(0, 100));
}
