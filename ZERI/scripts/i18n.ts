/**
 * The one translation tool. Translations live in src/lib/i18n/locales/<lang>.json
 * ({ "<Albanian source text>": "<translation>" }), loaded per language by dt().
 *
 *   npm run i18n:check             CI gate: fails on anything new that is missing or broken
 *   npm run i18n:check -- --update-baseline   accept the current state (the baseline may only shrink)
 *   npm run i18n:missing           write translations/to-translate.json: every dt() text a language lacks
 *   npm run i18n:import [file]     merge a filled to-translate.json back into the locale files
 *
 * Whatever fills to-translate.json (a translator, an AI, a script) hands it to i18n:import.
 * Empty values are skipped, so a half-filled file is safe to import.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const localesDir = path.join(root, 'src/lib/i18n/locales');
const baselineFile = path.join(root, 'scripts/i18n-baseline.json');
const pendingFile = path.join(root, 'translations/to-translate.json');

/** Every dt() text must be translated into these (Albanian is the source). The other languages are filled over time. */
const CORE_LANGUAGES = ['en', 'de', 'sr', 'bs', 'tr'];

type Table = Record<string, string>;
type Baseline = { missing: string[]; problems: string[] };

const localeFiles = () => fs.readdirSync(localesDir).filter((f) => f.endsWith('.json')).sort();
const readLocales = () =>
  Object.fromEntries(localeFiles().map((f) => [f.replace('.json', ''), JSON.parse(fs.readFileSync(path.join(localesDir, f), 'utf8')) as Table]));
const writeLocale = (lang: string, table: Table) => {
  const sorted = Object.fromEntries(Object.entries(table).sort(([a], [b]) => (a < b ? -1 : 1)));
  fs.writeFileSync(path.join(localesDir, `${lang}.json`), JSON.stringify(sorted));
};

/** Static dt('…') texts in src. Template literals with ${} are dynamic and skipped. */
function sourceLiterals(): Set<string> {
  const found = new Set<string>();
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name)) {
        const src = fs.readFileSync(full, 'utf8');
        for (const m of src.matchAll(/\bdt\(\s*(['"`])((?:(?!\1)[^\\]|\\.)*)\1\s*[,)]/g)) {
          if (m[1] === '`' && m[2].includes('${')) continue;
          found.add(m[2].replace(/\\n/g, '\n').replace(/\\(['"`\\])/g, '$1'));
        }
      }
    }
  };
  walk(path.join(root, 'src'));
  return found;
}

/** Substituted values and identifiers no translator may rewrite. */
const TOKEN_RE = /\{[^}]+\}|%[sd]|\bZQ-\d+\b|\(\d+s\)/g;
const SCRIPTS: Record<string, RegExp> = {
  ar: /[؀-ۿ]/,
  ja: /[぀-ヿ一-鿿]/,
  ko: /[가-힯]/,
  mk: /[Ѐ-ӿ]/,
  bg: /[Ѐ-ӿ]/,
};
const tokens = (text: string) => (text.match(TOKEN_RE) ?? []).sort().join('|');

function problemsIn(locales: Record<string, Table>): string[] {
  const out: string[] = [];
  for (const [lang, table] of Object.entries(locales)) {
    for (const [key, value] of Object.entries(table)) {
      if (tokens(key) !== tokens(value)) out.push(`${lang}|tokens|${key}`);
      const script = SCRIPTS[lang];
      if (script && /\p{L}/u.test(value) && !script.test(value) && value !== key) out.push(`${lang}|script|${key}`);
    }
  }
  return out;
}

function check() {
  const locales = readLocales();
  const known = new Set(Object.values(locales).flatMap((table) => Object.keys(table)));
  const missing = [...sourceLiterals()].filter((text) => CORE_LANGUAGES.some((lang) => !locales[lang]?.[text])).sort();
  const problems = problemsIn(locales).sort();

  if (process.argv.includes('--update-baseline')) {
    fs.writeFileSync(baselineFile, JSON.stringify({ missing, problems } satisfies Baseline, null, 1) + '\n');
    console.log(`Baseline written: ${missing.length} missing texts, ${problems.length} problems.`);
    return;
  }

  const baseline: Baseline = JSON.parse(fs.readFileSync(baselineFile, 'utf8'));
  const oldMissing = new Set(baseline.missing);
  const oldProblems = new Set(baseline.problems);
  const newMissing = missing.filter((text) => !oldMissing.has(text));
  const newProblems = problems.filter((p) => !oldProblems.has(p));
  const fixed = baseline.missing.length - missing.length + (baseline.problems.length - problems.length);

  console.log('Coverage of known texts per language:');
  for (const [lang, table] of Object.entries(locales)) {
    console.log(`  ${lang.padEnd(4)} ${((Object.keys(table).length / known.size) * 100).toFixed(1)}%`);
  }
  console.log(`Missing from a core language (${CORE_LANGUAGES.join(', ')}): ${missing.length} (baseline ${baseline.missing.length}). Problems: ${problems.length} (baseline ${baseline.problems.length}).`);
  if (fixed > 0) console.log(`${fixed} baseline entries are fixed: run  npm run i18n:check -- --update-baseline  to lock that in.`);

  if (newMissing.length || newProblems.length) {
    for (const text of newMissing.slice(0, 20)) console.error(`NEW text without a core-language translation: ${JSON.stringify(text)}`);
    for (const p of newProblems.slice(0, 20)) console.error(`NEW problem: ${p}`);
    console.error(`\n${newMissing.length} new missing texts, ${newProblems.length} new problems. Add translations (npm run i18n:missing, then i18n:import).`);
    process.exit(1);
  }
}

function missingCommand() {
  const locales = readLocales();
  const pending: Record<string, Record<string, string>> = {};
  const known = new Set(Object.values(locales).flatMap((table) => Object.keys(table)));
  for (const text of new Set([...known, ...sourceLiterals()])) {
    for (const [lang, table] of Object.entries(locales)) {
      if (!table[text]) (pending[text] ??= {})[lang] = '';
    }
  }
  fs.mkdirSync(path.dirname(pendingFile), { recursive: true });
  fs.writeFileSync(pendingFile, JSON.stringify(pending, null, 1) + '\n');
  console.log(`${Object.keys(pending).length} texts still need at least one language -> ${path.relative(root, pendingFile)}`);
}

function importCommand() {
  const file = process.argv[3] && !process.argv[3].startsWith('--') ? path.resolve(process.argv[3]) : pendingFile;
  const filled: Record<string, Record<string, string>> = JSON.parse(fs.readFileSync(file, 'utf8'));
  const locales = readLocales();
  let added = 0;
  let rejected = 0;
  for (const [text, byLang] of Object.entries(filled)) {
    for (const [lang, value] of Object.entries(byLang)) {
      if (!value || !locales[lang]) continue;
      if (tokens(text) !== tokens(value)) {
        console.error(`Rejected (placeholders differ) ${lang}: ${JSON.stringify(text)}`);
        rejected++;
        continue;
      }
      locales[lang][text] = value;
      added++;
    }
  }
  for (const [lang, table] of Object.entries(locales)) writeLocale(lang, table);
  console.log(`Imported ${added} translations, rejected ${rejected}.`);
}

const command = process.argv[2];
if (command === 'check') check();
else if (command === 'missing') missingCommand();
else if (command === 'import') importCommand();
else {
  console.error('Usage: tsx scripts/i18n.ts check [--update-baseline] | missing | import [file]');
  process.exit(1);
}
