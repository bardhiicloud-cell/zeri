/**
 * Offline engine for the languages Argos does not publish.
 *
 * Argos covers most targets. Bosnian, Serbian, Croatian and Macedonian have no
 * Argos model at all, so they are served by Helsinki-NLP's `opus-mt-en-mul` —
 * one many-to-many model that covers exactly those four.
 *
 * Same subprocess protocol as ArgosEngine so the generator can swap between them
 * without branching: one JSON request line in, one JSON response line out.
 */
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Languages served by the multilingual model. */
export const MUL_LANGUAGES = new Set(['bs', 'sr', 'hr', 'mk']);

const BATCH_SIZE = 8; // small: this model is heavier per string than Argos

export class MulEngine {
  constructor() {
    this.proc = null;
    this.buffer = '';
    this.pending = null;
  }

  start() {
    if (this.proc) return;
    this.proc = spawn('python', [path.join(__dirname, 'mul_bridge.py')], {
      cwd: __dirname,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
    });

    this.proc.stdout.setEncoding('utf8');
    this.proc.stderr.setEncoding('utf8');

    this.proc.stdout.on('data', (chunk) => {
      this.buffer += chunk;
      let newline;
      while ((newline = this.buffer.indexOf('\n')) !== -1) {
        const line = this.buffer.slice(0, newline).trim();
        this.buffer = this.buffer.slice(newline + 1);
        if (!line) continue;
        let parsed;
        try {
          parsed = JSON.parse(line);
        } catch {
          continue; // stray library output
        }
        if (this.pending) {
          const resolve = this.pending;
          this.pending = null;
          resolve(parsed);
        }
      }
    });

    this.proc.stderr.on('data', () => { /* download/load progress */ });
    this.proc.on('exit', (code) => {
      if (this.pending) {
        const resolve = this.pending;
        this.pending = null;
        resolve({ error: `mul bridge exited with code ${code}` });
      }
      this.proc = null;
    });
  }

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
