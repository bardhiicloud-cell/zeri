import { describe, expect, it } from 'vitest';
import { decideStaffRemoval, type RemovalInput } from '../../server/staffRemoval';

const base: RemovalInput = {
  actor: { uid: 'owner', role: 'superadmin' },
  targetUid: 'agent-1',
  targetRole: 'agent',
  targetEmail: 'agent@zeri.test',
  reason: 'Ka lënë punën',
  confirmEmail: 'agent@zeri.test',
};
const run = (patch: Partial<RemovalInput>) => decideStaffRemoval({ ...base, ...patch });

describe('decideStaffRemoval', () => {
  it('lets an owner remove an agent or a municipal account with a reason and the typed email', () => {
    expect(run({}).outcome).toBe('allow');
    expect(run({ targetRole: 'municipality' }).outcome).toBe('allow');
    expect(run({ targetRole: 'monitor' }).outcome).toBe('allow');
  });

  it('refuses everyone who is not an owner', () => {
    for (const role of ['agent', 'monitor', 'municipality', 'citizen', '']) {
      expect(run({ actor: { uid: 'x', role } }), role).toMatchObject({ outcome: 'deny', status: 403 });
    }
  });

  it('refuses removing yourself', () => {
    expect(run({ targetUid: 'owner' })).toMatchObject({ outcome: 'deny', status: 400 });
  });

  it('never removes a superadmin, and only a superadmin removes an admin', () => {
    expect(run({ targetRole: 'superadmin' })).toMatchObject({ outcome: 'deny', status: 403 });
    expect(run({ actor: { uid: 'a', role: 'admin' }, targetRole: 'admin' })).toMatchObject({ outcome: 'deny', status: 403 });
    expect(run({ targetRole: 'admin' }).outcome).toBe('allow');
  });

  it('leaves citizens to the moderation route', () => {
    expect(run({ targetRole: '' })).toMatchObject({ outcome: 'deny', status: 403 });
    expect(run({ targetRole: 'citizen' })).toMatchObject({ outcome: 'deny', status: 403 });
  });

  it('needs a reason of sensible length', () => {
    expect(run({ reason: '' })).toMatchObject({ outcome: 'deny', status: 400 });
    expect(run({ reason: 'ok' })).toMatchObject({ outcome: 'deny', status: 400 });
    expect(run({ reason: 'x'.repeat(301) })).toMatchObject({ outcome: 'deny', status: 400 });
    expect(run({ reason: 42 })).toMatchObject({ outcome: 'deny', status: 400 });
  });

  it('needs the account email retyped, ignoring case and spaces', () => {
    expect(run({ confirmEmail: '' })).toMatchObject({ outcome: 'deny', status: 400 });
    expect(run({ confirmEmail: 'other@zeri.test' })).toMatchObject({ outcome: 'deny', status: 400 });
    expect(run({ confirmEmail: '  AGENT@zeri.test ' }).outcome).toBe('allow');
    expect(run({ targetEmail: '', confirmEmail: '' })).toMatchObject({ outcome: 'deny', status: 400 });
  });
});
