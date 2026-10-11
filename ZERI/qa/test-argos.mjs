import { ArgosEngine, ARGOS_LANGUAGES } from '../argos_engine.js';

const engine = new ArgosEngine();
const samples = [
  'Mirësevini në platformën qendrore të qytetarëve',
  'Raportoni problemet dhe ndiqni zgjidhjet',
  'Komuna e Prishtinës',
];

console.log('Argos languages:', [...ARGOS_LANGUAGES].join(', '));
console.log();

for (const lang of ['fr', 'de', 'ar', 'nl', 'sv', 'ro', 'sl', 'gsw']) {
  const t0 = Date.now();
  const out = await engine.translateBatch(samples, lang);
  const ms = Date.now() - t0;
  console.log(`${lang.padEnd(5)} (${ms}ms)`);
  for (const s of samples) {
    console.log(`      ${JSON.stringify(out[s] || null)}`);
  }
}
engine.stop();