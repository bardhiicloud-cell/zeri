/**
 * Server-side editorial firewall enforcement.
 *
 * The client-side firewall only hides buttons. A municipal account with a valid
 * token could still POST a delete directly, so every write that touches
 * published content is re-checked here — this is the authoritative decision, and
 * the client copy exists so the UI does not offer what will be refused.
 *
 * Two rules shape the implementation:
 *
 *   1. Deny by default. A new endpoint is refused unless it is explicitly
 *      granted, so a route added later cannot slip past the boundary by
 *      omission.
 *   2. Record denials. A refused attempt is the single most valuable entry in
 *      the audit log — it is the evidence a later dispute would turn on — so it
 *      is written before the 403 is returned.
 *
 * Kept in JavaScript because server.ts is bundled by esbuild for Node and cannot
 * import the TypeScript module at runtime.
 */

/** Actions that ADD context. A municipality is allowed all of these. */
const CONSTRUCTIVE = new Set([
  'respond',
  'attach_document',
  'correct_fact',
  'dispute',
  'request_removal',
  'add_work_facts',
]);

/** Actions that REMOVE or reshape the public record. Never allowed. */
const DESTRUCTIVE = new Set([
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
]);

/**
 * Statuses a municipal account may see.
 *
 * Deliberately one boundary rather than a per-status list: everything from
 * 'Approved' onward is public record, everything before it is unverified
 * material about the municipality that must not reach it.
 */
const VISIBLE_STATUSES = new Set([
  'Approved', 'Assigned', 'In Progress', 'Resolved', 'Overdue',
]);

/**
 * Decide whether an account may perform an editorial action.
 * @param {{ role?: string, municipality?: string } | null | undefined} user
 * @param {string} action
 */
function evaluate(user, action) {
  if (!user) {
    return { allowed: false, code: 'NO_USER', reason: 'Identifikimi mungon.' };
  }

  // Staff answer to the published editorial policy, not to this customer
  // firewall. Only the municipal role is constrained here.
  if (user.role !== 'municipality') {
    return { allowed: true, code: 'ALLOW', reason: '' };
  }

  if (CONSTRUCTIVE.has(action)) {
    const requiresReview = ['correct_fact', 'dispute', 'request_removal', 'add_work_facts'].includes(action);
    return {
      allowed: true,
      code: 'ALLOW_CONSTRUCTIVE',
      reason: requiresReview
        ? 'Kërkesa regjistrohet dhe shqyrtohet nga redaksia e pavarur.'
        : 'Veprimi shton kontekst dhe nuk heq asgjë.',
      requiresReview,
    };
  }

  if (DESTRUCTIVE.has(action)) {
    return {
      allowed: false,
      code: 'FIREWALL_DENIED',
      reason:
        'Llogaria komunale nuk mund të heqë, fshehë ose ndryshojë përmbajtje të publikuar. ' +
        'Mund të përgjigjeni, të ngarkoni dokumente dhe të kërkoni korrigjim.',
    };
  }

  // Unknown action: refuse. A new endpoint must opt in explicitly.
  return { allowed: false, code: 'UNKNOWN_ACTION', reason: 'Veprim i panjohur — refuzohet si parazgjedhje.' };
}

/** May this account see a report in this status? */
function canSeeReportStatus(user, status) {
  if (!user) return false;
  if (user.role !== 'municipality') return true;
  return VISIBLE_STATUSES.has(status);
}

/** May this account act on a report belonging to this municipality? */
function canActOnMunicipality(user, reportMunicipality) {
  if (!user) return { allowed: false, code: 'NO_USER', reason: 'Identifikimi mungon.' };
  if (user.role !== 'municipality') return { allowed: true, code: 'ALLOW', reason: '' };

  const own = String(user.municipality || '').trim().toLowerCase();
  const target = String(reportMunicipality || '').trim().toLowerCase();

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
  return { allowed: true, code: 'ALLOW', reason: '' };
}

/** May this account add work facts to this report? */
function canAddWorkFacts(user, report) {
  if (!user) return { allowed: false, code: 'NO_USER', reason: 'Identifikimi mungon.' };
  if (user.role !== 'municipality') return { allowed: true, code: 'ALLOW', reason: '' };

  const jurisdiction = canActOnMunicipality(user, report?.location?.municipality);
  if (!jurisdiction.allowed) return jurisdiction;

  // Works can only be described against an approved report: before approval
  // there is no established issue for them to be about.
  if (!['Approved', 'Assigned', 'In Progress', 'Resolved'].includes(report?.status)) {
    return {
      allowed: false,
      code: 'NOT_APPROVED',
      reason: 'Fakte mund të shtohen vetëm pasi redaksia ta ketë pranuar raportimin.',
    };
  }
  return { allowed: true, code: 'ALLOW', reason: '' };
}

/** Work-fact shape rules. Kept in step with WORK_FACT_LIMITS on the client. */
function validateWorkFact(input) {
  const text = String(input?.description || '').trim();
  if (text.length < 20) {
    return { ok: false, error: 'Përshkrimi duhet të ketë së paku 20 shkronja — mjaftueshëm për t\'u verifikuar.' };
  }
  if (text.length > 800) return { ok: false, error: 'Përshkrimi kalon 800 shkronja.' };
  if (Array.isArray(input?.attachments) && input.attachments.length > 6) {
    return { ok: false, error: 'Maksimumi 6 bashkëngjitje.' };
  }
  return { ok: true };
}

export {
  evaluate,
  canSeeReportStatus,
  canActOnMunicipality,
  canAddWorkFacts,
  validateWorkFact,
  VISIBLE_STATUSES,
  CONSTRUCTIVE,
  DESTRUCTIVE,
};
