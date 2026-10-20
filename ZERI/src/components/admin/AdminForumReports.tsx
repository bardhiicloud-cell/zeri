import { useCallback, useEffect, useState } from 'react';
import { collection, doc, getDocs, limit, orderBy, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { AlertTriangle, CheckCircle2, Flag, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { dt } from '@/src/lib/dt';
import { auth, db } from '../../lib/firebase';
import { useStore } from '../../lib/store';
import { deleteCommentApi } from '../../lib/forumPostsApi';
import { REPORT_TARGET_REASONS } from '../../lib/forumReportsApi';
import { askConfirm, askReason } from '../../lib/dialogs';

interface Row {
  id: string; kind: 'comment' | 'user' | 'ad'; targetId: string; postId: string; reason: string; details: string;
  snapshot: { name?: string; excerpt?: string; authorName?: string };
  createdAtMs: number | null;
}

const KIND_LABEL = { comment: 'Koment', user: 'Llogari', ad: 'Reklamë' } as const;
const reasonLabel = (id: string) => REPORT_TARGET_REASONS.find((r) => r.id === id)?.label ?? id;
const fmt = (ms: number | null) => (ms ? new Date(ms).toLocaleString('sq-AL', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

/** Moderator queue for reported comments, accounts and ads. Rules restrict reading and closing to staff. */
export default function AdminForumReports() {
  const currentUser = useStore((s) => s.currentUser);
  const staffId = auth.currentUser?.uid || currentUser?.id || 'stafi';
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const snap = await getDocs(query(collection(db, 'forumReports'), where('status', '==', 'open'), orderBy('createdAt', 'desc'), limit(100)));
      setRows(snap.docs.map((d) => {
        const x = d.data();
        return {
          id: d.id, kind: x.kind, targetId: x.targetId, postId: x.postId ?? '', reason: x.reason, details: x.details ?? '',
          snapshot: x.snapshot ?? {}, createdAtMs: x.createdAt?.toMillis?.() ?? null,
        };
      }));
      setStatus('ready');
    } catch (error) {
      console.error('Raportimet nuk u ngarkuan:', error);
      setStatus('error');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const close = async (row: Row, deleteComment: boolean) => {
    if (busy) return;
    if (deleteComment && !await askConfirm(dt('Ta fshij këtë koment?'))) return;
    setBusy(row.id);
    try {
      if (deleteComment) await deleteCommentApi(row.postId, row.targetId).catch((e) => { if (e?.status !== 404) throw e; });
      await updateDoc(doc(db, 'forumReports', row.id), { status: 'closed', resolvedBy: staffId, resolvedAt: serverTimestamp() });
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      toast.success(deleteComment ? dt('Komenti u fshi.') : dt('Raportimi u mbyll.'));
    } catch (error) {
      toast.error(error?.message || dt('Veprimi dështoi.'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 rounded-[2rem] border border-slate-700 bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950 p-5 text-white">
        <div className="flex items-center gap-3">
          <span className="rounded-xl bg-amber-400/10 p-2 text-amber-300"><Flag className="h-6 w-6" aria-hidden="true" /></span>
          <div>
            <h2 className="text-xl font-black sm:text-2xl">{dt('Raportime: komente, llogari, reklama')}</h2>
            <p className="mt-1 text-xs text-slate-300">{dt('Asgjë nuk fshihet automatikisht. Shihni përmbajtjen e raportuar dhe vendosni.')}</p>
          </div>
        </div>
        <button type="button" onClick={() => void load()} aria-label={dt('Rifresko')} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 hover:bg-white/20">
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {status === 'loading' && <div role="status" className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> {dt('Po ngarkohen raportimet…')}</div>}
      {status === 'error' && (
        <div role="alert" className="rounded-2xl border border-rose-300/30 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          <p className="flex items-center gap-2 font-black"><AlertTriangle className="h-4 w-4" aria-hidden="true" /> {dt('Raportimet nuk u ngarkuan')}</p>
          <p className="mt-1 text-xs">{dt('Kontrolloni lejet e stafit dhe që indeksi i forumReports është i publikuar.')}</p>
        </div>
      )}
      {status === 'ready' && rows.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-300 py-14 text-slate-500">
          <CheckCircle2 className="h-6 w-6 text-emerald-500" aria-hidden="true" />
          <p className="text-sm font-bold">{dt('Nuk ka raportime të hapura.')}</p>
        </div>
      )}

      <ul className="grid gap-4 lg:grid-cols-2">
        {rows.map((r) => (
          <li key={r.id} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="rounded-full bg-amber-100 px-2 py-0.5 font-black text-amber-800">{dt(KIND_LABEL[r.kind] ?? r.kind)}</span>
              <span className="text-slate-500">{fmt(r.createdAtMs)}</span>
            </div>
            <p className="mt-2 text-sm font-black text-slate-900 dark:text-white">{r.snapshot.authorName || r.snapshot.name || r.targetId}</p>
            {r.snapshot.excerpt && <p className="mt-1 line-clamp-4 whitespace-pre-line text-xs text-slate-600 dark:text-slate-300">“{r.snapshot.excerpt}”</p>}
            <p className="mt-2 text-xs font-bold text-rose-600">{dt(reasonLabel(r.reason))}</p>
            {r.details && <p className="mt-0.5 whitespace-pre-line text-xs text-slate-500">{r.details}</p>}
            <div className="mt-3 flex gap-2">
              <button type="button" disabled={busy === r.id} onClick={() => void close(r, false)} className="flex-1 rounded-full border border-slate-300 py-2 text-xs font-black dark:border-slate-600">{dt('Mbaje, mbyll')}</button>
              {r.kind === 'comment' && (
                <button type="button" disabled={busy === r.id} onClick={() => void close(r, true)} className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-rose-600 py-2 text-xs font-black text-white disabled:opacity-60">
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> {dt('Fshi komentin')}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
