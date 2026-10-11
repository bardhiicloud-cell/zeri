/**
 * Editorial Firewall — the rule engine that keeps a paying municipality from
 * becoming a censor.
 *
 * The platform's business model depends on municipalities paying a transparency
 * subscription. That creates an obvious conflict: the customer is also the
 * subject of the reporting. Without a hard boundary, the first time a report
 * embarrasses a mayor the pressure arrives — a phone call, a hint about
 * "reconsidering the contract" — and a citizen's complaint quietly disappears.
 *
 * This module is that boundary, expressed as code rather than a promise in a
 * contract, because a contract cannot stop a database write.
 *
 * The asymmetry is the whole point:
 *
 *   A municipality may  ADD     context  (respond, upload, correct a fact)
 *   A municipality may  NEVER   REMOVE  content  (delete, hide, unpublish)
 *
 * Adding never suppresses a citizen. Removing always does. Every rule below is
 * an instance of that single principle.
 *
 * This file is the source of truth for three consumers:
 *   1. the client UI, which hides what the role cannot do
 *   2. the server, which enforces it regardless of the client
 *   3. the published Editorial Policy, which must match what the code does
 */

import type { User } from '../types';

/* ------------------------------------------------------------------ */
/* Vocabulary                                                          */
/* ------------------------------------------------------------------ */

/**
 * Every action a municipal account might attempt against published content.
 * Named after the act, not the endpoint, so the policy reads plainly.
 */
export type EditorialAction =
  | 'respond'            // publish an official reply beneath a report
  | 'attach_document'    // upload a supporting document
  | 'correct_fact'       // propose a factual correction
  | 'dispute'            // formally contest a report
  | 'request_removal'    // ASK for removal — a request, never an act
  | 'add_work_facts'     // describe works carried out, on an approved report
  | 'delete_report'
  | 'hide_report'
  | 'unpublish_report'
  | 'edit_report_body'
  | 'delete_comment'
  | 'hide_comment'
  | 'suppress_criticism'
  | 'curate_queue'
  | 'alter_outcome'
  | 'alter_statistic'
  | 'buy_editorial_position'
  | 'threaten_contract';

/** Actions that change the public record by REMOVING something. Always denied. */
const DESTRUCTIVE: readonly EditorialAction[] = [
  'delete_report',
  'hide_report',
  'unpublish_report',
  'edit_report_body',
  'delete_comment',
  'hide_comment',
  'suppress_criticism',
  'curate_queue',
  'alter_outcome',
  'alter_statistic',
  'buy_editorial_position',
  'threaten_contract',
];

/** Actions that ADD context without removing anything. Always permitted. */
const CONSTRUCTIVE: readonly EditorialAction[] = [
  'respond',
  'attach_document',
  'correct_fact',
  'dispute',
  'request_removal',
  'add_work_facts',
];

/**
 * Statuses a municipality may see at all.
 *
 * A municipality is a customer of the transparency system, not a moderator of
 * it. Before staff have approved a report there is nothing verified to respond
 * to, and exposing the raw queue would let a municipality see — and act on —
 * unverified complaints about itself, including ones later rejected as
 * unfounded. So the visible set is exactly one status: Approved and everything
 * beyond it.
 *
 * 'Pending Review' and 'Draft' are deliberately absent. 'Rejected' is absent too:
 * a rejected report is not a record the municipality needs, and showing it would
 * reveal that a complaint was made and dismissed.
 */
const MUNICIPALITY_VISIBLE_STATUSES: readonly string[] = [
  'Approved',
  'Assigned',
  'In Progress',
  'Resolved',
  'Overdue',
];

/**
 * May this account see reports in this status?
 *
 * Every other role sees everything; the restriction exists only for a municipal
 * customer, and only to keep unverified material out of their hands.
 */
export function canSeeReportStatus(
  user: Pick<User, 'role'> | null | undefined,
  status: string
): boolean {
  if (!user) return false;
  if (user.role !== 'municipality') return true;
  return MUNICIPALITY_VISIBLE_STATUSES.includes(status);
}

/**
 * May a municipality add facts about completed works to this report?
 *
 * Only on a report staff have already approved, and only once it is being
 * worked on or is finished. Before approval there is no established issue to
 * describe works against — this is the rule behind "vetëm raportimet e
 * pranuara".
 */
export function canAddWorkFacts(
  user: Pick<User, 'role' | 'municipality'> | null | undefined,
  report: { status: string; location?: { municipality?: string } }
): FirewallDecision {
  if (!user) return { allowed: false, code: 'NO_USER', reason: 'Identifikimi mungon.' };
  if (user.role !== 'municipality') return ALLOW;

  const jurisdiction = canActOnMunicipality(user, report.location?.municipality ?? '');
  if (!jurisdiction.allowed) return jurisdiction;

  // Works can only be described against an approved report.
  const approved = ['Approved', 'Assigned', 'In Progress', 'Resolved'].includes(report.status);
  if (!approved) {
    return {
      allowed: false,
      code: 'NOT_APPROVED',
      reason: 'Fakte mund të shtohen vetëm pasi redaksia ta ketë pranuar raportimin.',
    };
  }

  return ALLOW;
}

/**
 * The decision for one action.
 *
 * `reason` is written to the audit log and, where the client shows it, to the
 * user — so a denied action explains itself instead of failing silently, which
 * is how a "why can't I do this?" support ticket is avoided.
 */
export interface FirewallDecision {
  allowed: boolean;
  /** Stable code for logging and tests. */
  code: string;
  /** Human explanation, safe to show. */
  reason: string;
  /** True when the action is a request routed to a human, not a direct effect. */
  requiresReview?: boolean;
}

const ALLOW: FirewallDecision = { allowed: true, code: 'ALLOW', reason: '' };

/* ------------------------------------------------------------------ */
/* The firewall                                                        */
/* ------------------------------------------------------------------ */

/**
 * Decide whether an account may perform an editorial action.
 *
 * Platform staff (admin, superadmin, and the editorial roles) are not municipal
 * customers and are not restricted by this firewall — they answer to the
 * published editorial policy instead. The rules here exist specifically for the
 * `municipality` role, which is a paying customer with a conflict of interest.
 */
export function evaluateEditorialAction(
  user: Pick<User, 'role' | 'municipality'> | null | undefined,
  action: EditorialAction
): FirewallDecision {
  if (!user) {
    return { allowed: false, code: 'NO_USER', reason: 'Identifikimi mungon.' };
  }

  // Staff are governed by the editorial policy, not by this customer firewall.
  const isMunicipalAccount = user.role === 'municipality';
  if (!isMunicipalAccount) return ALLOW;

  if (CONSTRUCTIVE.includes(action)) {
    // A removal *request* is allowed because it grants nothing: it opens a case
    // for a human reviewer. Refusing it would leave a municipality with no way
    // to flag a genuine error, which pushes them to apply pressure off-platform
    // instead.
    const requiresReview = action === 'correct_fact' || action === 'dispute' || action === 'request_removal';
    return {
      allowed: true,
      code: 'ALLOW_CONSTRUCTIVE',
      reason: requiresReview
        ? 'Kërkesa regjistrohet dhe shqyrtohet nga redaksia e pavarur.'
        : 'Veprimi shton kontekst dhe nuk heq asgjë.',
      requiresReview,
    };
  }

  if (DESTRUCTIVE.includes(action)) {
    return {
      allowed: false,
      code: 'FIREWALL_DENIED',
      reason:
        'Llogaria komunale nuk mund të heqë, fshehë ose ndryshojë përmbajtje të publikuar. ' +
        'Mund të përgjigjeni, të ngarkoni dokumente dhe të kërkoni korrigjim.',
    };
  }

  // An unknown action is denied rather than allowed: a new endpoint added later
  // must be granted explicitly, so it cannot slip past the boundary by omission.
  return {
    allowed: false,
    code: 'UNKNOWN_ACTION',
    reason: 'Veprim i panjohur — refuzohet si parazgjedhje.',
  };
}

/* ------------------------------------------------------------------ */
/* Convenience guards                                                  */
/* ------------------------------------------------------------------ */

export const canRespond = (u: Parameters<typeof evaluateEditorialAction>[0]) =>
  evaluateEditorialAction(u, 'respond').allowed;

export const canAttachDocument = (u: Parameters<typeof evaluateEditorialAction>[0]) =>
  evaluateEditorialAction(u, 'attach_document').allowed;

export const canCorrectFact = (u: Parameters<typeof evaluateEditorialAction>[0]) =>
  evaluateEditorialAction(u, 'correct_fact').allowed;

export const canDispute = (u: Parameters<typeof evaluateEditorialAction>[0]) =>
  evaluateEditorialAction(u, 'dispute').allowed;

/**
 * Always false for municipal accounts. Exposed as a named function rather than a
 * constant so a call site reads as intent — `if (canDeleteReport(user))` — and
 * so the denial is impossible to miss in review.
 */
export const canDeleteReport = (u: Parameters<typeof evaluateEditorialAction>[0]) =>
  evaluateEditorialAction(u, 'delete_report').allowed;

export const canHideReport = (u: Parameters<typeof evaluateEditorialAction>[0]) =>
  evaluateEditorialAction(u, 'hide_report').allowed;

/**
 * A municipality may only act inside its own jurisdiction.
 *
 * Without this, a paid account for one municipality could attach an official
 * reply to a report about its neighbour — a cheap way to interfere.
 */
export function canActOnMunicipality(
  user: Pick<User, 'role' | 'municipality'> | null | undefined,
  reportMunicipality: string
): FirewallDecision {
  if (!user) return { allowed: false, code: 'NO_USER', reason: 'Identifikimi mungon.' };
  if (user.role !== 'municipality') return ALLOW;

  const own = (user.municipality ?? '').trim().toLowerCase();
  const target = (reportMunicipality ?? '').trim().toLowerCase();

  if (!own) {
    return { allowed: false, code: 'NO_JURISDICTION', reason: 'Llogaria nuk ka komunë të caktuar.' };
  }
  if (own !== target) {
    return {
      allowed: false,
      code: 'OUT_OF_JURISDICTION',
      reason: `Kjo llogari mbulon vetëm ${user.municipality}.`,
    };
  }
  return ALLOW;
}

/* ------------------------------------------------------------------ */
/* Display helpers                                                     */
/* ------------------------------------------------------------------ */

/**
 * The firewall in plain language, for the policy page and the municipality's
 * own panel. Kept beside the rules so the published text and the enforced
 * behaviour cannot drift apart.
 */
export const MUNICIPALITY_MAY = [
  'Të shohin vetëm raportimet e pranuara nga redaksia',
  'Të shtojnë fakte dhe përshkrime për punimet e kryera',
  'Të korrigjojnë të dhëna faktike për komunën',
  'Të dërgojnë përgjigje zyrtare',
  'Të ngarkojnë dokumente mbështetëse',
  'Të kundërshtojnë një raport',
  'Të kërkojnë korrigjim kur ka gabim faktik',
] as const;

export const MUNICIPALITY_MAY_NOT = [
  'Të shohin raportime të papranuara ose në shqyrtim',
  'Të fshijnë një raport qytetari sepse nuk i pëlqen',
  'Të ndalojnë publikimin e kritikës',
  'Të zgjedhin cilat raportime lejohen',
  'Të ndryshojnë rezultatet',
  'Të ndryshojnë tekstin e raportit origjinal',
  'Të blejnë pozicionim editorial',
  'Të kërcënojnë me ndërprerje kontrate për shkak të një raportimi',
] as const;

/* ------------------------------------------------------------------ */
/* Work facts                                                          */
/* ------------------------------------------------------------------ */

/**
 * A factual entry a municipality adds about work it has carried out.
 *
 * This is the ONE thing a municipality contributes that is about itself rather
 * than about the citizen's complaint: "the pothole was filled on 12 March",
 * with the crew, cost and a photo. It is additive — the original report stays
 * exactly as the citizen wrote it, and these entries appear beneath it.
 */
export interface WorkFact {
  id: string;
  reportId: string;
  /** What was done, in the municipality's own words. */
  description: string;
  /** When the work was completed, as reported by the municipality. */
  completedAt?: string;
  /** Who performed it, e.g. "Ndërmarrja Publike HORTIKULTURA". */
  performedBy?: string;
  /** Optional cost, free text so "1,200 €" and "Falas" both fit. */
  cost?: string;
  /** Supporting photos or documents. */
  attachments?: string[];
  /** Municipality that filed it. */
  municipality: string;
  /** Account that filed it. */
  authorUserId: string;
  authorEmail: string;
  createdAt: string;
  /**
   * Review state.
   *
   * Municipality-written facts are marked "claim" until the newsroom confirms
   * them. Showing them as established fact the moment they are typed would let a
   * municipality write its own record of events, which is the same power as
   * editing the report — just slower.
   */
  review: 'pending' | 'confirmed';
}

/** Limits that keep a work-fact entry reviewable rather than a manifesto. */
export const WORK_FACT_LIMITS = {
  descriptionMin: 20,
  descriptionMax: 800,
  maxAttachments: 6,
} as const;

/**
 * Validate a work-fact submission.
 *
 * The description floor exists because "fixed" is not a fact a citizen can
 * check. Requiring a real sentence forces a checkable claim.
 */
export function validateWorkFact(input: {
  description: string;
  attachments?: string[];
}): { ok: true; error?: undefined } | { ok: false; error: string } {
  const text = (input.description ?? '').trim();
  if (text.length < WORK_FACT_LIMITS.descriptionMin) {
    return {
      ok: false,
      error: `Përshkrimi duhet të ketë së paku ${WORK_FACT_LIMITS.descriptionMin} shkronja — mjaftueshëm për t'u verifikuar.`,
    };
  }
  if (text.length > WORK_FACT_LIMITS.descriptionMax) {
    return { ok: false, error: `Përshkrimi kalon ${WORK_FACT_LIMITS.descriptionMax} shkronja.` };
  }
  if ((input.attachments?.length ?? 0) > WORK_FACT_LIMITS.maxAttachments) {
    return { ok: false, error: `Maksimumi ${WORK_FACT_LIMITS.maxAttachments} bashkëngjitje.` };
  }
  return { ok: true };
}

/**
 * The clause a municipality must accept before the account is activated.
 * Stored on the account with a timestamp, so there is a record of consent.
 */
export const EDITORIAL_FIREWALL_CLAUSE = `FIREWALL EDITORIAL — KLAUZOLË E DETYRUESHME

Platforma "Zëri i Qytetarëve" është regjistër publik i pandryshueshëm.

Komuna MUND TË:
${MUNICIPALITY_MAY.map((x) => `  • ${x}`).join('\n')}

Komuna NUK MUND TË:
${MUNICIPALITY_MAY_NOT.map((x) => `  • ${x}`).join('\n')}

Këto kufizime janë teknike dhe të pandryshueshme. Pagesa e abonimit NUK jep
kontroll mbi përmbajtjen. Komuna që kërkon heqjen e një raporti të saktë, ose që
kërcënon me ndërprerje kontrate për shkak të një raportimi, shkel këtë klauzolë.

Redaksia mbetet e pavarur. Asnjë raport nuk hiqet për arsye politike ose
komerciale.`;