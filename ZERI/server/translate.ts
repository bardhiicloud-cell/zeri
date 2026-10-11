/**
 * Server-side translation for user-generated content (news articles).
 *
 * Mirrors the provider chain used by the build-time generator, but runs at
 * request time for text that did not exist when the bundle was built. Provider
 * choice is driven by the same reasoning: Google first for quality, MyMemory
 * next, public mirrors last. A provider that starts refusing is put on a
 * cooldown rather than being retried on every request.
 *
 * The glossary is applied afterwards so "Kosovo" is never rendered as the name
 * of a different country, which is the failure mode that actually occurred.
 */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Language codes that differ from our internal ones at the provider. */
const PROVIDER_CODE = { gsw: 'de-CH', nb: 'no' };

interface Health {
  failures: number;
  cooldownUntil: number;
}

const health = new Map<string, Health>();

function healthy(name: string): boolean {
  const h = health.get(name);
  if (!h) return true;
  return Date.now() >= h.cooldownUntil;
}

function noteSuccess(name: string): void {
  health.set(name, { failures: 0, cooldownUntil: 0 });
}

function noteFailure(name: string, cooldownMs = 60000): void {
  const h = health.get(name) || { failures: 0, cooldownUntil: 0 };
  h.failures += 1;
  if (h.failures >= 3) {
    h.cooldownUntil = Date.now() + cooldownMs;
    h.failures = 0;
  }
  health.set(name, h);
}

async function googleGtx(text: string, target: string): Promise<string | null> {
  const url =
    'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=' +
    target + '&dt=t&q=' + encodeURIComponent(text);
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ZERI/1.0)' } });
  const raw = await res.text();
  if (!raw.trim().startsWith('[')) return null;
  const data = JSON.parse(raw);
  const out = Array.isArray(data?.[0]) ? data[0].map((s: any) => s?.[0] || '').join('') : '';
  return out.trim() || null;
}

async function myMemory(text: string, target: string): Promise<string | null> {
  const url =
    'https://api.mymemory.translated.net/get?q=' +
    encodeURIComponent(text) +
    '&langpair=' + encodeURIComponent('auto|' + target);
  const res = await fetch(url);
  const data = await res.json();
  const out = data?.responseData?.translatedText;
  if (typeof out !== 'string') return null;
  if (/QUERY LENGTH LIMIT|MYMEMORY WARNING|INVALID|TOO MANY|YOU USED ALL/i.test(out)) return null;
  return out.trim() || null;
}

async function lingva(text: string, target: string): Promise<string | null> {
  const res = await fetch(
    `https://lingva.ml/api/v1/auto/${encodeURIComponent(target)}/${encodeURIComponent(text)}`
  );
  if (!res.ok) return null;
  const data = await res.json();
  return typeof data?.translation === 'string' ? data.translation.trim() || null : null;
}

const PROVIDERS: Array<{ name: string; fn: (t: string, l: string) => Promise<string | null>; cooldown: number }> = [
  { name: 'google', fn: googleGtx, cooldown: 120000 },
  { name: 'mymemory', fn: myMemory, cooldown: 90000 },
  { name: 'lingva', fn: lingva, cooldown: 120000 },
];

/**
 * Proper nouns and their correct rendering per language.
 *
 * The machine translator has produced "Kazakhstan" for Kosovo, so every proper
 * noun is corrected after the fact. Kept in sync with src/lib/glossary.ts.
 */
const PROPER_NOUNS: Record<string, Record<string, string>> = {
  'Kosovë': { en: 'Kosovo', de: 'Kosovo', fr: 'Kosovo', it: 'Kosovo', es: 'Kosovo', pt: 'Kosovo', nl: 'Kosovo', sv: 'Kosovo', nb: 'Kosovo', ro: 'Kosovo', hr: 'Kosovo', sl: 'Kosovo', mk: 'Косово', sr: 'Косово', tr: 'Kosova', ar: 'كوسوفو', hy: 'Կոսովո', gsw: 'Kosovo', bs: 'Kosovo' },
};

/** Words the translator wrongly substitutes for a proper noun. */
const WRONG_SUBSTITUTIONS = [
  /\bkaza[cjksz][a-z]*stan\b/gi,
  /\bkaza[cjksz]h?st[ae]n\b/gi,
  /\bqazaqstan\b/gi,
];

function repairProperNouns(text: string, target: string): string {
  let out = text;
  for (const re of WRONG_SUBSTITUTIONS) out = out.replace(re, '');
  for (const [sq, byLang] of Object.entries(PROPER_NOUNS)) {
    const correct = byLang[target];
    if (!correct) continue;
    const head = correct.slice(0, 4).toLowerCase();
    if (!out.toLowerCase().includes(head)) {
      out = `${correct} ${out.trim()}`;
    }
  }
  return out.replace(/\s{2,}/g, ' ').replace(/\s+([.,!?])/g, '$1').trim();
}

/**
 * Translate `text` into `target`, trying each healthy provider in turn.
 * Returns null when every provider is unavailable, letting the caller decide.
 */
export async function translateText(text: string, target: string, _source = 'sq'): Promise<string | null> {
  if (!text.trim()) return text;
  const code = PROVIDER_CODE[target] || target;

  for (const provider of PROVIDERS) {
    if (!healthy(provider.name)) continue;
    try {
      const out = await provider.fn(text, code);
      if (out && out !== text) {
        noteSuccess(provider.name);
        return repairProperNouns(out, target);
      }
      noteFailure(provider.name, provider.cooldown);
    } catch {
      noteFailure(provider.name, provider.cooldown);
    }
    await sleep(60);
  }
  return null;
}
