import { auth } from './firebase';
import { API_BASE } from './apiBase';
import { fetchWithTimeout, isJsonResponse } from './timeouts';
import { shrinkImageToBytes } from './imageCompress';

/**
 * Sends a report photo to the platform server, which keeps it in Firestore, for a project
 * where Firebase Storage is not available (it needs the paid plan). Returns the public
 * URL the report's `media` entry points at. Images only, at most 800 KB after shrinking.
 */
const MAX_BYTES = 800 * 1024;

const toBase64 = (file: Blob): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(file);
});

export async function uploadReportPhotoViaApi(file: File, reportId: string): Promise<string> {
  if (!file.type.startsWith('image/') && !/\.(heic|heif)$/i.test(file.name)) {
    throw new Error('Vetëm fotot ruhen pa Storage; videot, dokumentet dhe audio kërkojnë Storage.');
  }
  const small = file.size <= MAX_BYTES && /^image\/(jpeg|png|webp)$/.test(file.type)
    ? file
    : await shrinkImageToBytes(file, MAX_BYTES);
  if (!small) throw new Error(`Fotoja "${file.name}" nuk mund të zvogëlohet sa duhet. Provoni një foto tjetër.`);

  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Ngarkimi kërkon një sesion aktiv.');
  const response = await fetchWithTimeout('/api/v1/report-photos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ data: await toBase64(small), reportId }),
  }, 30000);
  const body = isJsonResponse(response) ? await response.json().catch(() => null) as { id?: string; error?: string } | null : null;
  if (!response.ok || !body?.id) throw new Error(body?.error || `Fotoja nuk u ruajt (${response.status}).`);
  return `${API_BASE || window.location.origin}/api/v1/report-photos/${body.id}`;
}
