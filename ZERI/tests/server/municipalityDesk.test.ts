import { describe, expect, it } from 'vitest';
import { decideMunicipalityRequest, type RequestInput } from '../../server/municipalityDesk';
import { availableActions, decide } from '../../src/lib/decisionRules';

const muni = { uid: 'k', role: 'municipality', municipality: 'Pejë' };
const report = { status: 'Approved', location: { municipality: 'Pejë' } };
const run = (patch: Partial<RequestInput>) =>
  decideMunicipalityRequest({ actor: muni, report, kind: 'respond', note: 'Ekipi del në terren nesër.', ...patch });

describe('decideMunicipalityRequest', () => {
  it('lets a municipality answer and file requests on its own approved reports', () => {
    expect(run({})).toMatchObject({ outcome: 'allow', kind: 'respond', publicNow: true });
    for (const kind of ['correct_fact', 'dispute', 'request_removal']) {
      expect(run({ kind }), kind).toMatchObject({ outcome: 'allow', publicNow: false });
    }
  });

  it('is only for municipal accounts with a municipality', () => {
    for (const role of ['agent', 'admin', 'superadmin', 'monitor', 'citizen']) {
      expect(run({ actor: { ...muni, role } }), role).toMatchObject({ outcome: 'deny', status: 403 });
    }
    expect(run({ actor: { ...muni, municipality: '' } })).toMatchObject({ outcome: 'deny', status: 403 });
  });

  it('tells a probe nothing: another municipality or an unapproved report is simply not found', () => {
    expect(run({ report: { status: 'Approved', location: { municipality: 'Gjilan' } } })).toMatchObject({ outcome: 'deny', status: 404 });
    expect(run({ report: { status: 'Pending Review', location: { municipality: 'Pejë' } } })).toMatchObject({ outcome: 'deny', status: 404 });
    expect(run({ report: { status: 'Rejected', location: { municipality: 'Pejë' } } })).toMatchObject({ outcome: 'deny', status: 404 });
    expect(run({ report: null })).toMatchObject({ outcome: 'deny', status: 404 });
  });

  it('refuses removing things: only the four constructive kinds exist', () => {
    for (const kind of ['delete_report', 'hide', 'edit', '', 5]) {
      expect(run({ kind }), String(kind)).toMatchObject({ outcome: 'deny', status: 400 });
    }
  });

  it('needs a real note of sensible length', () => {
    expect(run({ note: 'ok' })).toMatchObject({ outcome: 'deny', status: 400 });
    expect(run({ note: 'x'.repeat(1201) })).toMatchObject({ outcome: 'deny', status: 400 });
    expect(run({ note: 42 })).toMatchObject({ outcome: 'deny', status: 400 });
  });
});

describe('municipalityRequest decisions', () => {
  const owner = { uid: 'o', role: 'superadmin', municipality: '', permissions: [] as string[] };
  it('staff accept or decline (decline needs the reason the municipality will read)', () => {
    expect(availableActions('muniRequest', { status: 'pending' }, owner).map(a => a.action)).toEqual(['accept', 'decline']);
    expect(decide({ actor: owner, kind: 'muniRequest', action: 'decline', reason: '', doc: { status: 'pending' } })).toMatchObject({ outcome: 'deny', status: 400 });
    expect(decide({ actor: owner, kind: 'muniRequest', action: 'decline', reason: 'Faktet nuk korrigjohen', doc: { status: 'pending' } }).outcome).toBe('allow');
  });

  it('a municipality can never decide its own request', () => {
    const muni2 = { uid: 'k', role: 'municipality', municipality: 'Pejë', permissions: [] as string[] };
    expect(decide({ actor: muni2, kind: 'muniRequest', action: 'accept', reason: '', doc: { status: 'pending', municipality: 'Pejë' } })).toMatchObject({ outcome: 'deny', status: 403 });
  });
});
