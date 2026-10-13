import { requireAdminToken, describeApiFailure } from './adminApi';

/**
 * Taking a photo off a report, and putting it back. Both go through the server,
 * which keeps the file, records who and why, and decides who may do it.
 */
async function change(reportId: string, action: 'remove' | 'restore', body: Record<string, unknown>): Promise<{ images: string[] }> {
  const token = await requireAdminToken();
  const response = await fetch(`/api/v1/reports/${encodeURIComponent(reportId)}/media/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(describeApiFailure(response.status, result));
  return { images: Array.isArray(result.images) ? result.images : [] };
}

export const removeReportPhoto = (reportId: string, url: string, reason: string) =>
  change(reportId, 'remove', { url, reason });

export const restoreReportPhoto = (reportId: string, url: string) =>
  change(reportId, 'restore', { url });

/** The photo's bytes from our own server, so a canvas may draw and cut it. */
export async function fetchReportPhoto(reportId: string, url: string): Promise<Blob> {
  const token = await requireAdminToken();
  const response = await fetch(`/api/v1/reports/${encodeURIComponent(reportId)}/media/file?url=${encodeURIComponent(url)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(describeApiFailure(response.status, result));
  }
  return response.blob();
}

/** Replace a photo with its cropped version; the original is kept privately. */
export async function cropReportPhoto(reportId: string, url: string, image: string): Promise<{ url: string; images: string[] }> {
  const token = await requireAdminToken();
  const response = await fetch(`/api/v1/reports/${encodeURIComponent(reportId)}/media/crop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ url, image }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(describeApiFailure(response.status, result));
  return { url: String(result.url ?? ''), images: Array.isArray(result.images) ? result.images : [] };
}

/** Undo a crop: the original photo replaces the cropped one again. */
export async function uncropReportPhoto(reportId: string, url: string): Promise<{ images: string[] }> {
  const token = await requireAdminToken();
  const response = await fetch(`/api/v1/reports/${encodeURIComponent(reportId)}/media/uncrop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ url }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(describeApiFailure(response.status, result));
  return { images: Array.isArray(result.images) ? result.images : [] };
}
