// QA: does the per-actor indexing actually matter at the scale this platform
// targets? This measures the real functions against a realistic log volume
// (the old O(agents x logs) shape versus the new single-pass index).
//
// The number to watch is the ratio, not the absolute milliseconds: a browser
// main thread stalls at roughly 50ms, so anything above that on a render path
// is felt as lag by the operator.

export default async function run(page) {
  await page.goto('http://localhost:3002/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  return await page.evaluate(async function () {
    const mod = await import('/src/lib/moderationCenter.ts');
    const activity = await import('/src/lib/agentActivity.ts');

    const AGENTS = 200;
    const LOGS = 20000;

    const agents = [];
    for (let i = 0; i < AGENTS; i++) {
      agents.push({
        id: 'agent-' + i,
        name: 'Agjenti ' + i,
        email: 'agent' + i + '@ks.com',
        role: 'agent',
      });
    }

    const logs = [];
    const munis = ['Prishtinë', 'Prizren', 'Gjilan', 'Pejë'];
    for (let i = 0; i < LOGS; i++) {
      const a = agents[i % AGENTS];
      logs.push({
        id: 'log-' + i,
        action: i % 7 === 0 ? 'Report Approved' : i % 11 === 0 ? 'Report Rejected' : 'Report Viewed',
        userId: a.id,
        userEmail: a.email,
        userName: a.name,
        status: i % 13 === 0 ? 'danger' : i % 5 === 0 ? 'warning' : 'success',
        municipality: munis[i % munis.length],
        createdAt: new Date(Date.now() - (i % 900) * 3600000).toISOString(),
      });
    }

    // The OLD shape, reproduced so the comparison is honest.
    function oldShape() {
      return agents.map(function (agent) {
        const mine = logs.filter(function (l) {
          return l.userId === agent.id || l.userName === agent.name;
        });
        const approvals = mine.filter(function (l) {
          return /approve/i.test(l.action);
        }).length;
        const rejections = mine.filter(function (l) {
          return /reject/i.test(l.action);
        }).length;
        const mod = mine.filter(function (l) {
          return ['moderat', 'delete', 'hide', 'approve', 'reject', 'ban'].some(function (m) {
            return l.action.toLowerCase().includes(m);
          });
        }).length;
        let last = null;
        for (const l of mine) {
          const t = Date.parse(l.createdAt);
          if (Number.isFinite(t) && (!last || t > Date.parse(last))) last = l.createdAt;
        }
        return { agent: agent.id, approvals: approvals, rejections: rejections, mod: mod, last: last };
      });
    }

    function time(fn) {
      const t0 = performance.now();
      const out = fn();
      return { ms: Math.round((performance.now() - t0) * 10) / 10, count: out.length };
    }

    const oldRun = time(oldShape);
    const newRun = time(function () {
      return mod.computeAgentActivity(agents, logs);
    });

    // Correctness: the two must agree on totals, or the speedup is meaningless.
    const oldRows = oldShape();
    const newRows = mod.computeAgentActivity(agents, logs);
    const newById = {};
    for (const r of newRows) newById[r.agent.id] = r;
    let mismatches = 0;
    for (const o of oldRows) {
      const n = newById[o.agent];
      if (!n || n.approvals !== o.approvals || n.rejections !== o.rejections || n.moderationActions !== o.mod) {
        mismatches += 1;
      }
    }

    return {
      volume: { agents: AGENTS, logs: LOGS },
      oldShape: oldRun,
      newShape: newRun,
      speedup: Math.round((oldRun.ms / Math.max(newRun.ms, 0.1)) * 10) / 10,
      correctnessMismatches: mismatches,
      verdict:
        mismatches === 0 && newRun.ms < oldRun.ms
          ? 'Indexed version is both correct and faster'
          : 'MISMATCH - investigate',
    };
  });
}
