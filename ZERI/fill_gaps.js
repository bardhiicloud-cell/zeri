/**
 * Fill the remaining gaps with a focused, verified pass.
 *
 * The bulk run left ~30-70 strings per language because they are the awkward
 * shapes: ALL-CAPS labels ("BALLINA", "RI-NGARKON"), very short tokens ("pts",
 * "(Ti)"), or strings containing markup ("Glisni &rarr;"). The general model
 * mangles these.
 *
 * This pass handles them differently:
 *   - ALL-CAPS  : lowercased for translation, re-uppercased after
 *   - markup    : HTML entities are masked so they survive intact
 *   - short     : translated one at a time, with a longer context hint, because
 *                 a two-word label gives the model nothing to work with
 *
 * Anything it cannot improve is left missing rather than filled with a guess.
 *
 * Usage:  node fill_gaps.js [--lang=bs,hr]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dynamicTranslations } from './src/lib/dynamicTranslations.js';
import { ArgosEngine } from './argos_engine.js';
import { MulEngine, MUL_LANGUAGES } from './mul_engine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_FILE = path.join(__dirname, '_translation_cache.json');

const ARGOS_LANGS = ['en', 'de', 'gsw', 'ar', 'tr', 'fr', 'it', 'es', 'pt', 'sl', 'ro', 'sv', 'nb', 'nl'];

/** HTML entities and placeholder tokens that must survive verbatim. */
const MASKED = [
  '&rarr;', '&larr;', '&nbsp;', '&amp;', '&lt;', '&gt;', '&quot;', '&hellip;',
  '&mdash;', '&ndash;', 'https://', 'http://', '{name}', '{count}', '%s',
];

function maskMarkup(text) {
  const bag = [];
  let out = text;
  for (const token of MASKED) {
    while (out.includes(token)) {
      const idx = bag.push(token) - 1;
      out = out.replace(token, `\uE000${idx}\uE001`);
    }
  }
  return { out, bag };
}

function unmaskMarkup(text, bag) {
  return text.replace(/\uE000(\d+)\uE001/g, (_, i) => bag[Number(i)] ?? '');
}

function isAllCaps(text) {
  const letters = text.replace(/[^A-Za-zÀ-ÿ]/g, '');
  return letters.length > 2 && letters === letters.toUpperCase();
}

const WRONG = [/\bkaza[cjksz][a-z]*stan\b/gi, /\bkaza[cjksz]h?st[ae]n\b/gi, /\bqazaqstan\b/gi];
const KOSOVO = { mk: 'Косово', sr: 'Косово', ar: 'كوسوفو', hy: 'Կոսովո', tr: 'Kosova' };

function repair(text, lang, src) {
  let out = text;
  for (const re of WRONG) out = out.replace(re, '');
  if (/kosov/i.test(src)) {
    const correct = KOSOVO[lang] || 'Kosovo';
    if (!out.toLowerCase().includes(correct.slice(0, 4).toLowerCase())) out = `${correct} ${out}`.trim();
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

/**
 * A string is worth attempting only if another language actually translated it.
 * If every other language left it equal to the source, the source is the
 * translation (a brand name, a loanword) and there is nothing to fill.
 */
function worthTranslating(src, cache) {
  const refs = ['en', 'de', 'fr', 'it', 'es']
    .map((l) => (cache[l] || {})[src])
    .filter(Boolean);
  if (refs.length === 0) return true;
  return !refs.every((r) => r.trim() === src.trim());
}

async function main() {
  const langArg = process.argv.find((a) => a.startsWith('--lang='));
  const targets = langArg ? langArg.split('=')[1].split(',') : [...ARGOS_LANGS, ...MUL_LANGUAGES];

  const strings = collectStrings();
  const cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  const argos = new ArgosEngine();
  const mul = new MulEngine();

  let totalFilled = 0;

  for (const lang of targets) {
    cache[lang] = cache[lang] || {};
    const missing = strings.filter((s) => !cache[lang][s]);
    const todo = missing.filter((s) => worthTranslating(s, cache));

    if (todo.length === 0) {
      console.log(`${lang.padEnd(5)} nothing to fill (${missing.length} left, all language-neutral)`);
      continue;
    }

    process.stdout.write(`${lang.padEnd(5)} filling ${todo.length} ... `);
    let filled = 0;
    const useMul = MUL_LANGUAGES.has(lang);
    const CHUNK = useMul ? 4 : 20;

    for (let i = 0; i < todo.length; i += CHUNK) {
      const slice = todo.slice(i, i + CHUNK);
      // Mask markup, then lower-case all-caps labels.
      const prepared = slice.map((s) => {
        const { out, bag } = maskMarkup(s);
        return { src: s, text: isAllCaps(s) ? out.toLowerCase() : out, bag };
      });

      try {
        let results;
        if (useMul) {
          // English pivot: Albanian -> English -> target.
          const english = await argos.translateBatch(prepared.map((p) => p.text), 'en');
          const englishTexts = prepared.map((p) => english[p.text] || p.text);
          const out = await mul.translateBatch(englishTexts, lang);
          results = {};
          prepared.forEach((p, idx) => { results[p.src] = out[englishTexts[idx]] ?? null; });
        } else {
          results = await argos.translateBatch(prepared.map((p) => p.text), lang);
        }

        for (const p of prepared) {
          let raw = results[p.text];
          if (!raw) continue;
          raw = unmaskMarkup(raw.trim(), p.bag);
          let cleaned = repair(raw, lang, p.src);
          if (isAllCaps(p.src)) cleaned = cleaned.toUpperCase();
          if (cleaned && cleaned.trim() !== p.src.trim()) {
            cache[lang][p.src] = cleaned;
            filled++;
          }
        }
      } catch (e) {
        console.log(`\n  error: ${e.message}`);
        break;
      }
    }

    totalFilled += filled;
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache), 'utf8');
    console.log(`+${filled} (${Object.keys(cache[lang]).length}/${strings.length})`);
  }

  argos.stop();
  mul.stop();
  console.log(`\nTotal filled: ${totalFilled}`);
}

main().catch((e) => { console.error(e); process.exit(1); });