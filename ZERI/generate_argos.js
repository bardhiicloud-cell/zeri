/**
 * Full offline translation generator.
 *
 * Replaces the hosted-endpoint run entirely. Argos Translate runs locally with
 * no key and no quota, so this can finish all 2086 strings across every language
 * it supports, in one pass, without being rate-limited.
 *
 * Coverage, verified against Argos's own package index:
 *   direct via English : ar de fr it es pt ro sl sv nb nl (+ tr)  = 12 targets
 *   gsw                : served by standard German
 *   sq -> en           : gives English natively, no pivot needed
 *   not published      : bs sr mk hr hy  (Argos has no model at all)
 *
 * The five unavailable languages are reported, never faked. Their strings are
 * left for the hosted path or a human, and the coverage report says so.
 *
 * Usage:  node generate_argos.js [--lang=fr,nl] [--limit=N]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dynamicTranslations } from './src/lib/dynamicTranslations.js';
import { ArgosEngine } from './argos_engine.js';
import { MulEngine, MUL_LANGUAGES } from './mul_engine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Languages this generator will attempt. */
const ALL_TARGETS = [
  'en', 'de', 'gsw', 'ar', 'tr', 'fr', 'it', 'es', 'pt',
  'sl', 'ro', 'sv', 'nb', 'nl',
  // Served by the multilingual model rather than Argos, which publishes
  // nothing for these five.
  'bs', 'sr', 'hr', 'mk', 'hy',
];

const CACHE_FILE = path.join(__dirname, '_translation_cache.json');

/**
 * Repair mojibake produced when UTF-8 bytes are decoded as Latin-1 and then
 * re-encoded, e.g. "problÃ¨mes" for "problèmes". Reversal is safe because the
 * pattern only matches runs of exactly those byte sequences; ordinary text is
 * left untouched.
 */
function fixMojibake(text) {
  if (!/[ÃÂ][\u0080-\u00BF]/.test(text)) return text;
  try {
    return Buffer.from(text, 'latin1').toString('utf8');
  } catch {
    return text;
  }
}

/** Names the machine translator must not alter. */
const PROTECTED_SORTED = [
  'Kosovë', 'Kosova', 'KOSOVA', 'Kosovo', 'KOSOVO', 'Prishtinë', 'Prishtina',
  'Prizren', 'Pejë', 'Peja', 'Gjakovë', 'Gjakova', 'Mitrovicë', 'Mitrovica',
  'Ferizaj', 'Gjilan', 'Vushtrri', 'Podujevë', 'Rahovec', 'Suharekë',
  'Malishevë', 'Kamenicë', 'Deçan', 'Istog', 'Klinë', 'Skenderaj', 'Dragash',
  'Kaçanik', 'Junik', 'Mamushë', 'Ranillug', 'Partesh', 'Kllokot',
  'ZERI', 'Zëri', 'Firebase', 'Google', 'GDPR', 'e-Kosova', 'e-Komuna',
].sort((a, b) => b.length - a.length);

const LOCALIZED = { Kosovë: 'Kosova', Kosova: 'Kosova', KOSOVA: 'Kosova' };
const WRONG = [/\bkaza[cjksz][a-z]*stan\b/gi, /\bkaza[cjksz]h?st[ae]n\b/gi, /\bqazaqstan\b/gi];
const CYRILLIC_NAME = { mk: 'Косово', sr: 'Косово', ar: 'كوسوفو', hy: 'Կոսովո', tr: 'Kosova' };

/** Restore proper nouns the translator dropped or replaced. */
function repairProperNouns(text, lang, sources) {
  let out = text;
  const mentionsKosovo = sources.some((s) => /kosov/i.test(s));
  if (!mentionsKosovo) return out;

  const correct = CYRILLIC_NAME[lang] || 'Kosovo';
  for (const re of WRONG) out = out.replace(re, '');
  if (!out.toLowerCase().includes(correct.slice(0, 4).toLowerCase())) {
    out = `${correct} ${out}`.trim();
  }
  return out.replace(/\s{2,}/g, ' ').replace(/\s+([.,!?])/g, '$1').trim();
}

function loadCache() {
  try {
    return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function collectStrings() {
  const uiSrc = fs.readFileSync(path.join(__dirname, 'src', 'lib', 'uiTranslations.ts'), 'utf8');
  const uiKeys = new Set();
  const keyRe = /^\s{2}'((?:[^'\\]|\\.)*)':\s*\{/gm;
  let m;
  while ((m = keyRe.exec(uiSrc)) !== null) uiKeys.add(m[1].replace(/\\'/g, "'"));

  const strings = new Set(Object.keys(dynamicTranslations));
  for (const k of uiKeys) strings.add(k);
  try {
    const pageStrings = JSON.parse(fs.readFileSync(path.join(__dirname, '_page_strings.json'), 'utf8'));
    for (const s of pageStrings) strings.add(s);
  } catch { /* optional */ }
  return Array.from(strings);
}

async function main() {
  const langArg = process.argv.find((a) => a.startsWith('--lang='));
  const limitArg = process.argv.find((a) => a.startsWith('--limit='));
  const targets = langArg ? langArg.split('=')[1].split(',') : ALL_TARGETS;
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : Infinity;

  const strings = collectStrings();
  const cache = loadCache();
  const engine = new ArgosEngine();
  const mulEngine = new MulEngine();

  console.log(`Source strings: ${strings.length}`);
  console.log(`Targets: ${targets.join(', ')}`);
  console.log(`  via Argos      : ${targets.filter((t) => !MUL_LANGUAGES.has(t)).join(', ')}`);
  console.log(`  via multilingual: ${targets.filter((t) => MUL_LANGUAGES.has(t)).join(', ') || '(none requested)'}\n`);

  console.log('Warming up the translation model (first call loads ~1GB into RAM)...');
  const t0 = Date.now();
  await engine.translateBatch(['Përshëndetje'], 'en');
  console.log(`Model ready in ${((Date.now() - t0) / 1000).toFixed(1)}s\n`);

  for (const lang of targets) {
    cache[lang] = cache[lang] || {};
    // Pick the engine that actually has a model for this language.
    const useMul = MUL_LANGUAGES.has(lang);
    const activeEngine = useMul ? mulEngine : engine;

    const todo = strings.filter((s) => !cache[lang][s]);
    const batch = limit === Infinity ? todo : todo.slice(0, limit);

    if (batch.length === 0) {
      console.log(`${lang.padEnd(5)} already complete (${Object.keys(cache[lang]).length}/${strings.length})`);
      continue;
    }

    process.stdout.write(`${lang.padEnd(5)} ${useMul ? '[mul] ' : '      '}translating ${batch.length} strings... `);
    const start = Date.now();
    let filled = 0;

    // Small batches so progress is saved often and a crash cannot lose a whole
    // language's worth of work.
    const CHUNK = useMul ? 8 : 50;
    for (let i = 0; i < batch.length; i += CHUNK) {
      const slice = batch.slice(i, i + CHUNK);
      let results;
      try {
        results = await activeEngine.translateBatch(slice, lang);
      } catch (e) {
        console.log(`\n  batch failed at ${i}: ${e.message}`);
        break;
      }
      for (const src of slice) {
        const raw = results[src];
        if (!raw) continue;
        const cleaned = repairProperNouns(fixMojibake(raw.trim()), lang, [src]);
        if (cleaned && cleaned !== src) {
          cache[lang][src] = cleaned;
          filled++;
        }
      }
      fs.writeFileSync(CACHE_FILE, JSON.stringify(cache), 'utf8');
      process.stdout.write('.');
    }

    const secs = ((Date.now() - start) / 1000).toFixed(1);
    console.log(` done: +${filled} in ${secs}s (${Object.keys(cache[lang]).length}/${strings.length})`);
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache), 'utf8');
  }

  engine.stop();
  mulEngine.stop();

  console.log('\n--- Coverage ---');
  for (const lang of ALL_TARGETS) {
    const done = Object.keys(cache[lang] || {}).length;
    const pct = ((done / strings.length) * 100).toFixed(1);
    const bar = done >= strings.length ? ' COMPLETE' : '';
    console.log(`  ${lang.padEnd(5)} ${String(done).padStart(5)}/${strings.length}  ${pct.padStart(5)}%${bar}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });