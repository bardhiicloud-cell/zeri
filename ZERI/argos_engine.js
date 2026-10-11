/**
 * Offline translation engine backed by Argos Translate (Python).
 *
 * Every hosted endpoint reached from this machine is out of quota, which is what
 * capped the earlier runs at a few percent. Argos runs the models locally with no
 * key and no quota, so a full run is bounded only by CPU time.
 *
 * Albanian is reached through English because Argos only publishes sq<->en:
 *   sq -> en -> <target>
 * That is a pivot translation and loses some nuance, but it is complete, offline
 * and reproducible, which the hosted endpoints are not.
 *
 * The Python side is driven as a long-lived subprocess so the models load once
 * per run instead of once per batch.
 */
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Languages Argos can actually serve (verified against its package index). */
export const ARGOS_LANGUAGES = new Set([
  'ar', 'fr', 'it', 'es', 'pt', 'de', 'gsw', 'sl', 'ro', 'sv', 'nb', 'nl',
]);

/** Targets Argos has no model for; the caller must use a hosted provider. */
export const ARGOS_MISSING = ['mk', 'hr', 'hy'];

const BATCH_SIZE = 40;

export class ArgosEngine {
  constructor() {
    this.proc = null;
    this.buffer = '';
    this.pending = null;
  }

  start() {
    if (this.proc) return;
    this.proc = spawn('python', [path.join(__dirname, 'argos_bridge.py')], {
      cwd: __dirname,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
    });

    // Decode explicitly as UTF-8. Without this a chunk can split a multi-byte
    // character and every accented string comes back as "problï¿½mes".
    this.proc.stdout.setEncoding('utf8');
    this.proc.stderr.setEncoding('utf8');

    this.proc.stdout.on('data', (chunk) => {
      this.buffer += chunk;
      let newline;
      while ((newline = this.buffer.indexOf('\n')) !== -1) {
        const line = this.buffer.slice(0, newline).trim();
        this.buffer = this.buffer.slice(newline + 1);
        if (!line) continue;
        // The bridge only ever writes one JSON object per line, so anything
        // unparseable is stray library output and safe to ignore.
        let parsed;
        try {
          parsed = JSON.parse(line);
        } catch {
          continue;
        }
        if (this.pending) {
          const resolve = this.pending;
          this.pending = null;
          resolve(parsed);
        }
      }
    });

    // Model-load noise goes to stderr and is expected; keep it off the console
    // but do not treat it as failure.
    this.proc.stderr.on('data', () => { /* expected library chatter */ });

    this.proc.on('exit', (code) => {
      if (this.pending) {
        const resolve = this.pending;
        this.pending = null;
        resolve({ error: `bridge exited with code ${code}` });
      }
      this.proc = null;
    });
  }

  /** Translate a batch of strings into one language. Returns a source->text map. */
  async translateBatch(texts, lang) {
    if (texts.length === 0) return {};
    this.start();

    const out = {};
    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const slice = texts.slice(i, i + BATCH_SIZE);
      const result = await new Promise((resolve) => {
        this.pending = resolve;
        this.proc.stdin.write(JSON.stringify({ lang, texts: slice }) + '\n');
      });
      if (result.error) throw new Error(result.error);
      Object.assign(out, result.results || {});
    }
    return out;
  }

  stop() {
    if (this.proc) {
      try { this.proc.stdin.end(); } catch { /* already gone */ }
      this.proc = null;
    }
  }
}