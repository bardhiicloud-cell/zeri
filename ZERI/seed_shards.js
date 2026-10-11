/**
 * Seed shard caches from the main cache so existing work is not redone.
 * Run once before launching shards.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LANGS = ['ar', 'fr', 'it', 'es', 'pt', 'gsw', 'mk', 'sl', 'hr', 'ro', 'sv', 'nb', 'hy', 'nl'];
const SHARD_DIR = path.join(__dirname, '_shards');
fs.mkdirSync(SHARD_DIR, { recursive: true });

const main = JSON.parse(fs.readFileSync(path.join(__dirname, '_translation_cache.json'), 'utf8'));

for (const lang of LANGS) {
  const existing = fs.existsSync(path.join(SHARD_DIR, `cache_${lang}.json`))
    ? JSON.parse(fs.readFileSync(path.join(SHARD_DIR, `cache_${lang}.json`), 'utf8'))
    : {};

  const shard = { [lang]: { ...(main[lang] || {}), ...(existing[lang] || {}) } };
  fs.writeFileSync(path.join(SHARD_DIR, `cache_${lang}.json`), JSON.stringify(shard), 'utf8');
  console.log(`${lang.padEnd(5)} seeded ${Object.keys(shard[lang]).length}`);
}
console.log('\nShard caches seeded.');
