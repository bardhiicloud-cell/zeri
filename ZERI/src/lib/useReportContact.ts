import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

export interface ReportContact { name: string; phone: string }

/**
 * The name and phone a guest left with a report (`reportPrivate/{id}`). Firestore rules
 * let only staff and the author read it; for anyone else, or for older reports that
 * have none, this stays null and the screen shows what the public report has.
 */
export function useReportContact(reportId: string | undefined | null): ReportContact | null {
  const [contact, setContact] = useState<ReportContact | null>(null);
  useEffect(() => {
    setContact(null);
    if (!reportId) return;
    let cancelled = false;
    getDoc(doc(db, 'reportPrivate', reportId))
      .then(snap => {
        if (cancelled || !snap.exists()) return;
        const data = snap.data() as Partial<ReportContact>;
        setContact({ name: String(data.name ?? ''), phone: String(data.phone ?? '') });
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [reportId]);
  return contact;
}

/** "Name · phone" for a staff screen, falling back to the public author name. */
export function contactLine(contact: ReportContact | null, fallback: string | undefined): string {
  const parts = [contact?.name || fallback, contact?.phone].filter(Boolean);
  return parts.length ? parts.join(' · ') : '—';
}
