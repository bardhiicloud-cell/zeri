/**
 * Radha e fakteve të punimeve — burimi i përbashkët për `/komuna`.
 *
 * Komuna i regjistron faktet te `/komuna-panel` (firewall-i editorial i
 * vendosur në `editorialFirewall.ts`), ndërsa `/komuna` i shfaq ato. Të dyja
 * faqet duhet të shohin të njëjtën listë, prandaj ekziston ky modul: një vend i
 * vetëm për leximin e fakteve të sesionit, pa dyfishim logjike.
 *
 * Kufizimi: fakte mund të kenë vetëm raportime të aprovuara, dhe vetëm brenda
 * komunës së vet. Kontrolli mbetet në `editorialFirewall` — ky modul vetëm
 * mban dhe lexon.
 */

export interface SessionWorkFact {
  id: string;
  reportId: string;
  description: string;
  municipality: string;
  /** ISO timestamp. */
  at: string;
  /** Gjendja e verifikimit; redaksia e ndryshon pas shqyrtimit. */
  review: 'pending' | 'confirmed' | 'rejected';
}

const facts: SessionWorkFact[] = [];

let sequence = 0;

/**
 * Regjistron një fakt pune. Nuk zëvendëson asgjë — shton, siç e kërkon rregulli
 * themelor i firewall-it: komuna ADD kontekst, nuk REMOVE.
 */
export function scheduleWorkFact(input: {
  reportId: string;
  description: string;
  municipality: string;
}): SessionWorkFact {
  sequence += 1;
  const entry: SessionWorkFact = {
    id: `wf_${Date.now().toString(36)}_${sequence.toString(36)}`,
    reportId: input.reportId,
    description: input.description.trim(),
    municipality: input.municipality,
    at: new Date().toISOString(),
    review: 'pending',
  };
  facts.push(entry);
  return entry;
}

/**
 * Faktet e një komune, më të rejat në krye.
 *
 * Pa komunë kthen të gjitha: një administrator që inspekton panelin e duhet
 * pamja e plotë, ndërsa një llogari komunale kalon gjithmonë komunën e vet.
 */
export function sessionFacts(municipality?: string): SessionWorkFact[] {
  return facts
    .filter((f) => !municipality || f.municipality === municipality)
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

/** Sa fakte pritet të verifikohen për një komunë. */
export function pendingCount(municipality?: string): number {
  return facts.filter(
    (f) => f.review === 'pending' && (!municipality || f.municipality === municipality)
  ).length;
}
