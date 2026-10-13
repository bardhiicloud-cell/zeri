import { describe, expect, it } from 'vitest';
import { cheapestPlanWith, decidePlanChange, featuresFor, hasFeature, normalizePlan } from '../../server/municipalityPlans';
import { MUNICIPALITY_PLANS } from '../../src/lib/municipalityProvisioning';

describe('plan entitlements', () => {
  it('gives every plan in the catalogue an entitlement set', () => {
    for (const plan of MUNICIPALITY_PLANS) expect(featuresFor(plan.id).length, plan.id).toBeGreaterThan(0);
  });

  it('every plan can answer citizens and file requests', () => {
    for (const plan of ['free', 'basic', 'standard', 'pro']) {
      expect(hasFeature(plan, 'respond'), plan).toBe(true);
      expect(hasFeature(plan, 'requests'), plan).toBe(true);
    }
  });

  it('raises access with the tier, never lowers it', () => {
    expect(hasFeature('basic', 'health')).toBe(false);
    expect(hasFeature('basic', 'workFacts')).toBe(false);
    expect(hasFeature('standard', 'health')).toBe(true);
    expect(hasFeature('standard', 'email')).toBe(false);
    expect(hasFeature('pro', 'email')).toBe(true);
    for (const feature of featuresFor('standard')) expect(hasFeature('pro', feature), feature).toBe(true);
    for (const feature of featuresFor('basic')) expect(hasFeature('standard', feature), feature).toBe(true);
  });

  it('treats a missing or unknown plan as basic, so older accounts keep working', () => {
    for (const value of [undefined, null, '', 'platinum', 7]) expect(normalizePlan(value), String(value)).toBe('basic');
    expect(hasFeature(undefined, 'respond')).toBe(true);
    expect(hasFeature(undefined, 'health')).toBe(false);
  });

  it('names the cheapest plan that unlocks a feature', () => {
    expect(cheapestPlanWith('health')).toBe('standard');
    expect(cheapestPlanWith('email')).toBe('pro');
    expect(cheapestPlanWith('respond')).toBe('basic');
  });
});

describe('decidePlanChange', () => {
  const owner = { uid: 'o', role: 'superadmin' };
  it('lets an administrator set a plan on a municipal account', () => {
    expect(decidePlanChange({ actor: owner, targetUid: 'm', targetRole: 'municipality', plan: 'pro' })).toEqual({ outcome: 'allow', plan: 'pro' });
    expect(decidePlanChange({ actor: { uid: 'a', role: 'admin' }, targetUid: 'm', targetRole: 'municipality', plan: 'free' }).outcome).toBe('allow');
  });

  it('refuses everyone else, other kinds of account, and unknown plans', () => {
    for (const role of ['agent', 'monitor', 'municipality', 'citizen']) {
      expect(decidePlanChange({ actor: { uid: 'x', role }, targetUid: 'm', targetRole: 'municipality', plan: 'pro' }), role).toMatchObject({ outcome: 'deny', status: 403 });
    }
    expect(decidePlanChange({ actor: owner, targetUid: 'a', targetRole: 'agent', plan: 'pro' })).toMatchObject({ outcome: 'deny', status: 400 });
    expect(decidePlanChange({ actor: owner, targetUid: 'm', targetRole: 'municipality', plan: 'platinum' })).toMatchObject({ outcome: 'deny', status: 400 });
    expect(decidePlanChange({ actor: owner, targetUid: 'm', targetRole: 'municipality', plan: 3 })).toMatchObject({ outcome: 'deny', status: 400 });
  });
});
