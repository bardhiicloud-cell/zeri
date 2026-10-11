const fs = require('fs');
const p = 'src/lib/dynamicTranslations.ts';
const lines = fs.readFileSync(p, 'utf8').split('\n');

/**
 * Second repair pass.
 *
 * The previous pass matched locale lines by their key only, so an entry that
 * had en/bs/sr twice (a run, not a pair) kept the duplicates and the missing
 * comma before the next entry went unnoticed. This pass works on the entry
 * level: it walks the file, collects one entry at a time, drops repeated locale
 * lines inside it, and re-emits a well-formed block.
 */
const out = [];
let i = 0;
let entries = 0;
let dupesRemoved = 0;
let commasAdded = 0;

// Header: everything before the first entry, up to and including "export const ... = {"
while (i < lines.length && !/^  "(?:[^"\\]|\\.)*": \{$/.test(lines[i])) {
  out.push(lines[i]);
  i += 1;
}

while (i < lines.length) {
  const keyLine = lines[i];
  if (!/^  "(?:[^"\\]|\\.)*": \{$/.test(keyLine)) {
    out.push(keyLine);
    i += 1;
    continue;
  }

  // Collect the body: locale lines plus the closing brace.
  const body = [];
  let j = i + 1;
  while (j < lines.length && lines[j] !== '  }' && lines[j] !== '  },' && lines[j] !== '};') {
    body.push(lines[j]);
    j += 1;
  }

  const seen = new Set();
  const kept = [];
  for (const line of body) {
    const locale = /^\s*"(en|bs|sr|tr|de)":/.exec(line);
    if (locale) {
      if (seen.has(locale[1])) { dupesRemoved += 1; continue; }
      seen.add(locale[1]);
    }
    kept.push(line);
  }

  // Normalise the closing line and decide whether a comma is needed.
  const isLast = /^};$/.test(lines[j] ?? '');
  if (isLast) {
    out.push(keyLine, ...kept, '  }');
    i = j + 1;
    break;
  }

  out.push(keyLine, ...kept, '  },');
  if ((lines[j] ?? '').trim() !== '},') commasAdded += 1;
  i = j + 1;
  entries += 1;
}

// Any remaining tail.
for (; i < lines.length; i += 1) out.push(lines[i]);

fs.writeFileSync(p, out.join('\n'), 'utf8');
console.log('entries rebuilt:', entries, '| dupes removed:', dupesRemoved, '| commas added:', commasAdded);
console.log('lines now', out.length);
