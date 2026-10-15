/**
 * Lists the literal Albanian strings passed to `dt()` in the given files that have
 * no English or German entry in any translation table.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/find-untranslated-dt.ts src/pages/ReportIssue.tsx
 *
 * `dt()` falls back to the Albanian text for a missing entry, so a string that
 * comes back unchanged for `en` is untranslated (or genuinely identical, which
 * the --json output lets you filter by hand).
 */
import { readFileSync } from 'node:fs';
import { dt } from '../src/lib/dt';

const files = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
const asJson = process.argv.includes('--json');
const found = new Map<string, string[]>();

for (const file of files) {
  const source = readFileSync(file, 'utf8');
  // dt('...'), dt("..."), dt(`...`) with no interpolation.
  const pattern = /\b(?:dt|fmt)\(\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|`([^`$]*)`)\s*[,)]/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source))) {
    const raw = match[1] ?? match[2] ?? match[3];
    const text = raw.replace(/\\'/g, "'").replace(/\\"/g, '"');
    if (!/\p{L}/u.test(text)) continue;
    const missing: string[] = [];
    for (const lang of ['en', 'de']) if (dt(text, lang) === text) missing.push(lang);
    if (missing.length) found.set(text, missing);
  }
}

if (asJson) {
  console.log(JSON.stringify([...found.keys()], null, 2));
} else {
  for (const [text, langs] of found) console.log(`[${langs.join(',')}] ${text}`);
  console.log(`\n${found.size} untranslated string(s)`);
}
