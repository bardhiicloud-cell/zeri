import { useEffect, useMemo, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query, where, type Query } from 'firebase/firestore';
import { db } from './firebase';
import { requireAdminToken } from './adminApi';
import { STAFF_LIMITS } from './loadLimits';

/**
 * Live records for the work inbox, one bounded listener per source.
 *
 * Each source is opened only if the viewer's role can open the section it feeds,
 * is filtered to "waiting" records in the query itself (a single-field filter,
 * so no composite index), and has a hard limit. A source that fails — a role the
 * rules do not allow, an offline browser — is reported in `unavailable` and
 * contributes nothing; it never blanks the others.
 */

export type RawRecord = Record<string, unknown> & { id: string };

export interface InboxAccess {
  workfacts: boolean;
  health: boolean;
  support: boolean;
  ads: boolean;
  /** Citizen news tips. The rules open them to the newsroom (newsadmin) and the owner only. */
  news: boolean;
}

type SourceKey = 'workFacts' | 'health' | 'shortages' | 'chats' | 'adRequests' | 'newsTips';

const PER_SOURCE_LIMIT = 100;

function sources(access: InboxAccess): Array<{ key: SourceKey; build: () => Query }> {
  const list: Array<{ key: SourceKey; build: () => Query }> = [];
  if (access.workfacts) {
    list.push({ key: 'workFacts', build: () => query(collection(db, 'workFacts'), where('review', '==', 'pending'), limit(PER_SOURCE_LIMIT)) });
  }
  if (access.health) {
    // The health registry is read newest-first and filtered in memory: an urgent
    // case with no hospital notified is not captured by one `status` value.
    list.push({ key: 'health', build: () => query(collection(db, 'healthRegistry'), orderBy('createdAt', 'desc'), limit(STAFF_LIMITS.healthCases)) });
    list.push({ key: 'shortages', build: () => query(collection(db, 'medicineShortages'), where('status', '==', 'pending'), limit(PER_SOURCE_LIMIT)) });
  }
  if (access.support) {
    list.push({ key: 'chats', build: () => query(collection(db, 'supportChats'), where('status', '==', 'waiting_agent'), limit(PER_SOURCE_LIMIT)) });
  }
  if (access.ads) {
    list.push({ key: 'adRequests', build: () => query(collection(db, 'adRequests'), where('status', '==', 'pending'), limit(PER_SOURCE_LIMIT)) });
  }
  if (access.news) {
    list.push({ key: 'newsTips', build: () => query(collection(db, 'newsTips'), where('status', '==', 'submitted'), limit(PER_SOURCE_LIMIT)) });
  }
  return list;
}

export function useInboxSources(access: InboxAccess) {
  const [data, setData] = useState<Partial<Record<SourceKey, RawRecord[]>>>({});
  const [failed, setFailed] = useState<SourceKey[]>([]);
  const [settled, setSettled] = useState<SourceKey[]>([]);
  // Municipality requests live in a private collection (no client reads), so they
  // come from the staff API and are refreshed every minute.
  const [muniRequests, setMuniRequests] = useState<RawRecord[]>([]);

  const { workfacts, health, support, ads, news } = access;

  useEffect(() => {
    if (!workfacts) {
      setMuniRequests([]);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const token = await requireAdminToken();
        const response = await fetch('/api/v1/admin/municipality-requests?status=pending', { headers: { Authorization: `Bearer ${token}` } });
        if (!response.ok) return;
        const body = await response.json();
        if (!cancelled) setMuniRequests(Array.isArray(body.items) ? body.items : []);
      } catch {
        // Offline or signed out: the other sources still show.
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [workfacts]);
  const wanted = useMemo(() => sources({ workfacts, health, support, ads, news }), [workfacts, health, support, ads, news]);

  useEffect(() => {
    setData({});
    setFailed([]);
    setSettled([]);

    const unsubscribes = wanted.map(({ key, build }) =>
      onSnapshot(
        build(),
        snapshot => {
          setData(current => ({ ...current, [key]: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as RawRecord) }));
          setSettled(current => (current.includes(key) ? current : [...current, key]));
        },
        error => {
          console.warn(`[Inbox] "${key}" unavailable:`, (error as { code?: string }).code ?? error.message);
          setFailed(current => (current.includes(key) ? current : [...current, key]));
          setSettled(current => (current.includes(key) ? current : [...current, key]));
        }
      )
    );
    return () => unsubscribes.forEach(unsubscribe => unsubscribe());
  }, [wanted]);

  return {
    workFacts: data.workFacts ?? [],
    health: data.health ?? [],
    shortages: data.shortages ?? [],
    chats: data.chats ?? [],
    adRequests: data.adRequests ?? [],
    newsTips: data.newsTips ?? [],
    muniRequests,
    /** True once every source that was opened has answered (or failed). */
    ready: wanted.every(({ key }) => settled.includes(key)),
    unavailable: failed,
  };
}
