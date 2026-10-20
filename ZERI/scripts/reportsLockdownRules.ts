/**
 * The "reports are not world-readable" change to firestore.rules, as a transform.
 *
 * Why a transform and not an edit: the current client (before this change) reads the
 * whole collection for every visitor, so shipping the stricter rule with an old
 * client would blank the public site. The rule is therefore staged: this module
 * produces the stricter rules file from the live one, the rules tests exercise it,
 * and it is applied (and deployed) only after the new client is live. See
 * docs/ADMIN_SECURITY_REMEDIATION.md for the order and the rollback.
 *
 * Usage:  tsx scripts/reportsLockdownRules.ts            -> writes firestore.reports-lockdown.rules
 *         tsx scripts/reportsLockdownRules.ts --in-place -> rewrites firestore.rules (the apply step)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const OPEN_READ = `      // Anyone can look up a report by Track ID (public tracking).
      // PII (email) is not exposed in the TrackIdPage response.
      allow read: if true;
`;

export const CLOSED_READ = `      // Reports are not world-readable. The public site reads the server's allow-listed
      // feed (GET /api/v1/public/reports) and the Track ID page reads
      // GET /api/v1/public/track/:id; both go through the Admin SDK.
      //   - the person who filed it reads their own documents;
      //   - platform staff and the read-only monitor read all (same flags as isStaff()/isMonitor());
      //   - a municipality reads only its own, once a reviewer has accepted the report.
      function canReadReport() {
        return isAuthenticated() && (
          resource.data.authorId == request.auth.uid ||
          isStaff() ||
          isMonitor() ||
          (isMunicipality() &&
            resource.data.location.municipality == ownMunicipality() &&
            isMunicipalityVisibleStatus(resource.data.status))
        );
      }
      allow read: if canReadReport();
`;

/** Returns the stricter rules. Throws unless the open rule appears exactly once. */
export function applyReportsLockdown(rules: string): string {
  const normalized = rules.replace(/\r\n/g, '\n');
  // Already applied: nothing to do (the rules tests call this on whatever firestore.rules holds).
  if (normalized.includes(CLOSED_READ)) return normalized;
  const count = normalized.split(OPEN_READ).length - 1;
  if (count !== 1) throw new Error(`Expected the open reports read rule exactly once, found ${count}. The rules changed; update scripts/reportsLockdownRules.ts.`);
  return normalized.replace(OPEN_READ, () => CLOSED_READ);
}

/** The pre-lockdown rules, rebuilt from locked ones. For tests and for a rollback. */
export function revertReportsLockdown(rules: string): string {
  return rules.replace(/\r\n/g, '\n').replace(CLOSED_READ, () => OPEN_READ);
}

if (process.argv[1] && /reportsLockdownRules\.ts$/.test(process.argv[1].replace(/\\/g, '/'))) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const source = path.join(root, 'firestore.rules');
  const result = applyReportsLockdown(readFileSync(source, 'utf8'));
  const target = process.argv.includes('--in-place') ? source : path.join(root, 'firestore.reports-lockdown.rules');
  writeFileSync(target, result);
  console.log(`Wrote ${path.relative(root, target)}`);
}
