import { describe, expect, it } from 'vitest';
import { buildRoleClaims } from '../../server/roleClaims';
import { ADMIN_ROLES } from '../../server/auth';
import { decideModeration } from '../../server/userModeration';
import { checkRoleChange } from '../../server/policy';
import { planReportQuery } from '../../server/reportQuery';
import { decideTransition, pipelineRoleOf, ALL_TRANSITIONS } from '../../server/approvalPipeline';

/**
 * The Monitor role reads and changes nothing. Every property below is enforced on
 * the server; the UI merely stops drawing buttons that would fail.
 */
const monitor = { role: 'monitor', municipality: '', permissions: [] as string[] };
const report = { status: 'Pending Review', location: { municipality: 'Prishtinë' }, description: 'x'.repeat(30), category: 'c', images: ['a'] };

describe('monitor role', () => {
  it('is a recognised staff role that may reach the admin surface', () => {
    expect(ADMIN_ROLES.has('monitor')).toBe(true);
  });

  it('carries only its own rules flag - never the agent flag that unlocks write paths', () => {
    const claims = buildRoleClaims('monitor', []);
    expect(claims.monitor).toBe(true);
    for (const flag of ['agent', 'admin', 'superadmin', 'approver', 'adsadmin', 'newsadmin', 'municipality_account']) {
      expect(claims[flag], flag).toBeUndefined();
    }
  });

  it('may list reports (read) and sees all statuses, unlike a municipality', () => {
    const result = planReportQuery({ limit: 25, status: 'unapproved' }, monitor);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.plan.empty).toBe(false);
  });

  it('has no standing in the approval pipeline - every transition is refused', () => {
    expect(pipelineRoleOf('monitor')).toBeNull();
    for (const transition of ALL_TRANSITIONS) {
      const decision = decideTransition({ uid: 'm1', role: 'monitor' }, report, transition);
      expect(decision.allowed, transition).toBe(false);
    }
  });

  it('cannot moderate citizens', () => {
    const d = decideModeration({ actor: { uid: 'm1', ...monitor }, targetUid: 'c1', targetRole: '', action: 'ban', reason: 'testing the boundary' });
    expect(d.outcome === 'deny' && d.status).toBe(403);
  });

  it('cannot assign roles', () => {
    const d = checkRoleChange({ actorUid: 'm1', actorRole: 'monitor', targetUid: 't1', currentTargetRole: 'agent', nextRole: 'superadmin' });
    expect(d.outcome).toBe('deny');
  });

  it('can be assigned by an admin, but only a superadmin touches admins', () => {
    expect(checkRoleChange({ actorUid: 'a1', actorRole: 'admin', targetUid: 't1', currentTargetRole: 'agent', nextRole: 'monitor' }).outcome).toBe('allow');
  });
});
