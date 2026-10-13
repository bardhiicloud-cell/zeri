import { authHeaders } from './apiAuth';

/** Client for server/forumReports.ts: reporting a comment, an account or an ad. */

export type ReportTargetKind = 'comment' | 'user' | 'ad';

export const REPORT_TARGET_REASONS = [
  { id: 'spam', label: 'Spam ose reklamë e padëshiruar' },
  { id: 'abuse', label: 'Gjuhë ofenduese ose ngacmim' },
  { id: 'misinformation', label: 'Dezinformim' },
  { id: 'violence', label: 'Dhunë ose kërcënim' },
  { id: 'illegal', label: 'Përmbajtje e paligjshme' },
  { id: 'impersonation', label: 'Imiton dikë tjetër' },
  { id: 'other', label: 'Tjetër' },
] as const;

export async function reportTargetApi(input: {
  kind: ReportTargetKind; targetId: string; postId?: string; reason: string; details?: string;
}): Promise<{ status: 'reported' | 'duplicate' }> {
  const response = await fetch('/api/v1/forum/reports', {
    method: 'POST',
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(input),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Raportimi nuk u dërgua.');
  return data;
}
