const fs = require('fs');
const path = require('path');

/**
 * Guard for dynamicTranslations.ts.
 *
 * The file is a 10 000-line hand-maintained object, and a single missing comma
 * or duplicated closing brace fails the whole build. That happened twice while
 * adding the privacy and terms copy, and the cost was a broken bundle rather
 * than a failing test.
 *
 * Run with: node scripts/check-translations.cjs
 * Exits non-zero so it can run in CI or before a commit.
 */

const TABLE = 'src/lib/dynamicTranslations.ts';
const LOCALES = ['sq', 'en', 'bs', 'sr', 'tr', 'de'];
const src = fs.readFileSync(TABLE, 'utf8');
const lines = src.split('\n');

const errors = [];

// --- 1. Every entry is well formed -------------------------------------------
const entryRe = /^  "((?:[^"\\]|\\.)*)": \{$/;
const closeRe = /^  \},?$/;

let current = null;
let seenLocales = new Set();
let closed = false;
let total = 0;

function reset() {
  current = null;
  seenLocales = new Set();
  closed = false;
}

reset();

for (let i = 0; i < lines.length; i += 1) {
  const line = lines[i];
  const n = i + 1;

  const entry = entryRe.exec(line);
  if (entry) {
    if (current) {
      errors.push(`line ${n}: entry "${current}" was never closed`);
    }
    current = entry[1];
    seenLocales = new Set();
    closed = false;
    total += 1;
    continue;
  }

  if (closeRe.test(line)) {
    if (!current) {
      errors.push(`line ${n}: closing brace with no open entry`);
    } else {
      if (closed) {
        errors.push(`line ${n}: entry "${current}" closed twice`);
      }
      for (const locale of LOCALES) {
        if (!seenLocales.has(locale)) {
          errors.push(`entry "${current}" (near line ${n}) is missing "${locale}"`);
        }
      }
      if (line !== '  },' && n < lines.length && entryRe.test(lines[i + 1] ?? '')) {
        errors.push(`line ${n}: entry "${current}" needs a trailing comma`);
      }
    }
    reset();
    continue;
  }

  const locale = /^\s*"(sq|en|bs|sr|tr|de)":/.exec(line);
  if (locale && current) {
    if (seenLocales.has(locale[1])) {
      errors.push(`line ${n}: duplicate "${locale[1]}" in entry "${current}"`);
    }
    seenLocales.add(locale[1]);
  }
}

if (current) errors.push(`entry "${current}" was never closed`);

// --- 2. No duplicate keys ----------------------------------------------------
const seenKeys = new Map();
for (let i = 0; i < lines.length; i += 1) {
  const entry = entryRe.exec(lines[i]);
  if (!entry) continue;
  const key = entry[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  if (seenKeys.has(key)) {
    errors.push(`duplicate key at lines ${seenKeys.get(key)} and ${i + 1}: ${JSON.stringify(key)}`);
  } else {
    seenKeys.set(key, i + 1);
  }
}

// --- 3. Every dt() literal resolves ------------------------------------------
function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

const missing = [];
for (const file of walk('src')) {
  const fileSrc = fs.readFileSync(file, 'utf8');
  for (const m of fileSrc.matchAll(/\bdt\(\s*(['"])((?:[^'"\\]|\\.)*)\1\s*\)/g)) {
    if (!seenKeys.has(m[2])) {
      missing.push(`${path.relative('.', file)}: ${JSON.stringify(m[2])}`);
    }
  }
}
for (const item of missing) errors.push(`dt() key not in the table — ${item}`);

// --- Report ------------------------------------------------------------------
if (errors.length) {
  console.error(`FAIL — ${errors.length} problem(s):\n`);
  for (const error of errors.slice(0, 40)) console.error(`  ${error}`);
  if (errors.length > 40) console.error(`  ... and ${errors.length - 40} more`);
  process.exit(1);
}

console.log(`OK — ${total} entries, ${seenKeys.size} unique keys, all 6 locales present.`);
