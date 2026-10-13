import { describe, expect, it } from 'vitest';
import { decideEscalation, decideNote, decideProvideInfo, decideRequestInfo, type CaseActor } from '../../server/reportCase';
import { decideTransition } from '../../server/approvalPipeline';
import { parseReportListQuery, planReportQuery, REQUIRED_REPORT_INDEXES } from '../../server/reportQuery';

const owner: CaseActor = { uid: 'o', role: 'superadmin', permissions: [] };
const agent: CaseActor = { uid: 'a', role: 'agent', permissions: [] };
const review = { status: 'Pending Review', authorId: 'citizen-1' };
const Q = 'A mund të dërgoni një foto më të qartë të gropës?';

describe('decideRequestInfo', () => {
  it('lets staff and agents ask about a report still in review', () => {
    expect(decideRequestInfo(owner, review, Q)).toEqual({ outcome: 'allow', text: Q });
    expect(decideRequestInfo(agent, review, Q).outcome).toBe('allow');
  });

  it('refuses everyone else', () => {
    for (const role of ['monitor', 'municipality', 'citizen', '']) {
      expect(decideRequestInfo({ uid: 'x', role, permissions: [] }, review, Q), role).toMatchObject({ outcome: 'deny', status: 403 });
    }
  });

  it('asks only while the report is being reviewed, and only once at a time', () => {
    for (const status of ['Approved', 'Rejected', 'Resolved', 'In Progress']) {
      expect(decideRequestInfo(owner, { ...review, status }, Q), status).toMatchObject({ outcome: 'deny', status: 409 });
    }
    expect(decideRequestInfo(owner, { ...review, awaitingInfo: true }, Q)).toMatchObject({ outcome: 'deny', status: 409 });
  });

  it('needs someone to ask, and a real question', () => {
    expect(decideRequestInfo(owner, null, Q)).toMatchObject({ outcome: 'deny', status: 404 });
    expect(decideRequestInfo(owner, { status: 'Pending Review' }, Q)).toMatchObject({ outcome: 'deny', status: 409 });
    for (const bad of ['', 'ok', 'x'.repeat(601), 7]) expect(decideRequestInfo(owner, review, bad), String(bad)).toMatchObject({ outcome: 'deny', status: 400 });
  });
});

describe('decideProvideInfo', () => {
  const asked = { ...review, awaitingInfo: true };
  it('lets only the person who filed the report answer, and only when asked', () => {
    expect(decideProvideInfo({ uid: 'citizen-1' }, asked, 'Ja një foto e re.').outcome).toBe('allow');
    expect(decideProvideInfo({ uid: 'citizen-1' }, review, 'Ja një foto e re.')).toMatchObject({ outcome: 'deny', status: 409 });
  });

  it('makes someone else\'s report look like it does not exist, even for staff', () => {
    for (const uid of ['citizen-2', '', 'o', 'a']) {
      expect(decideProvideInfo({ uid }, asked, 'Ja një foto e re.'), uid).toMatchObject({ outcome: 'deny', status: 404 });
    }
    expect(decideProvideInfo({ uid: 'citizen-1' }, null, 'Ja një foto e re.')).toMatchObject({ outcome: 'deny', status: 404 });
  });

  it('limits the answer', () => {
    expect(decideProvideInfo({ uid: 'citizen-1' }, asked, 'jo')).toMatchObject({ outcome: 'deny', status: 400 });
    expect(decideProvideInfo({ uid: 'citizen-1' }, asked, 'x'.repeat(1201))).toMatchObject({ outcome: 'deny', status: 400 });
  });
});

describe('internal notes and escalation', () => {
  it('notes are for staff and agents only', () => {
    expect(decideNote(agent, review, 'Duket i dyshimtë, kontrolloni.').outcome).toBe('allow');
    for (const role of ['monitor', 'municipality', 'citizen']) expect(decideNote({ uid: 'x', role, permissions: [] }, review, 'Duket i dyshimtë.'), role).toMatchObject({ outcome: 'deny', status: 403 });
    expect(decideNote(agent, null, 'Duket i dyshimtë.')).toMatchObject({ outcome: 'deny', status: 404 });
    expect(decideNote(agent, review, 'x'.repeat(1001))).toMatchObject({ outcome: 'deny', status: 400 });
  });

  it('an agent escalates with a reason; only the owner resolves it', () => {
    expect(decideEscalation(agent, review, 'escalate', 'Rrezik për jetën, duhet vendim i shpejtë.').outcome).toBe('allow');
    expect(decideEscalation(agent, { ...review, escalated: true }, 'resolve', 'U zgjidh.')).toMatchObject({ outcome: 'deny', status: 403 });
    expect(decideEscalation(owner, { ...review, escalated: true }, 'resolve', 'U zgjidh.').outcome).toBe('allow');
  });

  it('refuses a double escalation, resolving what is not escalated, and a missing reason', () => {
    expect(decideEscalation(agent, { ...review, escalated: true }, 'escalate', 'Rrezik për jetën.')).toMatchObject({ outcome: 'deny', status: 409 });
    expect(decideEscalation(owner, review, 'resolve', 'U zgjidh.')).toMatchObject({ outcome: 'deny', status: 409 });
    expect(decideEscalation(agent, review, 'escalate', '')).toMatchObject({ outcome: 'deny', status: 400 });
    expect(decideEscalation({ uid: 'x', role: 'municipality', permissions: [] }, review, 'escalate', 'Rrezik për jetën.')).toMatchObject({ outcome: 'deny', status: 403 });
  });
});

describe('the two flag lists', () => {
  const plan = (raw: Record<string, unknown>, role = 'agent') => {
    const parsed = parseReportListQuery(raw);
    if (parsed.ok === false) return parsed;
    return planReportQuery(parsed.query, { uid: 'u', role, municipality: role === 'municipality' ? 'Pejë' : '', permissions: [] });
  };

  it('filters on the flag alone, and has an index for it', () => {
    const awaiting = plan({ flag: 'awaitingInfo' });
    expect(awaiting.ok && awaiting.plan.where).toEqual([{ field: 'awaitingInfo', op: '==', value: true }]);
    expect(REQUIRED_REPORT_INDEXES.some(f => f.length === 1 && f[0] === 'escalated')).toBe(true);
    expect(REQUIRED_REPORT_INDEXES.some(f => f.length === 1 && f[0] === 'awaitingInfo')).toBe(true);
  });

  it('refuses any other filter beside it, an unknown flag, and a municipality', () => {
    expect(plan({ flag: 'escalated', status: 'unapproved' })).toMatchObject({ ok: false, status: 400 });
    expect(plan({ flag: 'secret' })).toMatchObject({ ok: false, status: 400 });
    expect(plan({ flag: 'escalated' }, 'municipality')).toMatchObject({ ok: false, status: 403 });
  });
});

describe('a report waiting for the citizen cannot be passed on', () => {
  const complete = {
    status: 'Pending Review', assignedTo: 'Agjenti', title: 'Gropë', description: 'Gropë e thellë në rrugë, rrezik për automjetet.',
    category: 'Rrugë', location: { municipality: 'Pejë', address: 'Rr. Bajram Curri', lat: 42.6, lng: 20.3 }, images: ['https://x/a.jpg'], media: [{ type: 'image', url: 'https://x/a.jpg' }],
    urgency: 'E lartë', responsibleInstitution: 'Drejtoria e Infrastrukturës',
  };
  const actor = { uid: 'a', role: 'agent', municipality: '', permissions: [] as string[] };

  it('refuses "pass to municipality" while awaiting information, and says why', () => {
    const decision = decideTransition(actor, { ...complete, awaitingInfo: true }, 'pass_to_municipality');
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('përgjigjen e qytetarit');
  });

  it('still lets the reviewer reject it with a reason', () => {
    expect(decideTransition({ ...actor, role: 'superadmin' }, { ...complete, awaitingInfo: true }, 'reject').allowed).toBe(true);
  });
});
