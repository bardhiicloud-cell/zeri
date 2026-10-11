import type { User } from '../types';

function getGuestStorageKey(): string {
  return 'zq_guest_session_id';
}

export function formatGuestName(id: string): string {
  const shortId = id.replace(/^GUEST-/i, '').slice(0, 6).toUpperCase();
  return shortId ? `Mysafir #${shortId}` : 'Mysafir';
}

export function createGuestUser(): User {
  const fallbackId = typeof window !== 'undefined'
    ? (localStorage.getItem(getGuestStorageKey()) || `GUEST-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`)
    : `GUEST-${Date.now().toString(36).toUpperCase()}`;

  if (typeof window !== 'undefined' && !localStorage.getItem(getGuestStorageKey())) {
    localStorage.setItem(getGuestStorageKey(), fallbackId);
  }

  return {
    id: fallbackId,
    name: formatGuestName(fallbackId),
    email: 'guest@zeriqytetareve.local',
    role: 'guest',
    points: 0,
    badges: ['Mysafir i Verifikuar Lokal'],
    isVerified: false,
    phone: '',
    avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(formatGuestName(fallbackId))}&background=0D8ABC&color=fff`,
    trustScore: 0,
  };
}

export function getOrCreateGuestUser(): User {
  if (typeof window === 'undefined') return createGuestUser();
  const existing = localStorage.getItem(getGuestStorageKey());
  if (existing) {
    return {
      id: existing,
      name: formatGuestName(existing),
      email: 'guest@zeriqytetareve.local',
      role: 'guest',
      points: 0,
      badges: ['Mysafir i Verifikuar Lokal'],
      isVerified: false,
      phone: '',
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(formatGuestName(existing))}&background=0D8ABC&color=fff`,
      trustScore: 0,
    };
  }
  return createGuestUser();
}

export function createTrackingId(prefix: string, sourceId?: string): string {
  const normalizedPrefix = prefix.toUpperCase().replace(/[^A-Z0-9-]/g, '');
  const dateStamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const source = (sourceId || `${Date.now()}${Math.random().toString(36).slice(2, 8)}`).replace(/[^A-Z0-9]/g, '').toUpperCase();
  const suffix = source.slice(0, 12) || '000000000000';
  return `${normalizedPrefix}-${dateStamp}-${suffix}`;
}

export interface GuestReportRecord {
  id: string;
  trackingId: string;
  title: string;
  description?: string;
  category?: string;
  topicCategory?: string;
  status?: string;
  municipality?: string;
  createdAt: string;
}

const GUEST_REPORTS_KEY = 'zq_guest_report_history';

export function getGuestReportHistory(): GuestReportRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(GUEST_REPORTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveGuestReportHistory(entry: GuestReportRecord): GuestReportRecord[] {
  if (typeof window === 'undefined') return [];
  const current = getGuestReportHistory();
  const next = [entry, ...current.filter(item => item.trackingId !== entry.trackingId && item.id !== entry.id)].slice(0, 30);
  localStorage.setItem(GUEST_REPORTS_KEY, JSON.stringify(next));
  return next;
}
