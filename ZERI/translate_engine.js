/**
 * Translation engine with multiple fallback providers.
 *
 * The single-provider version stalled: MyMemory caps free anonymous traffic
 * after roughly 175 requests from one address, which left 22,000 strings
 * untranslated. A civic platform in 20 languages cannot depend on one free tier,
 * so this module tries several endpoints in order and remembers which ones work,
 * demoting a provider as soon as it starts refusing.
 *
 * Order matters: the Google gtx endpoint gives the best quality when it answers,
 * then MyMemory, then LibreTranslate mirrors. Any provider that returns a usable
 * string wins and the result is cached, so a provider being down never blocks a
 * run — it just moves down the list.
 */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// gsw has no Google code; de-CH is the closest honest match.
const API_CODE = { gsw: 'de-CH', nb: 'no' };

/**
 * Provider health, kept in memory for the life of the run.
 * A provider that fails N times in a row is skipped for a cooldown window
 * instead of being retried on every single string.
 */
const health = new Map();

function isHealthy(name) {
  const h = health.get(name);
  if (!h) return true;
  if (h.cooldownUntil && Date.now() < h.cooldownUntil) return false;
  return true;
}

function noteSuccess(name) {
  health.set(name, { failures: 0, cooldownUntil: 0 });
}

function noteFailure(name, cooldownMs = 60000) {
  const h = health.get(name) || { failures: 0, cooldownUntil: 0 };
  h.failures++;
  if (h.failures >= 3) {
    h.cooldownUntil = Date.now() + cooldownMs;
    h.failures = 0;
  }
  health.set(name, h);
}

/* ------------------------------------------------------------------ */
/* Providers                                                           */
/* ------------------------------------------------------------------ */

/** Google's public gtx endpoint. Best quality, strictest rate limiting. */
async function googleGtx(text, tl) {
  const url =
    'https://translate.googleapis.com/translate_a/single?client=gtx&sl=sq&tl=' +
    tl + '&dt=t&q=' + encodeURIComponent(text);
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ZERI-i18n/1.0)' },
  });
  const raw = await res.text();
  if (!raw.trim().startsWith('[')) return null;
  const data = JSON.parse(raw);
  const out = Array.isArray(data?.[0])
    ? data[0].map((seg) => seg?.[0] || '').join('').trim()
    : '';
  return out || null;
}

/** MyMemory. Generous free tier but caps anonymous traffic per address. */
async function myMemory(text, tl) {
  const url =
    'https://api.mymemory.translated.net/get?q=' +
    encodeURIComponent(text) +
    '&langpair=' + encodeURIComponent('sq|' + tl);
  const res = await fetch(url);
  const data = await res.json();
  const out = data?.responseData?.translatedText;
  if (typeof out !== 'string') return null;
  if (/QUERY LENGTH LIMIT|MYMEMORY WARNING|INVALID|TOO MANY|YOU USED ALL/i.test(out)) return null;
  return out.trim() || null;
}

/** Lingva, a JSON proxy in front of Google. Useful when gtx is blocked. */
async function lingva(text, tl) {
  const url = `https://lingva.ml/api/v1/sq/${encodeURIComponent(tl)}/${encodeURIComponent(text)}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  return typeof data?.translation === 'string' ? data.translation.trim() || null : null;
}

/** LibreTranslate community mirror. Lower quality, rarely rate limited. */
async function libre(text, tl) {
  const res = await fetch('https://translate.terraprint.co/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: text, source: 'sq', target: tl, format: 'text' }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return typeof data?.translatedText === 'string' ? data.translatedText.trim() || null : null;
}

const PROVIDERS = [
  { name: 'google', fn: googleGtx, cooldown: 120000 },
  { name: 'mymemory', fn: myMemory, cooldown: 90000 },
  { name: 'lingva', fn: lingva, cooldown: 120000 },
  { name: 'libre', fn: libre, cooldown: 180000 },
];

/**
 * Translate one string, trying each healthy provider.
 *
 * Returns null only when every provider is down or refusing, which the caller
 * records as a miss and retries on the next pass rather than writing a bad value.
 */
export async function translateWithFallback(text, lang, protectedCheck) {
  const code = API_CODE[lang] || lang;

  for (const provider of PROVIDERS) {
    if (!isHealthy(provider.name)) continue;
    try {
      const out = await provider.fn(text, code);
      if (out && out !== text) {
        // A provider that returns the input unchanged has not translated it.
        noteSuccess(provider.name);
        return { text: out, provider: provider.name };
      }
      noteFailure(provider.name, provider.cooldown);
    } catch {
      noteFailure(provider.name, provider.cooldown);
    }
    // Small gap between providers so we do not hammer all of them at once.
    await sleep(80);
  }
  return null;
}

/** Current provider health, for progress reporting. */
export function providerStatus() {
  const out = {};
  for (const p of PROVIDERS) {
    const h = health.get(p.name);
    out[p.name] = !h ? 'ok' : (h.cooldownUntil > Date.now() ? 'cooling' : 'ok');
  }
  return out;
}
