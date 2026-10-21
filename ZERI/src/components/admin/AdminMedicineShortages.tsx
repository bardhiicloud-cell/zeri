import { useEffect, useMemo, useState } from 'react';
import {
  Pill, Search, MapPin, Building2, CheckCircle2, XCircle, Clock,
  Trash2, BarChart3, ShieldCheck, Loader2, Eye,
} from 'lucide-react';
import {
  Bar, BarChart, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  collection, deleteDoc, doc, limit, onSnapshot, orderBy, query, updateDoc,
} from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { useStore } from '../../lib/store';
import { dt } from '../../lib/dt';
import { cn } from '../../lib/utils';
import { KOSOVO_MUNICIPALITIES } from '../../lib/constants';
import { STAFF_LIMITS } from '../../lib/loadLimits';
import type { MedicineShortage } from '../../types';
import toast from 'react-hot-toast';
import { askConfirm } from '../../lib/dialogs';

/**
 * Staff-side management of citizen medicine-shortage reports.
 *
 * The public board (`components/health/MedicineShortages.tsx`) only ever shows
 * VERIFIED documents — firestore.rules denies the rest to everyone but staff and
 * the reporter. This panel is the other half of that contract: staff read the
 * whole collection, confirm a claim is genuine (verify), mark it resolved or
 * reject it, and delete outright. Verification is what moves a report from
 * invisible to public, so every status change is stamped with who did it and
 * when (`verifiedBy` / `verifiedAt`), matching the audit trail the health
 * registry keeps.
 */

const STATUS_META: Record<MedicineShortage['status'], { label: string; cls: string }> = {
  pending: { label: 'Në verifikim', cls: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50' },
  verified: { label: 'E verifikuar', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50' },
  resolved: { label: 'E zgjidhur', cls: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/50' },
  rejected: { label: 'E refuzuar', cls: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/50' },
};

const CHART_COLORS = ['#1E40AF', '#D28A35', '#16A34A', '#0284C7', '#DC2626', '#7C3AED'];

const tooltipStyle = {
  backgroundColor: 'var(--color-surface)',
  border: '1px solid var(--color-border-soft)',
  borderRadius: '12px',
  fontSize: '12px',
  color: 'var(--color-text)',
};

export default function AdminMedicineShortages() {
  const currentUser = useStore((s) => s.currentUser);
  const staffId = auth.currentUser?.uid || currentUser?.id || 'stafi';

  const [items, setItems] = useState<MedicineShortage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | MedicineShortage['status']>('all');
  const [muniFilter, setMuniFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [inspecting, setInspecting] = useState<MedicineShortage | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'medicineShortages'),
      orderBy('createdAt', 'desc'),
      limit(STAFF_LIMITS.medicineShortages),
    );
    return onSnapshot(
      q,
      (snap) => {
        setItems(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as MedicineShortage[]);
        setLoadError(null);
        setLoading(false);
      },
      (err) => {
        console.error('Mungesat e barnave nuk u ngarkuan për stafin:', err);
        setLoadError('Të dhënat nuk u ngarkuan. Kontrolloni lejet dhe lidhjen, pastaj provoni përsëri.');
        setLoading(false);
        toast.error(dt('Mungesat e barnave nuk u ngarkuan.'));
      },
    );
  }, []);

  const filtered = useMemo(() => {
    return items.filter((s) => {
      const matchStatus = statusFilter === 'all' || s.status === statusFilter;
      const matchMuni = muniFilter === 'all' || s.municipality === muniFilter;
      const needle = search.trim().toLowerCase();
      const matchSearch =
        !needle ||
        s.medicineName?.toLowerCase().includes(needle) ||
        s.institution?.toLowerCase().includes(needle) ||
        s.municipality?.toLowerCase().includes(needle);
      return matchStatus && matchMuni && matchSearch;
    });
  }, [items, statusFilter, muniFilter, search]);

  const stats = useMemo(() => {
    const byStatus = { pending: 0, verified: 0, resolved: 0, rejected: 0 } as Record<MedicineShortage['status'], number>;
    const byMuni = new Map<string, number>();
    const byQuantity = new Map<string, number>();
    for (const s of items) {
      byStatus[s.status] = (byStatus[s.status] || 0) + 1;
      byMuni.set(s.municipality, (byMuni.get(s.municipality) || 0) + 1);
      const key = s.quantityStatus || 'E panjohur';
      byQuantity.set(key, (byQuantity.get(key) || 0) + 1);
    }
    return {
      byStatus,
      byMuni: Array.from(byMuni.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10),
      byQuantity: Array.from(byQuantity.entries()).map(([name, value]) => ({ name, value })),
    };
  }, [items]);

  const setStatus = async (s: MedicineShortage, status: MedicineShortage['status']) => {
    try {
      const now = new Date().toISOString();
      const patch: Record<string, any> = { status, updatedAt: now };
      if (status === 'verified' || status === 'rejected') {
        patch.verifiedBy = staffId;
        patch.verifiedAt = now;
      }
      await updateDoc(doc(db, 'medicineShortages', s.id), patch);
      setItems((prev) => prev.map((x) => (x.id === s.id ? { ...x, status } : x)));
      setInspecting((prev) => (prev?.id === s.id ? { ...prev, status } : prev));
      toast.success(`Statusi u ndryshua në: ${STATUS_META[status].label}`);
    } catch (err) {
      console.error('Statusi i mungesës nuk u ruajt:', err);
      toast.error(dt('Statusi nuk u ruajt. Kontrolloni lejet dhe provoni përsëri.'));
    }
  };

  const remove = async (s: MedicineShortage) => {
    if (!await askConfirm(`Fshi përgjithmonë raportimin për "${s.medicineName}"? Ky veprim nuk mund të kthehet.`)) return;
    try {
      await deleteDoc(doc(db, 'medicineShortages', s.id));
      setItems((prev) => prev.filter((x) => x.id !== s.id));
      if (inspecting?.id === s.id) setInspecting(null);
      toast.success(dt('Raportimi u fshi.'));
    } catch (err) {
      console.error('Mungesa nuk u fshi:', err);
      toast.error(dt('Fshirja dështoi. Kontrolloni lejet dhe provoni përsëri.'));
    }
  };

  const inputCls =
    'w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-blue-500';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative isolate overflow-hidden rounded-[2rem] border border-slate-700 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-5 text-white shadow-[0_28px_80px_-40px_rgba(15,23,42,0.8)] sm:p-7">
        <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="flex items-center gap-3">
          <span className="p-2 rounded-xl bg-blue-400/10 text-blue-300 ring-1 ring-blue-300/10">
            <Pill className="w-6 h-6" />
          </span>
          <div>
            <h2 className="text-xl font-black text-white sm:text-2xl">{dt('Menaxhimi i Mungesave të Barnave')}</h2>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-300">
              {dt('Verifikoni raportimet e qytetarëve. Vetëm mungesat e verifikuara bëhen publike në faqen e shëndetësisë.')}
            </p>
          </div>
        </div>
      </div>

      {loading && (
        <div role="status" className="flex items-center gap-2 rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.06] px-4 py-3 text-xs font-semibold text-cyan-800 dark:text-cyan-200">
          <Loader2 className="h-4 w-4 animate-spin" /> {dt('Po sinkronizohen raportimet...')}
        </div>
      )}
      {loadError && (
        <div role="alert" className="rounded-2xl border border-rose-300/30 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:bg-rose-950/30 dark:text-rose-100">
          <p className="font-black">{dt('Sinkronizimi dështoi')}</p><p className="mt-1 text-xs">{loadError}</p>
        </div>
      )}

      {/* KPI bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900">
          <p className="text-[11px] font-black uppercase tracking-wider text-amber-500">{dt('Në verifikim')}</p>
          <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{stats.byStatus.pending}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900">
          <p className="text-[11px] font-black uppercase tracking-wider text-emerald-500">{dt('Të verifikuara')}</p>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{stats.byStatus.verified}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900">
          <p className="text-[11px] font-black uppercase tracking-wider text-blue-500">{dt('Të zgjidhura')}</p>
          <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">{stats.byStatus.resolved}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900">
          <p className="text-[11px] font-black uppercase tracking-wider text-rose-500">{dt('Të refuzuara')}</p>
          <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">{stats.byStatus.rejected}</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-4 sm:p-5 shadow-sm">
          <h4 className="mb-3 flex items-center gap-2 text-sm font-black text-slate-900 dark:text-white">
            <BarChart3 className="h-4 w-4 text-blue-600" aria-hidden="true" /> {dt('Mungesat sipas komunës (top 10)')}
          </h4>
          {stats.byMuni.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-400">{dt('Ende pa të dhëna.')}</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={stats.byMuni} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} interval={0} angle={-30} textAnchor="end" height={56} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
                <Bar dataKey="value" name={dt('Mungesa')} radius={[6, 6, 0, 0]}>
                  {stats.byMuni.map((_, i) => (<Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-4 sm:p-5 shadow-sm">
          <h4 className="mb-3 text-sm font-black text-slate-900 dark:text-white">{dt('Shpërndarja sipas gjendjes së sasisë')}</h4>
          {stats.byQuantity.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-400">{dt('Ende pa të dhëna.')}</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={stats.byQuantity} dataKey="value" nameKey="name" innerRadius={52} outerRadius={82} paddingAngle={2}>
                  {stats.byQuantity.map((_, i) => (<Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-4 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={dt('Kërko barnë, farmaci, komunë...')}
              className="w-full pl-9 pr-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500"
            />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className={inputCls}>
            <option value="all">{dt('📋 Të gjitha statuset')}</option>
            <option value="pending">{dt('⏳ Në verifikim')}</option>
            <option value="verified">{dt('✅ E verifikuar')}</option>
            <option value="resolved">{dt('🕊️ E zgjidhur')}</option>
            <option value="rejected">{dt('❌ E refuzuar')}</option>
          </select>
          <select value={muniFilter} onChange={(e) => setMuniFilter(e.target.value)} className={inputCls}>
            <option value="all">{dt('📍 Të gjitha komunat')}</option>
            {KOSOVO_MUNICIPALITIES.map((m) => (<option key={m} value={m}>{m}</option>))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">{dt('Barna')}</th>
                <th className="py-3.5 px-4">{dt('Komuna / Institucioni')}</th>
                <th className="py-3.5 px-4">{dt('Sasia')}</th>
                <th className="py-3.5 px-4">{dt('Statusi')}</th>
                <th className="py-3.5 px-4 text-right">{dt('Veprime')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {filtered.length === 0 ? (
                <tr><td colSpan={5} className="py-8 text-center text-slate-500 font-medium">{dt('Nuk u gjet asnjë raportim me këta filtra.')}</td></tr>
              ) : (
                filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4">
                      <p className="font-bold text-slate-900 dark:text-white">{s.medicineName}{s.dose ? ` · ${s.dose}` : ''}</p>
                      <p className="text-[11px] text-slate-400">
                        {s.isAnonymous ? dt('Raportim anonim') : dt('Raportues i identifikuar')}
                        {s.form ? ` · ${s.form}` : ''}
                      </p>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 font-bold text-slate-900 dark:text-white">
                        <MapPin className="w-3.5 h-3.5 text-blue-500 shrink-0" /> {s.municipality}
                      </span>
                      {s.institution && (
                        <p className="text-[11px] text-slate-400 pl-4 flex items-center gap-1">
                          <Building2 className="w-3 h-3" /> {s.institution}
                        </p>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300">{s.quantityStatus || dt('E panjohur')}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-black uppercase', STATUS_META[s.status]?.cls)}>
                        {s.status === 'pending' ? <Clock className="h-3 w-3" /> : s.status === 'rejected' ? <XCircle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                        {STATUS_META[s.status]?.label}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        <button onClick={() => setInspecting(s)} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800" title={dt('Shiko detajet')}>
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {s.status !== 'verified' && (
                          <button onClick={() => setStatus(s, 'verified')} className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] inline-flex items-center gap-1 transition active:scale-95" title={dt('Verifiko dhe boto publikisht')}>
                            <ShieldCheck className="w-3 h-3" /> {dt('Verifiko')}
                          </button>
                        )}
                        {s.status !== 'resolved' && (
                          <button onClick={() => setStatus(s, 'resolved')} className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-[11px] transition active:scale-95" title={dt('Shëno si të zgjidhur')}>
                            {dt('Zgjidhur')}
                          </button>
                        )}
                        {s.status !== 'rejected' && (
                          <button onClick={() => setStatus(s, 'rejected')} className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-[11px] transition active:scale-95" title={dt('Refuzo raportimin')}>
                            {dt('Refuzo')}
                          </button>
                        )}
                        <button onClick={() => remove(s)} className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40" title={dt('Fshi')}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inspect modal */}
      {inspecting && (
        <div className="fixed inset-0 z-[9999] bg-black/60 md:backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                  <Pill className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">{inspecting.medicineName}</h3>
                  <p className="text-xs text-slate-500">{dt('Detajet e raportimit të mungesës')}</p>
                </div>
              </div>
              <button onClick={() => setInspecting(null)} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                <span className="text-[11px] uppercase font-bold text-slate-400 block">{dt('Doza')}</span>
                <strong className="text-sm text-slate-900 dark:text-white">{inspecting.dose || '—'}</strong>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                <span className="text-[11px] uppercase font-bold text-slate-400 block">{dt('Forma')}</span>
                <strong className="text-sm text-slate-900 dark:text-white">{inspecting.form || '—'}</strong>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                <span className="text-[11px] uppercase font-bold text-slate-400 block">{dt('Komuna')}</span>
                <strong className="text-sm text-slate-900 dark:text-white">{inspecting.municipality}</strong>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                <span className="text-[11px] uppercase font-bold text-slate-400 block">{dt('Institucioni')}</span>
                <strong className="text-sm text-slate-900 dark:text-white">{inspecting.institution || '—'}</strong>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                <span className="text-[11px] uppercase font-bold text-slate-400 block">{dt('Gjendja e sasisë')}</span>
                <strong className="text-sm text-amber-700 dark:text-amber-300">{inspecting.quantityStatus || dt('E panjohur')}</strong>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                <span className="text-[11px] uppercase font-bold text-slate-400 block">{dt('Anonim')}</span>
                <strong className="text-sm text-slate-900 dark:text-white">{inspecting.isAnonymous ? dt('Po') : dt('Jo')}</strong>
              </div>
            </div>

            {inspecting.comment && (
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs">
                <span className="text-[11px] uppercase font-bold text-slate-400 block mb-1">{dt('Komenti i raportuesit')}</span>
                <p className="text-slate-700 dark:text-slate-200 leading-relaxed">{inspecting.comment}</p>
              </div>
            )}

            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
              <p>{dt('Raportuar')}: {inspecting.reportedDate ? new Date(inspecting.reportedDate).toLocaleString('sq-AL') : '—'}</p>
              {inspecting.verifiedAt && <p>{dt('Verifikuar')}: {new Date(inspecting.verifiedAt).toLocaleString('sq-AL')}</p>}
              <p className="font-mono text-[11px]">ID: {inspecting.id}</p>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-white/10 flex items-center justify-between gap-2 flex-wrap">
              <button onClick={() => remove(inspecting)} className="text-xs font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1">
                <Trash2 className="w-3.5 h-3.5" /> {dt('Fshi raportimin')}
              </button>
              <div className="flex items-center gap-1.5 flex-wrap">
                <button onClick={() => setStatus(inspecting, 'verified')} className="px-3 py-1.5 text-[11px] font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors">{dt('Verifiko')}</button>
                <button onClick={() => setStatus(inspecting, 'resolved')} className="px-3 py-1.5 text-[11px] font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">{dt('Zgjidhur')}</button>
                <button onClick={() => setStatus(inspecting, 'rejected')} className="px-3 py-1.5 text-[11px] font-bold bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors">{dt('Refuzo')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
