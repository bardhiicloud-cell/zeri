import { useEffect, useMemo, useState } from 'react';
import {
  Pill, Plus, X, MapPin, Building2, CheckCircle2, Clock, BarChart3, Send, Loader2,
} from 'lucide-react';
import {
  Bar, BarChart, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { addDoc, collection, limit, onSnapshot, query, where } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { dt } from '@/src/lib/dt';
import toast from 'react-hot-toast';
import { cn } from '../../lib/utils';
import { KOSOVO_MUNICIPALITIES, ALL_MUNICIPALITIES_OPTION } from '../../lib/constants';
import type { MedicineShortage } from '../../types';

/**
 * "Mungesat e Barnave" — the public medicine-shortage board.
 *
 * Citizens and institutions report a missing medicine; staff or the commune
 * verify it. Only VERIFIED shortages are world-readable (firestore.rules), so
 * an unverified claim never reaches the public feed, and a reporter always sees
 * their own pending reports. The statistics below are computed over the verified
 * set only — aggregate counts per commune and per availability level, never
 * personal data.
 */

const QUANTITY_OPTIONS: MedicineShortage['quantityStatus'][] = [
  'Ka mungesë totale',
  'Sasi e kufizuar',
  'Pjesërisht e disponueshme',
  'E panjohur',
];

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

export function MedicineShortages() {
  const uid = auth.currentUser?.uid || null;
  // A guest signs in for real (anonymous or server-minted), so they may report too; staff still verify every report.
  const canReport = Boolean(uid);

  const [verified, setVerified] = useState<MedicineShortage[]>([]);
  const [mine, setMine] = useState<MedicineShortage[]>([]);
  const [municipalityFilter, setMunicipalityFilter] = useState<string>(ALL_MUNICIPALITIES_OPTION);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    medicineName: '',
    dose: '',
    form: '',
    institution: '',
    municipality: KOSOVO_MUNICIPALITIES[0],
    quantityStatus: 'Ka mungesë totale' as NonNullable<MedicineShortage['quantityStatus']>,
    comment: '',
    isAnonymous: false,
  });

  // Public feed: verified only (rules deny the rest to non-staff/non-owner).
  useEffect(() => {
    const q = query(collection(db, 'medicineShortages'), where('status', '==', 'verified'), limit(200));
    return onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as MedicineShortage[];
        items.sort((a, b) => new Date(b.reportedDate || b.createdAt).getTime() - new Date(a.reportedDate || a.createdAt).getTime());
        setVerified(items);
      },
      (err) => console.error('Mungesat e verifikuara nuk u ngarkuan:', err),
    );
  }, []);

  // The signed-in reporter's own submissions, any status.
  useEffect(() => {
    if (!uid) {
      setMine([]);
      return;
    }
    const q = query(collection(db, 'medicineShortages'), where('authorId', '==', uid), limit(50));
    return onSnapshot(
      q,
      (snap) => setMine(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as MedicineShortage[]),
      () => setMine([]),
    );
  }, [uid]);

  const filtered = useMemo(
    () =>
      municipalityFilter === ALL_MUNICIPALITIES_OPTION
        ? verified
        : verified.filter((v) => v.municipality === municipalityFilter),
    [verified, municipalityFilter],
  );

  const byMunicipality = useMemo(() => {
    const counts = new Map<string, number>();
    for (const v of verified) counts.set(v.municipality, (counts.get(v.municipality) || 0) + 1);
    return Array.from(counts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [verified]);

  const byQuantity = useMemo(() => {
    const counts = new Map<string, number>();
    for (const v of verified) {
      const key = v.quantityStatus || 'E panjohur';
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return Array.from(counts.entries()).map(([name, value]) => ({ name, value }));
  }, [verified]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canReport || !form.medicineName.trim()) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      await addDoc(collection(db, 'medicineShortages'), {
        medicineName: form.medicineName.trim(),
        dose: form.dose.trim() || null,
        form: form.form.trim() || null,
        institution: form.institution.trim() || null,
        municipality: form.municipality,
        quantityStatus: form.quantityStatus,
        comment: form.comment.trim() || null,
        isAnonymous: form.isAnonymous,
        authorId: uid,
        reportedDate: now,
        createdAt: now,
        status: 'pending',
      });
      setShowForm(false);
      setForm({ ...form, medicineName: '', dose: '', form: '', institution: '', comment: '' });
      toast.success(dt('Mungesa u dërgua për verifikim.'));
    } catch (err: any) {
      console.error('Raportimi i mungesës dështoi:', err);
      toast.error(err?.message || dt('Raportimi dështoi.'));
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    'w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-medium outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition';

  return (
    <div className="space-y-6">
      {/* Header + report CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-xs">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-black text-slate-900 dark:text-white">
            <Pill className="h-5 w-5 text-blue-700 dark:text-blue-300" aria-hidden="true" />
            {dt('Mungesat e Barnave të Verifikuara')}
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {dt('Vetëm mungesat e verifikuara nga stafi ose komuna shfaqen publikisht.')}
          </p>
        </div>
        {canReport && (
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className={cn(
              'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition',
              showForm
                ? 'bg-rose-50 text-rose-600 border border-rose-200 dark:bg-rose-950/40 dark:border-rose-900/50'
                : 'bg-blue-700 text-white hover:bg-blue-800',
            )}
          >
            {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showForm ? dt('Mbyll') : dt('Raporto Mungesë')}
          </button>
        )}
      </div>

      {/* Report form */}
      {showForm && canReport && (
        <form onSubmit={submit} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-6 shadow-xs space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">{dt('Emri i Barnës / Medikamentit')} *</label>
              <input required value={form.medicineName} onChange={(e) => setForm({ ...form, medicineName: e.target.value })} className={inputCls} placeholder="psh. Insulina" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">{dt('Doza')}</label>
              <input value={form.dose} onChange={(e) => setForm({ ...form, dose: e.target.value })} className={inputCls} placeholder="psh. 100ml" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">{dt('Forma')}</label>
              <input value={form.form} onChange={(e) => setForm({ ...form, form: e.target.value })} className={inputCls} placeholder="psh. tablet / shurup / injeksion" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">{dt('Farmacia / Institucioni')}</label>
              <input value={form.institution} onChange={(e) => setForm({ ...form, institution: e.target.value })} className={inputCls} placeholder="psh. QKMF Prishtinë" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">{dt('Komuna')}</label>
              <select value={form.municipality} onChange={(e) => setForm({ ...form, municipality: e.target.value })} className={inputCls}>
                {KOSOVO_MUNICIPALITIES.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">{dt('Gjendja e sasisë')}</label>
              <select value={form.quantityStatus} onChange={(e) => setForm({ ...form, quantityStatus: e.target.value as any })} className={inputCls}>
                {QUANTITY_OPTIONS.map((q) => (
                  <option key={q} value={q}>{q}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">{dt('Komenti (opsional)')}</label>
              <textarea value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} className={cn(inputCls, 'min-h-[80px] resize-y')} />
            </div>
            <label className="sm:col-span-2 flex items-center gap-2.5 cursor-pointer text-sm font-semibold text-slate-700 dark:text-slate-300">
              <input type="checkbox" checked={form.isAnonymous} onChange={(e) => setForm({ ...form, isAnonymous: e.target.checked })} className="h-4 w-4 accent-blue-700" />
              {dt('Raporto anonimisht (identiteti yt nuk shfaqet)')}
            </label>
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={saving || !form.medicineName.trim()} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-blue-700 px-5 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-50 transition-colors">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {dt('Dërgo për Verifikim')}
            </button>
          </div>
        </form>
      )}

      {/* Statistics */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-xs">
          <h4 className="mb-3 flex items-center gap-2 text-sm font-black text-slate-900 dark:text-white">
            <BarChart3 className="h-4 w-4 text-blue-700 dark:text-blue-300" aria-hidden="true" />
            {dt('Mungesat sipas komunës (top 10)')}
          </h4>
          {byMunicipality.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-400">{dt('Ende pa të dhëna.')}</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={byMunicipality} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} interval={0} angle={-30} textAnchor="end" height={56} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
                <Bar dataKey="value" name={dt('Mungesa')} radius={[6, 6, 0, 0]}>
                  {byMunicipality.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-xs">
          <h4 className="mb-3 text-sm font-black text-slate-900 dark:text-white">{dt('Shpërndarja sipas gjendjes së sasisë')}</h4>
          {byQuantity.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-400">{dt('Ende pa të dhëna.')}</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={byQuantity} dataKey="value" nameKey="name" innerRadius={52} outerRadius={82} paddingAngle={2}>
                  {byQuantity.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Filter + verified list */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h4 className="text-sm font-black text-slate-900 dark:text-white">{dt('Lista e mungesave të verifikuara')}</h4>
          <select
            value={municipalityFilter}
            onChange={(e) => setMunicipalityFilter(e.target.value)}
            className="w-full sm:w-64 px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-bold outline-none focus:border-blue-500"
          >
            <option value={ALL_MUNICIPALITIES_OPTION}>{dt(ALL_MUNICIPALITIES_OPTION)}</option>
            {KOSOVO_MUNICIPALITIES.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        {filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">{dt('Nuk ka mungesa të verifikuara për këtë komunë.')}</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {filtered.map((s) => (
              <li key={s.id} className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-bold text-slate-900 dark:text-white">{s.medicineName}{s.dose ? ` ${s.dose}` : ''}</p>
                  <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase', STATUS_META[s.status]?.cls)}>
                    {STATUS_META[s.status]?.label}
                  </span>
                </div>
                <p className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                  <MapPin className="h-3 w-3" aria-hidden="true" /> {s.municipality}
                  {s.institution && (<><span aria-hidden="true">·</span><Building2 className="h-3 w-3" aria-hidden="true" /> {s.institution}</>)}
                </p>
                <p className="mt-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300">{s.quantityStatus}</p>
                {s.comment && <p className="mt-1.5 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{s.comment}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* My submissions */}
      {canReport && mine.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-xs">
          <h4 className="mb-3 text-sm font-black text-slate-900 dark:text-white">{dt('Raportimet e mia')}</h4>
          <ul className="space-y-2">
            {mine.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-zinc-800 px-3.5 py-2.5">
                <span className="min-w-0 truncate text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {s.medicineName} <span className="text-slate-400">· {s.municipality}</span>
                </span>
                <span className={cn('flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase', STATUS_META[s.status]?.cls)}>
                  {s.status === 'pending' ? <Clock className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                  {STATUS_META[s.status]?.label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default MedicineShortages;
