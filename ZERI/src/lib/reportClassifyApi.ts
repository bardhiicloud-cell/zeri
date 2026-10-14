import { describeApiFailure, requireAdminToken } from './adminApi';
import type { Zone } from './responsibility';

/** Setting category, municipality and zone on many reports at once; see server/reportClassification.ts. */
export interface ClassifyChange {
  topicCategory?: string;
  municipality?: string;
  zone?: Zone;
}

export interface ClassifyResult {
  updated: number;
  results: Array<{ id: string; responsible: string; level: 'municipal' | 'central'; needsZone: boolean }>;
  at: string;
}

export async function classifyReports(ids: readonly string[], change: ClassifyChange): Promise<ClassifyResult> {
  const token = await requireAdminToken();
  const response = await fetch('/api/v1/admin/reports/classify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ ids, ...change }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(describeApiFailure(response.status, result));
  return result as ClassifyResult;
}
