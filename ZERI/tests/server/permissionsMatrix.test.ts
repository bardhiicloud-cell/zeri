import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildMatrix, renderMatrix } from '../../server/permissionsMatrix';

const rows = buildMatrix();
const who = (id: string) => rows.filter(r => r.allowed[id]).map(r => r.capability);
const row = (text: string) => {
  const found = rows.find(r => r.capability.startsWith(text));
  if (!found) throw new Error(`rreshti mungon: ${text}`);
  return found;
};

describe('permissions matrix', () => {
  it('docs/PERMISSIONS_MATRIX.md matches what the code decides', () => {
    const doc = readFileSync('docs/PERMISSIONS_MATRIX.md', 'utf8').replace(/\r\n/g, '\n');
    expect(doc).toBe(renderMatrix(rows).replace(/\r\n/g, '\n'));
  });

  it('a citizen can do nothing in the admin surface', () => {
    expect(who('citizen')).toEqual([]);
  });

  it('the monitor reads and watches but changes nothing', () => {
    expect(who('monitor').sort()).toEqual(['Hap Sigurinë dhe Auditimin', 'Hap listën e raportimeve', 'Sheh ngarkesën e ekipit të agjentëve'].sort());
  });

  it('municipality powers are bound to the plan', () => {
    expect(row('Verifikon një rast shëndetësor').allowed.municipalityBasic).toBe(false);
    expect(row('Verifikon një rast shëndetësor').allowed.municipalityPro).toBe(true);
    expect(row('Dërgon raportin me email').allowed.municipalityBasic).toBe(false);
    expect(row('Dërgon raportin me email').allowed.municipalityPro).toBe(true);
  });

  it('no municipality can staff-only actions, and agents cannot reject or reassign', () => {
    for (const cap of ['Refuzon', 'Ndalon një llogari', 'Cakton ose ndryshon rolin', 'Cakton planin']) {
      expect(row(cap).allowed.municipalityPro).toBe(false);
      expect(row(cap).allowed.agent).toBe(false);
    }
    expect(row('Ia cakton raportin').allowed.agent).toBe(false);
  });

  it('owner and admin are identical', () => {
    for (const r of rows) expect(r.allowed.superadmin).toBe(r.allowed.admin);
  });
});
