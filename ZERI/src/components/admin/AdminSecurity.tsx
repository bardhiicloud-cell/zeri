import { dt } from '@/src/lib/dt';
import React, { useState, useCallback, useEffect } from 'react';
import { Shield, AlertTriangle, UserCheck, Lock, Download, Loader2 } from 'lucide-react';
import { useStore } from '../../lib/store';
import { db } from '../../lib/firebase';
import { collection, getDocs, query, orderBy, limit, startAfter, type DocumentSnapshot } from 'firebase/firestore';
import toast from 'react-hot-toast';

const PAGE_SIZE = 50;

/** Strip undefined fields so the exported JSON never carries `undefined`. */
function safeExport(logs: unknown[]): string {
  return JSON.stringify(logs, (_k, v) => (v === undefined ? null : v), 2);
}

function downloadJson(filename: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminSecurity() {
  const auditLogs = useStore(state => state.auditLogs);

  // Real server-side pagination: the rows on screen plus the query cursors
  // needed to move forward (and back) page by page, instead of the earlier
  // "next 50" button that rendered and did nothing.
  const [rows, setRows] = useState<any[]>(() => auditLogs.slice(0, PAGE_SIZE));
  const [cursorStack, setCursorStack] = useState<DocumentSnapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasNext, setHasNext] = useState(false);
  const [exporting, setExporting] = useState(false);

  const loadPage = useCallback(async (cursor: DocumentSnapshot | null) => {
    setLoading(true);
    try {
      const base = query(collection(db, 'auditLogs'), orderBy('createdAt', 'desc'), limit(PAGE_SIZE));
      const q = cursor ? query(base, startAfter(cursor)) : base;
      const snap = await getDocs(q);
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setRows(docs);
      setHasNext(snap.size === PAGE_SIZE);
      if (snap.docs.length > 0) {
        setCursorStack(stack => (cursor ? [...stack, snap.docs[snap.docs.length - 1]] : [snap.docs[snap.docs.length - 1]]));
      }
    } catch {
      // Offline / rules refusal: keep the in-memory slice so the panel stays
      // usable, and say so instead of failing silently.
      if (!cursor) setRows(auditLogs.slice(0, PAGE_SIZE));
      setHasNext(false);
      toast.error(dt('Log-et e auditimit nuk u ngarkuan nga serveri — shfaqen të fundit lokalë.'));
    } finally {
      setLoading(false);
    }
  }, [auditLogs]);

  useEffect(() => { loadPage(null); }, [loadPage]);

  const exportJson = async () => {
    setExporting(true);
    try {
      // The full log, not just the visible page. Capped at 2000 so one click
      // cannot pull an unbounded collection, and the export stays a real file.
      const snap = await getDocs(query(collection(db, 'auditLogs'), orderBy('createdAt', 'desc'), limit(2000)));
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      downloadJson(`zeri-audit-log-${new Date().toISOString().slice(0, 10)}.json`, safeExport(all));
      toast.success(dt(`Eksportuan ${all.length} regjistrime.`));
    } catch {
      downloadJson(`zeri-audit-log-lokal-${new Date().toISOString().slice(0, 10)}.json`, safeExport(auditLogs));
      toast.error(dt('Eksportimi nga serveri dështoi — u eksportuan vetëm log-et lokale.'));
    } finally {
      setExporting(false);
    }
  };

  // Filter failed logs to show warning stats
  const failedLogins = auditLogs.filter(l => l.status === 'danger').length;

  return (
    <div className="space-y-6 max-w-full mx-auto">
      {/* HEADER */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 pb-2">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight title-serif flex items-center gap-3">
             <Shield className="w-8 h-8 text-indigo-600" />{dt(`Paneli i Auditimit & Sigurisë`)}
          </h2>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-2">{dt(`Arkiva vizuale e log-eve: Cili admin u logua, çfarë klikoi i gjithë stafi (Audit Logging Live).`)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-2xl p-6 shadow-sm dark:shadow-none hover:shadow transition-all relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-32 h-32 bg-emerald-50 rounded-full blur-3xl opacity-50 group-hover:opacity-100 transition-opacity -mr-16 -mt-16 pointer-events-none" />
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-12 h-12 bg-emerald-100 flex items-center justify-center rounded-xl text-emerald-600 shadow-sm dark:shadow-none border border-emerald-200">
              <UserCheck className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 tracking-widest uppercase mb-1">{dt(`Statusi i Sistemit`)}</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white title-serif">{dt(`AKTIV`)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-2xl p-6 shadow-sm dark:shadow-none hover:shadow transition-all relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-32 h-32 bg-indigo-50 rounded-full blur-3xl opacity-50 group-hover:opacity-100 transition-opacity -mr-16 -mt-16 pointer-events-none" />
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-12 h-12 bg-indigo-100 flex items-center justify-center rounded-xl text-indigo-600 shadow-sm dark:shadow-none border border-indigo-200">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 tracking-widest uppercase mb-1">{dt(`Total Regjistrime (Logs)`)}</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white title-serif">{auditLogs.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-2xl p-6 shadow-sm dark:shadow-none hover:shadow transition-all relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-32 h-32 bg-amber-50 rounded-full blur-3xl opacity-50 group-hover:opacity-100 transition-opacity -mr-16 -mt-16 pointer-events-none" />
          <div className="flex items-center gap-4 relative z-10">
             <div className="w-12 h-12 bg-amber-100 flex items-center justify-center rounded-xl text-amber-600 shadow-sm dark:shadow-none border border-amber-200">
               <Lock className="w-6 h-6" />
             </div>
             <div>
               <p className="text-xs font-bold text-slate-500 dark:text-slate-400 tracking-widest uppercase mb-1">{dt(`Veprime me Rrezik (Rrezik)`)}</p>
               <p className="text-2xl font-bold text-rose-600 title-serif">{failedLogins}</p>
             </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-2xl shadow-sm dark:shadow-none overflow-hidden">
        <div className="p-5 md:p-6 border-b border-slate-100 dark:border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50 dark:bg-slate-800/50">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight title-serif flex items-center gap-2">{dt(`Regjistri i Veprimeve (Logs DB)`)}
          </h2>
          <button
            type="button"
            onClick={exportJson}
            disabled={exporting}
            className="px-5 py-2.5 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-white/10 shadow-sm dark:shadow-none rounded-xl text-sm font-bold tracking-wide hover:bg-slate-50 dark:bg-slate-800 hover:text-slate-900 dark:text-white transition-colors w-full sm:w-auto flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}{dt(`Eksporto JSON`)}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200/60 dark:border-white/10">
                <th className="p-4 text-xs font-bold tracking-widest uppercase text-slate-500 dark:text-slate-400">{dt(`Veprimi`)}</th>
                <th className="p-4 text-xs font-bold tracking-widest uppercase text-slate-500 dark:text-slate-400">{dt(`Subjekti / Përdoruesi`)}</th>
                <th className="p-4 text-xs font-bold tracking-widest uppercase text-slate-500 dark:text-slate-400">{dt(`Detaje nga Backend`)}</th>
                <th className="p-4 text-xs font-bold tracking-widest uppercase text-slate-500 dark:text-slate-400">{dt(`Koha e Regjistrimit`)}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/10">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-slate-500 dark:text-slate-400">{dt(`Nuk ka asnjë log të regjistruar deri tani. Filloni të përdorni sistemin për të mbushur Audit Log-un.`)}</td>
                </tr>
              )}
              {rows.map((log: any) => (
                <tr key={log.id} className="hover:bg-slate-50 dark:bg-slate-800/80 transition-colors group">
                  <td className="p-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded text-[11px] font-bold tracking-widest uppercase border ${
                      log.status === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                      log.status === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                      'bg-rose-50 border-rose-200 text-rose-700'
                    }`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="p-4 flex flex-col gap-1">
                    <span className="text-sm font-bold text-slate-900 dark:text-white">{log.userEmail}</span>
                    <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/50 rounded px-1 w-max">{dt(`IP:`)} {log.ip}</span>
                  </td>
                  <td className="p-4 text-sm font-medium text-slate-700 dark:text-slate-300 max-w-sm truncate" title={log.details}>
                    {log.details || '-'}
                  </td>
                  <td className="p-4 text-xs font-bold text-slate-400 uppercase tracking-widest">
                    {log.createdAt?.toDate ? log.createdAt.toDate().toLocaleString() : new Date(log.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-slate-800 flex justify-center">
           <button
             type="button"
             onClick={() => loadPage(cursorStack[cursorStack.length - 1] ?? null)}
             disabled={loading || !hasNext}
             className="text-sm font-bold text-indigo-600 hover:text-indigo-500 transition-colors px-4 py-2 hover:bg-indigo-50 dark:bg-slate-900 dark:hover:bg-slate-800 rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed"
           >
             {loading ? <Loader2 className="w-4 h-4 animate-spin inline mr-1" /> : null}
             {dt(`Ngarko 50 Rekordet e Rradhës`)}
           </button>
        </div>
      </div>
    </div>
  );
}
