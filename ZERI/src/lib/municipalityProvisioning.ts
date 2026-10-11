/**
 * Municipality provisioning agent — the step-by-step creation of a municipal
 * account, including the legal gate that makes the editorial firewall binding.
 *
 * Creating a municipality is not "making a user with a different role". Three
 * things must happen in order, and skipping any one of them is how a platform
 * ends up with a customer who believes they bought editorial control:
 *
 *   1. Identity      — which municipality, which official, which email
 *   2. Jurisdiction  — the exact scope the account may act within
 *   3. Consent       — the editorial firewall clause, accepted and timestamped
 *
 * The agent is written as an explicit state machine rather than a form, because
 * the steps have real prerequisites: an account cannot be activated before the
 * clause is accepted, and the clause cannot be accepted before the jurisdiction
 * is known (the clause names the municipality).
 *
 * KOSOVO_MUNICIPALITIES is the same list the rest of the app validates against,
 * so an account can never be provisioned for a municipality the platform does
 * not actually cover.
 */

import { KOSOVO_MUNICIPALITIES } from './constants';
import { EDITORIAL_FIREWALL_CLAUSE } from './editorialFirewall';

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

export type ProvisioningStep =
  | 'identity'
  | 'jurisdiction'
  | 'consent'
  | 'review'
  | 'done';

export interface MunicipalityDraft {
  /** Official's full name. */
  contactName: string;
  /** Official's role at the municipality, e.g. "Drejtor i Komunikimit". */
  contactRole: string;
  /** Working email. Becomes the sign-in address. */
  contactEmail: string;
  /** Optional direct line, shown only to platform staff. */
  contactPhone: string;
  /** Municipality name, must match KOSOVO_MUNICIPALITIES exactly. */
  municipality: string;
  /** Subscription tier — recorded for billing, grants no editorial power. */
  plan: 'free' | 'basic' | 'standard' | 'pro';
  /** Optional direct password set by the superadmin (min 8, letters+digits). */
  initialPassword: string;
  /** Free-text internal note for the account manager. */
  internalNote: string;
  /** Step 3: the clause was shown and accepted. */
  clauseAccepted: boolean;
  /** ISO timestamp of acceptance, set when the box is ticked. */
  clauseAcceptedAt: string;
}

export const EMPTY_DRAFT: MunicipalityDraft = {
  contactName: '',
  contactRole: '',
  contactEmail: '',
  contactPhone: '',
  municipality: '',
  plan: 'standard',
  initialPassword: '',
  internalNote: '',
  clauseAccepted: false,
  clauseAcceptedAt: '',
};

/* ------------------------------------------------------------------ */
/* Plan catalogue                                                      */
/* ------------------------------------------------------------------ */

/**
 * What each subscription actually buys.
 *
 * Every line describes ACCESS TO DATA or TOOLS, never influence over content.
 * That distinction is the whole firewall: the tiers differ in how much of the
 * municipality's own reporting they can see and act on, never in what the
 * public is allowed to read.
 */
export interface MunicipalityPlan {
  id: 'free' | 'basic' | 'standard' | 'pro';
  name: string;
  pricePerMonth: number;
  features: readonly string[];
}

export const MUNICIPALITY_PLANS: readonly MunicipalityPlan[] = [
  {
    id: 'free',
    name: 'Pa pagesë (Provim 12 muaj)',
    pricePerMonth: 0,
    features: [
      'Profil zyrtar i komunës me stemë',
      'Përgjigje zyrtare ndaj raporteve qytetarësh',
      'Njoftime publike në faqen e komunës',
      'Statistika bazë mujore',
      'Shënjuar si plan provë — rinovohet nga superadmini',
    ],
  },
  {
    id: 'basic',
    name: 'Bazë',
    pricePerMonth: 150,
    features: [
      'Profil zyrtar i komunës',
      'Statistika mujore të raportimeve',
      'Përgjigje zyrtare ndaj raporteve',
      'Arkivë e plotë e rasteve',
    ],
  },
  {
    id: 'standard',
    name: 'Standard',
    pricePerMonth: 350,
    features: [
      'Gjithçka nga plani Bazë',
      'Panel për agjentët komunalë',
      'Ngarkim dokumentesh dhe dëshmish',
      'Filtra sipas lagjes dhe kategorisë',
      'Raporte mujore të eksportueshme (PDF/CSV)',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    pricePerMonth: 700,
    features: [
      'Gjithçka nga plani Standard',
      'Raporte automatike javore',
      'Qasje API për sistemet e komunës',
      'Trajnim për stafin (2 sesione)',
      'Mbështetje prioritare',
    ],
  },
];

/** The line every plan must show, so no tier can be sold as "more control". */
export const PLAN_DISCLAIMER =
  'Asnjë plan nuk jep kontroll mbi përmbajtjen. Komuna mund të përgjigjet dhe të korrigjojë fakte; ' +
  'nuk mund të fshijë, fshehë ose ndryshojë raportime qytetarësh.';

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

export interface ValidationResult {
  ok: boolean;
  /** Field name -> message. Empty when ok. */
  errors: Record<string, string>;
}

/** Basic shape check; the authoritative check is the server's email regex. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateIdentity(draft: MunicipalityDraft): ValidationResult {
  const errors: Record<string, string> = {};
  if (draft.contactName.trim().length < 3) errors.contactName = 'Emri i zyrtarit është i detyrueshëm.';
  if (draft.contactRole.trim().length < 2) errors.contactRole = 'Roli i zyrtarit është i detyrueshëm.';
  if (!EMAIL_RE.test(draft.contactEmail.trim())) errors.contactEmail = 'Email-i zyrtar nuk është i vlefshëm.';
  return { ok: Object.keys(errors).length === 0, errors };
}

/** Optional but validated: an initial password must still be strong. */
export function validateInitialPassword(draft: MunicipalityDraft): ValidationResult {
  const errors: Record<string, string> = {};
  const pwd = draft.initialPassword;
  if (pwd) {
    if (pwd.length < 8 || pwd.length > 128) errors.initialPassword = 'Fjalëkalimi duhet të ketë 8–128 shenja.';
    else if (!/[a-zA-Z]/.test(pwd) || !/\d/.test(pwd)) errors.initialPassword = 'Duhet të përmbajë shkronja dhe numra.';
  }
  return { ok: Object.keys(errors).length === 0, errors };
}

export function validateJurisdiction(draft: MunicipalityDraft): ValidationResult {
  const errors: Record<string, string> = {};
  if (!draft.municipality) {
    errors.municipality = 'Zgjidhni komunën.';
  } else if (!KOSOVO_MUNICIPALITIES.includes(draft.municipality)) {
    // Guards against a typo producing an account scoped to nothing, which the
    // firewall would then refuse every action for — a confusing dead end.
    errors.municipality = 'Komuna nuk është në listën e komunave të mbuluara.';
  }
  return { ok: Object.keys(errors).length === 0, errors };
}

export function validateConsent(draft: MunicipalityDraft): ValidationResult {
  const errors: Record<string, string> = {};
  if (!draft.clauseAccepted) {
    errors.clauseAccepted = 'Klauzola e firewall-it editorial duhet të pranohet.';
  }
  return { ok: Object.keys(errors).length === 0, errors };
}

/* ------------------------------------------------------------------ */
/* The agent                                                           */
/* ------------------------------------------------------------------ */

/** Fields each step owns, so the UI can validate only what is on screen. */
export const STEP_FIELDS: Record<Exclude<ProvisioningStep, 'done'>, readonly (keyof MunicipalityDraft)[]> = {
  identity: ['contactName', 'contactRole', 'contactEmail'],
  jurisdiction: ['municipality', 'plan'],
  consent: ['clauseAccepted'],
  review: [],
};

export const STEP_TITLES: Record<ProvisioningStep, string> = {
  identity: 'Identiteti i zyrtarit',
  jurisdiction: 'Komuna dhe plani',
  consent: 'Firewall-i editorial',
  review: 'Përmbledhje dhe aktivizim',
  done: 'Llogaria u krijua',
};

export function validateStep(step: ProvisioningStep, draft: MunicipalityDraft): ValidationResult {
  switch (step) {
    case 'identity': {
      const base = validateIdentity(draft);
      const pwd = validateInitialPassword(draft);
      return { ok: base.ok && pwd.ok, errors: { ...base.errors, ...pwd.errors } };
    }
    case 'jurisdiction': return validateJurisdiction(draft);
    case 'consent': return validateConsent(draft);
    case 'review': {
      // Re-run everything: an earlier step may have been edited on the way back.
      const a = validateIdentity(draft);
      const b = validateJurisdiction(draft);
      const c = validateConsent(draft);
      return {
        ok: a.ok && b.ok && c.ok,
        errors: { ...a.errors, ...b.errors, ...c.errors },
      };
    }
    default: return { ok: true, errors: {} };
  }
}

/** Steps in order, for the progress indicator and the next/back logic. */
export const STEP_ORDER: readonly ProvisioningStep[] = ['identity', 'jurisdiction', 'consent', 'review'];

export function nextStep(current: ProvisioningStep): ProvisioningStep {
  const i = STEP_ORDER.indexOf(current);
  if (i === -1 || i === STEP_ORDER.length - 1) return 'done';
  return STEP_ORDER[i + 1];
}

export function previousStep(current: ProvisioningStep): ProvisioningStep {
  const i = STEP_ORDER.indexOf(current);
  return i <= 0 ? 'identity' : STEP_ORDER[i - 1];
}

/**
 * Build the account record the server will persist.
 *
 * `role` is fixed to 'municipality' and `clauseAcceptedAt` is stamped here — the
 * two facts that make the firewall enforceable. A partial submission is refused
 * rather than written, so there is no window in which a municipal account exists
 * without having accepted the clause.
 */
export function buildMunicipalityAccount(draft: MunicipalityDraft):
  | { ok: true; account: Record<string, unknown>; errors?: undefined }
  | { ok: false; errors: Record<string, string>; account?: undefined } {
  const check = validateStep('review', draft);
  if (!check.ok) return { ok: false, errors: check.errors };

  return {
    ok: true,
    account: {
      role: 'municipality',
      name: draft.contactName.trim(),
      email: draft.contactEmail.trim().toLowerCase(),
      phone: draft.contactPhone.trim(),
      municipality: draft.municipality,
      municipalityPlan: draft.plan,
      // Stamped at provisioning time; the server stores it verbatim so there is
      // a dated record of consent.
      editorialClauseAcceptedAt: draft.clauseAcceptedAt || new Date().toISOString(),
      billing: draft.plan === 'free' ? 'trial-12-months' : 'paid-monthly',
      // The exact text accepted, so a later change to the clause cannot rewrite
      // history for accounts that agreed to an older version.
      editorialClauseText: EDITORIAL_FIREWALL_CLAUSE,
      internalNote: draft.internalNote.trim(),
      // Carried to the server, which passes it straight to Firebase Auth when
      // creating the sign-in. An empty value means "send a reset email"; it is
      // stripped before the Firestore profile is written, so no password ever
      // reaches the users collection.
      initialPassword: draft.initialPassword,
      permissions: ['dashboard', 'reports', 'health', 'donations'],
      createdAt: new Date().toISOString(),
    },
  };
}

/**
 * Mark a draft's consent step, stamping the time.
 * Separated so the UI cannot tick the box without the timestamp being set.
 */
export function acceptClause(draft: MunicipalityDraft, accepted: boolean): MunicipalityDraft {
  return {
    ...draft,
    clauseAccepted: accepted,
    clauseAcceptedAt: accepted ? new Date().toISOString() : '',
  };
}