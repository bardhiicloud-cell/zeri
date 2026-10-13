import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { applyReportsLockdown } from '../../scripts/reportsLockdownRules';

const live = readFileSync(path.resolve(__dirname, '../../firestore.rules'), 'utf8').replace(/\r\n/g, '\n');

describe('reports lockdown transform', () => {
  const locked = applyReportsLockdown(live);

  it('applies to the live rules file and closes the world-readable rule', () => {
    expect(locked).not.toBe(live);
    expect(locked).toContain('allow read: if canReadReport();');
    const reportsBlock = locked.slice(locked.indexOf('match /reports/{reportId}'), locked.indexOf('match /comments/{commentId}'));
    expect(reportsBlock).not.toMatch(/allow read:\s*if true/);
  });

  it('changes only the reports read rule', () => {
    // Cut the old rule out of the original and the new rule out of the result: what is left must be identical.
    const oldStart = live.indexOf('      // Anyone can look up a report by Track ID');
    const oldEnd = live.indexOf('allow read: if true;', oldStart) + 'allow read: if true;'.length + 1;
    const newStart = locked.indexOf('      // Reports are not world-readable.');
    const newEnd = locked.indexOf('allow read: if canReadReport();') + 'allow read: if canReadReport();'.length + 1;
    expect(oldStart).toBeGreaterThan(0);
    expect(newStart).toBeGreaterThan(0);
    expect(live.slice(0, oldStart) + live.slice(oldEnd)).toBe(locked.slice(0, newStart) + locked.slice(newEnd));
  });

  it('refuses to guess when the rules changed shape', () => {
    expect(() => applyReportsLockdown('rules_version = "2";')).toThrow(/exactly once/);
    expect(() => applyReportsLockdown(live + '\n' + live)).toThrow(/exactly once/);
  });

  it('is idempotent in intent: applying it to its own output is refused, not doubled', () => {
    expect(() => applyReportsLockdown(locked)).toThrow(/exactly once/);
  });

  it('the rules the new client relies on stay defined', () => {
    for (const helper of ['function isStaff()', 'function isMonitor()', 'function isMunicipality()', 'function ownMunicipality()', 'function isMunicipalityVisibleStatus(']) {
      expect(live, helper).toContain(helper);
    }
  });
});
