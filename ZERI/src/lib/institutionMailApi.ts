import { describeApiFailure, requireAdminToken } from './adminApi';

/** Sending a report to the institution responsible for it; see server/institutionMail.ts. */

export interface MailStatus {
  configured: boolean;
  provider: string | null;
}

export interface SentEmail {
  id: string;
  to: string;
  institution: string;
  status: 'queued' | 'sent' | 'failed';
  at: string | null;
  byName: string;
  error?: string;
}

export interface SendResult {
  id: string;
  status: 'queued' | 'sent' | 'failed';
  configured?: boolean;
  error?: string;
}

async function call(method: 'GET' | 'POST', path: string, body?: unknown, acceptStatuses: number[] = []) {
  const token = await requireAdminToken();
  const response = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok && !acceptStatuses.includes(response.status)) throw new Error(describeApiFailure(response.status, result));
  return result;
}

export async function getMailStatus(): Promise<MailStatus> {
  const result = await call('GET', '/api/v1/mail/status');
  return { configured: result.configured === true, provider: typeof result.provider === 'string' ? result.provider : null };
}

/** 202 (queued, provider not configured) and 502 (provider refused) are answers, not exceptions. */
export async function sendReportEmail(reportId: string, contactId: string, note: string): Promise<SendResult> {
  return call('POST', `/api/v1/reports/${encodeURIComponent(reportId)}/email-institution`, { contactId, note }, [202, 502]);
}

export async function listReportEmails(reportId: string): Promise<SentEmail[]> {
  const result = await call('GET', `/api/v1/reports/${encodeURIComponent(reportId)}/emails`);
  return Array.isArray(result.items) ? result.items : [];
}

export async function retryEmail(id: string): Promise<SendResult> {
  const result = await call('POST', `/api/v1/admin/emails/${encodeURIComponent(id)}/retry`, {}, [502]);
  return { id, status: result.status, error: result.error };
}
