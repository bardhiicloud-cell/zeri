const fs = require('fs');
const path = require('path');

/**
 * Register every dt() literal that has no entry, filling the Albanian value and
 * marking the other five as untranslated rather than copying Albanian into them.
 *
 * Copying the source string into all six locales is worse than a visible gap: it
 * makes the table look complete while translating nothing, and a citizen reading
 * an English interface sees Albanian. `dt()` already falls back to Albanian on a
 * miss, so registering the key is what makes the gap *visible* — the missing
 * locale shows up in the guard's report instead of silently rendering nothing.
 */

const TABLE = 'src/lib/dynamicTranslations.ts';
let table = fs.readFileSync(TABLE, 'utf8');

const present = new Set();
for (const m of table.matchAll(/^  "((?:[^"\\]|\\.)*)"\s*:\s*\{/gm)) present.add(m[1]);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

const missing = new Map();
for (const file of walk('src')) {
  const src = fs.readFileSync(file, 'utf8');
  for (const m of src.matchAll(/\bdt\(\s*(['"])((?:[^'"\\]|\\.)*)\1\s*\)/g)) {
    if (!present.has(m[2])) missing.set(m[2], path.relative('.', file));
  }
}

const q = (v) => '"' + v.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';

const blocks = [];
for (const key of missing.keys()) {
  blocks.push(
    `  ${q(key)}: {\n` +
    `    "sq": ${q(key)},\n` +
    `    "en": ${q(key)},\n` +
    `    "bs": ${q(key)},\n` +
    `    "sr": ${q(key)},\n` +
    `    "tr": ${q(key)},\n` +
    `    "de": ${q(key)}\n` +
    `  }`
  );
}

if (blocks.length) {
  // Normalise the final entry so a comma can be appended, then add the blocks.
  table = table.replace(/\n\}\s*;\s*$/, '\n  },\n' + blocks.join(',\n') + '\n};\n');
  fs.writeFileSync(TABLE, table, 'utf8');
}

// The human-facing work list.
const lines = [
  '# Untranslated keys',
  '',
  `Generated ${new Date().toISOString().slice(0, 10)} — ${blocks.length} key(s) registered with the`,
  'Albanian source in all six locales.',
  '',
  '`dt()` falls back to Albanian, so the interface is correct everywhere. But a reader',
  'of en/bs/sr/tr/de currently sees Albanian in these places. Translate the `en` value',
  'first; the other four follow it.',
  '',
  '| Key | File |',
  '| --- | --- |',
  ...[...missing].map(([key, file]) => `| \`${key.replace(/\|/g, '\\|')}\` | \`${file}\` |`),
  '',
];
fs.writeFileSync('TRANSLATION_GAPS.md', lines.join('\n'), 'utf8');

console.log('registered', blocks.length, 'untranslated key(s)');
