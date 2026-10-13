import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  MAX_PAGE_SIZE,
  MUNICIPALITY_VISIBLE_STATUSES,
  REQUIRED_REPORT_INDEXES,
  REQUIRED_ASC_REPORT_INDEXES,
  decodeCursor,
  encodeCursor,
  parseReportListQuery,
  planReportQuery,
  presentReport,
  type Principal,
  type ReportListQuery,
} from '../../server/reportQuery';

const admin: Principal = { role: 'admin', municipality: '', permissions: [] };
const superadmin: Principal = { role: 'superadmin', municipality: '', permissions: [] };
const agent: Principal = { role: 'agent', municipality: '', permissions: [] };
const adsadmin: Principal = { role: 'adsadmin', municipality: '', permissions: [] };
const citizen: Principal = { role: 'citizen', municipality: '', permissions: [] };
const prizren: Principal = { role: 'municipality', municipality: 'Prizren', permissions: [] };

const q = (over: Partial<ReportListQuery> = {}): ReportListQuery => ({ limit: 25, ...over });

function plan(query: ReportListQuery, principal: Principal) {
  const result = planReportQuery(query, principal);
  if (result.ok === false) throw new Error(`refused: ${result.error}`);
  return result.plan;
}

describe('parseReportListQuery', () => {
  it('accepts an empty query with defaults', () => {
    const result = parseReportListQuery({});
    expect(result).toMatchObject({ ok: true, query: { limit: 25 } });
  });

  it('caps the page size and rejects nonsense', () => {
    expect((parseReportListQuery({ limit: '9999' }) as any).query.limit).toBe(MAX_PAGE_SIZE);
    for (const limit of ['0', '-3', 'abc', '1.5']) {
      expect(parseReportListQuery({ limit }).ok).toBe(false);
    }
  });

  it('rejects arrays and objects (parameter pollution) and unknown values', () => {
    expect(parseReportListQuery({ status: ['a', 'b'] }).ok).toBe(false);
    expect(parseReportListQuery({ municipality: { $ne: 'x' } }).ok).toBe(false);
    expect(parseReportListQuery({ status: 'DROP TABLE' }).ok).toBe(false);
    expect(parseReportListQuery({ urgency: 'whenever' }).ok).toBe(false);
    expect(parseReportListQuery({ municipality: 'x'.repeat(200) }).ok).toBe(false);
  });

  it('accepts a status tab key, a raw status and a valid urgency', () => {
    expect(parseReportListQuery({ status: 'unapproved' }).ok).toBe(true);
    expect(parseReportListQuery({ status: 'Assigned' }).ok).toBe(true);
    expect(parseReportListQuery({ urgency: 'Kritike' }).ok).toBe(true);
  });

  it('round-trips a cursor and rejects a forged one', () => {
    const cursor = { value: 1_760_000_000_000, id: 'abc123' };
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
    // A text date (legacy data) round-trips too.
    const text = { value: '2026-01-01T00:00:00.000Z', id: 'x' };
    expect(decodeCursor(encodeCursor(text))).toEqual(text);
    expect(parseReportListQuery({ cursor: encodeCursor(cursor) })).toMatchObject({ ok: true });
    expect(decodeCursor('not-base64-json')).toBeNull();
    expect(decodeCursor(Buffer.from('{"a":1}').toString('base64url'))).toBeNull();
    expect(decodeCursor(Buffer.from('[1]').toString('base64url'))).toBeNull();
    expect(decodeCursor(Buffer.from('[null,"y"]').toString('base64url'))).toBeNull();
    expect(decodeCursor(Buffer.from('[{},"y"]').toString('base64url'))).toBeNull();
    expect(decodeCursor(Buffer.from('["","y"]').toString('base64url'))).toBeNull();
    expect(parseReportListQuery({ cursor: '%%%' }).ok).toBe(false);
  });
});

describe('who may list reports at all (default deny)', () => {
  it('allows owner-level, agent and municipality roles', () => {
    for (const principal of [admin, superadmin, agent, prizren]) {
      expect(planReportQuery(q(), principal).ok).toBe(true);
    }
  });

  it('refuses a citizen, a guest and a role without the reports section', () => {
    for (const principal of [citizen, { ...citizen, role: 'guest' }, adsadmin, { ...citizen, role: '' }]) {
      const result = planReportQuery(q(), principal);
      expect(result.ok).toBe(false);
      if (result.ok === false) expect(result.status).toBe(403);
    }
  });

  it('lets a per-section grant open the list for a role that lacks it', () => {
    expect(planReportQuery(q(), { ...adsadmin, permissions: ['reports'] }).ok).toBe(true);
  });
});

describe('staff queries', () => {
  it('uses no filter at all for an unfiltered staff query', () => {
    expect(plan(q(), agent)).toMatchObject({ empty: false, where: [], indexKey: '' });
  });

  it('maps status tabs to equality or `in`', () => {
    expect(plan(q({ status: 'unapproved' }), agent).where).toEqual([{ field: 'status', op: '==', value: 'Pending Review' }]);
    expect(plan(q({ status: 'in-progress' }), agent).where).toEqual([
      { field: 'status', op: 'in', value: ['Approved', 'Assigned', 'In Progress'] },
    ]);
    expect(plan(q({ status: 'Assigned' }), agent).where).toEqual([{ field: 'status', op: '==', value: 'Assigned' }]);
  });

  it('lets staff filter by any municipality and urgency', () => {
    const p = plan(q({ municipality: 'Pejë', urgency: 'Kritike', status: 'resolved' }), admin);
    expect(p.where.map(w => w.field).sort()).toEqual(['location.municipality', 'status', 'urgency']);
  });
});

describe('municipality isolation', () => {
  it('pins a municipality to its own name even when it sends no filter', () => {
    const p = plan(q(), prizren);
    expect(p.where).toContainEqual({ field: 'location.municipality', op: '==', value: 'Prizren' });
  });

  it('limits an unfiltered municipality query to public-record statuses', () => {
    const p = plan(q(), prizren);
    const status = p.where.find(w => w.field === 'status')!;
    expect(status.op).toBe('in');
    expect([...(status.value as string[])].sort()).toEqual([...MUNICIPALITY_VISIBLE_STATUSES].sort());
  });

  it('refuses outright a request for another municipality', () => {
    const result = planReportQuery(q({ municipality: 'Prishtinë' }), prizren);
    expect(result.ok).toBe(false);
    if (result.ok === false) expect(result.status).toBe(403);
  });

  it('accepts a request for its own municipality', () => {
    expect(planReportQuery(q({ municipality: 'Prizren' }), prizren).ok).toBe(true);
  });

  it('returns nothing, not an error, for a status it may not see', () => {
    for (const status of ['unapproved', 'rejected', 'Pending Review', 'Draft']) {
      expect(plan(q({ status }), prizren).empty).toBe(true);
    }
  });

  it('narrows a mixed status group to the visible part', () => {
    const p = plan(q({ status: 'unresolved' }), prizren); // includes Pending Review
    const status = p.where.find(w => w.field === 'status')!;
    expect(status.value).not.toContain('Pending Review');
    expect(status.value).toContain('In Progress');
  });

  it('refuses a municipality account that has no municipality in its token', () => {
    const result = planReportQuery(q(), { ...prizren, municipality: '' });
    expect(result.ok).toBe(false);
  });

  it('cannot be widened by the client in any way', () => {
    // Whatever the client sends, a municipality plan always has its own equality.
    for (const status of [undefined, 'in-progress', 'resolved', 'overdue', 'Resolved']) {
      for (const urgency of [undefined, 'Kritike']) {
        const p = plan(q({ status, urgency }), prizren);
        if (p.empty) continue;
        expect(p.where).toContainEqual({ field: 'location.municipality', op: '==', value: 'Prizren' });
      }
    }
  });
});

describe('output', () => {
  const doc = {
    title: 'Gropa', status: 'Approved', authorId: 'u1', authorName: 'Arben', authorEmail: 'a@b.test',
    isAnonymous: false, createdAt: { toDate: () => new Date('2026-01-01T00:00:00.000Z') },
    timeline: [{ date: { toDate: () => new Date('2026-01-02T00:00:00.000Z') }, status: 'Approved' }],
  };

  it('converts timestamps (including nested ones) to ISO strings', () => {
    const out = presentReport('r1', doc, agent) as any;
    expect(out.id).toBe('r1');
    expect(out.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(out.timeline[0].date).toBe('2026-01-02T00:00:00.000Z');
  });

  it('keeps the reporter for staff and removes it for a municipality', () => {
    expect((presentReport('r1', doc, agent) as any).authorName).toBe('Arben');
    const forMunicipality = presentReport('r1', doc, prizren) as any;
    for (const field of ['authorId', 'authorName', 'authorEmail']) expect(forMunicipality).not.toHaveProperty(field);
    expect(forMunicipality.title).toBe('Gropa');
  });
});

describe('index coverage', () => {
  const declared = JSON.parse(readFileSync('firestore.indexes.json', 'utf8')).indexes as Array<{
    collectionGroup: string;
    fields: Array<{ fieldPath: string; order?: string }>;
  }>;

  it('has a composite index for every filter combination the planner can emit', () => {
    for (const equality of REQUIRED_REPORT_INDEXES) {
      const found = declared.some(index => {
        if (index.collectionGroup !== 'reports') return false;
        const fields = index.fields.map(f => f.fieldPath);
        const tail = index.fields[index.fields.length - 1];
        // Equality fields in any order, then createdAt descending.
        return (
          fields.length === equality.length + 1 &&
          fields[fields.length - 1] === 'createdAt' &&
          tail.order === 'DESCENDING' &&
          equality.every(field => fields.slice(0, -1).includes(field))
        );
      });
      expect(found, `missing reports index for [${equality.join(', ')}] + createdAt desc`).toBe(true);
    }
  });
});

describe('exact lookup by code', () => {
  it('accepts a tracking code or id and rejects anything else', () => {
    for (const code of ['ZQ-1042', 'zq_abc123', 'a1B2c3D4e5F6']) {
      expect(parseReportListQuery({ code }).ok, code).toBe(true);
    }
    for (const code of ['', 'x', 'a b', 'a/b', "a'; drop", 'x'.repeat(41), ['ZQ-1'], { a: 1 }]) {
      const result = parseReportListQuery({ code } as any);
      // An empty string means "no code"; everything else here must be refused.
      if (code === '') expect(result.ok).toBe(true);
      else expect(result.ok, JSON.stringify(code)).toBe(false);
    }
  });

  it('plans a lookup for staff and municipalities alike, ignoring list filters', () => {
    for (const principal of [agent, admin, prizren]) {
      const result = planReportQuery({ ...q(), code: 'ZQ-1042', status: 'resolved', municipality: undefined }, principal);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.plan).toMatchObject({ code: 'ZQ-1042', empty: false, where: [] });
    }
  });

  it('still applies default deny: a citizen cannot look anything up', () => {
    expect(planReportQuery({ ...q(), code: 'ZQ-1042' }, citizen).ok).toBe(false);
  });

  it('still refuses a municipality that names another municipality alongside the code', () => {
    const result = planReportQuery({ ...q(), code: 'ZQ-1042', municipality: 'Prishtinë' }, prizren);
    expect(result.ok).toBe(false);
  });
});

describe('the "working" status group', () => {
  it('means taken on or assigned, and a municipality may see it', () => {
    const parsed = parseReportListQuery({ status: 'working' });
    expect(parsed.ok).toBe(true);
    if (parsed.ok === false) return;
    const owner = planReportQuery(parsed.query, { role: 'superadmin', municipality: '', permissions: [] });
    expect(owner.ok && owner.plan.where).toEqual([{ field: 'status', op: 'in', value: ['Assigned', 'In Progress'] }]);
    const muni = planReportQuery(parsed.query, { role: 'municipality', municipality: 'Pejë', permissions: [] });
    expect(muni.ok && muni.plan.where.find(w => w.field === 'status')).toEqual({ field: 'status', op: 'in', value: ['Assigned', 'In Progress'] });
  });
});


describe('oldest first (the work inbox)', () => {
  const owner = { role: 'superadmin', municipality: '', permissions: [] as string[] };
  const plan = (raw: Record<string, unknown>, who = owner) => {
    const parsed = parseReportListQuery(raw);
    if (parsed.ok === false) return parsed;
    return planReportQuery(parsed.query, who);
  };

  it('is ascending only when asked, and only for filter shapes that have an ascending index', () => {
    const asc = plan({ status: 'unapproved', order: 'oldest' });
    expect(asc.ok && asc.plan.direction).toBe('asc');
    const desc = plan({ status: 'unapproved' });
    expect(desc.ok && desc.plan.direction).toBe('desc');
    const byMunicipality = plan({ status: 'unapproved', municipality: 'Pejë', order: 'oldest' });
    expect(byMunicipality.ok && byMunicipality.plan.direction).toBe('asc');
  });

  it('refuses the combinations it has no index for, and unknown orders', () => {
    expect(plan({ status: 'unapproved', urgency: 'Kritike', order: 'oldest' })).toMatchObject({ ok: false, status: 400 });
    expect(plan({ order: 'oldest' })).toMatchObject({ ok: false, status: 400 });
    expect(plan({ order: 'random' })).toMatchObject({ ok: false, status: 400 });
  });

  it('has an ascending composite index for every shape it offers', () => {
    const declared = JSON.parse(readFileSync('firestore.indexes.json', 'utf8')).indexes as Array<{
      collectionGroup: string;
      fields: Array<{ fieldPath: string; order?: string }>;
    }>;
    for (const equality of REQUIRED_ASC_REPORT_INDEXES) {
      const found = declared.some(index => {
        if (index.collectionGroup !== 'reports') return false;
        const fields = index.fields.map(f => f.fieldPath);
        const tail = index.fields[index.fields.length - 1];
        return fields.length === equality.length + 1 && fields[fields.length - 1] === 'createdAt' && tail.order === 'ASCENDING'
          && equality.every(field => fields.slice(0, -1).includes(field));
      });
      expect(found, `missing ASC reports index for [${equality.join(', ')}]`).toBe(true);
    }
  });
});
