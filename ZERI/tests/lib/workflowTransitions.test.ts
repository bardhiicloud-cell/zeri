import { describe, expect, it } from 'vitest';
import { WORKFLOWS, WORK_KINDS, isTerminalState, transitionsFrom, type TransitionDef, type WorkKind } from '../../src/lib/workflow/definitions';
import { availableActions, decideTransition, workRolesOf, type WorkActor, type WorkItemFacts } from '../../src/lib/workflow/transition';

const actors = {
  admin: { uid: 'admin1', role: 'admin' } as WorkActor,
  owner: { uid: 'owner1', role: 'superadmin' } as WorkActor,
  dispatcher: { uid: 'disp1', role: 'dispatcher' } as WorkActor,
  monitor: { uid: 'mon1', role: 'monitor' } as WorkActor,
  agentA: { uid: 'agentA', role: 'agent' } as WorkActor,
  agentB: { uid: 'agentB', role: 'agent' } as WorkActor,
  peja: { uid: 'peja1', role: 'municipality', municipality: 'Pejë' } as WorkActor,
  gjilan: { uid: 'gji1', role: 'municipality', municipality: 'Gjilan' } as WorkActor,
  moderator: { uid: 'mod1', role: 'debatwp' } as WorkActor,
  moderator2: { uid: 'mod2', role: 'debatwp' } as WorkActor,
  citizen: { uid: 'cit1', role: 'citizen' } as WorkActor,
  stranger: { uid: 'x', role: 'guest' } as WorkActor,
};

/** An actor who holds the role a transition names, and who is the assignee when it must be. */
function actorFor(def: TransitionDef, kind: WorkKind): WorkActor {
  const role = def.roles[0];
  if (role === 'manager') return actors.admin;
  if (role === 'agent') return { ...actors.agentA };
  if (role === 'municipality') return actors.peja;
  if (role === 'moderator') return kind === 'moderation_case' ? actors.moderator : actors.admin;
  return actors.citizen;
}

function itemFor(kind: WorkKind, status: string, def: TransitionDef, actor: WorkActor): WorkItemFacts {
  return {
    kind, status,
    assigneeUid: def.assigneeOnly ? actor.uid : 'someone-else',
    municipality: 'Pejë',
    subjectUid: actors.citizen.uid,
    decidedBy: 'earlier-moderator',
    requiresReview: false,
    requiresEvidence: false,
  };
}

const full = { note: 'U kontrollua në terren.', reason: 'Arsye e mjaftueshme.', evidence: ['https://x.test/a.jpg'], assigneeUid: 'agentB' };

describe('the three workflows are well formed', () => {
  for (const kind of WORK_KINDS) {
    const workflow = WORKFLOWS[kind];

    it(`${kind}: every transition names real states`, () => {
      for (const def of workflow.transitions) {
        for (const state of def.from) expect(workflow.states[state], `${def.action} from ${state}`).toBeDefined();
        if (def.to !== '=') expect(workflow.states[def.to], `${def.action} to ${def.to}`).toBeDefined();
      }
    });

    it(`${kind}: action names are unique`, () => {
      const names = workflow.transitions.map(def => def.action);
      expect(new Set(names).size).toBe(names.length);
    });

    it(`${kind}: every state can be reached from the start`, () => {
      const seen = new Set([workflow.initial]);
      const queue = [workflow.initial];
      while (queue.length) {
        const state = queue.shift() as string;
        for (const def of transitionsFrom(kind, state)) {
          if (def.to !== '=' && !seen.has(def.to)) { seen.add(def.to); queue.push(def.to); }
        }
      }
      expect([...seen].sort()).toEqual(Object.keys(workflow.states).sort());
    });

    it(`${kind}: no state is a dead end, except terminal ones`, () => {
      for (const state of Object.keys(workflow.states)) {
        const exits = transitionsFrom(kind, state).filter(def => def.to !== '=');
        if (!isTerminalState(kind, state)) expect(exits.length, `${state} has no way out`).toBeGreaterThan(0);
      }
    });
  }

  it('a moderation violation can only be confirmed or restricted by a person who gives a reason', () => {
    const into = WORKFLOWS.moderation_case.transitions.filter(def => ['violation_confirmed', 'restricted'].includes(def.to));
    expect(into.length).toBeGreaterThan(0);
    for (const def of into) {
      expect(def.requires).toContain('reason');
      expect(def.roles).not.toContain('citizen');
    }
    // Nothing the automatic flag does leads there: the only ways out of "flagged" are a human opening a review or an escalation.
    expect(transitionsFrom('moderation_case', 'flagged').map(def => def.action).sort()).toEqual(['escalate', 'open_review']);
  });
});

describe('every permitted transition behaves', () => {
  for (const kind of WORK_KINDS) {
    for (const def of WORKFLOWS[kind].transitions) {
      for (const from of def.from) {
        it(`${kind}: ${def.action} from ${from} is allowed for ${def.roles[0]}`, () => {
          const actor = actorFor(def, kind);
          const decision = decideTransition({ actor, item: itemFor(kind, from, def, actor), request: { action: def.action, ...full } });
          expect(decision.outcome, decision.outcome === 'deny' ? `${decision.code}: ${decision.error}` : '').toBe('allow');
          if (decision.outcome === 'allow') {
            expect(decision.to).toBe(def.to === '=' ? from : def.to);
            expect(decision.override).toBe(false);
          }
        });
      }
    }
  }
});

describe('every rejected transition is rejected', () => {
  for (const kind of WORK_KINDS) {
    const states = Object.keys(WORKFLOWS[kind].states);
    for (const def of WORKFLOWS[kind].transitions) {
      const wrong = states.filter(state => !def.from.includes(state));
      it(`${kind}: ${def.action} is refused from every state it does not start in (${wrong.length})`, () => {
        for (const from of wrong) {
          const actor = actorFor(def, kind);
          const decision = decideTransition({ actor, item: itemFor(kind, from, def, actor), request: { action: def.action, ...full } });
          expect(decision).toMatchObject({ outcome: 'deny', code: 'WRONG_STATE', status: 409 });
        }
      });

      it(`${kind}: ${def.action} is refused when a required item is missing`, () => {
        const actor = actorFor(def, kind);
        const item = itemFor(kind, def.from[0], def, actor);
        const missing: Record<string, [Record<string, unknown>, string]> = {
          reason: [{ note: full.note, evidence: full.evidence, assigneeUid: full.assigneeUid }, 'REASON_REQUIRED'],
          note: [{ reason: full.reason, evidence: full.evidence, assigneeUid: full.assigneeUid }, 'NOTE_REQUIRED'],
          assignee: [{ note: full.note, reason: full.reason, evidence: full.evidence }, 'ASSIGNEE_REQUIRED'],
        };
        for (const requirement of def.requires ?? []) {
          if (requirement === 'evidence') continue;
          const [request, code] = missing[requirement];
          expect(decideTransition({ actor, item, request: { action: def.action, ...request } }), `${def.action} without ${requirement}`)
            .toMatchObject({ outcome: 'deny', code });
        }
      });
    }
  }
});

describe('who may do what', () => {
  const task = (status: string, extra: Partial<WorkItemFacts> = {}): WorkItemFacts =>
    ({ kind: 'internal_task', status, assigneeUid: actors.agentA.uid, municipality: 'Pejë', ...extra });

  it('refuses an unknown action and an unknown account', () => {
    expect(decideTransition({ actor: actors.admin, item: task('assigned'), request: { action: 'teleport' } })).toMatchObject({ code: 'UNKNOWN_ACTION' });
    expect(decideTransition({ actor: actors.stranger, item: task('assigned'), request: { action: 'accept' } })).toMatchObject({ code: 'WRONG_ROLE', status: 403 });
  });

  it('the monitoring role reads and changes nothing', () => {
    for (const def of WORKFLOWS.internal_task.transitions) {
      const decision = decideTransition({ actor: actors.monitor, item: task(def.from[0]), request: { action: def.action, ...full } });
      expect(decision).toMatchObject({ outcome: 'deny', code: 'READ_ONLY' });
    }
  });

  it('only the assignee does their own steps; another agent is refused', () => {
    expect(decideTransition({ actor: actors.agentA, item: task('assigned'), request: { action: 'accept' } }).outcome).toBe('allow');
    expect(decideTransition({ actor: actors.agentB, item: task('assigned'), request: { action: 'accept' } })).toMatchObject({ code: 'NOT_ASSIGNEE', status: 403 });
  });

  it('a manager cannot accept or submit work for someone else', () => {
    expect(decideTransition({ actor: actors.admin, item: task('assigned'), request: { action: 'accept', reason: full.reason } })).toMatchObject({ outcome: 'deny', code: 'WRONG_ROLE' });
    expect(decideTransition({ actor: actors.admin, item: task('in_progress'), request: { action: 'submit', note: full.note, reason: full.reason } })).toMatchObject({ outcome: 'deny', code: 'WRONG_ROLE' });
  });

  it('a manager may unblock someone else\'s work, but only with a reason, and it is marked as an override', () => {
    const blocked = task('blocked');
    expect(decideTransition({ actor: actors.admin, item: blocked, request: { action: 'unblock', note: full.note } })).toMatchObject({ outcome: 'deny', code: 'OVERRIDE_REASON_REQUIRED' });
    const ok = decideTransition({ actor: actors.admin, item: blocked, request: { action: 'unblock', note: full.note, reason: full.reason } });
    expect(ok).toMatchObject({ outcome: 'allow', override: true, to: 'in_progress' });
  });

  it('assigning and reassigning is for managers and dispatchers, with the right inputs', () => {
    expect(decideTransition({ actor: actors.dispatcher, item: task('unassigned', { assigneeUid: null }), request: { action: 'assign', assigneeUid: 'agentB' } }))
      .toMatchObject({ outcome: 'allow', assigneeUid: 'agentB', to: 'assigned' });
    expect(decideTransition({ actor: actors.agentA, item: task('unassigned', { assigneeUid: null }), request: { action: 'assign', assigneeUid: 'agentA' } }))
      .toMatchObject({ outcome: 'deny', code: 'WRONG_ROLE' });
    expect(decideTransition({ actor: actors.admin, item: task('in_progress'), request: { action: 'reassign', assigneeUid: 'agentB' } }))
      .toMatchObject({ outcome: 'deny', code: 'REASON_REQUIRED' });
  });

  it('declining clears the assignee and sends the item back to the queue', () => {
    expect(decideTransition({ actor: actors.agentA, item: task('assigned'), request: { action: 'decline', reason: 'Jam në pushim javën tjetër.' } }))
      .toMatchObject({ outcome: 'allow', to: 'unassigned', assigneeUid: null });
  });

  it('work that needs review cannot be closed directly, and work that needs evidence needs it', () => {
    expect(decideTransition({ actor: actors.agentA, item: task('in_progress', { requiresReview: true }), request: { action: 'complete', note: full.note } }))
      .toMatchObject({ outcome: 'deny', code: 'REVIEW_REQUIRED' });
    expect(decideTransition({ actor: actors.agentA, item: task('in_progress', { requiresEvidence: true }), request: { action: 'submit', note: full.note } }))
      .toMatchObject({ outcome: 'deny', code: 'EVIDENCE_REQUIRED' });
    expect(decideTransition({ actor: actors.agentA, item: task('in_progress', { requiresEvidence: true }), request: { action: 'submit', note: full.note, evidence: ['javascript:alert(1)'] } }))
      .toMatchObject({ outcome: 'deny', code: 'EVIDENCE_REQUIRED' });
    expect(decideTransition({ actor: actors.agentA, item: task('in_progress', { requiresEvidence: true }), request: { action: 'submit', note: full.note, evidence: ['https://x.test/p.jpg'] } }).outcome).toBe('allow');
  });

  it('rejected work goes back as rework and finished work reopens', () => {
    const rework = decideTransition({ actor: actors.admin, item: task('in_review'), request: { action: 'reject_work', reason: full.reason } });
    expect(rework).toMatchObject({ outcome: 'allow', to: 'in_progress' });
    expect(rework.outcome === 'allow' && rework.def.rework).toBe(true);
    const reopened = decideTransition({ actor: actors.admin, item: task('done'), request: { action: 'reopen', reason: full.reason } });
    expect(reopened.outcome === 'allow' && reopened.def.reopen).toBe(true);
    expect(decideTransition({ actor: actors.admin, item: task('done'), request: { action: 'cancel', reason: full.reason } })).toMatchObject({ code: 'WRONG_STATE' });
  });

  it('an escalation keeps the state', () => {
    expect(decideTransition({ actor: actors.agentB, item: task('blocked'), request: { action: 'escalate', reason: 'Bllokuar që dy ditë.' } }))
      .toMatchObject({ outcome: 'allow', to: 'blocked' });
  });

  it('a municipality works only its own referrals; another gets "not found"', () => {
    const referral: WorkItemFacts = { kind: 'report_referral', status: 'pending_acceptance', assigneeUid: null, municipality: 'Pejë' };
    expect(decideTransition({ actor: actors.peja, item: referral, request: { action: 'acknowledge' } }).outcome).toBe('allow');
    expect(decideTransition({ actor: actors.gjilan, item: referral, request: { action: 'acknowledge' } })).toMatchObject({ outcome: 'deny', status: 404, code: 'NOT_FOUND' });
  });

  it('the debate moderator has no say over reports or tasks', () => {
    expect(decideTransition({ actor: actors.moderator, item: { kind: 'report_referral', status: 'pending_acceptance', assigneeUid: null, municipality: 'Pejë' }, request: { action: 'acknowledge' } }))
      .toMatchObject({ outcome: 'deny', code: 'WRONG_ROLE' });
    expect(decideTransition({ actor: actors.moderator, item: task('unassigned', { assigneeUid: null }), request: { action: 'assign', assigneeUid: 'agentA' } }))
      .toMatchObject({ outcome: 'deny', code: 'WRONG_ROLE' });
  });

  it('a moderation appeal: only the person the case is about, reviewed by a different moderator', () => {
    const decided: WorkItemFacts = { kind: 'moderation_case', status: 'restricted', assigneeUid: actors.moderator.uid, subjectUid: actors.citizen.uid, decidedBy: actors.moderator.uid };
    expect(decideTransition({ actor: actors.citizen, item: decided, request: { action: 'appeal', reason: 'Postimi nuk shkel rregullat.' } }).outcome).toBe('allow');
    expect(decideTransition({ actor: { uid: 'other-citizen', role: 'citizen' }, item: decided, request: { action: 'appeal', reason: 'Postimi nuk shkel rregullat.' } }))
      .toMatchObject({ outcome: 'deny', status: 404 });

    const appealed: WorkItemFacts = { ...decided, status: 'appealed' };
    expect(decideTransition({ actor: actors.moderator, item: appealed, request: { action: 'overturn', reason: full.reason } })).toMatchObject({ outcome: 'deny', code: 'SAME_REVIEWER' });
    expect(decideTransition({ actor: actors.moderator2, item: appealed, request: { action: 'overturn', reason: full.reason } })).toMatchObject({ outcome: 'allow', to: 'no_violation' });
    expect(decideTransition({ actor: actors.citizen, item: appealed, request: { action: 'overturn', reason: full.reason } })).toMatchObject({ outcome: 'deny', code: 'WRONG_ROLE' });
  });

  it('a citizen cannot confirm a violation or restrict content', () => {
    const underReview: WorkItemFacts = { kind: 'moderation_case', status: 'under_review', assigneeUid: actors.moderator.uid, subjectUid: actors.citizen.uid };
    expect(decideTransition({ actor: actors.citizen, item: underReview, request: { action: 'confirm_violation', reason: full.reason } })).toMatchObject({ outcome: 'deny', code: 'WRONG_ROLE' });
  });

  it('lists only the moves the actor can make from here', () => {
    const names = (actor: WorkActor, item: WorkItemFacts) => availableActions(actor, item).map(def => def.action).sort();
    expect(names(actors.agentA, task('assigned'))).toEqual(['accept', 'decline', 'escalate']);
    expect(names(actors.agentB, task('assigned'))).toEqual(['escalate']);
    expect(names(actors.monitor, task('assigned'))).toEqual([]);
    expect(names(actors.admin, task('in_review'))).toEqual(['approve', 'cancel', 'escalate', 'reject_work']);
  });

  it('maps accounts to workflow roles', () => {
    expect([...workRolesOf({ role: 'superadmin' })].sort()).toEqual(['manager', 'moderator']);
    expect([...workRolesOf({ role: 'dispatcher' })].sort()).toEqual(['agent', 'manager']);
    expect([...workRolesOf({ role: 'monitor' })]).toEqual(['observer']);
    expect([...workRolesOf({ role: 'debatwp' })]).toEqual(['moderator']);
    expect([...workRolesOf({ role: 'ghost' })]).toEqual([]);
  });
});
