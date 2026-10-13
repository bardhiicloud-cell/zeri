import { describe, expect, it } from 'vitest';
import { DORMANT_AFTER_MS, mayViewTeam, summarizeTeam, type AgentLoad } from '../../server/teamOverview';

const NOW = Date.parse('2026-10-12T12:00:00.000Z');
const agent = (uid: string, name = uid) => ({ uid, name, email: `${uid}@z.test`, role: 'agent' });
const loads = (entries: Record<string, Partial<AgentLoad>>) =>
  new Map(Object.entries(entries).map(([uid, load]) => [uid, { holding: 0, actions24h: 0, actions7d: 0, lastActionMs: null, ...load }]));

describe('summarizeTeam', () => {
  const team = [agent('a'), agent('b'), agent('c'), agent('d')];

  it('counts what the team holds and each agent\'s share', () => {
    const summary = summarizeTeam(team, loads({
      a: { holding: 6, lastActionMs: NOW - 3600_000 },
      b: { holding: 3, lastActionMs: NOW - 3600_000 },
      c: { holding: 1, lastActionMs: NOW - 3600_000 },
    }), NOW);
    expect(summary.totalHeld).toBe(10);
    expect(Object.fromEntries(summary.rows.map(r => [r.uid, r.sharePercent]))).toMatchObject({ a: 60, b: 30, c: 10, d: 0 });
  });

  it('flags an agent who holds work but has gone quiet, and puts them first', () => {
    const summary = summarizeTeam(team, loads({
      a: { holding: 8, lastActionMs: NOW - 60_000 },
      b: { holding: 2, lastActionMs: NOW - DORMANT_AFTER_MS - 1 },
      c: { holding: 4, lastActionMs: null },
    }), NOW);
    expect(summary.rows.map(r => r.uid).slice(0, 2).sort()).toEqual(['b', 'c']);
    expect(summary.rows.find(r => r.uid === 'b')?.dormant).toBe(true);
    expect(summary.rows.find(r => r.uid === 'c')?.dormant).toBe(true);
    expect(summary.rows.find(r => r.uid === 'a')?.dormant).toBe(false);
    expect(summary.dormantHolders).toBe(2);
  });

  it('does not call an idle agent with nothing to do dormant', () => {
    const summary = summarizeTeam(team, loads({ d: { holding: 0, lastActionMs: null } }), NOW);
    expect(summary.rows.find(r => r.uid === 'd')?.dormant).toBe(false);
    expect(summary.dormantHolders).toBe(0);
  });

  it('measures imbalance as the heaviest load over the average of those who hold work', () => {
    const even = summarizeTeam(team, loads({ a: { holding: 4 }, b: { holding: 4 }, c: { holding: 4 } }), NOW);
    expect(even.imbalance).toBe(1);
    const lopsided = summarizeTeam(team, loads({ a: { holding: 9 }, b: { holding: 2 }, c: { holding: 1 } }), NOW);
    expect(lopsided.imbalance).toBe(2.3);
  });

  it('handles an empty team and a team holding nothing', () => {
    expect(summarizeTeam([], new Map(), NOW)).toMatchObject({ rows: [], totalHeld: 0, imbalance: 1 });
    expect(summarizeTeam(team, new Map(), NOW).rows.every(r => r.sharePercent === 0 && !r.dormant)).toBe(true);
  });

  it('orders the rest by load, then recent activity, then name', () => {
    const summary = summarizeTeam([agent('x', 'Zeta'), agent('y', 'Alfa'), agent('z', 'Beta')], loads({
      x: { holding: 2, actions24h: 1, lastActionMs: NOW - 1 },
      y: { holding: 2, actions24h: 5, lastActionMs: NOW - 1 },
      z: { holding: 5, lastActionMs: NOW - 1 },
    }), NOW);
    expect(summary.rows.map(r => r.uid)).toEqual(['z', 'y', 'x']);
  });
});

describe('mayViewTeam', () => {
  it('is for owners, the manager of the agents, and anyone granted monitoring', () => {
    for (const role of ['admin', 'superadmin', 'monitor']) expect(mayViewTeam({ role, permissions: [] }), role).toBe(true);
    expect(mayViewTeam({ role: 'agent', permissions: ['monitorim'] })).toBe(true);
  });

  it('is not for plain agents, municipalities or citizens', () => {
    for (const role of ['agent', 'municipality', 'citizen', '']) expect(mayViewTeam({ role, permissions: [] }), role).toBe(false);
  });
});
