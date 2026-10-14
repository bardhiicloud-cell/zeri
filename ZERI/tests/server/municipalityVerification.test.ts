import { describe, expect, it } from 'vitest';
import { decideTransition, stageOf } from '../../server/approvalPipeline';
import { stageOf as clientStageOf, TRANSITIONS as CLIENT_TRANSITIONS } from '../../src/lib/approvalPipeline';
import { TRANSITIONS } from '../../server/approvalPipeline';

/**
 * A municipality claims; the platform verifies. "Punimet u kryen" must never close a
 * report by itself: it leaves it In Progress, marked as claimed, until staff confirm it
 * (Resolved) or send it back with a reason.
 */
const municipality = { uid: 'mun1', role: 'municipality', municipality: 'Prishtinë', permissions: [] };
const neighbour = { uid: 'mun2', role: 'municipality', municipality: 'Prizren', permissions: [] };
const staff = { uid: 'boss', role: 'admin', permissions: [] };
const agent = { uid: 'ag1', role: 'agent', permissions: [] };

const working = {
  status: 'In Progress', assignedTo: 'x', location: { municipality: 'Prishtinë' },
  timeline: [{ status: 'In Progress', comment: 'U shtrua asfalti, 12 tetor, ekipi i mirëmbajtjes' }],
};
const claimed = { ...working, resolutionClaimed: true };

describe('a municipality claims the work is done', () => {
  it('leaves the report In Progress and moves it to "responded", not Resolved', () => {
    const decision = decideTransition(municipality, working, 'municipality_done');
    expect(decision).toMatchObject({ allowed: true, toStatus: 'In Progress' });
    expect(stageOf(claimed)).toBe('responded');
    expect(clientStageOf(claimed as never)).toBe('responded');
    expect(stageOf(working)).toBe('responding');
  });

  it('still needs a description of the work first', () => {
    expect(decideTransition(municipality, { ...working, timeline: [] }, 'municipality_done').allowed).toBe(false);
  });

  it('cannot claim twice, and cannot verify or return its own claim', () => {
    expect(decideTransition(municipality, claimed, 'municipality_done').allowed).toBe(false);
    expect(decideTransition(municipality, claimed, 'staff_verify').allowed).toBe(false);
    expect(decideTransition(municipality, claimed, 'staff_return').allowed).toBe(false);
  });

  it('cannot claim a neighbouring municipality\'s report', () => {
    expect(decideTransition(neighbour, working, 'municipality_done').allowed).toBe(false);
  });
});

describe('the platform verifies or returns the claim', () => {
  it('staff verification is the only way to Resolved', () => {
    expect(decideTransition(staff, claimed, 'staff_verify')).toMatchObject({ allowed: true, toStatus: 'Resolved' });
    expect(decideTransition(agent, claimed, 'staff_verify').allowed).toBe(false);
  });

  it('staff can send an unconfirmed claim back, and only a claimed one', () => {
    expect(decideTransition(staff, claimed, 'staff_return')).toMatchObject({ allowed: true, toStatus: 'In Progress' });
    expect(decideTransition(staff, working, 'staff_return').allowed).toBe(false);
  });

  it('returning requires a reason the municipality can read', () => {
    expect(TRANSITIONS.find(rule => rule.transition === 'staff_return')?.requiresNote).toBe(true);
  });
});

describe('the client draws the same table', () => {
  it('has the same transitions, sources and target statuses as the server', () => {
    const shape = (rules: ReadonlyArray<{ transition: string; by: string; from: readonly string[]; toStatus: string }>) =>
      rules.map(rule => `${rule.transition}|${rule.by}|${[...rule.from].sort().join(',')}|${rule.toStatus}`).sort();
    expect(shape(CLIENT_TRANSITIONS)).toEqual(shape(TRANSITIONS));
  });
});
