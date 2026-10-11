import type { IssueStatus } from '@/src/types';

/**
 * The canonical report-status vocabulary.
 *
 * Internally the pipeline stores English status codes (they are matched by
 * firestore.rules, server/approvalPipeline.ts and the municipality-visibility
 * rule). Everything the citizen reads — Track ID, the bell, the news live feed,
 * the admin detail view — must render the same Albanian label, icon and colour.
 * Before this module those labels were re-declared by hand in at least three
 * components, so they drifted. This is the single source of truth.
 *
 * The `tone` is a semantic token key (mapped to CSS variables in index.css), not
 * a raw colour, so dark/light mode stays correct everywhere it is used.
 */

export type StatusTone = 'neutral' | 'info' | 'primary' | 'warning' | 'success' | 'danger';

export interface StatusMeta {
  /** Albanian label shown to citizens. */
  label: string;
  /** Lucide icon name. */
  icon: string;
  tone: StatusTone;
  /** Short sentence used to build the reporter's notification. */
  notifyTemplate: string;
  /** Whether a report in this status is public record. */
  isPublic: boolean;
  /** Whether reaching this status should notify the reporter. */
  notifyReporter: boolean;
}

export const REPORT_STATUS: Record<IssueStatus, StatusMeta> = {
  'Draft': {
    label: 'Draft',
    icon: 'FileEdit',
    tone: 'neutral',
    notifyTemplate: 'Raportimi juaj {track} është ruajtur si draft.',
    isPublic: false,
    notifyReporter: false,
  },
  'Pending Review': {
    label: 'Në pritje',
    icon: 'Clock',
    tone: 'info',
    notifyTemplate: 'Raportimi juaj {track} u pranua dhe është në pritje të shqyrtimit.',
    isPublic: false,
    notifyReporter: true,
  },
  'Approved': {
    label: 'U aprovua',
    icon: 'CheckCircle2',
    tone: 'primary',
    notifyTemplate: 'Raportimi juaj {track} u aprovua dhe u dërgua te institucioni përgjegjës.',
    isPublic: true,
    notifyReporter: true,
  },
  'Assigned': {
    label: 'I caktuar',
    icon: 'UserCheck',
    tone: 'primary',
    notifyTemplate: 'Raportimi juaj {track} i është caktuar një inspektori.',
    isPublic: true,
    notifyReporter: true,
  },
  'In Progress': {
    label: 'Në proces',
    icon: 'Loader',
    tone: 'warning',
    notifyTemplate: 'Komuna ka filluar trajtimin e raportimit tuaj {track}.',
    isPublic: true,
    notifyReporter: true,
  },
  'Resolved': {
    label: 'U zgjidh',
    icon: 'BadgeCheck',
    tone: 'success',
    notifyTemplate: 'Raportimi juaj {track} është zgjidhur.',
    isPublic: true,
    notifyReporter: true,
  },
  'Rejected': {
    label: 'U refuzua',
    icon: 'XCircle',
    tone: 'danger',
    notifyTemplate: 'Raportimi juaj {track} është refuzuar. Arsyeja është shënuar në detaje.',
    isPublic: true,
    notifyReporter: true,
  },
  'Overdue': {
    label: 'Përgjegjësi e vonuar',
    icon: 'AlarmClock',
    tone: 'danger',
    notifyTemplate: 'Raportimi juaj {track} ka kaluar afatin e përgjigjes.',
    isPublic: true,
    notifyReporter: true,
  },
  'Closed': {
    label: 'U mbyll',
    icon: 'Lock',
    tone: 'neutral',
    notifyTemplate: 'Raportimi juaj {track} është mbyllur.',
    isPublic: true,
    notifyReporter: true,
  },
};

/** Albanian label for a status code, safe against unknown/legacy values. */
export function statusLabel(status: string | undefined | null): string {
  if (!status) return 'E panjohur';
  return REPORT_STATUS[status as IssueStatus]?.label ?? status;
}

export function statusMeta(status: string | undefined | null): StatusMeta {
  return (
    REPORT_STATUS[status as IssueStatus] ?? {
      label: status || 'E panjohur',
      icon: 'HelpCircle',
      tone: 'neutral',
      notifyTemplate: 'Raportimi juaj {track} ka ndryshuar statusin.',
      isPublic: false,
      notifyReporter: true,
    }
  );
}

export function statusIcon(status: string | undefined | null): string {
  return statusMeta(status).icon;
}

export function statusTone(status: string | undefined | null): StatusTone {
  return statusMeta(status).tone;
}

/** Whether a status counts as public record (safe for the live news feed). */
export function isPublicStatus(status: string | undefined | null): boolean {
  return statusMeta(status).isPublic;
}

/** Build the reporter-facing notification sentence for a status change. */
export function buildStatusNotification(
  status: string,
  trackId: string | undefined,
  municipality?: string
): string {
  const template = statusMeta(status).notifyTemplate;
  return template
    .replace('{track}', trackId ? `#${trackId}` : 'juaj')
    .replace('{municipality}', municipality || '');
}

/**
 * Ordered status list for filter dropdowns (admin, registry, live feed).
 * Ordered by lifecycle position so filters read naturally.
 */
export const STATUS_ORDER: IssueStatus[] = [
  'Pending Review',
  'Approved',
  'Assigned',
  'In Progress',
  'Resolved',
  'Closed',
  'Rejected',
  'Overdue',
  'Draft',
];

/** Tailwind token classes per tone — resolved against CSS variables. */
export const TONE_CLASSES: Record<StatusTone, { badge: string; dot: string; text: string }> = {
  neutral: {
    badge: 'bg-(--color-surface-subtle) text-(--color-text-muted) border-(--color-border-soft)',
    dot: 'bg-(--color-text-muted)',
    text: 'text-(--color-text-muted)',
  },
  info: {
    badge: 'bg-(--color-info)/12 text-(--color-info) border-(--color-info)/30',
    dot: 'bg-(--color-info)',
    text: 'text-(--color-info)',
  },
  primary: {
    badge: 'bg-(--color-primary)/12 text-(--color-primary) border-(--color-primary)/30',
    dot: 'bg-(--color-primary)',
    text: 'text-(--color-primary)',
  },
  warning: {
    badge: 'bg-(--color-warning)/15 text-(--color-warning) border-(--color-warning)/30',
    dot: 'bg-(--color-warning)',
    text: 'text-(--color-warning)',
  },
  success: {
    badge: 'bg-(--color-success)/12 text-(--color-success) border-(--color-success)/30',
    dot: 'bg-(--color-success)',
    text: 'text-(--color-success)',
  },
  danger: {
    badge: 'bg-(--color-error)/12 text-(--color-error) border-(--color-error)/30',
    dot: 'bg-(--color-error)',
    text: 'text-(--color-error)',
  },
};
