import { canAccessSection, type AdminSection } from './adminPermissions';

/**
 * One acceptance system for everything that waits for a decision.
 *
 * Reports have their own pipeline (server/approvalPipeline.ts). Everything else
 * that a person submits and staff must accept - donation appeals, health cases,
 * news, advertising requests, forum posts - used to be approved by writing the
 * document straight from the browser. That meant:
 *   - no reason was ever asked for a rejection, so nobody could say why;
 *   - nothing recorded who decided, so "who let this through" had no answer;
 *   - the database rules and the menu disagreed: an agent given "donations" saw
 *     the approve button, but only a superadmin could write, so the click failed;
 *   - a status could jump anywhere, e.g. a rejected appeal straight to resolved.
 *
 * Every kind has a small table of actions: from which states each is allowed,
 * where it leads, and whether it needs a written reason. This module is shared:
 * the server enforces it (server/decisions.ts) and the screens use it to draw only
 * the buttons the server will accept.
 */

const MIN_REASON = 5;
const MAX_REASON = 300;

export type DecisionKind = 'donation' | 'health' | 'news' | 'adRequest' | 'forum' | 'muniRequest';

interface ActionRule {
  label: string;
  from: readonly string[];
  to: string;
  /** A written reason is required (rejecting, hiding, withdrawing). */
  needsReason?: boolean;
  /** The document fields this action writes. */
  patch: (now: string, extra: { reason: string; campaignId: string }) => Record<string, unknown>;
  /**
   * Moves a record between board stages (src/lib/workflowStages.ts) and nothing else: the
   * status the public site reads is left alone. Every other action on a board kind
   * puts the record back on its base stage - see {@link patchFor}.
   */
  staging?: boolean;
}

/** A board-stage step: writes only `workflowStage`, never the public status. */
const stageStep = (label: string, from: readonly string[], stage: string | null): ActionRule => ({
  label,
  from,
  to: from[0],
  staging: true,
  patch: () => ({ workflowStage: stage }),
});

interface KindRule {
  label: string;
  collection: string;
  section: AdminSection;
  /** The state name the action table speaks in, read from the document. */
  stateOf: (doc: Record<string, any>) => string;
  actions: Record<string, ActionRule>;
  /** Field holding the municipality, for kinds a municipality may act on. */
  municipalityField?: string;
  /** Actions a municipality may take on its own records. Nothing that removes. */
  municipalityActions?: readonly string[];
  /** The plan feature a municipality needs for this kind (see server/municipalityPlans.ts). */
  municipalityFeature?: string;
  /** Takes part in the staged board: its records carry an optional `workflowStage`. */
  board?: boolean;
}

export const DECISION_KINDS: Record<DecisionKind, KindRule> = {
  donation: {
    label: 'Kauza e donacionit',
    collection: 'donationCauses',
    section: 'donations',
    board: true,
    stateOf: d => String(d.status || 'pending'),
    actions: {
      approve: { label: 'Aprovo', from: ['pending', 'rejected'], to: 'approved', patch: () => ({ status: 'approved' }) },
      reject: { label: 'Refuzo', from: ['pending', 'approved'], to: 'rejected', needsReason: true, patch: () => ({ status: 'rejected' }) },
      reopen: { label: 'Kthe në shqyrtim', from: ['approved', 'rejected'], to: 'pending', patch: () => ({ status: 'pending' }) },
      stage_approved: stageStep('Kthe te e aprovuar', ['approved'], null),
      stage_waiting: stageStep('Vendos në pritje', ['approved'], 'waiting'),
      stage_responded: stageStep('Shëno me përgjigje', ['approved'], 'responded'),
      stage_completed: stageStep('Shëno si të përfunduar', ['approved'], 'completed'),
    },
  },
  health: {
    label: 'Rasti shëndetësor',
    collection: 'healthRegistry',
    section: 'health',
    stateOf: d => String(d.status || 'pending'),
    municipalityField: 'municipality',
    board: true,
    // A municipality collects and confirms its own cases; it does not reject them.
    // It also marks one as waiting on the hospital or as answered.
    municipalityActions: ['approve', 'resolve', 'stage_approved', 'stage_waiting', 'stage_responded'],
    municipalityFeature: 'health',
    actions: {
      approve: { label: 'Verifiko', from: ['pending', 'rejected'], to: 'verified', patch: now => ({ status: 'verified', statusUpdatedAt: now }) },
      reject: { label: 'Refuzo', from: ['pending', 'verified'], to: 'rejected', needsReason: true, patch: (now, x) => ({ status: 'rejected', statusUpdatedAt: now, statusNote: x.reason }) },
      resolve: { label: 'Shëno të zgjidhur', from: ['verified'], to: 'resolved', patch: now => ({ status: 'resolved', statusUpdatedAt: now }) },
      reopen: { label: 'Kthe në shqyrtim', from: ['verified', 'rejected', 'resolved'], to: 'pending', patch: now => ({ status: 'pending', statusUpdatedAt: now }) },
      stage_approved: stageStep('Kthe te e verifikuar', ['verified'], null),
      stage_waiting: stageStep('Vendos në pritje', ['verified'], 'waiting'),
      stage_responded: stageStep('Shëno me përgjigje', ['verified'], 'responded'),
    },
  },
  news: {
    label: 'Lajmi',
    collection: 'newsArticles',
    section: 'news',
    board: true,
    stateOf: d => (d.published === true ? 'published' : d.status === 'Rejected' ? 'rejected' : 'draft'),
    actions: {
      publish: { label: 'Publiko', from: ['draft', 'rejected'], to: 'published', patch: now => ({ published: true, publishedAt: now, status: 'Published' }) },
      unpublish: { label: 'Tërhiq nga publikimi', from: ['published'], to: 'draft', needsReason: true, patch: () => ({ published: false, publishedAt: null, status: 'Draft' }) },
      reject: { label: 'Refuzo', from: ['draft'], to: 'rejected', needsReason: true, patch: () => ({ published: false, status: 'Rejected' }) },
      reopen: { label: 'Kthe në draft', from: ['rejected'], to: 'draft', patch: () => ({ status: 'Draft' }) },
      stage_reported: stageStep('Kthe te drafti', ['draft'], null),
      stage_approved: stageStep('Aprovo për publikim', ['draft'], 'approved'),
      stage_waiting: stageStep('Vendos në pritje', ['draft'], 'waiting'),
      stage_responded: stageStep('Kthe për rishikim', ['draft'], 'responded'),
    },
  },
  adRequest: {
    label: 'Kërkesa për reklamë',
    collection: 'adRequests',
    section: 'ads',
    stateOf: d => String(d.status || 'pending'),
    actions: {
      confirmPayment: { label: 'Konfirmo pagesën', from: ['pending'], to: 'payment_confirmed', patch: now => ({ status: 'payment_confirmed', paymentConfirmedAt: now }) },
      approve: {
        label: 'Aprovo',
        from: ['pending', 'payment_confirmed'],
        to: 'approved',
        patch: (now, x) => ({ status: 'approved', approvedAt: now, ...(x.campaignId ? { campaignId: x.campaignId } : {}) }),
      },
      reject: { label: 'Refuzo', from: ['pending', 'payment_confirmed', 'approved'], to: 'rejected', needsReason: true, patch: () => ({ status: 'rejected' }) },
      complete: { label: 'Mbyll fushatën', from: ['approved'], to: 'completed', patch: now => ({ status: 'completed', completedAt: now }) },
      reopen: { label: 'Kthe në pritje', from: ['rejected', 'completed'], to: 'pending', patch: () => ({ status: 'pending' }) },
    },
  },
  muniRequest: {
    label: 'Kërkesa e komunës',
    collection: 'municipalityRequests',
    section: 'reports',
    stateOf: d => String(d.status || 'pending'),
    actions: {
      accept: { label: 'Pranoje', from: ['pending'], to: 'accepted', patch: (_now, x) => ({ status: 'accepted', decisionReason: x.reason || null }) },
      decline: { label: 'Refuzoje', from: ['pending'], to: 'declined', needsReason: true, patch: (_now, x) => ({ status: 'declined', decisionReason: x.reason }) },
      reopen: { label: 'Kthe në pritje', from: ['accepted', 'declined'], to: 'pending', patch: () => ({ status: 'pending', decisionReason: null }) },
    },
  },
  forum: {
    label: 'Postimi në forum',
    collection: 'forumPosts',
    section: 'forum',
    stateOf: d => (d.isHidden === true ? 'hidden' : d.isApproved === true ? 'approved' : 'pending'),
    actions: {
      approve: { label: 'Aprovo', from: ['pending', 'hidden'], to: 'approved', patch: () => ({ isApproved: true, isHidden: false }) },
      hide: { label: 'Fshih nga publiku', from: ['pending', 'approved'], to: 'hidden', needsReason: true, patch: () => ({ isHidden: true }) },
      unapprove: { label: 'Hiq aprovimin', from: ['approved'], to: 'pending', patch: () => ({ isApproved: false }) },
    },
  },
};

/**
 * What an action writes. On a board kind, anything that is not a stage step also puts
 * the record back on its base stage, so a re-approved appeal does not keep an old
 * "waiting" mark from before it was rejected.
 */
export function patchFor(
  kind: DecisionKind,
  action: string,
  now: string,
  extra: { reason: string; campaignId: string }
): Record<string, unknown> {
  const rule = DECISION_KINDS[kind];
  const step = rule.actions[action];
  const patch = step.patch(now, extra);
  return rule.board && !step.staging ? { ...patch, workflowStage: null } : patch;
}

export interface DecisionInput {
  actor: { uid: string; role: string; municipality: string; permissions: readonly string[]; features?: readonly string[] };
  kind: unknown;
  action: unknown;
  reason: unknown;
  doc: Record<string, any> | null;
}

export type DecisionOutcome =
  | { outcome: 'allow'; kind: DecisionKind; action: string; from: string; to: string; reason: string; label: string }
  | { outcome: 'deny'; status: 400 | 403 | 404 | 409; error: string };

const deny = (status: 400 | 403 | 404 | 409, error: string): DecisionOutcome => ({ outcome: 'deny', status, error });

const norm = (value: unknown) => String(value ?? '').trim().toLowerCase();

/** May this actor take this action on this record, and where does it lead? Pure. */
export function decide(input: DecisionInput): DecisionOutcome {
  if (typeof input.kind !== 'string' || !(input.kind in DECISION_KINDS)) return deny(400, 'Lloji i punës nuk njihet.');
  const kind = input.kind as DecisionKind;
  const rule = DECISION_KINDS[kind];

  if (typeof input.action !== 'string' || !(input.action in rule.actions)) return deny(400, 'Veprimi nuk njihet për këtë lloj.');
  const action = input.action;
  const step = rule.actions[action];

  const { role } = input.actor;
  if (role === 'monitor') return deny(403, 'Menaxheri i agjentëve vëzhgon; nuk vendos.');

  if (role === 'municipality') {
    if (!rule.municipalityField || !(rule.municipalityActions ?? []).includes(action)) {
      return deny(403, 'Komuna nuk e merr këtë vendim.');
    }
    // The server always supplies the plan's features; a screen that does not know
    // them (undefined) is not asked to decide on the server's behalf.
    if (rule.municipalityFeature && input.actor.features && !input.actor.features.includes(rule.municipalityFeature)) {
      return deny(403, 'Plani i komunës suaj nuk e përfshin këtë pjesë.');
    }
  } else if (!canAccessSection({ role, permissions: input.actor.permissions }, rule.section)) {
    return deny(403, 'Nuk keni qasje në këtë fushë. Administratori jua jep nga Agjentët.');
  }

  if (!input.doc) return deny(404, `${rule.label} nuk u gjet.`);

  if (role === 'municipality') {
    const own = norm(input.actor.municipality);
    if (!own) return deny(403, 'Llogaria nuk ka komunë të caktuar.');
    if (own !== norm(input.doc[rule.municipalityField!])) return deny(403, `Kjo llogari mbulon vetëm ${input.actor.municipality}.`);
  }

  const from = rule.stateOf(input.doc);
  if (!step.from.includes(from)) {
    return deny(409, `"${step.label}" nuk lejohet kur gjendja është "${from}". Rifreskoni: dikush tjetër mund ta ketë ndryshuar.`);
  }

  const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
  if (step.needsReason && reason.length < MIN_REASON) return deny(400, `Shkruani arsyen (të paktën ${MIN_REASON} shenja).`);
  if (reason.length > MAX_REASON) return deny(400, `Arsyeja nuk mund të kalojë ${MAX_REASON} shenja.`);

  return { outcome: 'allow', kind, action, from, to: step.to, reason, label: step.label };
}

/**
 * The actions this viewer may take on a record in this state, for drawing buttons.
 * Board-stage steps are left out: the staged board draws those, and the decision bar
 * keeps offering only the decisions themselves.
 */
export function availableActions(
  kind: DecisionKind,
  doc: Record<string, any>,
  actor: { uid: string; role: string; municipality: string; permissions: readonly string[] }
): Array<{ action: string; label: string; needsReason: boolean; to: string }> {
  const rule = DECISION_KINDS[kind];
  return Object.entries(rule.actions)
    .filter(([, step]) => !step.staging)
    .filter(([action]) => {
      const verdict = decide({ actor, kind, action, reason: 'x'.repeat(MIN_REASON), doc });
      return verdict.outcome === 'allow';
    })
    .map(([action, step]) => ({ action, label: step.label, needsReason: !!step.needsReason, to: step.to }));
}
