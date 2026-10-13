/**
 * Show live translation progress across all shards.
 *
 * Reads each shard's cache file and reports how many of the 2086 source strings
 * it has, plus whether the process is still alive. Safe to run at any time: it
 * only reads.
 *
 * Usage:  node shard_status.js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { dynamicTranslations } from './src/lib/dynamicTranslations.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LANGS = ['ar', 'fr', 'it', 'pt', 'gsw', 'mk', 'sl', 'hr', 'sv', 'nb', 'nl', 'ja', 'ko', 'pl', 'bg'];
const SHARD_DIR = path.join(__dirname, '_shards');

function totalStrings() {
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
  return strings.size;
}

/** PIDs of node processes still running generate_new_languages.js. */
function liveShardPids() {
  try {
    const out = execSync(
      'powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name=\'node.exe\'\\" | Where-Object { $_.CommandLine -like \'*generate_new_languages*\' } | Select-Object -ExpandProperty ProcessId"',
      { encoding: 'utf8' }
    );
    return new Set(out.split(/\s+/).filter(Boolean));
  } catch {
    return new Set();
  }
}

const total = totalStrings();
const live = liveShardPids();

console.log(`Source strings per language: ${total}`);
console.log(`Live shard processes: ${live.size}\n`);
console.log('lang   done/total     %    state');

let grandDone = 0;
for (const lang of LANGS) {
  const f = path.join(SHARD_DIR, `cache_${lang}.json`);
  let done = 0;
  if (fs.existsSync(f)) {
    try {
      const shard = JSON.parse(fs.readFileSync(f, 'utf8'));
      done = Object.keys(shard[lang] || {}).length;
    } catch { /* still being written */ }
  }
  grandDone += done;
  const pct = ((done / total) * 100).toFixed(1);
  const state = done >= total ? 'COMPLETE' : (live.size > 0 ? 'running' : 'stopped');
  console.log(`${lang.padEnd(5)} ${String(done).padStart(5)}/${total} ${pct.padStart(6)}%    ${state}`);
}

const grandTotal = total * LANGS.length;
console.log(`\nOVERALL: ${grandDone}/${grandTotal} (${((grandDone / grandTotal) * 100).toFixed(1)}%)`);
if (live.size === 0 && grandDone < grandTotal) {
  console.log('\nNo shards running. Re-launch with:  node run_shards.js');
  console.log('Then bank the work with:            node merge_shards.js');
}
