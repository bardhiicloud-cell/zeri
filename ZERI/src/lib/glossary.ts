/**
 * Terminology base for AI and machine translation.
 *
 * "AI të ruajë terminologjinë e njëjtë" is a correctness requirement, not a
 * nicety: if the assistant calls the same thing "raportim" on one turn and
 * "ankesë" on the next, in German "Meldung" and "Beschwerde", a citizen cannot
 * tell whether they are looking at one concept or two. Place names must also
 * never be re-translated — an earlier pass turned Kosovo into Kazakhstan.
 *
 * The glossary is the single source for four consumers:
 *   1. the AI system prompt, injected so the model is told the preferred term
 *   2. check_translations.js, which verifies the term survived translation
 *   3. the server's translateText helper, as post-translation replacements
 *   4. a human reviewer, who reads this table rather than grepping the codebase
 */

export interface GlossaryEntry {
  /** The Albanian source term, exactly as it appears in the UI. */
  sq: string;
  /** Whether the term is a proper noun that must never be translated. */
  properNoun?: boolean;
  /** Preferred rendering per language. Missing languages fall back to Albanian. */
  translations: Record<string, string>;
}

/**
 * Core civic vocabulary. Deliberately short and high-traffic: these are the
 * words that appear in headings, buttons and AI answers often enough that
 * inconsistency would be visible to a citizen.
 */
export const GLOSSARY: GlossaryEntry[] = [
  {
    sq: 'Kosovë',
    properNoun: true,
    translations: { en: 'Kosovo', de: 'Kosovo', fr: 'Kosovo', it: 'Kosovo', es: 'Kosovo', pt: 'Kosovo', nl: 'Kosovo', sv: 'Kosovo', nb: 'Kosovo', ro: 'Kosovo', hr: 'Kosovo', sl: 'Kosovo', mk: 'Косово', sr: 'Косово', tr: 'Kosova', ar: 'كوسوفو', hy: 'Կոսովո', gsw: 'Kosovo', bs: 'Kosovo' },
  },
  {
    sq: 'raportim',
    translations: { en: 'report', de: 'Meldung', fr: 'signalement', it: 'segnalazione', es: 'reporte', pt: 'relatório', nl: 'melding', sv: 'rapport', nb: 'rapport', ro: 'raportare', hr: 'prijava', sl: 'prijava', mk: 'пријава', sr: 'пријава', tr: 'bildirim', ar: 'بلاغ', hy: 'հաղորդում', gsw: 'Mäldig', bs: 'prijava' },
  },
  {
    sq: 'qytetar',
    translations: { en: 'citizen', de: 'Bürger', fr: 'citoyen', it: 'cittadino', es: 'ciudadano', pt: 'cidadão', nl: 'burger', sv: 'medborgare', nb: 'innbygger', ro: 'cetățean', hr: 'građanin', sl: 'državljan', mk: 'граѓанин', sr: 'грађанин', tr: 'vatandaş', ar: 'مواطن', hy: 'քաղաքացի', gsw: 'Bürger', bs: 'građanin' },
  },
  {
    sq: 'komunë',
    translations: { en: 'municipality', de: 'Gemeinde', fr: 'municipalité', it: 'comune', es: 'municipio', pt: 'município', nl: 'gemeente', sv: 'kommun', nb: 'kommune', ro: 'municipalitate', hr: 'općina', sl: 'občina', mk: 'општина', sr: 'општина', tr: 'belediye', ar: 'بلدية', hy: 'համայնք', gsw: 'Gmeind', bs: 'općina' },
  },
  {
    sq: 'shërbim publik',
    translations: { en: 'public service', de: 'öffentlicher Dienst', fr: 'service public', it: 'servizio pubblico', es: 'servicio público', pt: 'serviço público', nl: 'openbare dienst', sv: 'offentlig tjänst', nb: 'offentlig tjeneste', ro: 'serviciu public', hr: 'javna usluga', sl: 'javna storitev', mk: 'јавна услуга', sr: 'јавна услуга', tr: 'kamu hizmeti', ar: 'خدمة عامة', hy: 'հանրային ծառայություն', gsw: 'öffentliche Dienst', bs: 'javna usluga' },
  },
  {
    sq: 'transparencë',
    translations: { en: 'transparency', de: 'Transparenz', fr: 'transparence', it: 'trasparenza', es: 'transparencia', pt: 'transparência', nl: 'transparantie', sv: 'transparens', nb: 'åpenhet', ro: 'transparență', hr: 'transparentnost', sl: 'preglednost', mk: 'транспарентност', sr: 'транспарентност', tr: 'şeffaflık', ar: 'شفافية', hy: 'թափանցիկություն', gsw: 'Transparänz', bs: 'transparentnost' },
  },
  {
    sq: 'raport i zgjidhur',
    translations: { en: 'resolved report', de: 'gelöste Meldung', fr: 'signalement résolu', it: 'segnalazione risolta', es: 'reporte resuelto', pt: 'relatório resolvido', nl: 'opgeloste melding', sv: 'löst rapport', nb: 'løst rapport', ro: 'raportare soluționată', hr: 'riješena prijava', sl: 'rešena prijava', mk: 'решена пријава', sr: 'решена пријава', tr: 'çözülmüş bildirim', ar: 'بلاغ محلول', hy: 'լուծված հաղորդում', gsw: 'glösti Mäldig', bs: 'riješena prijava' },
  },
];

/** Fast lookup by Albanian source term. */
const BY_SOURCE = new Map(GLOSSARY.map((entry) => [entry.sq, entry]));

/**
 * The preferred term in a given language, or null when the glossary has no
 * opinion. Returning null (rather than the Albanian) lets callers distinguish
 * "no guidance" from "use this exact word".
 */
export function glossaryTerm(sq: string, lang: string): string | null {
  const entry = BY_SOURCE.get(sq);
  if (!entry) return null;
  return entry.translations[lang] ?? null;
}

/** Every proper noun, for the translation guard. */
export const PROTECTED_PROPER_NOUNS = GLOSSARY
  .filter((e) => e.properNoun)
  .map((e) => e.sq);

/**
 * Build the terminology block injected into the AI system prompt.
 *
 * Written as instructions the model can follow directly: "use this word", not a
 * data dump. Only the terms available in the target language are listed, so the
 * prompt never tempts the model into inventing a translation.
 */
export function glossaryPromptFor(lang: string): string {
  const pairs = GLOSSARY
    .map((entry) => {
      const target = entry.translations[lang];
      if (!target) return null;
      // A proper noun is stated as immutable so the model does not "localize" it.
      return entry.properNoun
        ? `- NEVER translate "${entry.sq}"; always write it as "${target}".`
        : `- "${entry.sq}" → "${target}"`;
    })
    .filter(Boolean);

  if (pairs.length === 0) return '';
  return `Use this exact terminology consistently:\n${pairs.join('\n')}`;
}

/**
 * Replace any known term that came back in the wrong form.
 *
 * Used as a post-translation pass on AI output, where the model may drift
 * mid-conversation even when instructed.
 */
export function enforceGlossary(text: string, lang: string): string {
  let out = text;
  for (const entry of GLOSSARY) {
    if (!entry.properNoun) continue;
    const target = entry.translations[lang];
    if (!target) continue;
    // Only correct a term that is present but wrong; do not inject.
    if (text.includes(entry.sq) && !out.includes(target)) {
      out = out.split(entry.sq).join(target);
    }
  }
  return out;
}
