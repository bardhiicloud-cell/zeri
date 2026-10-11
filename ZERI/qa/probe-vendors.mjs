/**
 * Vendor discovery probe.
 *
 * Every free endpoint reached from this machine is exhausted, so this checks the
 * remaining candidate services and reports exactly what each returns — the raw
 * response, not a guess. Run it to decide which provider can carry a full run.
 */
const SAMPLE = 'Mirësevini në platformën qendrore të qytetarëve';

const CANDIDATES = [
  {
    name: 'simplytranslate-html',
    fn: async () => {
      const r = await fetch('https://simplytranslate.org/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ engine: 'google', from: 'sq', to: 'fr', text: SAMPLE }),
      });
      const t = await r.text();
      return `HTTP ${r.status} :: ${t.slice(0, 120)}`;
    },
  },
  {
    name: 'simplytranslate-get',
    fn: async () => {
      const r = await fetch(
        `https://simplytranslate.org/api/translate?engine=google&from=sq&to=fr&text=${encodeURIComponent(SAMPLE)}`
      );
      const t = await r.text();
      return `HTTP ${r.status} :: ${t.slice(0, 120)}`;
    },
  },
  {
    name: 'libretranslate.de',
    fn: async () => {
      const r = await fetch('https://libretranslate.de/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: SAMPLE, source: 'sq', target: 'fr', format: 'text' }),
      });
      const t = await r.text();
      return `HTTP ${r.status} :: ${t.slice(0, 120)}`;
    },
  },
  {
    name: 'translate.argosopentech',
    fn: async () => {
      const r = await fetch('https://translate.argosopentech.com/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: SAMPLE, source: 'sq', target: 'fr', format: 'text' }),
      });
      const t = await r.text();
      return `HTTP ${r.status} :: ${t.slice(0, 120)}`;
    },
  },
  {
    name: 'microsoft-edge-auth',
    fn: async () => {
      const r = await fetch('https://edge.microsoft.com/translate/auth');
      const t = await r.text();
      return `HTTP ${r.status} :: ${t.slice(0, 60)}`;
    },
  },
  {
    name: 'bing-translate-direct',
    fn: async () => {
      const auth = await (await fetch('https://edge.microsoft.com/translate/auth')).text();
      if (!auth || auth.length < 20) return 'no auth token';
      const r = await fetch('https://api-edge.cognitive.microsofttranslator.com/translate?api-version=3.0&from=sq&to=fr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + auth },
        body: JSON.stringify([{ Text: SAMPLE }]),
      });
      const j = await r.json();
      return `HTTP ${r.status} :: ${JSON.stringify(j).slice(0, 140)}`;
    },
  },
  {
    name: 'papago-free',
    fn: async () => {
      const r = await fetch('https://papago.naver.com/apis/langs');
      const t = await r.text();
      return `HTTP ${r.status} :: ${t.slice(0, 80)}`;
    },
  },
  {
    name: 'reverso-api',
    fn: async () => {
      const r = await fetch(
        `https://api.reverso.net/translate/v1/translation`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ input: SAMPLE, from: 'alb', to: 'fra', format: 'text', options: {} }),
        }
      );
      const t = await r.text();
      return `HTTP ${r.status} :: ${t.slice(0, 140)}`;
    },
  },
];

for (const c of CANDIDATES) {
  let out;
  try {
    out = await c.fn();
  } catch (e) {
    out = `THREW :: ${e.message.slice(0, 90)}`;
  }
  console.log(c.name.padEnd(26), out);
}
