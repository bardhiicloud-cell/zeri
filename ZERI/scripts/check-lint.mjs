/**
 * Lint ratchet over all of src/ and server/. The tree still carries older findings, so
 * the gate is "no rule may get worse": it compares the error count per rule with
 * scripts/lint-baseline.json and fails on any increase. Fix findings, then run
 *   node scripts/check-lint.mjs --update
 * to lock the lower numbers in. The baseline only ever goes down.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';

const baselineFile = new URL('./lint-baseline.json', import.meta.url);
let output = '';
try {
  output = execSync('npx eslint src server -f json', { maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }).toString();
} catch (error) {
  output = error.stdout?.toString() ?? '';
}
const counts = {};
for (const file of JSON.parse(output)) {
  for (const message of file.messages) {
    if (message.severity !== 2) continue;
    const rule = message.ruleId ?? 'parse-error';
    counts[rule] = (counts[rule] ?? 0) + 1;
  }
}
const total = Object.values(counts).reduce((a, b) => a + b, 0);

if (process.argv.includes('--update')) {
  fs.writeFileSync(baselineFile, JSON.stringify(Object.fromEntries(Object.entries(counts).sort()), null, 1) + '\n');
  console.log(`Baseline written: ${total} errors.`);
  process.exit(0);
}

const baseline = JSON.parse(fs.readFileSync(baselineFile, 'utf8'));
const worse = Object.entries(counts).filter(([rule, n]) => n > (baseline[rule] ?? 0));
const baselineTotal = Object.values(baseline).reduce((a, b) => a + b, 0);
console.log(`ESLint errors in src/ and server/: ${total} (baseline ${baselineTotal}).`);
if (total < baselineTotal) console.log('Fewer than the baseline: run  node scripts/check-lint.mjs --update  to lock it in.');
if (worse.length) {
  for (const [rule, n] of worse) console.error(`WORSE ${rule}: ${n} > ${baseline[rule] ?? 0}`);
  process.exit(1);
}
