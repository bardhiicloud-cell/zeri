/**
 * Repair proper-noun corruption in the translation cache.
 *
 * The machine translator has a consistent failure mode: the Albanian word for
 * Kosovo-shaped source text is sometimes rendered as Kazakhstan. The existing
 * generators strip it, but only for strings that *mention* Kosovo, and only for
 * the languages they were run against — so "KOSOVA BASHKË" survived as
 * "Kosova KAZAHSTAN JUNTOS" in Romanian, Slovenian, Spanish and others, and the
 * four newest languages were never checked at all.
 *
 * Two rules:
 *
 *   1. Any Kazakhstan spelling inside a translation is deleted outright. It is
 *      never a legitimate rendering of an Albanian civic string.
 *   2. If the source mentions Kosovo and the translation no longer contains a
 *      Kosovo-shaped word, the correct native name is prepended. That is what
 *      turns "Kosova" alone into a readable phrase for the reader.
 *
 * Idempotent: running it twice changes nothing the second time.
 *
 * Usage:  node repair_leaks.js [--dry]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_FILE = path.join(__dirname, '_translation_cache.json');

const DRY = process.argv.includes('--dry');

/**
 * Every spelling the providers emit for the wrong country.
 *
 * Match boundaries are written as character classes rather than `\b` on
 * purpose. JavaScript's `\b` is defined against ASCII word characters, so it
 * silently never matches next to Cyrillic or Arabic — the first version of this
 * file used `\bkaza...stan\b` and repaired nothing at all, while the same
 * pattern without the anchors matched. The character classes work in every
 * script.
 *
 * The trailing guard `(?!\p{L})` is what keeps Turkish out: "kazandı" (won)
 * and "kazanmak" (to win) start with the same four letters and are perfectly
 * good Turkish words, not a mis-translated country.
 */
const WRONG = [
  /(?<!\p{L})kaza[ckj]h?s?t[aá]?n?(?!\p{L})/giu,
  /(?<!\p{L})qazaqstan(?!\p{L})/giu,
  /(?<!\p{L})kazachstan(?!\p{L})/giu,
  /(?<!\p{L})kazajst[aá]n(?!\p{L})/giu,
];

/** Kosovo spelled correctly, per language, using each language's own script. */
const KOSOVO = {
  en: 'Kosovo',
  sq: 'Kosovë',
  de: 'Kosovo',
  bs: 'Kosovo',
  sr: 'Косово',
  tr: 'Kosova',
  ar: 'كوسوفو',
  fr: 'Kosovo',
  it: 'Kosovo',
  pt: 'Kosovo',
  gsw: 'Kosovo',
  mk: 'Косово',
  sl: 'Kosovo',
  hr: 'Kosovo',
  sv: 'Kosovo',
  nb: 'Kosovo',
  nl: 'Kosovo',
  ja: 'コソボ',
  ko: '코소보',
  pl: 'Kosowo',
  bg: 'Косово',
};

/** Recognising the name again, however the translator spelled it. */
const KOSOVO_SHAPE = /kosov|косов|كوسوف|コソボ|코소보/i;

function repair(text, lang) {
  let out = text;
  const hadWrong = WRONG.some((re) => re.test(out));
  for (const re of WRONG) out = out.replace(re, '');
  out = out.replace(/\s{2,}/g, ' ').replace(/\s+([.,!?;:،。])/g, '$1').trim();

  if (!hadWrong) return { text: out, changed: false };

  // Only re-add the name when the string was actually about Kosovo and the
  // repair left it without one — otherwise a clean sentence that merely
  // contained the stray word would gain a name it never had.
  const name = KOSOVO[lang];
  if (name && !KOSOVO_SHAPE.test(out)) {
    out = `${name} ${out}`.trim();
  }
  return { text: out, changed: true };
}

function main() {
  const cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  let fixed = 0;
  const byLang = {};

  for (const [lang, entries] of Object.entries(cache)) {
    if (!entries || typeof entries !== 'object') continue;
    for (const [src, value] of Object.entries(entries)) {
      if (typeof value !== 'string' || !value) continue;
      if (!WRONG.some((re) => re.test(value))) continue;

      const { text, changed } = repair(value, lang);
      if (!changed) continue;

      byLang[lang] = (byLang[lang] || 0) + 1;
      fixed += 1;
      if (DRY) {
        console.log(`${lang} | ${src.slice(0, 48)}`);
        console.log(`     was: ${value.slice(0, 90)}`);
        console.log(`     now: ${text.slice(0, 90)}`);
      } else {
        entries[src] = text;
      }
    }
  }

  if (!DRY) fs.writeFileSync(CACHE_FILE, JSON.stringify(cache), 'utf8');

  console.log(`\n${DRY ? '[dry run] ' : ''}Repaired ${fixed} entries.`);
  for (const [lang, n] of Object.entries(byLang).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${lang.padEnd(4)} ${n}`);
  }
  if (!DRY && fixed > 0) console.log('\nRun `node rebuild_overlay.js` to publish the fix.');
}

main();
