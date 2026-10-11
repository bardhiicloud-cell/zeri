/**
 * Probe every keyless translation endpoint and report which work right now.
 * Rate limits reset over time, so a provider that was cooling earlier may serve
 * again. Run this before deciding whether generation is possible on this machine.
 */
const PROVIDERS = [
  {
    name: 'google-gtx',
    run: async (t, l) => {
      const r = await fetch(
        `https://translate.googleapis.com/translate_a/single?client=gtx&sl=sq&tl=${l}&dt=t&q=${encodeURIComponent(t)}`,
        { headers: { 'User-Agent': 'Mozilla/5.0' } }
      );
      const raw = await r.text();
      if (!raw.trim().startsWith('[')) return `HTTP ${r.status}: ${raw.slice(0, 70)}`;
      const d = JSON.parse(raw);
      return Array.isArray(d?.[0]) ? d[0].map((s) => s?.[0]).join('') : '(empty)';
    },
  },
  {
    name: 'mymemory',
    run: async (t, l) => {
      const r = await fetch(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(t)}&langpair=${encodeURIComponent('sq|' + l)}`
      );
      const d = await r.json();
      const out = d?.responseData?.translatedText;
      if (/QUOTA|LIMIT|WARNING|USED ALL/i.test(String(out))) return `QUOTA: ${out.slice(0, 70)}`;
      return out || '(empty)';
    },
  },
  {
    name: 'lingva.ml',
    run: async (t, l) => {
      const r = await fetch(
        `https://lingva.ml/api/v1/sq/${encodeURIComponent(l)}/${encodeURIComponent(t)}`
      );
      if (!r.ok) return `HTTP ${r.status}`;
      const d = await r.json();
      return d?.translation || '(empty)';
    },
  },
  {
    name: 'terraprint',
    run: async (t, l) => {
      const r = await fetch('https://translate.terraprint.co/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: t, source: 'sq', target: l, format: 'text' }),
      });
      if (!r.ok) return `HTTP ${r.status}`;
      const d = await r.json();
      return d?.translatedText || '(empty)';
    },
  },
  {
    name: 'simplytranslate',
    run: async (t, l) => {
      const r = await fetch(
        `https://simplytranslate.org/api/translate?engine=google&from=sq&to=${l}&text=${encodeURIComponent(t)}`
      );
      if (!r.ok) return `HTTP ${r.status}`;
      const d = await r.json();
      return d?.translated_text || '(empty)';
    },
  },
];

const SAMPLE = 'Mirësevini në platformën qendrore të qytetarëve';
const results = [];

for (const p of PROVIDERS) {
  let verdict;
  try {
    const out = await p.run(SAMPLE, 'fr');
    const looksTranslated = out && !out.startsWith('HTTP') && !out.startsWith('QUOTA') && !/Mirësevini/.test(out);
    verdict = looksTranslated ? `WORKS -> "${String(out).slice(0, 55)}"` : `BLOCKED -> ${String(out).slice(0, 55)}`;
  } catch (e) {
    verdict = `ERROR -> ${e.message.slice(0, 55)}`;
  }
  results.push({ provider: p.name, verdict });
  console.log(p.name.padEnd(16), verdict);
}

const working = results.filter((r) => r.verdict.startsWith('WORKS')).map((r) => r.provider);
console.log('\nWorking providers:', working.length ? working.join(', ') : 'NONE');
