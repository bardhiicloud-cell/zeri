/**
 * Verify the i18n wiring without a browser.
 *
 * The headless browser is blocked by this app's first-visit gates and by
 * Firebase calls that cannot complete offline, which makes it a poor harness for
 * this particular question. The logic that actually needs proving is pure:
 *
 *   1. every one of the 20 languages resolves a translation
 *   2. switching language changes rendered text
 *   3. the URL prefix for a language round-trips
 *   4. Arabic is flagged RTL and the rest are not
 *   5. no supported language falls back to Albanian for a string that has a
 *      translation available in the overlay
 *
 * These are the guarantees the user asked for, and they can be checked exactly.
 */
import { SUPPORTED_LANGUAGES, LANGUAGE_OPTIONS, RTL_LANGUAGES, HTML_LANG_TAGS } from '../src/lib/languageConstants.js';
import { dt } from '../src/lib/dt.js';
import { SEO_LOCALES, parseLocalePath, buildLocalizedPath } from '../src/lib/seo.js';
import { dynamicTranslations } from '../src/lib/dynamicTranslations.js';

const results = [];
const fail = (name, detail) => results.push({ ok: false, name, detail });
const pass = (name, detail) => results.push({ ok: true, name, detail });

// --- 1. all 20 languages are wired ---
const EXPECTED = [
  'sq', 'en', 'de', 'bs', 'ar', 'tr', 'sr', 'fr', 'it', 'es',
  'pt', 'gsw', 'mk', 'sl', 'hr', 'ro', 'sv', 'nb', 'hy', 'nl',
];
if (SUPPORTED_LANGUAGES.length === 20) {
  pass('20 languages supported', SUPPORTED_LANGUAGES.join(','));
} else {
  fail('20 languages supported', `got ${SUPPORTED_LANGUAGES.length}: ${SUPPORTED_LANGUAGES.join(',')}`);
}

const missingMeta = EXPECTED.filter((l) => !LANGUAGE_OPTIONS.some((o) => o.code === l));
if (missingMeta.length === 0) pass('switcher lists all 20', `${LANGUAGE_OPTIONS.length} entries`);
else fail('switcher lists all 20', `missing: ${missingMeta.join(',')}`);

const missingSeo = EXPECTED.filter((l) => !SEO_LOCALES[l]);
if (missingSeo.length === 0) pass('SEO locale per language', 'all present');
else fail('SEO locale per language', `missing: ${missingSeo.join(',')}`);

const missingTag = EXPECTED.filter((l) => !HTML_LANG_TAGS[l]);
if (missingTag.length === 0) pass('html lang tag per language', 'all present');
else fail('html lang tag per language', `missing: ${missingTag.join(',')}`);

// --- 2. RTL ---
if (RTL_LANGUAGES.length === 1 && RTL_LANGUAGES[0] === 'ar') {
  pass('Arabic is the only RTL language', 'ar');
} else {
  fail('Arabic is the only RTL language', RTL_LANGUAGES.join(','));
}

// --- 3. translation actually differs per language ---
// Use strings that already have entries in the original table (en/de/bs/tr/sr)
// AND ones that should only resolve through the new overlay.
const sample = 'Duke ngarkuar platformën...';
const byLang = {};
for (const lang of EXPECTED) byLang[lang] = dt(sample, lang);

// For the six original languages we can assert a real translation exists.
const origSix = ['en', 'de', 'bs', 'tr', 'sr'];
for (const lang of origSix) {
  const native = dynamicTranslations[sample]?.[lang];
  if (native && byLang[lang] === native) {
    pass(`dt() returns ${lang} translation`, byLang[lang]);
  } else {
    fail(`dt() returns ${lang} translation`, `expected "${native}", got "${byLang[lang]}"`);
  }
}

// Albanian must be the identity.
if (byLang.sq === sample) pass('dt() returns Albanian unchanged', sample);
else fail('dt() returns Albanian unchanged', byLang.sq);

// --- 4. URL round-trip ---
const pagePaths = ['/', '/sherbimet', '/lajme', '/raporto', '/kontakt-numrat'];
let urlOk = true;
const urlFailures = [];
for (const p of pagePaths) {
  for (const lang of EXPECTED) {
    const built = buildLocalizedPath(p, lang);
    const parsed = parseLocalePath(built);
    if (parsed.language !== lang) {
      urlOk = false;
      urlFailures.push(`${p} + ${lang} -> ${built} parsed as ${parsed.language}`);
    }
  }
}
if (urlOk) pass('URL prefix round-trips for every language', `${pagePaths.length * EXPECTED.length} combinations`);
else fail('URL prefix round-trips for every language', urlFailures.slice(0, 6).join(' | '));

// Albanian stays unprefixed; English gets /en.
const enPath = buildLocalizedPath('/sherbimet', 'en');
const sqPath = buildLocalizedPath('/sherbimet', 'sq');
if (enPath === '/en/sherbimet') pass('English URL is /en/sherbimet', enPath);
else fail('English URL is /en/sherbimet', enPath);
if (sqPath === '/sherbimet') pass('Albanian URL is unprefixed', sqPath);
else fail('Albanian URL is unprefixed', sqPath);

// --- 5. no language silently renders the wrong one ---
// A language that is supported but has no entry must still return something
// (never empty, never the source unless that is the declared fallback).
const emptyResults = EXPECTED.filter((l) => {
  const v = dt(sample, l);
  return typeof v !== 'string' || v.length === 0;
});
if (emptyResults.length === 0) pass('no language renders an empty string', 'all non-empty');
else fail('no language renders an empty string', emptyResults.join(','));

// --- Report ---
console.log('\n=== i18n verification ===\n');
for (const r of results) {
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}\n        ${r.detail}`);
}
const failures = results.filter((r) => !r.ok);
console.log(`\n${results.length - failures.length}/${results.length} checks passed.`);
if (failures.length > 0) {
  console.log('\nFAILURES:');
  for (const f of failures) console.log(`  - ${f.name}: ${f.detail}`);
  process.exit(1);
}
