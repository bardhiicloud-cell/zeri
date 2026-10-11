
/**
 * Quality gate for machine translations.
 *
 * "100% correct" cannot be delegated to a machine API blindly — the first test
 * run already produced "KOSOVA BASHKË" -> "KAZACHSTAN SAMEN" (Kosovo became
 * Kazakhstan) in Dutch. This script flags the classes of error that actually
 * occur, so they can be fixed rather than shipped:
 *
 *   1. Proper nouns mangled or dropped (Kosovo, Albanian names, institutions).
 *   2. Placeholders / format tokens destroyed  ({name}, %s, (10s), ZQ-4587).
 *   3. Strings that came back identical to Albanian (i.e. not translated).
 *   4. Language-script mismatches (Arabic must contain Arabic script, Armenian
 *      Armenian script, Macedonian/Slovenian Cyrillic where expected, etc).
 *   5. Punctuation drift: a trailing period invented or dropped.
 *   6. Empty or suspiciously short output for a long input.
 *
 * Usage:  node check_translations.js
 * Exit code 1 when anything fails, so it can gate a build.
 */
import fs from 'fs';

const CACHE_FILE = '_translation_cache.json';
const LANGS = ['ar', 'fr', 'it', 'es', 'pt', 'gsw', 'mk', 'sl', 'hr', 'ro', 'sv', 'nb', 'hy', 'nl'];

// Names and terms that must survive translation verbatim.
const PROPER_NOUNS = [
  'Kosov', 'Kosova', 'Kosovë', 'Prishtin', 'Prizren', 'Peja', 'Gjakov',
  'Mitrovic', 'Ferizaj', 'Gjilan', 'ZERI', 'Zëri', 'ZQ-', 'AIP', 'GDPR',
  'Firebase', 'Google', 'Zeri',
];

/**
 * Anything the app substitutes or that must stay literal. Deliberately narrow:
 * an earlier version matched every uppercase word, which flagged the correct
 * Dutch rendering of "VENDI I REKLAMËS SUAJ" as a lost token. Only identifiers
 * that no translator would legitimately rewrite are listed here.
 */
const TOKEN_RE = /\{[^}]+\}|%[sd]|\bZQ-\d+\b|\(\d+s\)|\b\d[\d.,]*\s*€/g;

const SCRIPTS = {
  ar: /[\u0600-\u06FF]/,
  hy: /[\u0530-\u058F]/,
  mk: /[\u0400-\u04FF]/,
  // Serbian/Macedonian Cyrillic; Slovenian/Croatian/Romanian are Latin.
};

const problems = [];
const stats = { total: 0, checked: 0, byLang: {}, byKind: {} };

function record(lang, kind, src, out, detail) {
  stats.byKind[kind] = (stats.byKind[kind] || 0) + 1;
  problems.push({ lang, kind, src, out, detail });
}

function check(lang, src, out) {
  stats.checked++;

  // 3. not translated at all
  if (out === src) {
    record(lang, 'untranslated', src, out, 'output identical to Albanian source');
    return;
  }

  // 1. proper nouns
  for (const noun of PROPER_NOUNS) {
    if (src.includes(noun) && !out.includes(noun)) {
      // Allow the localized form (Kosovo/Kosova both fine) but not a different country.
      const localized = out.includes(noun.replace('ë', 'o')) || out.includes(noun.replace('ë', 'e'));
      if (!localized) {
        record(lang, 'proper-noun', src, out, `"${noun}" missing from output`);
      }
    }
  }

  // 2. tokens / numbers
  const srcTokens = (src.match(TOKEN_RE) || []).filter((t) => t.length > 1);
  for (const t of srcTokens) {
    if (!out.includes(t)) {
      record(lang, 'token-lost', src, out, `token "${t}" missing`);
    }
  }

  // 4. script
  const scriptRe = SCRIPTS[lang];
  if (scriptRe && src.length > 3) {
    const hasLatin = /[A-Za-z]/.test(out);
    if (!scriptRe.test(out) && hasLatin) {
      record(lang, 'wrong-script', src, out, `expected ${lang} script`);
    }
  }

  // 5. trailing punctuation drift (ignore strings that are pure labels/emojis)
  const srcEnds = /[.!?…]$/.test(src.trim());
  const outEnds = /[.!?…]$/.test(out.trim());
  if (src.length > 15 && srcEnds !== outEnds && /[A-Za-zÀ-ÿ]/.test(src)) {
    record(lang, 'punctuation', src, out, srcEnds ? 'period dropped' : 'period invented');
  }

  // 6. suspiciously short
  if (src.length > 40 && out.length < src.length * 0.25) {
    record(lang, 'too-short', src, out, `output ${out.length} chars for ${src.length}-char source`);
  }

  // 7. leftover Albanian diacritics in a language that has no reason to use them.
  //    Words that legitimately carry ë in the target language (Dutch "een" does
  //    not, but loanwords occasionally do) are rare enough to review by hand.
  if (!['hr', 'sl', 'bs', 'sq'].includes(lang) && /[ëË]/.test(out)) {
    record(lang, 'albanian-leftover', src, out, 'contains ë/Ë');
  }
}

function main() {
  const cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  for (const lang of LANGS) {
    stats.byLang[lang] = { entries: 0, problems: 0 };
    if (!cache[lang]) continue;
    for (const [src, out] of Object.entries(cache[lang])) {
      stats.total++;
      stats.byLang[lang].entries++;
      const before = problems.length;
      check(lang, src, out);
      if (problems.length > before) stats.byLang[lang].problems++;
    }
  }

  console.log('=== Translation quality report ===');
  console.log(`Strings checked: ${stats.checked}`);
  console.log('\nPer language:');
  for (const lang of LANGS) {
    const s = stats.byLang[lang] || { entries: 0, problems: 0 };
    const pct = s.entries ? ((s.problems / s.entries) * 100).toFixed(1) : '0.0';
    console.log(`  ${lang.padEnd(4)} ${String(s.entries).padStart(5)} entries, ${String(s.problems).padStart(4)} flagged (${pct}%)`);
  }

  console.log('\nProblem kinds:');
  for (const [k, n] of Object.entries(stats.byKind).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(20)} ${n}`);
  }

  fs.writeFileSync('_translation_problems.json', JSON.stringify(problems, null, 2), 'utf8');
  console.log('\nDetails written to _translation_problems.json');
  console.log(`\nTOTAL FLAGGED: ${problems.length}`);
  process.exit(problems.length > 0 ? 1 : 0);
}

main();
