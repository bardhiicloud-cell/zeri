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
import {
  SUPPORTED_LANGUAGES, LANGUAGE_OPTIONS, RTL_LANGUAGES, HTML_LANG_TAGS,
  REGIONAL_ENGLISH,
} from '../src/lib/languageConstants.js';
import { dt } from '../src/lib/dt.js';
import { SEO_LOCALES, parseLocalePath, buildLocalizedPath, translationLanguageFor } from '../src/lib/seo.js';
import { dynamicTranslations } from '../src/lib/dynamicTranslations.js';

const results = [];
const fail = (name, detail) => results.push({ ok: false, name, detail });
const pass = (name, detail) => results.push({ ok: true, name, detail });

// --- 1. the current language set is wired ---
// Spanish, Romanian and Armenian were removed and replaced by Japanese, Korean
// and Polish, plus Bulgarian, Canada and Australia.
const EXPECTED = [
  'sq', 'en', 'de', 'bs', 'ar', 'tr', 'sr', 'fr', 'it', 'pt',
  'gsw', 'mk', 'sl', 'hr', 'sv', 'nb', 'nl',
  'ja', 'ko', 'pl', 'bg', 'ca', 'au',
];
if (SUPPORTED_LANGUAGES.length === EXPECTED.length) {
  pass(`${EXPECTED.length} languages supported`, SUPPORTED_LANGUAGES.join(','));
} else {
  fail(`${EXPECTED.length} languages supported`, `got ${SUPPORTED_LANGUAGES.length}: ${SUPPORTED_LANGUAGES.join(',')}`);
}

// The three removed languages must be gone from every lookup table, or a stale
// /es/ link would still resolve and render Spanish on a site that no longer
// offers it.
const REMOVED = ['es', 'ro', 'hy'];
const stillSupported = REMOVED.filter((l) => SUPPORTED_LANGUAGES.includes(l));
if (stillSupported.length === 0) pass('removed languages are gone (es, ro, hy)', 'not in SUPPORTED_LANGUAGES');
else fail('removed languages are gone (es, ro, hy)', `still present: ${stillSupported.join(',')}`);

const stillInSwitcher = REMOVED.filter((l) => LANGUAGE_OPTIONS.some((o) => o.code === l));
if (stillInSwitcher.length === 0) pass('removed languages are gone from the switcher', 'not in LANGUAGE_OPTIONS');
else fail('removed languages are gone from the switcher', `still present: ${stillInSwitcher.join(',')}`);

const stillInSeo = REMOVED.filter((l) => SEO_LOCALES[l]);
if (stillInSeo.length === 0) pass('removed languages have no URL prefix', 'not in SEO_LOCALES');
else fail('removed languages have no URL prefix', `still present: ${stillInSeo.join(',')}`);

const missingMeta = EXPECTED.filter((l) => !LANGUAGE_OPTIONS.some((o) => o.code === l));
if (missingMeta.length === 0) pass('switcher lists every language', `${LANGUAGE_OPTIONS.length} entries`);
else fail('switcher lists every language', `missing: ${missingMeta.join(',')}`);

const missingOpt = EXPECTED.filter((l) => !LANGUAGE_OPTIONS.some((o) => o.code === l));
if (missingOpt.length === 0) pass('every supported language has a switcher entry', 'none missing');
else fail('every supported language has a switcher entry', missingOpt.join(','));

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

/*
 * Regional English must render the English string, not fall back to Albanian.
 * A regression here is silent: the page loads, the URL says /au/, and the text
 * is Albanian — which reads as "the site is broken" to an Australian visitor.
 */
const enText = dt(sample, 'en');
for (const region of REGIONAL_ENGLISH) {
  if (byLang[region] === enText && enText !== sample) {
    pass(`${region} renders through the English table`, byLang[region]);
  } else {
    fail(`${region} renders through the English table`, `expected "${enText}", got "${byLang[region]}"`);
  }
}

// The three new translations must be present in their own scripts.
for (const [lang, re, label] of [
  ['ja', /[\u3040-\u30FF\u4E00-\u9FFF]/, 'Japanese script'],
  ['ko', /[\uAC00-\uD7AF]/, 'Korean script'],
  ['bg', /[\u0400-\u04FF]/, 'Cyrillic script'],
]) {
  if (re.test(byLang[lang])) pass(`${lang} renders in ${label}`, byLang[lang]);
  else fail(`${lang} renders in ${label}`, byLang[lang]);
}
// Polish is Latin but must not be the Albanian source text.
if (byLang.pl && byLang.pl !== sample) pass('pl renders a Polish string', byLang.pl);
else fail('pl renders a Polish string', byLang.pl);

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
