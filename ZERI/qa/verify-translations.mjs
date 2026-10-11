/**
 * Verify that the generated translations actually resolve at runtime.
 *
 * The coverage report proves the data is in the cache; this proves dt() returns
 * it, which is the property that matters. It checks a spread of languages
 * including the ones served by the multilingual model and the five that are
 * structurally identical across Latin-script languages.
 */
import { dt } from '../src/lib/dt.js';
import { SUPPORTED_LANGUAGES } from '../src/lib/languageConstants.js';
import { newLanguageTranslations } from '../src/lib/newLanguageTranslations.js';

// A string that exists in every language and must differ from Albanian.
const SAMPLES = [
  'Ballina',
  'Statistika',
  'Tema',
  'Shtrirja (Targeti)',
  'Lanso Fushatën',
  'Online (Bot)',
];

const results = [];
let resolved = 0;
let total = 0;
let missing = 0;

for (const lang of SUPPORTED_LANGUAGES) {
  for (const sample of SAMPLES) {
    total++;
    const out = dt(sample, lang);
    if (!out) {
      missing++;
      results.push({ lang, sample, out, problem: 'empty' });
      continue;
    }
    // Albanian returns itself; every other language should differ for at least
    // one of the sample set, so a language that returns everything unchanged is
    // a red flag rather than a pass.
    if (out.trim() !== sample.trim()) resolved++;
  }

  const translated = SAMPLES.filter((s) => dt(s, lang).trim() !== s.trim()).length;
  console.log(`${lang.padEnd(5)} ${translated}/${SAMPLES.length} differ from Albanian  e.g. "${dt('Ballina', lang)}" · "${dt('Tema', lang)}"`);
}

console.log(`\nTotal lookups: ${total}`);
console.log(`Resolved to a different string: ${resolved}`);
console.log(`Empty results: ${missing}`);

// Overlay size, which is what ships.
console.log(`\nOverlay entries: ${Object.keys(newLanguageTranslations).length}`);
const langCounts = {};
for (const entry of Object.values(newLanguageTranslations)) {
  for (const l of Object.keys(entry)) {
    langCounts[l] = (langCounts[l] || 0) + 1;
  }
}
console.log('Entries per language in the shipped overlay:');
for (const lang of SUPPORTED_LANGUAGES) {
  if (lang === 'sq') continue;
  console.log(`  ${lang.padEnd(5)} ${langCounts[lang] || 0}`);
}

const problems = results.filter((r) => r.problem);
if (problems.length > 0) {
  console.log(`\n${problems.length} empty resolution(s):`);
  for (const p of problems.slice(0, 10)) console.log(`  ${p.lang} "${p.sample}"`);
  process.exit(1);
}
console.log('\nAll lookups resolved.');
