/**
 * Where a broadcast notification appears. One list, used by the admin form (to show the author
 * exactly where it will go), by the public components (to decide what to draw) and by tests.
 *
 *   bell    the bell's "Njoftime" tab — always, for every published broadcast
 *   banner  a dismissible strip under the header on the home page and public pages
 *   popup   a single dialog the first time a visitor opens the site after it is published
 *   news    a pinned strip at the top of the Lajme page
 */
export type NotificationPlacement = 'bell' | 'banner' | 'popup' | 'news';

export const PLACEMENTS: readonly NotificationPlacement[] = ['bell', 'banner', 'popup', 'news'];

export const PLACEMENT_META: Record<NotificationPlacement, { label: string; where: string; behaviour: string }> = {
  bell: { label: 'Zilja', where: 'Ikona e zilës, skeda "Njoftime"', behaviour: 'Gjithmonë, për çdo njoftim të publikuar; qytetari e hap vetë.' },
  banner: { label: 'Banner në ballinë', where: 'Rripi nën menynë, në ballinë dhe faqet publike', behaviour: 'Qytetari mund ta mbyllë; nuk shfaqet më pas mbylljes.' },
  popup: { label: 'Pop-up', where: 'Dritare në mes të ekranit', behaviour: 'Një herë për çdo vizitor, kur e hap faqen; mbyllet me X ose Esc. Përdoreni vetëm për gjëra të rëndësishme.' },
  news: { label: 'Fillimi i Lajmeve', where: 'Rripi i fiksuar në krye të faqes Lajme', behaviour: 'Qëndron derisa të skadojë ose të çaktivizohet.' },
};

export interface PlacementSource {
  state?: string;
  placements?: unknown;
  expiresAt?: unknown;
  createdAt?: unknown;
  urgent?: boolean;
}

/** The placements a notification has. Older documents have none and are bell-only. */
export function placementsOf(n: Pick<PlacementSource, 'placements'>): NotificationPlacement[] {
  const raw = Array.isArray(n.placements) ? n.placements : [];
  const set = new Set<NotificationPlacement>(['bell']);
  for (const item of raw) if ((PLACEMENTS as readonly string[]).includes(String(item))) set.add(item as NotificationPlacement);
  return PLACEMENTS.filter(p => set.has(p));
}

/** Published and not expired. Expiry is checked in the browser as well, so a stale banner never lingers. */
export function isLive(n: PlacementSource, nowMs = Date.now()): boolean {
  if ((n.state ?? 'published') !== 'published') return false;
  if (typeof n.expiresAt === 'string' && n.expiresAt) {
    const t = Date.parse(n.expiresAt);
    if (Number.isFinite(t) && t <= nowMs) return false;
  }
  return true;
}

/** Of the live notifications that use a placement: urgent first, then newest. */
export function pickFor<T extends PlacementSource & { id: string }>(items: readonly T[], placement: NotificationPlacement, nowMs = Date.now()): T[] {
  const time = (n: T) => (typeof n.createdAt === 'string' ? Date.parse(n.createdAt) || 0 : 0);
  return items
    .filter(n => isLive(n, nowMs) && placementsOf(n).includes(placement))
    .sort((a, b) => Number(Boolean(b.urgent)) - Number(Boolean(a.urgent)) || time(b) - time(a));
}
