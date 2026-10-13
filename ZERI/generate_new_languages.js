/**
 * Generate translations for the languages added on top of the original six
 * (sq, en, bs, sr, tr, de).
 *
 * The original six live in dynamicTranslations.ts and uiTranslations.ts. Rather
 * than rewrite those 11k-line files, the new languages are collected into a
 * single overlay module (newLanguageTranslations.ts) that dt() consults first.
 * Keeping them separate also means a bad machine translation can be fixed by
 * editing one entry instead of untangling the big tables.
 *
 * Source of truth for every string is the Albanian original, taken from the
 * existing tables. Translation goes through the MyMemory API, with an on-disk
 * cache so a re-run resumes instead of re-fetching everything.
 *
 * Usage:  node generate_new_languages.js [--lang=nl,sv] [--limit=N]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dynamicTranslations } from './src/lib/dynamicTranslations.js';
import { translateWithFallback, providerStatus } from './translate_engine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/*
 * The added languages, minus the three that were removed (es, ro, hy) and plus
 * the three that replaced them (ja, ko, pl) together with bg.
 *
 * `ca` and `au` are deliberately absent: they are regions, not translations.
 * Their strings resolve through the English table at render time, so generating
 * duplicate copies here would be 20,000 dead rows nobody reads.
 */
const NEW_LANGS = ['ar', 'fr', 'it', 'pt', 'gsw', 'mk', 'sl', 'hr', 'sv', 'nb', 'nl', 'ja', 'ko', 'pl', 'bg'];

// API language codes live in translate_engine.js, which owns provider details.

const CACHE_FILE = path.join(__dirname, '_translation_cache.json');
const OUT_FILE = path.join(__dirname, 'src', 'lib', 'newLanguageTranslations.ts');

/**
 * When --cache is passed the shard writes to that file and does NOT regenerate
 * the TypeScript module: several shards writing one .ts file would interleave
 * and corrupt it. The module is rebuilt once, at the end, by import_translations.js.
 */
const cacheFileArg = process.argv.find((a) => a.startsWith('--cache='));
const CACHE_PATH = cacheFileArg
  ? path.resolve(cacheFileArg.split('=')[1])
  : CACHE_FILE;
const IS_SHARD = Boolean(cacheFileArg);

function loadCache() {
  try {
    return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
  } catch {
    return {};
  }
}
function saveCache(cache) {
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache), 'utf8');
}

/** Every Albanian source string from both existing tables plus the pages. */
function collectStrings() {
  const uiSrc = fs.readFileSync(path.join(__dirname, 'src', 'lib', 'uiTranslations.ts'), 'utf8');
  const uiKeys = new Set();
  const keyRe = /^\s{2}'((?:[^'\\]|\\.)*)':\s*\{/gm;
  let m;
  while ((m = keyRe.exec(uiSrc)) !== null) uiKeys.add(m[1].replace(/\\'/g, "'"));

  const strings = new Set(Object.keys(dynamicTranslations));
  for (const k of uiKeys) strings.add(k);

  // Page, service-catalogue and news strings extracted by extract_page_strings.js.
  // Without these the chrome translates but the service list stays Albanian.
  try {
    const pageStrings = JSON.parse(fs.readFileSync(path.join(__dirname, '_page_strings.json'), 'utf8'));
    for (const s of pageStrings) strings.add(s);
  } catch {
    console.warn('  (no _page_strings.json — run extract_page_strings.js first for full coverage)');
  }

  return Array.from(strings);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Terms the translator must not touch.
 *
 * Machine translation turns "KOSOVA BASHKË" into "KAZACHSTAN SAMEN" in Dutch —
 * it decided Kosovo meant Kazakhstan. Place names and brand names are not
 * translatable content, so each is replaced with an opaque marker before the
 * request and substituted back afterwards. This is the difference between
 * "translated" and "correct".
 */
const PROTECTED = [
  'Kosovë', 'Kosova', 'KOSOVA', 'Kosovo', 'KOSOVO',
  'Prishtinë', 'Prishtina', 'Prizren', 'Pejë', 'Peja', 'Gjakovë', 'Gjakova',
  'Mitrovicë', 'Mitrovica', 'Ferizaj', 'Gjilan', 'Gjilani', 'Vushtrri',
  'Podujevë', 'Rahovec', 'Suharekë', 'Malishevë', 'Kamenicë', 'Viti',
  'Deçan', 'Istog', 'Klinë', 'Skenderaj', 'Dragash', 'Kaçanik',
  'Han i Elezit', 'Junik', 'Mamushë', 'Ranillug', 'Partesh', 'Kllokot',
  'ZERI', 'Zëri', 'Zëri i Qytetarëve', 'ZQ', 'Firebase', 'Google', 'GDPR',
  'AIP', 'SLA', 'AI', 'SSL', 'DDoS', 'CSV', 'QR', 'SMS', 'Email',
];

// Longest first, so "Kosova" is shielded before "Kosovo" can split it.
const PROTECTED_SORTED = [...PROTECTED].sort((a, b) => b.length - a.length);

/**
 * Track which protected terms appeared in a source string.
 *
 * The marker/substitute trick is unreliable: every opaque marker tried so far
 * (control chars, "Qzx0Zq", "Kz0X") came back rewritten by the engine as
 * something like "K0x" or stripped entirely. So we no longer try to hide the
 * terms from the translator. We let it translate naturally, then repair the
 * damage afterwards using the knowledge of what the source contained.
 */
function shield(text) {
  const bag = PROTECTED_SORTED.filter((term) => text.includes(term));
  return { out: text, bag };
}

/**
 * Repair mangled protected terms in a finished translation.
 *
 * For each term the source contained, look for evidence that the translation
 * kept it. If the term is absent we remove any wrong placeholder the engine
 * substituted ("KAZACHSTAN" for Kosovo) and put the correct name back, so a
 * citizen never sees the name of another country on a civic platform.
 */
const LOCALIZED = {
  Kosovë: 'Kosova', Kosova: 'Kosova', KOSOVA: 'Kosova', Kosovo: 'Kosovo', KOSOVO: 'KOSOVO',
};

/**
 * Wrong substitutions the engine actually produced, mapped to the term they
 * replaced. The transliterations differ by language (KAZACHSTAN in Dutch,
 * Kasachstan in German, Kazajistán in Spanish), so the pattern covers the
 * common stems rather than one exact spelling. Extend this list whenever
 * check_translations.js reports a new one.
 */
const WRONG_SUBSTITUTIONS = {
  // kaza(c|k|j|z)(h|i|y)...  matches KAZACHSTAN, Kasachstan, Kazajistán, Kazakistan
  Kosova: [/\bkaza[cjksz][a-z]*stan\b/gi, /\bkaza[cjksz]h?st[ae]n\b/gi, /\bkazajist[áa]n\b/gi, /\bqazaqstan\b/gi],
};

function unshield(text, bag) {
  let out = text;

  // 1. Strip residual marker fragments so they cannot leak into the UI.
  out = out.replace(/\bK[0-9]+x?\b/gi, '').replace(/\bMARK\d*\b/gi, '');

  // 2. For every protected term the source carried, make sure the output has
  //    the right name and not a wrong one.
  for (const term of bag) {
    const canonical = LOCALIZED[term] || term;
    const head = canonical.slice(0, 4).toLowerCase();

    // Drop known wrong substitutions for this term.
    for (const bad of WRONG_SUBSTITUTIONS[canonical] || []) {
      out = out.replace(bad, '');
    }

    // Put the term back if it is missing after the cleanup above.
    if (!out.toLowerCase().includes(head)) {
      out = `${canonical} ${out.trim()}`;
    }
  }

  return out.replace(/\s{2,}/g, ' ').replace(/\s+([.,!?])/g, '$1').trim();
}

async function translateOne(text, lang) {
  const { bag } = shield(text);
  let result;
  try {
    result = await translateWithFallback(text, lang);
  } catch {
    return { ok: false };
  }
  if (!result) return { ok: false };
  return { ok: true, text: unshield(result.text, bag) };
}

async function main() {
  const args = process.argv.slice(2);
  const langArg = args.find((a) => a.startsWith('--lang='));
  const limitArg = args.find((a) => a.startsWith('--limit='));
  const passesArg = args.find((a) => a.startsWith('--passes='));
  const langs = langArg ? langArg.split('=')[1].split(',') : NEW_LANGS;
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : Infinity;
  const maxPasses = passesArg ? parseInt(passesArg.split('=')[1], 10) : 6;

  const strings = collectStrings();
  console.log(`Source strings: ${strings.length} | Languages: ${langs.join(', ')}`);

  const cache = loadCache();

  /**
   * Work in passes. A pass only attempts strings still missing, so when a
   * provider hits its quota mid-run the work already done is kept and the next
   * pass picks up the remainder with whatever provider has recovered.
   */
  for (let pass = 1; pass <= maxPasses; pass++) {
    let missingBefore = 0;
    let filled = 0;

    for (const lang of langs) {
      cache[lang] = cache[lang] || {};
      let processed = 0;

      for (const src of strings) {
        if (cache[lang][src]) continue;
        if (processed >= limit) { missingBefore++; continue; }

        const res = await translateOne(src, lang);
        if (res.ok) { cache[lang][src] = res.text; filled++; }
        else { missingBefore++; }

        processed++;
        if (processed % 30 === 0) {
          saveCache(cache);
          console.log(`  pass ${pass} [${lang}] +${processed} (have ${Object.keys(cache[lang]).length}/${strings.length}) ${JSON.stringify(providerStatus())}`);
        }
        await sleep(60);
      }

      saveCache(cache);
      console.log(`pass ${pass} [${lang}] complete: ${Object.keys(cache[lang]).length}/${strings.length}`);
    }

    saveCache(cache);
    if (filled === 0) {
      console.log(`Pass ${pass}: nothing new filled; stopping.`);
      break;
    }
  }

  saveCache(cache);
  if (IS_SHARD) {
    // The shared module is rebuilt once from all shard caches; writing it here
    // would let 14 processes overwrite each other with partial data.
    console.log(`Shard [${langs.join(',')}] done. Rebuild the module with: node merge_shards.js`);
  } else {
    writeOutput(cache, strings);
    console.log('Done.');
  }
}

function writeOutput(cache, strings) {
  const out = {};
  for (const src of strings) {
    const entry = {};
    for (const lang of NEW_LANGS) {
      const v = cache[lang] && cache[lang][src];
      if (v) entry[lang] = v;
    }
    if (Object.keys(entry).length > 0) out[src] = entry;
  }

  const header = `/**
 * Translations for the languages added on top of the original six.
 *
 * Generated by generate_new_languages.js from the Albanian source strings in
 * dynamicTranslations.ts and uiTranslations.ts. dt() consults this map before
 * the original tables, so an entry here wins for its language and any string
 * that is absent falls through to the Albanian original.
 *
 * Languages: ar, fr, it, es, pt, gsw, mk, sl, hr, ro, sv, nb, hy, nl
 */
`;
  const body =
    'export const newLanguageTranslations: Record<string, Record<string, string>> = ' +
    JSON.stringify(out, null, 2) + ';\n';

  fs.writeFileSync(OUT_FILE, header + body, 'utf8');
  console.log(`Wrote ${OUT_FILE} with ${Object.keys(out).length} entries.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
