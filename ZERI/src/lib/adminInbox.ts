import type { AdminSection } from './adminPermissions';

/**
 * The work inbox: everything that is waiting on a person, in one list.
 *
 * Reports, municipal work claims, health cases, medicine shortages, support
 * chats, donation appeals and ad requests each live in their own section, so
 * finding "what needs me now" meant visiting seven pages. This module turns the
 * raw records of each into one common shape and orders them by how much waiting
 * hurts. It is pure: the records arrive as plain data and `now` is a parameter,
 * so the ordering rules can be tested without Firestore or a clock.
 *
 * Privacy: an item carries only what is needed to recognise it. Health cases show
 * the category and municipality, never the person's name or diagnosis, and a
 * citizen's identity is not shown on a report row.
 */

export type InboxKind = 'report' | 'workfact' | 'health' | 'shortage' | 'chat' | 'donation' | 'adrequest' | 'munirequest' | 'newstip';

export type InboxUrgency = 'critical' | 'high' | 'normal';

export interface InboxItem {
  /** Unique across kinds: `${kind}:${recordId}`. */
  key: string;
  kind: InboxKind;
  recordId: string;
  title: string;
  subtitle: string;
  /** Why it is here, in a few words. */
  reason: string;
  municipality?: string;
  urgency: InboxUrgency;
  /** ISO time the item started waiting. */
  createdAt: string;
  /** ISO deadline, when the item has one. */
  dueAt?: string;
  /**
   * Past its deadline - by the clock, or because the report is already marked
   * Overdue. One field decides every place that says "late" (the reason, the
   * summary count, the sort order, the row badge), so they cannot disagree.
   */
  overdue?: boolean;
  /** The admin section that handles this kind. */
  section: AdminSection;
}

/** Which section handles each kind, and its label. */
export const INBOX_KINDS: Record<InboxKind, { label: string; section: AdminSection }> = {
  report: { label: 'Raporte', section: 'reports' },
  workfact: { label: 'Fakte komunale', section: 'workfacts' },
  health: { label: 'Raste shëndetësore', section: 'health' },
  shortage: { label: 'Mungesa barnash', section: 'health' },
  chat: { label: 'Biseda', section: 'support' },
  donation: { label: 'Donacione', section: 'donations' },
  adrequest: { label: 'Kërkesa reklamash', section: 'ads' },
  munirequest: { label: 'Kërkesa komunash', section: 'workfacts' },
  newstip: { label: 'Lajme nga qytetarët', section: 'workflow' },
};

/** Firestore Timestamps, `{seconds}` objects and ISO strings all appear in the data. */
export function toIso(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const v = value as { toDate?: () => Date; seconds?: number };
    if (typeof v.toDate === 'function') return v.toDate().toISOString();
    if (typeof v.seconds === 'number') return new Date(v.seconds * 1000).toISOString();
  }
  return '';
}

const clip = (text: unknown, max: number): string => {
  const value = String(text ?? '').trim().replace(/\s+/g, ' ');
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
};

const urgencyFromReport = (urgency: unknown): InboxUrgency =>
  urgency === 'Kritike' ? 'critical' : urgency === 'E lartë' ? 'high' : 'normal';

type Raw = Record<string, unknown> & { id: string };

// ── Mappers: one raw record in, one item (or null when it does not belong) out ──

export interface ReportLike {
  id: string;
  title: string;
  status: string;
  urgency?: string;
  category?: string;
  createdAt: string;
  location?: { municipality?: string };
}

/**
 * A report belongs in the inbox when it is waiting for a first review, has passed
 * its response deadline, or is critical and still open.
 */
export function reportItem(report: ReportLike, dueAt: string | undefined, now: number): InboxItem | null {
  const open = ['Pending Review', 'Approved', 'Assigned', 'In Progress', 'Overdue'].includes(report.status);
  if (!open) return null;

  const due = dueAt ? Date.parse(dueAt) : Number.NaN;
  const late = report.status === 'Overdue' || (Number.isFinite(due) && due < now);
  const pending = report.status === 'Pending Review';
  const critical = report.urgency === 'Kritike';
  if (!pending && !late && !critical) return null;

  const reason = late
    ? 'Afati i përgjigjes ka kaluar'
    : pending
      ? critical ? 'Kritike — pret shqyrtimin e parë' : 'Pret shqyrtimin e parë'
      : 'Urgjencë kritike';

  return {
    key: `report:${report.id}`,
    kind: 'report',
    recordId: report.id,
    title: clip(report.title, 90),
    subtitle: [report.location?.municipality, report.category].filter(Boolean).join(' · '),
    reason,
    municipality: report.location?.municipality,
    urgency: urgencyFromReport(report.urgency),
    createdAt: report.createdAt,
    dueAt,
    overdue: late,
    section: 'reports',
  };
}

export function workFactItem(raw: Raw): InboxItem | null {
  if (raw.review !== 'pending') return null;
  return {
    key: `workfact:${raw.id}`,
    kind: 'workfact',
    recordId: raw.id,
    title: clip(raw.description, 90) || 'Fakt komunal',
    subtitle: String(raw.municipality ?? ''),
    reason: 'Pret verifikimin e stafit',
    municipality: raw.municipality ? String(raw.municipality) : undefined,
    urgency: 'normal',
    createdAt: toIso(raw.createdAt),
    section: 'workfacts',
  };
}

export function healthItem(raw: Raw): InboxItem | null {
  const urgent = raw.urgency === 'Urgjente';
  const unnotified = raw.hospitalNotified !== true;
  const pending = raw.status === 'pending';
  if (!(urgent && unnotified) && !pending) return null;
  return {
    key: `health:${raw.id}`,
    kind: 'health',
    recordId: raw.id,
    // Deliberately the category, not the person or the diagnosis.
    title: clip(raw.category, 60) || 'Rast shëndetësor',
    subtitle: [raw.municipality, raw.urgency].filter(Boolean).join(' · '),
    reason: urgent && unnotified ? 'Urgjent — spitali nuk është njoftuar' : 'Pret verifikimin',
    municipality: raw.municipality ? String(raw.municipality) : undefined,
    urgency: urgent ? 'critical' : 'normal',
    createdAt: toIso(raw.createdAt),
    section: 'health',
  };
}

export function shortageItem(raw: Raw): InboxItem | null {
  if (raw.status !== 'pending') return null;
  return {
    key: `shortage:${raw.id}`,
    kind: 'shortage',
    recordId: raw.id,
    title: clip(raw.medicineName, 70) || 'Mungesë barnash',
    subtitle: String(raw.municipality ?? ''),
    reason: 'Pret verifikimin',
    municipality: raw.municipality ? String(raw.municipality) : undefined,
    urgency: 'normal',
    createdAt: toIso(raw.createdAt) || String(raw.reportedDate ?? ''),
    section: 'health',
  };
}

export function chatItem(raw: Raw): InboxItem | null {
  if (raw.status !== 'waiting_agent') return null;
  return {
    key: `chat:${raw.id}`,
    kind: 'chat',
    recordId: raw.id,
    title: clip(raw.userName, 60) || 'Qytetar',
    subtitle: String(raw.department ?? ''),
    reason: 'Kërkon të flasë me një agjent',
    urgency: 'high',
    createdAt: toIso(raw.updatedAt) || toIso(raw.createdAt),
    section: 'support',
  };
}

export function donationItem(raw: Raw): InboxItem | null {
  if (raw.status !== 'pending') return null;
  return {
    key: `donation:${raw.id}`,
    kind: 'donation',
    recordId: raw.id,
    title: clip(raw.title, 90) || 'Kërkesë për donacion',
    subtitle: String(raw.category ?? ''),
    reason: 'Pret vendimin',
    urgency: 'normal',
    createdAt: toIso(raw.createdAt),
    section: 'donations',
  };
}

export function adRequestItem(raw: Raw): InboxItem | null {
  if (raw.status !== 'pending') return null;
  return {
    key: `adrequest:${raw.id}`,
    kind: 'adrequest',
    recordId: raw.id,
    title: clip(raw.title, 90) || 'Kërkesë për reklamë',
    subtitle: [raw.name, raw.municipality].filter(Boolean).join(' · '),
    reason: 'Kërkesë e re',
    municipality: raw.municipality ? String(raw.municipality) : undefined,
    urgency: 'normal',
    createdAt: toIso(raw.createdAt),
    section: 'ads',
  };
}

/** A news tip a citizen sent through "Lajmero" that no editor has picked up yet. */
export function newsTipItem(raw: Raw): InboxItem | null {
  if (raw.status !== 'submitted') return null;
  return {
    key: `newstip:${raw.id}`,
    kind: 'newstip',
    recordId: raw.id,
    title: clip(raw.title, 90) || 'Lajm nga qytetari',
    subtitle: [raw.category, raw.municipality].filter(Boolean).join(' · '),
    reason: 'Lajm i ri pret redaksinë',
    municipality: raw.municipality ? String(raw.municipality) : undefined,
    urgency: 'normal',
    createdAt: toIso(raw.createdAt),
    section: 'workflow',
  };
}

const MUNI_REQUEST_LABELS: Record<string, string> = {
  correct_fact: 'Kërkesë për korrigjim fakti',
  dispute: 'Kundërshtim i raportit',
  request_removal: 'Kërkesë për heqje',
  respond: 'Përgjigje zyrtare',
};

/** What a municipality asked staff to look at (corrections, disputes, removals). */
export function muniRequestItem(raw: Raw): InboxItem | null {
  if (raw.status !== 'pending') return null;
  return {
    key: `munirequest:${raw.id}`,
    kind: 'munirequest',
    recordId: raw.id,
    title: clip(raw.reportTitle, 90) || 'Kërkesë e komunës',
    subtitle: [raw.municipality, MUNI_REQUEST_LABELS[String(raw.kind)] ?? raw.kind].filter(Boolean).join(' · '),
    reason: 'Komuna pret vendimin e redaksisë',
    municipality: raw.municipality ? String(raw.municipality) : undefined,
    // A removal request is the one that can leave content up that should come down.
    urgency: raw.kind === 'request_removal' ? 'high' : 'normal',
    createdAt: toIso(raw.at) || toIso(raw.createdAt),
    section: 'workfacts',
  };
}

// ── Ordering ─────────────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * How much it hurts that this item is still waiting. Higher sorts first.
 *
 *   1. past its deadline, and the longer past, the higher;
 *   2. critical urgency;
 *   3. due soonest;
 *   4. waiting longest.
 * Tiers are 1e12 apart so a lower tier can never outrank a higher one.
 */
export function priority(item: InboxItem, now: number): number {
  const created = Date.parse(item.createdAt);
  const waited = Number.isFinite(created) ? Math.max(0, now - created) : 0;
  const due = item.dueAt ? Date.parse(item.dueAt) : Number.NaN;

  let score = Math.min(waited, 365 * DAY_MS); // tier 4: age
  if (isOverdueItem(item, now)) {
    // tier 1; the longer past the deadline the higher (0 when only the stored status says late)
    score += 4e12 + (Number.isFinite(due) ? Math.min(Math.max(0, now - due), 365 * DAY_MS) : 0);
  } else if (Number.isFinite(due)) {
    score += 1e12 + Math.max(0, 30 * DAY_MS - (due - now)); // tier 3: sooner is higher
  }
  if (item.urgency === 'critical') score += 2e12; // tier 2
  else if (item.urgency === 'high') score += 5e11;
  return score;
}

export function sortInbox(items: readonly InboxItem[], now: number): InboxItem[] {
  return items
    .map(item => ({ item, score: priority(item, now) }))
    .sort((a, b) => b.score - a.score || a.item.key.localeCompare(b.item.key))
    .map(entry => entry.item);
}

export function isOverdueItem(item: InboxItem, now: number): boolean {
  if (item.overdue) return true;
  const due = item.dueAt ? Date.parse(item.dueAt) : Number.NaN;
  return Number.isFinite(due) && due < now;
}

export function countByKind(items: readonly InboxItem[]): Record<InboxKind, number> {
  const counts = Object.fromEntries(Object.keys(INBOX_KINDS).map(kind => [kind, 0])) as Record<InboxKind, number>;
  for (const item of items) counts[item.kind] += 1;
  return counts;
}

/** Keep one kind (or all) and, when given, only items inside a municipality. */
export function filterInbox(
  items: readonly InboxItem[],
  options: { kind?: InboxKind | ''; inMunicipality?: (item: InboxItem) => boolean }
): InboxItem[] {
  return items.filter(item => {
    if (options.kind && item.kind !== options.kind) return false;
    if (options.inMunicipality && !options.inMunicipality(item)) return false;
    return true;
  });
}
