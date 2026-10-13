import type { PublicTrackView } from '../../server/trackLookup';

export type { PublicTrackView };
export type {
  PublicMedia, PublicOfficialResponse, PublicTimelineEvent, ResolutionState,
} from '../../server/trackLookup';

/** Same shape the server accepts (server/trackLookup.ts); checked here to save a request. */
export const TRACKING_ID_PATTERN = /^[A-Z0-9][A-Z0-9-]{7,39}$/;

export function normalizeTrackingId(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

export type TrackErrorKind = 'invalid' | 'not_found' | 'rate_limited' | 'network' | 'server';

export class TrackLookupError extends Error {
  constructor(public kind: TrackErrorKind, message: string, public retryAfter?: number) {
    super(message);
  }
}

/**
 * Looks a report up by Track ID through the server, which decides what is public.
 * The browser never reads the report document itself.
 */
export async function lookupTrackingId(rawId: string, signal?: AbortSignal): Promise<PublicTrackView> {
  const trackingId = normalizeTrackingId(rawId);
  if (!TRACKING_ID_PATTERN.test(trackingId)) {
    throw new TrackLookupError('invalid', 'Track ID duhet të ketë 8 deri 40 shenja: shkronja, shifra ose viza (p.sh. ZQ-20260101-ABC123).');
  }

  let response: Response;
  try {
    response = await fetch(`/api/v1/public/track/${encodeURIComponent(trackingId)}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal,
    });
  } catch (error) {
    if ((error as { name?: string })?.name === 'AbortError') throw error;
    throw new TrackLookupError('network', 'Nuk u lidhëm me serverin. Kontrolloni internetin dhe provoni përsëri.');
  }

  if (response.ok) {
    const body = (await response.json()) as { report?: PublicTrackView };
    if (!body.report) throw new TrackLookupError('server', 'Përgjigja e serverit ishte e pavlefshme.');
    return body.report;
  }

  const body = (await response.json().catch(() => ({}))) as { error?: string; retryAfter?: number };
  if (response.status === 404) {
    throw new TrackLookupError('not_found', body.error || 'Nuk u gjet asnjë raportim me këtë Track ID.');
  }
  if (response.status === 429) {
    const wait = Number(body.retryAfter ?? response.headers.get('Retry-After') ?? 0) || undefined;
    throw new TrackLookupError('rate_limited', body.error || 'Shumë kërkime. Provoni përsëri pas pak.', wait);
  }
  throw new TrackLookupError('server', body.error || 'Kërkimi nuk u krye. Provoni përsëri.');
}

export type StepState = 'done' | 'current' | 'upcoming' | 'rejected';

export interface JourneyStep {
  id: string;
  label: string;
  state: StepState;
  /** Date the report reached this stage, when it did. */
  date: string | null;
}

const RANK: Record<string, number> = {
  'Pending Review': 0, Approved: 1, Assigned: 2, 'In Progress': 3, Resolved: 4, Closed: 5,
};

/**
 * The stages of a report and where this one stands.
 *
 * Every state comes from the report's own history: a step is `done` only when an
 * event with that status exists. Stages ahead of the current one are shown as
 * `upcoming` so the citizen sees the path, never as completed. An official
 * response is its own stage only when one was actually published.
 */
export function buildJourney(report: PublicTrackView): JourneyStep[] {
  const firstDate = (status: string) => report.timeline.find(event => event.status === status)?.date ?? null;
  const submitted: JourneyStep = { id: 'submitted', label: 'Dërguar', state: 'done', date: report.createdAt ?? report.timeline[0]?.date ?? null };
  const review = { id: 'review', label: 'Në shqyrtim', rank: 0, date: firstDate('Pending Review') };

  if (report.status === 'Rejected') {
    return [
      submitted,
      { id: 'review', label: 'Në shqyrtim', state: 'done', date: review.date },
      { id: 'rejected', label: 'U refuzua', state: 'rejected', date: firstDate('Rejected') },
    ];
  }

  // Overdue is a flag over whichever stage the report was in, not a stage.
  const reached = report.timeline
    .filter(event => event.status in RANK)
    .reduce((max, event) => Math.max(max, RANK[event.status]), 0);
  const currentRank = report.status in RANK ? RANK[report.status] : reached;

  const stages: Array<{ id: string; label: string; rank: number; date: string | null }> = [
    review,
    { id: 'approved', label: 'Aprovuar', rank: 1, date: firstDate('Approved') },
    { id: 'assigned', label: 'I caktuar te institucioni', rank: 2, date: firstDate('Assigned') },
    { id: 'progress', label: 'Në proces', rank: 3, date: firstDate('In Progress') },
    { id: 'resolved', label: 'U zgjidh', rank: 4, date: firstDate('Resolved') },
    { id: 'closed', label: 'Verifikim nga platforma', rank: 5, date: null },
  ];

  // A stage the report skipped (no event, and the report is already past it) is not
  // shown as done: the pipeline never produced it for this case.
  const steps: JourneyStep[] = stages.filter(stage => stage.date || stage.rank >= currentRank).map(stage => ({
    id: stage.id,
    label: stage.label,
    date: stage.date,
    state: stage.rank < currentRank || (stage.rank <= reached && stage.rank !== currentRank)
      ? 'done'
      : stage.rank === currentRank ? 'current' : 'upcoming',
  }));

  // The last stage is the platform's own verification. The pipeline marks a case
  // `Resolved` when the institution says it is done and again, after staff checked
  // it, so what the citizen is waiting for depends on that second fact.
  const resolvedStep = steps.find(step => step.id === 'resolved');
  const finalStep = steps[steps.length - 1];
  if (resolvedStep && report.resolution.state !== 'none') {
    resolvedStep.state = 'done';
    resolvedStep.date = report.resolution.resolvedAt ?? resolvedStep.date;
  }
  if (report.resolution.state === 'awaiting_verification') {
    finalStep.label = 'Në pritje të verifikimit';
    finalStep.state = 'current';
  } else if (report.resolution.state === 'verified' || report.resolution.state === 'closed') {
    finalStep.label = 'Verifikuar dhe mbyllur';
    finalStep.state = 'done';
    finalStep.date = report.resolution.verifiedAt ?? finalStep.date;
  }

  const response = report.officialResponses[0];
  if (response) {
    const at = steps.findIndex(step => step.id === 'resolved');
    steps.splice(at, 0, { id: 'response', label: 'Përgjigje zyrtare', state: 'done', date: response.date });
  }
  return [submitted, ...steps];
}
