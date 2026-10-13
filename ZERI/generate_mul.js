/**
 * Translate the four languages Argos cannot serve, using the multilingual model.
 *
 * These four (bs, sr, hr, mk) are the largest remaining gap and the model
 * that handles them is much slower per string than Argos — roughly 8x — so this
 * runs as its own long-lived process with frequent checkpoints rather than
 * sharing the Argos run. Either can be interrupted and resumed without losing
 * the other's work, because they write to different cache files and are merged
 * at the end.
 *
 * Usage:  node generate_mul.js [--lang=hr] [--limit=N]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dynamicTranslations } from './src/lib/dynamicTranslations.js';
import { MulEngine, MUL_LANGUAGES } from './mul_engine.js';
import { ArgosEngine } from './argos_engine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_FILE = path.join(__dirname, '_mul_cache.json');

const fixMojibake = (t) => {
  if (!/[ÃÂ][\u0080-\u00BF]/.test(t)) return t;
  try { return Buffer.from(t, 'latin1').toString('utf8'); } catch { return t; }
};

const WRONG = [/\bkaza[cjksz][a-z]*stan\b/gi, /\bkaza[cjksz]h?st[ae]n\b/gi, /\bqazaqstan\b/gi];
const CYRILLIC_NAME = { mk: 'Косово', sr: 'Косово', hr: 'Kosovo', bs: 'Kosovo' };

/**
 * Is the source shouting? ALL-CAPS Albanian is a label, not a sentence.
 *
 * The multilingual model mangles uppercase input badly — "VENDI I REKLAMËS SUAJ"
 * came back as "V SUYA REKLACE". So an all-caps source is lowercased before
 * translation and the result is re-uppercased afterwards, which preserves the
 * label styling without feeding the model a form it cannot handle.
 */
function isAllCaps(text) {
  const letters = text.replace(/[^A-Za-zÀ-ÿ]/g, '');
  return letters.length > 2 && letters === letters.toUpperCase();
}

/** Restore proper nouns the translator dropped or replaced. */
function repairProperNouns(text, lang, src) {
  let out = text;

  // Strip the mangled remnants of any proper noun the model tried to translate.
  for (const re of WRONG) out = out.replace(re, '');
  // "KOMS SOVA BASKA" is what the model produced for "KOSOVA BASHKË"; remove it
  // so the correct name below is not sitting next to garbage.
  out = out.replace(/\bKOMS\b/gi, '').replace(/\bSOVA\b/gi, '').replace(/\bBASKA\b/gi, '');

  if (/kosov/i.test(src)) {
    const correct = CYRILLIC_NAME[lang] || 'Kosovo';
    if (!out.toLowerCase().includes(correct.slice(0, 4).toLowerCase())) {
      out = `${correct} ${out}`.trim();
    }
  }

  return out.replace(/\s{2,}/g, ' ').replace(/\s+([.,!?])/g, '$1').trim();
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

const load = () => { try { return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')); } catch { return {}; } };
const save = (c) => fs.writeFileSync(CACHE_FILE, JSON.stringify(c), 'utf8');

async function main() {
  const langArg = process.argv.find((a) => a.startsWith('--lang='));
  const limitArg = process.argv.find((a) => a.startsWith('--limit='));
  const targets = langArg ? langArg.split('=')[1].split(',') : [...MUL_LANGUAGES];
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : Infinity;

  const strings = collectStrings();
  const cache = load();
  const engine = new MulEngine();

  /**
   * Albanian -> English, needed before the multilingual model.
   *
   * opus-mt-en-mul is English-source only. Sending it Albanian produced output
   * that merely echoed the input ("ndiqni zgjidhjet" -> "dhendiqni zgjidhjet"),
   * which would have shipped Albanian text into a Croatian page while looking
   * successful. The Albanian is therefore put through Argos sq->en first, and
   * only the English is handed to the multilingual model.
   */
  const argos = new ArgosEngine();

  console.log(`Multilingual translation — ${strings.length} source strings`);
  console.log(`Languages: ${targets.join(', ')}\n`);
  console.log('Loading models (Argos sq->en, then opus-mt-en-mul)...');

  const t0 = Date.now();
  await argos.translateBatch(['Përshëndetje'], 'en');
  await engine.translateBatch(['Hello'], targets[0]);
  console.log(`Models ready in ${((Date.now() - t0) / 1000).toFixed(1)}s\n`);

  for (const lang of targets) {
    cache[lang] = cache[lang] || {};
    const todo = strings.filter((s) => !cache[lang][s]);
    const batch = limit === Infinity ? todo : todo.slice(0, limit);

    if (batch.length === 0) {
      console.log(`${lang.padEnd(4)} already complete`);
      continue;
    }

    process.stdout.write(`${lang.padEnd(4)} ${batch.length} strings `);
    const start = Date.now();
    let filled = 0;

    // 6 per batch: this model is memory-hungry and a larger batch risks being
    // killed mid-language on a constrained machine.
    const CHUNK = 6;
    for (let i = 0; i < batch.length; i += CHUNK) {
      const slice = batch.slice(i, i + CHUNK);
      let results;
      try {
        // Step 1: Albanian -> English. Step 2: English -> target.
        // All-caps sources are lowercased for step 2 and restored afterwards;
        // the model mangles uppercase input.
        const english = await argos.translateBatch(slice, 'en');
        const englishTexts = slice.map((s) => {
          const en = english[s] || s;
          return isAllCaps(s) ? en.toLowerCase() : en;
        });
        const translated = await engine.translateBatch(englishTexts, lang);

        // Map the results back onto the Albanian sources the caller asked about.
        results = {};
        slice.forEach((src, idx) => {
          const out = translated[englishTexts[idx]] ?? null;
          results[src] = out && isAllCaps(src) ? out.toUpperCase() : out;
        });
      } catch (e) {
        console.log(`\n  error at ${i}: ${e.message}`);
        break;
      }
      for (const src of slice) {
        const raw = results[src];
        if (!raw) continue;
        const cleaned = repairProperNouns(fixMojibake(raw.trim()), lang, src);
        if (cleaned && cleaned !== src) { cache[lang][src] = cleaned; filled++; }
      }
      if (i % 60 === 0) { save(cache); process.stdout.write('.'); }
    }

    save(cache);
    const secs = ((Date.now() - start) / 1000).toFixed(0);
    console.log(` done: +${filled} in ${secs}s (${Object.keys(cache[lang]).length}/${strings.length})`);
  }

  engine.stop();
  argos.stop();

  console.log('\n--- Multilingual coverage ---');
  for (const lang of [...MUL_LANGUAGES]) {
    const done = Object.keys(cache[lang] || {}).length;
    console.log(`  ${lang.padEnd(4)} ${String(done).padStart(5)}/${strings.length}  ${((done / strings.length) * 100).toFixed(1)}%`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
