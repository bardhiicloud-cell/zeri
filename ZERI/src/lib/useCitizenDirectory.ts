import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, limit, orderBy, type Query } from 'firebase/firestore';
import { db } from './firebase';
import { useStore } from './store';

/**
 * Paginated, staff-only access to the citizens directory.
 *
 * Three things this replaces:
 *
 *  1. A collection-wide `onSnapshot` that every visitor used to open, which
 *     cost one read per user profile per session and downloaded the whole
 *     country. Now it only opens for staff, and only one page at a time.
 *  2. `getDocs(collection(db, 'users'))` in the admin panel, which cannot scale
 *     past a few thousand documents because it materialises everything at once.
 *  3. Downloading full profile documents to render a list. The directory needs
 *     name, role and points; the email and phone stay in Firestore until an
 *     operator opens a single record.
 */

export interface CitizenSummary {
  id: string;
  name: string;
  role: string;
  points: number;
  isBanned: boolean;
  isVerified: boolean;
  createdAt?: string;
  /**
   * Per-section grants, present only on staff. The directory query reads them
   * so the agent console can show and edit what a staffer may open without a
   * second round trip; they are empty for ordinary citizens.
   */
  permissions: string[];
  /** Free-text notes an administrator left on the account. */
  notes: string;
  /** Contact details, present only for staff. Never fetched for citizens. */
  email: string;
  phone: string;
  /**
   * The municipality this account represents or is scoped to.
   *
   * Present for municipal accounts and for staff that have been pinned to one.
   * The monitoring and moderation consoles group by it, so it has to travel
   * with the directory row rather than be looked up per row.
   */
  municipality: string;
  /** Subscription tier, shown beside a municipal account. Grants no power. */
  municipalityPlan: string;
  /** Kept for structural compatibility with the shared User shape. */
  badges: string[];
}

const PAGE_SIZE = 50;

/** Staff roles permitted to read the directory. Mirrors server/auth.ts. */
const STAFF_ROLES = new Set([
  'admin', 'superadmin', 'approver', 'adsadmin', 'newsadmin',
  'agent', 'responder', 'dispatcher', 'moderator',
]);

export function useCitizenDirectory() {
  const currentUser = useStore((state) => state.currentUser);
  const isStaff = Boolean(currentUser && STAFF_ROLES.has(currentUser.role));
  const [citizens, setCitizens] = useState<CitizenSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pagination state. `cursor` is the last visible document; Firestore's
  // startAfter walks the collection without ever counting or buffering it.
  const [page, setPage] = useState(0);
  const [cursors, setCursors] = useState<Array<QueryDocumentSnapshotLike | null>>([null]);
  const [hasMore, setHasMore] = useState(true);

  /**
   * Sampled outside the effect so it can appear in the dependency array. A
   * demotion therefore tears the listener down instead of leaving a revoked
   * session subscribed to the directory.
   */
  const role = currentUser?.role ?? '';

  useEffect(() => {
    // Nothing to load for a citizen or a guest, and no listener is opened.
    if (!isStaff) {
      setCitizens([]);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    let q: Query = query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(PAGE_SIZE));
    const startAfter = cursors[page];
    if (startAfter) q = query(q, startAfter as never);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (cancelled) return;

        const rows: CitizenSummary[] = snapshot.docs.map((doc) => {
          const data = doc.data() as Record<string, unknown>;
          const role = String(data.role ?? 'citizen');
          const isStaffAccount = STAFF_ROLES.has(role);
          return {
            id: doc.id,
            name: String(data.name ?? 'Përdorues i panjohur'),
            role,
            points: Number(data.points ?? 0),
            isBanned: data.isBanned === true,
            isVerified: data.isVerified === true,
            createdAt: typeof data.createdAt === 'string' ? data.createdAt : undefined,
            permissions: Array.isArray(data.permissions)
              ? data.permissions.map(String)
              : [],
            notes: String(data.notes ?? ''),
            // Contact details are only carried for staff records. Leaving them
            // empty for citizens keeps a list of 50 rows free of PII that the
            // table does not display.
            email: isStaffAccount ? String(data.email ?? '') : '',
            phone: isStaffAccount ? String(data.phone ?? '') : '',
            municipality: String(data.municipality ?? ''),
            municipalityPlan: String(data.municipalityPlan ?? ''),
            badges: Array.isArray(data.badges) ? data.badges.map(String) : [],
          };
        });

        setCitizens(rows);
        setHasMore(snapshot.docs.length === PAGE_SIZE);

        const last = snapshot.docs[snapshot.docs.length - 1];
        if (last) {
          setCursors((previous) => {
            const next = [...previous];
            next[page + 1] = last;
            return next;
          });
        }
        setIsLoading(false);
      },
      (err) => {
        if (cancelled) return;
        console.error('[Directory] query failed:', err.message);
        setError(
          err.code === 'permission-denied'
            ? 'Nuk keni leje për të parë regjistrin e qytetarëve.'
            : 'Regjistri nuk mund të ngarkohej. Kontrolloni indekset e Firestore.'
        );
        setIsLoading(false);
      }
    );

    return () => {
      cancelled = true;
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStaff, page, role]);

  return {
    citizens,
    isLoading,
    error,
    page,
    setPage: (next: number) => setPage(Math.max(0, next)),
    hasMore,
    hasPrevious: page > 0,
  };
}

/**
 * Minimal structural type for the cursor. Firestore's QueryDocumentSnapshot is
 * generic and awkward to thread through a state array, so only the two members
 * the SDK needs are modelled.
 */
type QueryDocumentSnapshotLike = object & { id: string };

/** Convenience for the admin dashboard counters. */
export function useCitizenCount() {
  const currentUser = useStore((state) => state.currentUser);
  const isStaff = Boolean(currentUser && STAFF_ROLES.has(currentUser.role));
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (!isStaff) return;
    let cancelled = false;

    // The aggregate count comes from the cached server endpoint, not from a
    // client-side tally of a partial page, which would be silently wrong.
    void fetch('/api/v1/admin/users/count', { credentials: 'include' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled && data && typeof data.count === 'number') setCount(data.count);
      })
      .catch(() => {
        // A missing counter is cosmetic; the panel still works without it.
      });

    return () => {
      cancelled = true;
    };
  }, [isStaff]);

  return count;
}
