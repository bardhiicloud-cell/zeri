/**
 * Find why specific strings fail to translate.
 *
 * The coverage report shows ~30-70 "prose" strings outstanding per language.
 * Many look translatable, so this checks whether they are actually failing or
 * whether they are strings whose correct translation IS the source (brand names,
 * loanwords like "Reels", "Bot", "Edit" which are the same in Croatian).
 *
 * Usage:  node qa/why_missing.js <lang>
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dynamicTranslations } from '../src/lib/dynamicTranslations.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const lang = process.argv[2] || 'bs';

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

const strings = collectStrings();
const cache = JSON.parse(fs.readFileSync(path.join(root, '_translation_cache.json'), 'utf8'));
const have = cache[lang] || {};

// What other languages did with the same string — if they all equal the source,
// the source IS the translation and there is nothing to fix.
const missing = strings.filter((s) => !have[s]);

console.log(`Language: ${lang}`);
console.log(`Missing: ${missing.length}\n`);

let trulyUntranslated = 0;
const rows = [];

for (const s of missing) {
  const others = ['en', 'de', 'fr', 'it'].map((l) => (cache[l] || {})[s]).filter(Boolean);
  const allSame = others.length > 0 && others.every((o) => o.trim() === s.trim());
  const noData = others.length === 0;
  const verdict = allSame ? 'same-in-others (nothing to fix)' : noData ? 'no reference' : 'TRANSLATABLE';
  if (verdict === 'TRANSLATABLE') trulyUntranslated++;
  rows.push({ s, verdict, sample: others[0] || '-' });
}

console.log(`Genuinely untranslated: ${trulyUntranslated}`);
console.log(`Left alone correctly   : ${missing.length - trulyUntranslated}\n`);

console.log('=== Genuinely untranslated ===');
for (const r of rows.filter((r) => r.verdict === 'TRANSLATABLE').slice(0, 30)) {
  console.log(`  ${JSON.stringify(r.s).slice(0, 46).padEnd(48)} -> e.g. ${JSON.stringify(r.sample).slice(0, 34)}`);
}

console.log('\n=== Correctly identical across languages ===');
for (const r of rows.filter((r) => r.verdict === 'same-in-others (nothing to fix)').slice(0, 15)) {
  console.log(`  ${JSON.stringify(r.s).slice(0, 60)}`);
}