const fs = require('fs');
const p = 'src/lib/dynamicTranslations.ts';
const lines = fs.readFileSync(p, 'utf8').split('\n');

/**
 * Repair entries left malformed by the previous regex pass:
 *   - a duplicated locale line ("de" twice in a row)
 *   - a duplicated closing brace ("  }" then "  },")
 *   - a missing comma before the next entry ("  }" then "  "KEY": {")
 */
const out = [];
let i = 0;
const fixes = { dupLocale: 0, dupBrace: 0, missingComma: 0 };

while (i < lines.length) {
  const line = lines[i];
  const next = lines[i + 1];
  const next2 = lines[i + 2];

  // 1. duplicated locale line
  if (
    next !== undefined &&
    /^\s*"(en|bs|sr|tr|de)":/.test(line) &&
    line.replace(/:\s*.*/, '') === next.replace(/:\s*.*/, '').replace(/,$/, '')
  ) {
    out.push(line);
    i += 2;
    fixes.dupLocale += 1;
    continue;
  }

  // 2. duplicated closing brace: "  }" followed by "  },"
  if (line.trim() === '}' && next !== undefined && next.trim() === '},') {
    out.push(line);
    i += 2;
    fixes.dupBrace += 1;
    continue;
  }

  // 3. closing brace with no comma, immediately followed by a new entry
  if (line === '  }' && next !== undefined && /^  ".*": \{$/.test(next)) {
    out.push('  },');
    out.push(next);
    i += 2;
    fixes.missingComma += 1;
    continue;
  }

  out.push(line);
  i += 1;
}

fs.writeFileSync(p, out.join('\n'), 'utf8');
console.log(JSON.stringify(fixes), 'lines now', out.length);
