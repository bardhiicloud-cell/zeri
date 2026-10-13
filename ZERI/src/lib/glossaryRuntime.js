/**
 * Runtime glossary for the server.
 *
 * server.ts is bundled by esbuild and executed by Node, so it cannot import the
 * TypeScript glossary module directly. This is the JavaScript twin, holding only
 * what the AI endpoints need: the language names for the system prompt and the
 * terminology block that keeps answers consistent.
 *
 * Keep the term list in sync with src/lib/glossary.ts. Only the terms the AI is
 * instructed to use verbatim are needed here; the client module also carries the
 * validation helpers.
 */

/** Language name used when telling the model which language to answer in. */
export const AI_LANGUAGE_NAMES = {
  sq: 'Albanian (Shqip)',
  en: 'English',
  de: 'German (Deutsch)',
  bs: 'Bosnian (Bosanski)',
  ar: 'Arabic (العربية)',
  tr: 'Turkish (Türkçe)',
  sr: 'Serbian (Srpski)',
  fr: 'French (Français)',
  it: 'Italian (Italiano)',
  pt: 'Portuguese (Português)',
  gsw: 'Swiss German (Schweizerdeutsch)',
  mk: 'Macedonian (Македонски)',
  sl: 'Slovenian (Slovenščina)',
  hr: 'Croatian (Hrvatski)',
  sv: 'Swedish (Svenska)',
  nb: 'Norwegian (Norsk)',
  nl: 'Dutch (Nederlands)',
  ja: 'Japanese (日本語)',
  ko: 'Korean (한국어)',
  pl: 'Polish (Polski)',
  bg: 'Bulgarian (Български)',
  ca: 'English (Canada)',
  au: 'English (Australia)',
};

/**
 * Core civic vocabulary with a fixed rendering per language.
 * The AI is told to use these exact words so one concept keeps one name.
 */
const TERMS = [
  { sq: 'Kosovë', proper: true, t: { en: 'Kosovo', de: 'Kosovo', fr: 'Kosovo', it: 'Kosovo', pt: 'Kosovo', nl: 'Kosovo', sv: 'Kosovo', nb: 'Kosovo', hr: 'Kosovo', sl: 'Kosovo', mk: 'Косово', sr: 'Косово', tr: 'Kosova', ar: 'كوسوفو', gsw: 'Kosovo', bs: 'Kosovo', ja: 'コソボ', ko: '코소보', pl: 'Kosowo', bg: 'Косово', ca: 'Kosovo', au: 'Kosovo' } },
  { sq: 'raportim', t: { en: 'report', de: 'Meldung', fr: 'signalement', it: 'segnalazione', pt: 'relatório', nl: 'melding', sv: 'rapport', nb: 'rapport', hr: 'prijava', sl: 'prijava', mk: 'пријава', sr: 'пријава', tr: 'bildirim', ar: 'بلاغ', gsw: 'Mäldig', bs: 'prijava', ja: '通報', ko: '신고', pl: 'zgłoszenie', bg: 'докладване', ca: 'report', au: 'report' } },
  { sq: 'qytetar', t: { en: 'citizen', de: 'Bürger', fr: 'citoyen', it: 'cittadino', pt: 'cidadão', nl: 'burger', sv: 'medborgare', nb: 'innbygger', hr: 'građanin', sl: 'državljan', mk: 'граѓанин', sr: 'грађанин', tr: 'vatandaş', ar: 'مواطن', gsw: 'Bürger', bs: 'građanin', ja: '市民', ko: '시민', pl: 'obywatel', bg: 'гражданин', ca: 'citizen', au: 'citizen' } },
  { sq: 'komunë', t: { en: 'municipality', de: 'Gemeinde', fr: 'municipalité', it: 'comune', pt: 'município', nl: 'gemeente', sv: 'kommun', nb: 'kommune', hr: 'općina', sl: 'občina', mk: 'општина', sr: 'општина', tr: 'belediye', ar: 'بلدية', gsw: 'Gmeind', bs: 'općina', ja: '自治体', ko: '지방자치단체', pl: 'gmina', bg: 'община', ca: 'municipality', au: 'municipality' } },
  { sq: 'shërbim publik', t: { en: 'public service', de: 'öffentlicher Dienst', fr: 'service public', it: 'servizio pubblico', pt: 'serviço público', nl: 'openbare dienst', sv: 'offentlig tjänst', nb: 'offentlig tjeneste', hr: 'javna usluga', sl: 'javna storitev', mk: 'јавна услуга', sr: 'јавна услуга', tr: 'kamu hizmeti', ar: 'خدمة عامة', gsw: 'öffentliche Dienst', bs: 'javna usluga', ja: '公共サービス', ko: '공공 서비스', pl: 'usługa publiczna', bg: 'обществена услуга', ca: 'public service', au: 'public service' } },
  { sq: 'transparencë', t: { en: 'transparency', de: 'Transparenz', fr: 'transparence', it: 'trasparenza', pt: 'transparência', nl: 'transparantie', sv: 'transparens', nb: 'åpenhet', hr: 'transparentnost', sl: 'preglednost', mk: 'транспарентност', sr: 'транспарентност', tr: 'şeffaflık', ar: 'شفافية', gsw: 'Transparänz', bs: 'transparentnost', ja: '透明性', ko: '투명성', pl: 'przejrzystość', bg: 'прозрачност', ca: 'transparency', au: 'transparency' } },
];

/**
 * Build the terminology block injected into the AI system prompt.
 *
 * Phrased as instructions the model can follow, and only listing terms that
 * exist for the target language, so the model is never nudged into inventing one.
 */
export function glossaryPromptFor(lang) {
  const pairs = TERMS
    .map((entry) => {
      const target = entry.t[lang];
      if (!target) return null;
      return entry.proper
        ? `- NEVER translate "${entry.sq}"; always write it as "${target}".`
        : `- "${entry.sq}" → "${target}"`;
    })
    .filter(Boolean);

  if (pairs.length === 0) return '';
  return `Use this exact terminology consistently:\n${pairs.join('\n')}`;
}
