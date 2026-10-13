import { describe, expect, it } from 'vitest';
import { DECISION_KINDS, decide, patchFor } from '../../src/lib/decisionRules';
import {
  ALL_STAGES,
  EDGES,
  docStage,
  hasMunicipalResponse,
  pipelineRoleFor,
  planDocMove,
  planPath,
  planReportMove,
  reportStage,
  type DocBoardKind,
  type StageKey,
} from '../../src/lib/workflowStages';

const owner = { uid: 'o', role: 'superadmin', municipality: '', permissions: [] as string[] };
const now = '2026-10-12T00:00:00.000Z';

/** A record of each kind sitting on a given stage, built the way the decisions write them. */
function sample(kind: DocBoardKind, stage: StageKey): Record<string, any> | null {
  const sub = (value: string) => ({ workflowStage: value });
  switch (kind) {
    case 'donation':
      return {
        reported: { status: 'pending' },
        approved: { status: 'approved' },
        waiting: { status: 'approved', ...sub('waiting') },
        responded: { status: 'approved', ...sub('responded') },
        completed: { status: 'approved', ...sub('completed') },
        rejected: { status: 'rejected' },
      }[stage];
    case 'health':
      return {
        reported: { status: 'pending' },
        approved: { status: 'verified' },
        waiting: { status: 'verified', ...sub('waiting') },
        responded: { status: 'verified', ...sub('responded') },
        completed: { status: 'resolved' },
        rejected: { status: 'rejected' },
      }[stage];
    case 'news':
      return {
        reported: { published: false, status: 'Draft' },
        approved: { published: false, status: 'Draft', ...sub('approved') },
        waiting: { published: false, status: 'Draft', ...sub('waiting') },
        responded: { published: false, status: 'Draft', ...sub('responded') },
        completed: { published: true, status: 'Published' },
        rejected: { published: false, status: 'Rejected' },
      }[stage];
  }
}

describe('docStage', () => {
  it('reads every sample on the stage it was built for', () => {
    for (const kind of ['donation', 'health', 'news'] as const) {
      for (const stage of ALL_STAGES) {
        const doc = sample(kind, stage);
        if (doc) expect(docStage(kind, doc), `${kind}/${stage}`).toBe(stage);
      }
    }
  });

  it('puts a record with no status in the first stage', () => {
    expect(docStage('donation', {})).toBe('reported');
    expect(docStage('health', {})).toBe('reported');
    expect(docStage('news', {})).toBe('reported');
  });

  it('ignores a stale sub-stage once the public status says the record is done or refused', () => {
    expect(docStage('donation', { status: 'rejected', workflowStage: 'waiting' })).toBe('rejected');
    expect(docStage('health', { status: 'resolved', workflowStage: 'waiting' })).toBe('completed');
    expect(docStage('news', { published: true, workflowStage: 'waiting' })).toBe('completed');
    expect(docStage('donation', { status: 'pending', workflowStage: 'completed' })).toBe('reported');
  });
});

describe('the edge tables agree with the decision tables', () => {
  // The contract: take a record on `from`, run the action's real patch, and it must read
  // as `to`; and the real `decide()` must allow it for the owner. If either table is
  // edited without the other, this fails.
  for (const kind of ['donation', 'health', 'news'] as const) {
    for (const edge of EDGES[kind]) {
      it(`${kind}: ${edge.action} -> ${edge.to}`, () => {
        expect(DECISION_KINDS[kind].actions[edge.action], 'the action exists').toBeTruthy();
        for (const from of edge.from) {
          const doc = sample(kind, from);
          expect(doc, `${kind} has a ${from} sample`).toBeTruthy();
          const needsReason = !!DECISION_KINDS[kind].actions[edge.action].needsReason;
          const verdict = decide({ actor: owner, kind, action: edge.action, reason: needsReason ? 'arsye e vlefshme' : '', doc });
          expect(verdict.outcome, `${kind}: ${edge.action} from ${from}`).toBe('allow');
          const after = { ...doc, ...patchFor(kind, edge.action, now, { reason: 'arsye e vlefshme', campaignId: '' }) };
          expect(docStage(kind, after), `${kind}: ${edge.action} from ${from}`).toBe(edge.to);
        }
      });
    }
  }
});

describe('planPath', () => {
  it('is empty when the record is already there', () => {
    expect(planPath('donation', 'approved', 'approved')).toEqual([]);
  });

  it('chains actions when one is not enough', () => {
    expect(planPath('donation', 'reported', 'waiting')).toEqual(['approve', 'stage_waiting']);
    expect(planPath('health', 'reported', 'completed')).toEqual(['approve', 'resolve']);
    expect(planPath('health', 'completed', 'approved')).toEqual(['reopen', 'approve']);
    expect(planPath('news', 'completed', 'approved')).toEqual(['unpublish', 'stage_approved']);
  });

  it('takes the direct action when there is one', () => {
    expect(planPath('news', 'reported', 'completed')).toEqual(['publish']);
    expect(planPath('donation', 'waiting', 'completed')).toEqual(['stage_completed']);
  });

  it('never goes through a refusal on the way to somewhere else', () => {
    for (const kind of ['donation', 'health', 'news'] as const) {
      for (const from of ALL_STAGES) {
        for (const to of ALL_STAGES) {
          if (to === 'rejected') continue;
          const path = planPath(kind, from, to);
          expect(path === null || !path.slice(0, -1).includes('reject'), `${kind} ${from}->${to}`).toBe(true);
          expect(path === null || !path.includes('reject'), `${kind} ${from}->${to}`).toBe(true);
        }
      }
    }
  });

  it('reaches every stage from every other stage', () => {
    for (const kind of ['donation', 'health', 'news'] as const) {
      const stages = ALL_STAGES.filter(stage => sample(kind, stage));
      for (const from of stages) {
        for (const to of stages) {
          if (from === to) continue;
          expect(planPath(kind, from, to), `${kind} ${from}->${to}`).not.toBeNull();
        }
      }
    }
    expect(planPath('donation', 'rejected', 'completed')).toEqual(['approve', 'stage_completed']);
    expect(planPath('health', 'rejected', 'completed')).toEqual(['approve', 'resolve']);
    expect(planPath('news', 'rejected', 'waiting')).toEqual(['reopen', 'stage_waiting']);
  });
});

describe('planDocMove', () => {
  it('plans a chain the owner may run and says when a reason is needed', () => {
    expect(planDocMove('donation', sample('donation', 'reported')!, 'waiting', owner)).toEqual({
      ok: true, actions: ['approve', 'stage_waiting'], needsReason: false,
    });
    expect(planDocMove('news', sample('news', 'reported')!, 'rejected', owner)).toEqual({
      ok: true, actions: ['reject'], needsReason: true,
    });
    expect(planDocMove('news', sample('news', 'completed')!, 'waiting', owner)).toMatchObject({
      ok: true, actions: ['unpublish', 'stage_waiting'], needsReason: true,
    });
  });

  it('refuses a move to where the record already is', () => {
    expect(planDocMove('health', sample('health', 'approved')!, 'approved', owner)).toMatchObject({ ok: false });
  });

  it('refuses what the person has no access to', () => {
    const agent = { uid: 'a', role: 'agent', municipality: '', permissions: ['donations'] };
    expect(planDocMove('donation', sample('donation', 'reported')!, 'approved', agent)).toMatchObject({ ok: true });
    // A responder has reports and the debate, but neither donations nor news.
    expect(planDocMove('news', sample('news', 'reported')!, 'approved', { ...agent, role: 'responder', permissions: [] })).toMatchObject({ ok: false });
    expect(planDocMove('donation', sample('donation', 'reported')!, 'approved', { ...agent, role: 'responder', permissions: [] })).toMatchObject({ ok: false });
    expect(planDocMove('donation', sample('donation', 'reported')!, 'approved', { ...agent, role: 'monitor' })).toMatchObject({ ok: false });
  });

  it('lets a municipality move only its own health cases, and never refuse one', () => {
    const muni = { uid: 'k', role: 'municipality', municipality: 'Prishtinë', permissions: [] as string[] };
    const own = (stage: StageKey) => ({ ...sample('health', stage)!, municipality: 'Prishtinë' });
    expect(planDocMove('health', own('reported'), 'approved', muni)).toMatchObject({ ok: true });
    expect(planDocMove('health', own('approved'), 'waiting', muni)).toMatchObject({ ok: true });
    expect(planDocMove('health', own('waiting'), 'responded', muni)).toMatchObject({ ok: true });
    expect(planDocMove('health', own('responded'), 'completed', muni)).toMatchObject({ ok: true });
    expect(planDocMove('health', own('reported'), 'rejected', muni)).toMatchObject({ ok: false });
    expect(planDocMove('health', { ...own('reported'), municipality: 'Gjilan' }, 'approved', muni)).toMatchObject({ ok: false });
    expect(planDocMove('donation', sample('donation', 'reported')!, 'approved', muni)).toMatchObject({ ok: false });
  });
});

describe('reports', () => {
  const report = (status: string, extra: Record<string, any> = {}) =>
    ({ status, timeline: [], ...extra }) as any;
  const answered = { timeline: [{ id: 't', status: 'In Progress', comment: 'U nis pastrimi.', date: now, updatedBy: 'Komuna' }] };

  it('maps each status onto a stage', () => {
    expect(reportStage(report('Pending Review'))).toBe('reported');
    expect(reportStage(report('Draft'))).toBe('reported');
    expect(reportStage(report('Approved'))).toBe('approved');
    expect(reportStage(report('In Progress'))).toBe('waiting');
    expect(reportStage(report('Assigned'))).toBe('waiting');
    expect(reportStage(report('Overdue'))).toBe('waiting');
    expect(reportStage(report('In Progress', answered))).toBe('responded');
    expect(reportStage(report('Resolved'))).toBe('completed');
    expect(reportStage(report('Rejected'))).toBe('rejected');
  });

  it('counts only a written municipal note as a response', () => {
    expect(hasMunicipalResponse(report('In Progress', { timeline: [{ status: 'In Progress', comment: '   ' }] }))).toBe(false);
    expect(hasMunicipalResponse(report('In Progress', { timeline: [{ status: 'Approved', comment: 'ok' }] }))).toBe(false);
    expect(hasMunicipalResponse(report('In Progress', answered))).toBe(true);
  });

  it('knows the pipeline roles the way the server does', () => {
    expect(pipelineRoleFor('superadmin')).toBe('staff');
    expect(pipelineRoleFor('admin')).toBe('staff');
    expect(pipelineRoleFor('approver')).toBe('agent');
    expect(pipelineRoleFor('municipality')).toBe('municipality');
    expect(pipelineRoleFor('citizen')).toBeNull();
    expect(pipelineRoleFor('citizen', ['agents'])).toBe('agent');
  });

  const complete = {
    description: 'Gropë e madhe në mes të rrugës, rrezik për makina.',
    category: 'Infrastrukturë',
    images: ['a.jpg'],
    location: { municipality: 'Prishtinë', address: 'Rr. Nëna Terezë' },
  };

  it('lets the owner approve a complete report and refuse with a note', () => {
    expect(planReportMove(report('Pending Review', complete), 'approved', 'staff')).toMatchObject({ ok: true, transition: 'pass_to_municipality' });
    expect(planReportMove(report('Pending Review', complete), 'rejected', 'staff')).toMatchObject({ ok: true, transition: 'reject', note: 'required' });
  });

  it('explains why an incomplete report cannot be passed on', () => {
    const plan = planReportMove(report('Pending Review', { ...complete, images: [] }), 'approved', 'agent');
    expect(plan.ok).toBe(false);
    if (plan.ok === false) expect(plan.reason).toContain('foto');
  });

  it('keeps the municipality\'s steps with the municipality', () => {
    const plan = planReportMove(report('Approved', complete), 'waiting', 'staff');
    expect(plan.ok).toBe(false);
    if (plan.ok === false) expect(plan.reason).toContain('komuna');
    expect(planReportMove(report('Approved', complete), 'waiting', 'municipality')).toMatchObject({ ok: true, transition: 'municipality_accept', note: 'none' });
  });

  it('answers by accepting with a note, and closes only after facts exist', () => {
    expect(planReportMove(report('Approved', complete), 'responded', 'municipality')).toMatchObject({ ok: true, transition: 'municipality_accept', note: 'required' });
    expect(planReportMove(report('In Progress', complete), 'responded', 'municipality')).toMatchObject({ ok: false });
    expect(planReportMove(report('In Progress', complete), 'completed', 'municipality')).toMatchObject({ ok: false });
    expect(planReportMove(report('In Progress', { ...complete, ...answered }), 'completed', 'municipality')).toMatchObject({ ok: true, transition: 'municipality_done', note: 'optional' });
  });

  it('does not offer a way back to "Raportuar" and refuses an account with no role', () => {
    expect(planReportMove(report('Approved', complete), 'reported', 'staff')).toMatchObject({ ok: false });
    expect(planReportMove(report('Pending Review', complete), 'approved', null)).toMatchObject({ ok: false });
  });

  it('refuses a report that is already there', () => {
    expect(planReportMove(report('Approved', complete), 'approved', 'staff')).toMatchObject({ ok: false });
  });
});
