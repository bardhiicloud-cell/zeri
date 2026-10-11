/**
 * Sharded translation runner.
 *
 * One process per language keeps each inside MyMemory's per-address quota
 * window: a single sequential process would spend the whole budget on Arabic
 * before German got a turn. Each shard owns its own cache file, so there is no
 * concurrent-write race on a shared JSON file — a real hazard that silently
 * drops translations when two writers interleave.
 *
 * Shards are launched as detached processes so the run survives the terminal
 * call returning, and progress is read from the per-shard files afterwards.
 *
 * Usage:
 *   node run_shards.js                 # all 14 languages
 *   node run_shards.js ar fr nl        # named languages only
 */
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ALL_LANGS = ['ar', 'fr', 'it', 'es', 'pt', 'gsw', 'mk', 'sl', 'hr', 'ro', 'sv', 'nb', 'hy', 'nl'];

const requested = process.argv.slice(2);
const langs = requested.length > 0 ? requested.filter((l) => ALL_LANGS.includes(l)) : ALL_LANGS;

const shardDir = path.join(__dirname, '_shards');
fs.mkdirSync(shardDir, { recursive: true });

console.log(`Launching ${langs.length} shard(s): ${langs.join(', ')}`);

const children = [];

for (const lang of langs) {
  const cacheFile = path.join(shardDir, `cache_${lang}.json`);
  const logFile = path.join(shardDir, `log_${lang}.txt`);

  // A shard with an empty cache starts from scratch; one with an existing file
  // resumes, because the generator skips anything already present.
  if (!fs.existsSync(cacheFile)) fs.writeFileSync(cacheFile, '{}', 'utf8');

  const out = fs.openSync(logFile, 'a');
  const child = spawn(
    process.execPath,
    ['generate_new_languages.js', `--lang=${lang}`, '--passes=30', `--cache=${cacheFile}`],
    { cwd: __dirname, stdio: ['ignore', out, out], detached: true, windowsHide: true }
  );
  child.unref();
  children.push({ lang, pid: child.pid, cacheFile, logFile });
  console.log(`  ${lang.padEnd(5)} pid ${child.pid}`);
  // Stagger launches so they do not all hit the API in the same millisecond.
  await new Promise((r) => setTimeout(r, 1500));
}

fs.writeFileSync(path.join(shardDir, 'manifest.json'), JSON.stringify(children, null, 2), 'utf8');
console.log(`\nShards running detached. Check progress with:  node shard_status.js`);
