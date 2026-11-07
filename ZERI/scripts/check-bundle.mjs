/**
 * Bundle budget, run after `npm run build`. Fails when what a first visit downloads
 * (the scripts and styles dist/index.html loads) or any one language table grows
 * past its budget. Lower the numbers when the bundle shrinks; raising them needs a reason.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const BUDGET_KB = { initialJs: 550, initialCss: 60, languageTable: 250 };

const gzipKb = (file) => zlib.gzipSync(fs.readFileSync(file)).length / 1024;
const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const assets = [...html.matchAll(/(?:src|href)="\/(assets\/[^"]+\.(js|css))"/g)].map((m) => ({ file: m[1], type: m[2] }));

const sum = (type) => assets.filter((a) => a.type === type).reduce((total, a) => total + gzipKb(path.join(dist, a.file)), 0);
const initialJs = sum('js');
const initialCss = sum('css');

const initial = new Set(assets.map((a) => path.basename(a.file)));
const tables = fs.readdirSync(path.join(dist, 'assets'))
  .filter((f) => /^[a-z]{2,3}-[\w-]{8}\.js$/.test(f) && !initial.has(f))
  .map((f) => ({ f, kb: gzipKb(path.join(dist, 'assets', f)) }));
const largestTable = tables.reduce((max, t) => (t.kb > max.kb ? t : max), { f: '-', kb: 0 });

const rows = [
  ['initial JS (gzip)', initialJs, BUDGET_KB.initialJs],
  ['initial CSS (gzip)', initialCss, BUDGET_KB.initialCss],
  [`largest language table (${largestTable.f})`, largestTable.kb, BUDGET_KB.languageTable],
];
let failed = false;
for (const [name, value, budget] of rows) {
  const ok = value <= budget;
  failed ||= !ok;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: ${value.toFixed(1)} KB (budget ${budget} KB)`);
}
if (failed) process.exit(1);
