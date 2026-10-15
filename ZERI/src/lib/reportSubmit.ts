/**
 * Pure decisions behind the public report form (`/raporto`).
 *
 * They live outside the component so each one can be tested without rendering
 * the form, a map or Firebase.
 */

/** What the form should do after `POST /api/v1/reports` answered (or did not). */
export type ServerOutcome =
  | { kind: 'created'; id: string; trackingId: string }
  /** 409 / 429: the server refused for a reason the citizen can act on. */
  | { kind: 'refused'; message: string; code: string }
  /** 400 and friends: the server validated the content and rejected it. */
  | { kind: 'invalid'; message: string }
  /** 401 / 403: the sign-in expired or was never valid. */
  | { kind: 'session' }
  /** The server answered but did not store the report (500...). Retrying is safe. */
  | { kind: 'retry' }
  /** The server could not be reached at all (404/502/503/504 or no response). */
  | { kind: 'fallback' };

const UNREACHABLE = new Set([404, 502, 503, 504]);

export function classifyServerResponse(status: number, body: unknown): ServerOutcome {
  const data = (body && typeof body === 'object' ? body : {}) as { id?: unknown; trackingId?: unknown; error?: unknown; code?: unknown };
  const message = typeof data.error === 'string' && data.error.trim() ? data.error.trim() : '';

  if (status === 200 || status === 201) {
    if (typeof data.id === 'string' && data.id) {
      return { kind: 'created', id: data.id, trackingId: typeof data.trackingId === 'string' ? data.trackingId : '' };
    }
    return { kind: 'retry' };
  }
  if (status === 409 || status === 429) return { kind: 'refused', message, code: typeof data.code === 'string' ? data.code : '' };
  if (status === 401 || status === 403) return { kind: 'session' };
  if (UNREACHABLE.has(status)) return { kind: 'fallback' };
  if (status >= 400 && status < 500) return { kind: 'invalid', message };
  return { kind: 'retry' };
}

/* ------------------------------------------------------------------ files */

/** The server keeps at most this many files per report (server/reports.ts). */
export const MAX_REPORT_FILES = 6;

const ALLOWED_MIME_PREFIXES = ['image/', 'video/', 'audio/'];
const ALLOWED_MIME = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]);
const ALLOWED_EXTENSIONS = new Set(['pdf', 'doc', 'docx', 'txt']);

export type FileProblem = 'empty' | 'unsupported' | 'too_large' | 'limit';

export function checkEvidenceFile(
  file: { name: string; size: number; type?: string },
  options: { maxBytes: number; currentCount: number },
): FileProblem | null {
  if (options.currentCount >= MAX_REPORT_FILES) return 'limit';
  if (!file.size) return 'empty';
  const mime = (file.type || '').toLowerCase();
  const extension = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : '';
  const allowed =
    ALLOWED_MIME_PREFIXES.some(prefix => mime.startsWith(prefix)) ||
    ALLOWED_MIME.has(mime) ||
    (!mime && ALLOWED_EXTENSIONS.has(extension));
  if (!allowed) return 'unsupported';
  if (file.size > options.maxBytes) return 'too_large';
  return null;
}

export function evidenceKind(mime: string): 'image' | 'video' | 'audio' | 'document' {
  const type = (mime || '').toLowerCase();
  if (type.startsWith('video/')) return 'video';
  if (type.startsWith('audio/')) return 'audio';
  if (type.startsWith('image/')) return 'image';
  return 'document';
}
