import { describe, expect, it } from 'vitest';
import { actingUser, permissionsFromClaims } from '../../server/auth';
import { decideTransition } from '../../server/approvalPipeline';

/**
 * Authority must come from verified token claims only. The profile document is
 * client-writable, so nothing stored there may influence these decisions.
 */

const submittedReport = { status: 'Pending Review', location: { municipality: 'Prishtinë' } };

function requestFor(claims: Record<string, unknown>, role = 'citizen') {
  return { user: { uid: 'u1', email: 'u1@example.test', role, claims } };
}

describe('actingUser', () => {
  it('reads the municipality from the token claims', () => {
    const actor = actingUser(requestFor({ role: 'municipality', municipality: 'Prizren' }, 'municipality'));
    expect(actor.municipality).toBe('Prizren');
    expect(actor.role).toBe('municipality');
  });

  it('has no municipality when the claim is absent', () => {
    expect(actingUser(requestFor({})).municipality).toBe('');
  });

  it('derives permissions only from perm_* claims set to true', () => {
    expect(permissionsFromClaims({ perm_agents: true, perm_reports: false, role: 'agent', permissions: ['x'] }))
      .toEqual(['agents']);
  });

  it('defaults to the citizen role', () => {
    expect(actingUser({}).role).toBe('citizen');
  });
});

describe('decideTransition — privilege escalation', () => {
  it('denies a citizen with no claims', () => {
    const actor = actingUser(requestFor({}));
    const decision = decideTransition(actor, submittedReport, 'claim');
    expect(decision.allowed).toBe(false);
    expect(decision.code).toBe('NO_STANDING');
  });

  it('gives a self-written profile permissions array no path into the decision', () => {
    // The old endpoint fed `users/{uid}.permissions` into the decision. The actor
    // is now built from claims, so a profile value cannot reach it.
    const actor = actingUser(requestFor({}));
    expect(actor.permissions).toEqual([]);
    expect(decideTransition(actor, submittedReport, 'claim').allowed).toBe(false);
  });

  it('allows an agent provisioned with the perm_agents claim', () => {
    const actor = actingUser(requestFor({ role: 'dispatcher', perm_agents: true }, 'dispatcher'));
    expect(decideTransition(actor, submittedReport, 'claim').allowed).toBe(true);
  });

  it('denies a municipality account acting outside its claimed municipality', () => {
    const actor = actingUser(requestFor({ role: 'municipality', municipality: 'Gjilan' }, 'municipality'));
    const report = { status: 'Approved', assignedTo: 'x', location: { municipality: 'Prishtinë' } };
    const decision = decideTransition(actor, report, 'municipality_accept');
    expect(decision.allowed).toBe(false);
  });

  it('denies a municipality account that has no municipality claim', () => {
    const actor = actingUser(requestFor({ role: 'municipality' }, 'municipality'));
    const report = { status: 'Approved', location: { municipality: 'Prishtinë' } };
    expect(decideTransition(actor, report, 'municipality_accept').allowed).toBe(false);
  });
});

describe('decideTransition - the owner does the agents\' work', () => {
  const claimable = { status: 'Pending Review', location: { municipality: 'Prishtinë' } };

  it('lets an admin and a superadmin take an agent step, marked as on the agent\'s behalf', () => {
    for (const role of ['admin', 'superadmin']) {
      const actor = actingUser(requestFor({ role }, role));
      const decision = decideTransition(actor, claimable, 'claim');
      expect(decision.allowed, role).toBe(true);
      expect(decision.onBehalfOf, role).toBe('agent');
    }
  });

  it('does not mark an agent\'s own step as on behalf of anyone', () => {
    const actor = actingUser(requestFor({ role: 'agent' }, 'agent'));
    const decision = decideTransition(actor, claimable, 'claim');
    expect(decision.allowed).toBe(true);
    expect(decision.onBehalfOf).toBeUndefined();
  });

  it('still keeps the municipality\'s steps with the municipality', () => {
    const actor = actingUser(requestFor({ role: 'superadmin' }, 'superadmin'));
    const report = { status: 'Approved', assignedTo: 'x', location: { municipality: 'Prishtinë' } };
    const decision = decideTransition(actor, report, 'municipality_accept');
    expect(decision.allowed).toBe(false);
    expect(decision.code).toBe('WRONG_ROLE');
  });

  it('does not let an agent take the owner\'s steps', () => {
    const actor = actingUser(requestFor({ role: 'agent' }, 'agent'));
    const report = { status: 'Resolved', assignedTo: 'x', timeline: [{ status: 'In Progress', comment: 'u rregullua' }], location: { municipality: 'Prishtinë' } };
    expect(decideTransition(actor, report, 'staff_verify').allowed).toBe(false);
  });
});
