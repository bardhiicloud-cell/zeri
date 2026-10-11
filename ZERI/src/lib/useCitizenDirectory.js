import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, limit, orderBy } from 'firebase/firestore';
import { db } from './firebase';
import { useStore } from './store';
const PAGE_SIZE = 50;
/** Staff roles permitted to read the directory. Mirrors server/auth.ts. */
const STAFF_ROLES = new Set([
    'admin', 'superadmin', 'approver', 'adsadmin', 'newsadmin',
    'agent', 'responder', 'dispatcher', 'moderator',
]);
export function useCitizenDirectory() {
    const currentUser = useStore((state) => state.currentUser);
    const isStaff = Boolean(currentUser && STAFF_ROLES.has(currentUser.role));
    const [citizens, setCitizens] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    // Pagination state. `cursor` is the last visible document; Firestore's
    // startAfter walks the collection without ever counting or buffering it.
    const [page, setPage] = useState(0);
    const [cursors, setCursors] = useState([null]);
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
        let q = query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(PAGE_SIZE));
        const startAfter = cursors[page];
        if (startAfter)
            q = query(q, startAfter);
        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (cancelled)
                return;
            const rows = snapshot.docs.map((doc) => {
                const data = doc.data();
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
        }, (err) => {
            if (cancelled)
                return;
            console.error('[Directory] query failed:', err.message);
            setError(err.code === 'permission-denied'
                ? 'Nuk keni leje për të parë regjistrin e qytetarëve.'
                : 'Regjistri nuk mund të ngarkohej. Kontrolloni indekset e Firestore.');
            setIsLoading(false);
        });
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
        setPage: (next) => setPage(Math.max(0, next)),
        hasMore,
        hasPrevious: page > 0,
    };
}
/** Convenience for the admin dashboard counters. */
export function useCitizenCount() {
    const currentUser = useStore((state) => state.currentUser);
    const isStaff = Boolean(currentUser && STAFF_ROLES.has(currentUser.role));
    const [count, setCount] = useState(null);
    useEffect(() => {
        if (!isStaff)
            return;
        let cancelled = false;
        // The aggregate count comes from the cached server endpoint, not from a
        // client-side tally of a partial page, which would be silently wrong.
        void fetch('/api/v1/admin/users/count', { credentials: 'include' })
            .then((response) => (response.ok ? response.json() : null))
            .then((data) => {
            if (!cancelled && data && typeof data.count === 'number')
                setCount(data.count);
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
