/**
 * What each municipality plan lets the account do, enforced by the server.
 *
 * The catalogue in src/lib/municipalityProvisioning.ts says what each plan sells.
 * This module turns it into entitlements the routes check. Every entitlement is
 * ACCESS TO DATA OR TOOLS, never influence over content: no plan removes the
 * editorial firewall (a municipality adds context and never removes anything).
 *
 *   respond / requests   answer citizens, file corrections and disputes   every plan
 *   workFacts            register the works carried out, with evidence      standard, pro
 *   health               the health cases of the municipality's area        standard, pro
 *   export               CSV of the municipality's own reports              standard, pro
 *   email                send a report to the responsible institution       pro
 *
 * A missing or unknown plan counts as `basic`: an account that predates plans
 * keeps working, with the entitlements of the plan it was sold.
 */

export const PLAN_IDS = ['free', 'basic', 'standard', 'pro'] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export type Feature = 'respond' | 'requests' | 'workFacts' | 'health' | 'export' | 'email';

const BASE: readonly Feature[] = ['respond', 'requests'];
const STANDARD: readonly Feature[] = [...BASE, 'workFacts', 'health', 'export'];

const FEATURES: Record<PlanId, readonly Feature[]> = {
  free: BASE,
  basic: BASE,
  standard: STANDARD,
  pro: [...STANDARD, 'email'],
};

export function normalizePlan(value: unknown): PlanId {
  return (PLAN_IDS as readonly string[]).includes(String(value)) ? (String(value) as PlanId) : 'basic';
}

export function featuresFor(plan: unknown): readonly Feature[] {
  return FEATURES[normalizePlan(plan)];
}

export function hasFeature(plan: unknown, feature: Feature): boolean {
  return featuresFor(plan).includes(feature);
}

/** The cheapest plan that includes a feature, for "available from plan X". */
export function cheapestPlanWith(feature: Feature): PlanId {
  return (['basic', 'standard', 'pro'] as const).find(plan => FEATURES[plan].includes(feature)) ?? 'pro';
}

export interface PlanChangeInput {
  actor: { uid: string; role: string };
  targetUid: string;
  targetRole: string;
  plan: unknown;
}

export type PlanChangeDecision =
  | { outcome: 'allow'; plan: PlanId }
  | { outcome: 'deny'; status: 400 | 403; error: string };

/** May this actor set this plan on this account? Pure. */
export function decidePlanChange(input: PlanChangeInput): PlanChangeDecision {
  if (input.actor.role !== 'admin' && input.actor.role !== 'superadmin') {
    return { outcome: 'deny', status: 403, error: 'Vetëm administratori cakton planin e një komune.' };
  }
  if (input.targetRole !== 'municipality') {
    return { outcome: 'deny', status: 400, error: 'Plani caktohet vetëm për llogari komunale.' };
  }
  if (typeof input.plan !== 'string' || !(PLAN_IDS as readonly string[]).includes(input.plan)) {
    return { outcome: 'deny', status: 400, error: 'Plani nuk njihet.' };
  }
  return { outcome: 'allow', plan: input.plan as PlanId };
}
