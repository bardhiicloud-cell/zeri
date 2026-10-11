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
  es: 'Spanish (Español)',
  pt: 'Portuguese (Português)',
  gsw: 'Swiss German (Schweizerdeutsch)',
  mk: 'Macedonian (Македонски)',
  sl: 'Slovenian (Slovenščina)',
  hr: 'Croatian (Hrvatski)',
  ro: 'Romanian (Română)',
  sv: 'Swedish (Svenska)',
  nb: 'Norwegian (Norsk)',
  hy: 'Armenian (Հայերեն)',
  nl: 'Dutch (Nederlands)',
};

/**
 * Core civic vocabulary with a fixed rendering per language.
 * The AI is told to use these exact words so one concept keeps one name.
 */
const TERMS = [
  { sq: 'Kosovë', proper: true, t: { en: 'Kosovo', de: 'Kosovo', fr: 'Kosovo', it: 'Kosovo', es: 'Kosovo', pt: 'Kosovo', nl: 'Kosovo', sv: 'Kosovo', nb: 'Kosovo', ro: 'Kosovo', hr: 'Kosovo', sl: 'Kosovo', mk: 'Косово', sr: 'Косово', tr: 'Kosova', ar: 'كوسوفو', hy: 'Կոսովո', gsw: 'Kosovo', bs: 'Kosovo' } },
  { sq: 'raportim', t: { en: 'report', de: 'Meldung', fr: 'signalement', it: 'segnalazione', es: 'reporte', pt: 'relatório', nl: 'melding', sv: 'rapport', nb: 'rapport', ro: 'raportare', hr: 'prijava', sl: 'prijava', mk: 'пријава', sr: 'пријава', tr: 'bildirim', ar: 'بلاغ', hy: 'հաղորդում', gsw: 'Mäldig', bs: 'prijava' } },
  { sq: 'qytetar', t: { en: 'citizen', de: 'Bürger', fr: 'citoyen', it: 'cittadino', es: 'ciudadano', pt: 'cidadão', nl: 'burger', sv: 'medborgare', nb: 'innbygger', ro: 'cetățean', hr: 'građanin', sl: 'državljan', mk: 'граѓанин', sr: 'грађанин', tr: 'vatandaş', ar: 'مواطن', hy: 'քաղաքացի', gsw: 'Bürger', bs: 'građanin' } },
  { sq: 'komunë', t: { en: 'municipality', de: 'Gemeinde', fr: 'municipalité', it: 'comune', es: 'municipio', pt: 'município', nl: 'gemeente', sv: 'kommun', nb: 'kommune', ro: 'municipalitate', hr: 'općina', sl: 'občina', mk: 'општина', sr: 'општина', tr: 'belediye', ar: 'بلدية', hy: 'համայնք', gsw: 'Gmeind', bs: 'općina' } },
  { sq: 'shërbim publik', t: { en: 'public service', de: 'öffentlicher Dienst', fr: 'service public', it: 'servizio pubblico', es: 'servicio público', pt: 'serviço público', nl: 'openbare dienst', sv: 'offentlig tjänst', nb: 'offentlig tjeneste', ro: 'serviciu public', hr: 'javna usluga', sl: 'javna storitev', mk: 'јавна услуга', sr: 'јавна услуга', tr: 'kamu hizmeti', ar: 'خدمة عامة', hy: 'հանրային ծառայություն', gsw: 'öffentliche Dienst', bs: 'javna usluga' } },
  { sq: 'transparencë', t: { en: 'transparency', de: 'Transparenz', fr: 'transparence', it: 'trasparenza', es: 'transparencia', pt: 'transparência', nl: 'transparantie', sv: 'transparens', nb: 'åpenhet', ro: 'transparență', hr: 'transparentnost', sl: 'preglednost', mk: 'транспарентност', sr: 'транспарентност', tr: 'şeffaflık', ar: 'شفافية', hy: 'թափանցիկություն', gsw: 'Transparänz', bs: 'transparentnost' } },
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
