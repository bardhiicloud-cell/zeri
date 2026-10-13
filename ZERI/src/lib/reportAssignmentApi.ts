import { applyTransition, describeApiFailure, requireAdminToken } from './adminApi';

/**
 * Who holds a report while it is checked. The server records the person (uid),
 * when and by whom; see server/reportAssignment.ts.
 */

export interface Holder {
  assignedToUid: string;
  assignedTo: string;
}

/** "Merr përsipër": the signed-in agent (or owner) takes the report. */
export async function claimReport(reportId: string): Promise<void> {
  await applyTransition({ reportId, transition: 'claim' });
}

async function post(reportId: string, body: Record<string, unknown>): Promise<Holder> {
  const token = await requireAdminToken();
  const response = await fetch(`/api/v1/reports/${encodeURIComponent(reportId)}/assign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(describeApiFailure(response.status, result));
  return { assignedToUid: String(result.assignedToUid ?? ''), assignedTo: String(result.assignedTo ?? '') };
}

/** The owner hands the report to a specific agent. */
export const assignReport = (reportId: string, uid: string) => post(reportId, { uid });

/** The holder gives the report back to the shared queue (or the owner takes it back). */
export const releaseReport = (reportId: string) => post(reportId, { release: true });
