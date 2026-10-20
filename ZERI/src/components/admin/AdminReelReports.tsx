import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, EyeOff, Film, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { dt } from '@/src/lib/dt';
import { auth } from '../../lib/firebase';
import { useStore } from '../../lib/store';
import { REEL_REPORT_REASONS, type Reel } from '../../lib/reels';
import {
  fetchOpenReelReports, fetchReelForReview, groupReportsByReel, resolveReelReports, setReelHidden, type ReelReport,
} from '../../lib/reelsSocial';
import { deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { askConfirm } from '../../lib/dialogs';

type Group = { reelId: string; reports: ReelReport[]; reel: (Reel & { isHidden: boolean }) | null | 'missing' };

const reasonLabel = (id: string) => REEL_REPORT_REASONS.find((r) => r.id === id)?.label ?? id;
const fmt = (ms: number | null) => (ms ? new Date(ms).toLocaleString('sq-AL', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

/**
 * Moderator queue for reported Reels. One card per reel, most-reported first.
 * Three outcomes: hide the reel, delete it, or keep it. Every outcome closes
 * the open reports on that reel. Rules limit this to staff; the UI is not the
 * only gate.
 */
export default function AdminReelReports() {
  const currentUser = useStore((s) => s.currentUser);
  const staffId = auth.currentUser?.uid || currentUser?.id || 'stafi';
  const [groups, setGroups] = useState<Group[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const reports = await fetchOpenReelReports();
      const grouped = groupReportsByReel(reports);
      // One read per reported reel, not per report.
      const withReels: Group[] = await Promise.all(grouped.map(async (g) => ({
        ...g,
        reel: (await fetchReelForReview(g.reelId).catch(() => null)) ?? 'missing',
      })));
      setGroups(withReels);
      setStatus('ready');
    } catch (error) {
      console.error('Raportimet e Reels nuk u ngarkuan:', error);
      setStatus('error');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const act = async (group: Group, action: 'hide' | 'keep' | 'delete') => {
    if (busy) return;
    if (action === 'delete' && !await askConfirm(dt('Fshini përgjithmonë këtë Reel? Veprimi nuk mund të zhbëhet.'))) return;
    setBusy(group.reelId);
    try {
      if (action === 'hide') await setReelHidden(group.reelId, true, staffId, group.reports[0]?.reason ?? 'raportim');
      if (action === 'delete') await deleteDoc(doc(db, 'forumReels', group.reelId));
      await resolveReelReports(group.reports, staffId);
      setGroups((prev) => prev.filter((g) => g.reelId !== group.reelId));
      toast.success(action === 'hide' ? dt('Reel-i u fshehu.') : action === 'delete' ? dt('Reel-i u fshi.') : dt('Raportimet u mbyllën.'));
    } catch (error) {
      console.error('Veprimi i moderimit dështoi:', error);
      toast.error(dt('Veprimi dështoi. Kontrolloni lejet dhe provoni përsëri.'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="relative isolate overflow-hidden rounded-[2rem] border border-slate-700 bg-gradient-to-br from-slate-950 via-slate-900 to-rose-950 p-5 text-white">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="rounded-xl bg-rose-400/10 p-2 text-rose-300 ring-1 ring-rose-300/10"><Film className="h-6 w-6" aria-hidden="true" /></span>
            <div>
              <h2 className="text-xl font-black sm:text-2xl">{dt('Raportimet e Reels')}</h2>
              <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-300">
                {dt('Reels të raportuara nga qytetarët, më të raportuarat së pari. Fshehja e largon nga publiku por autori e sheh; fshirja është e përhershme.')}
              </p>
            </div>
          </div>
          <button type="button" onClick={() => void load()} aria-label={dt('Rifresko')}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 hover:bg-white/20">
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {status === 'loading' && (
        <div role="status" className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> {dt('Po ngarkohen raportimet…')}</div>
      )}
      {status === 'error' && (
        <div role="alert" className="rounded-2xl border border-rose-300/30 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:bg-rose-950/30 dark:text-rose-100">
          <p className="flex items-center gap-2 font-black"><AlertTriangle className="h-4 w-4" aria-hidden="true" /> {dt('Raportimet nuk u ngarkuan')}</p>
          <p className="mt-1 text-xs">{dt('Kontrolloni lejet e stafit dhe që indeksi i forumReelReports është i publikuar.')}</p>
        </div>
      )}
      {status === 'ready' && groups.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-300 py-14 text-slate-500 dark:border-slate-700">
          <CheckCircle2 className="h-6 w-6 text-emerald-500" aria-hidden="true" />
          <p className="text-sm font-bold">{dt('Nuk ka raportime të hapura.')}</p>
        </div>
      )}

      <ul className="grid gap-4 lg:grid-cols-2">
        {groups.map((g) => (
          <li key={g.reelId} className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
            <div className="flex gap-3 p-3">
              <div className="aspect-[9/16] w-28 shrink-0 overflow-hidden rounded-xl bg-black">
                {g.reel !== 'missing' && g.reel ? (
                  <video src={g.reel.mediaUrl} controls preload="metadata" playsInline className="h-full w-full object-contain" />
                ) : (
                  <div className="flex h-full items-center justify-center p-2 text-center text-[11px] text-slate-400">{dt('Reel-i nuk ekziston më')}</div>
                )}
              </div>
              <div className="min-w-0 flex-1 text-sm">
                {g.reel !== 'missing' && g.reel && (
                  <>
                    <p className="font-black text-slate-900 dark:text-white">{g.reel.authorName}</p>
                    {g.reel.caption && <p className="mt-0.5 line-clamp-3 whitespace-pre-line text-xs text-slate-600 dark:text-slate-300">{g.reel.caption}</p>}
                    {g.reel.isHidden && <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800"><EyeOff className="h-3 w-3" aria-hidden="true" /> {dt('Tashmë i fshehur')}</p>}
                  </>
                )}
                <p className="mt-2 text-xs font-black text-rose-600">{g.reports.length} {g.reports.length === 1 ? dt('raportim') : dt('raportime')}</p>
                <ul className="mt-1 space-y-1">
                  {g.reports.slice(0, 4).map((r) => (
                    <li key={r.id} className="text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="font-bold">{dt(reasonLabel(r.reason))}</span> · {fmt(r.createdAtMs)}
                      {r.details && <span className="block whitespace-pre-line text-slate-600 dark:text-slate-300">“{r.details}”</span>}
                    </li>
                  ))}
                  {g.reports.length > 4 && <li className="text-[11px] text-slate-400">+{g.reports.length - 4} {dt('të tjera')}</li>}
                </ul>
              </div>
            </div>
            <div className="flex gap-2 border-t border-slate-100 p-3 dark:border-slate-800">
              <button type="button" disabled={busy === g.reelId} onClick={() => void act(g, 'keep')}
                className="flex-1 rounded-full border border-slate-300 py-2 text-xs font-black dark:border-slate-600">{dt('Mbaje')}</button>
              {g.reel !== 'missing' && g.reel && !g.reel.isHidden && (
                <button type="button" disabled={busy === g.reelId} onClick={() => void act(g, 'hide')}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-amber-500 py-2 text-xs font-black text-white disabled:opacity-60">
                  <EyeOff className="h-3.5 w-3.5" aria-hidden="true" /> {dt('Fshih')}
                </button>
              )}
              {g.reel !== 'missing' && (
                <button type="button" disabled={busy === g.reelId} onClick={() => void act(g, 'delete')}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-rose-600 py-2 text-xs font-black text-white disabled:opacity-60">
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> {dt('Fshi')}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
