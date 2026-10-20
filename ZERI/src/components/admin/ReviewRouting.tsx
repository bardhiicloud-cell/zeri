import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { AlertTriangle, Check, Loader2, Mail, MapPinned, Phone } from 'lucide-react';
import { dt } from '@/src/lib/dt';
import { cn } from '../../lib/utils';
import type { Report } from '../../types';
import { KOSOVO_MUNICIPALITIES } from '../../lib/constants';
import { getReportTopic } from '../../lib/reportTopics';
import SectorPicker from './SectorPicker';
import ContactsDirectory from './ContactsDirectory';
import { TOPIC_ROUTES, resolveResponsible, type Zone } from '../../lib/responsibility';
import { classifyReports, type ClassifyChange } from '../../lib/reportClassifyApi';

/**
 * The part of a review that decides where the report goes: what it is about, where it is,
 * whether that place is urban, and who therefore answers it.
 *
 * Approving a report without this is approving it blind. The block shows what is known,
 * what is missing, and the body the report would reach, so the reviewer fixes the
 * classification and approves in one place.
 */
export interface ReviewRoutingProps {
  report: Report;
  /** Who may change the classification (the server checks again). */
  canClassify: boolean;
  /** Called with what was saved so the caller can show it without waiting for a reload. */
  onClassified: (id: string, change: ClassifyChange) => void;
}

const field = 'min-h-10 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-900 dark:border-white/10 dark:bg-slate-800 dark:text-slate-100';

export default function ReviewRouting({ report, canClassify, onClassified }: ReviewRoutingProps) {
  const known = getReportTopic(report);
  const municipalityNow = String(report.location?.municipality ?? '');
  const [topic, setTopic] = useState(known?.id ?? '');
  const [municipality, setMunicipality] = useState(municipalityNow);
  const [zone, setZone] = useState<'' | Zone>(report.zone ?? '');
  const [saving, setSaving] = useState(false);
  const [directory, setDirectory] = useState(false);

  // A different report: start from what it has.
  useEffect(() => {
    setTopic(getReportTopic(report)?.id ?? '');
    setMunicipality(String(report.location?.municipality ?? ''));
    setZone(report.zone ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report.id, report.topicCategory, report.zone, municipalityNow]);

  const resolution = useMemo(
    () => resolveResponsible({ topicId: topic || null, municipality, zone: zone || null }),
    [topic, municipality, zone]
  );
  const zoneMatters = topic ? TOPIC_ROUTES[topic as keyof typeof TOPIC_ROUTES]?.rule === 'zone' : false;

  const change: ClassifyChange = {
    ...(topic && topic !== (known?.id ?? '') ? { topicCategory: topic } : {}),
    ...(municipality && municipality !== municipalityNow ? { municipality } : {}),
    ...(zone && zone !== (report.zone ?? '') ? { zone } : {}),
  };
  const dirty = Object.keys(change).length > 0;

  const checks = [
    { label: dt('Kategoria'), ok: Boolean(topic) },
    { label: dt('Komuna'), ok: Boolean(municipality) },
    { label: dt('Zona'), ok: !zoneMatters || Boolean(zone) },
  ];
  const ready = checks.every(check => check.ok);

  const save = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      await classifyReports([report.id], change);
      onClassified(report.id, change);
      toast.success(dt('Klasifikimi u ruajt.'));
    } catch (error) {
      toast.error((error as Error)?.message || dt('Klasifikimi nuk u ruajt.'));
    } finally {
      setSaving(false);
    }
  };

  const { primary } = resolution;

  return (
    <section aria-label={dt('Rrugëzimi')} className="mt-5 rounded-xl border border-slate-200 p-3 dark:border-white/10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
          <MapPinned className="h-3.5 w-3.5" aria-hidden="true" />{dt('Rrugëzimi')}
        </p>
        <ul className="flex flex-wrap gap-1.5 text-[11px] font-bold">
          {checks.map(check => (
            <li key={check.label} className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5', check.ok ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200' : 'bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200')}>
              {check.ok ? <Check className="h-3 w-3" aria-hidden="true" /> : <AlertTriangle className="h-3 w-3" aria-hidden="true" />}{check.label}
            </li>
          ))}
        </ul>
      </div>

      {canClassify && (
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
            {dt('Sektori / Ministria')}
            <SectorPicker value={topic} onChange={setTopic} className="mt-1" />
          </div>
          <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
            {dt('Komuna')}
            <select value={municipality} onChange={event => setMunicipality(event.target.value)} className={cn(field, 'mt-1')}>
              {!municipality && <option value="">{dt('Zgjidh…')}</option>}
              {KOSOVO_MUNICIPALITIES.map(name => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
          <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
            {dt('Zona')}
            <select value={zone} onChange={event => setZone(event.target.value as '' | Zone)} className={cn(field, 'mt-1')}>
              <option value="">{zoneMatters ? dt('Zgjidh…') : dt('Nuk ka rëndësi')}</option>
              <option value="urban">{dt('Urbane')}</option>
              <option value="rural">{dt('Rurale')}</option>
            </select>
          </label>
        </div>
      )}
      {canClassify && dirty && (
        <button type="button" onClick={() => void save()} disabled={saving} className="mt-2 inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-xs font-black text-white disabled:opacity-40">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Check className="h-3.5 w-3.5" aria-hidden="true" />}
          {dt('Ruaj klasifikimin')}
        </button>
      )}

      <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm dark:bg-white/5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{dt('Përgjigjet')}</p>
          <button type="button" onClick={() => setDirectory(true)} className="min-h-8 text-[11px] font-bold text-blue-700 hover:underline dark:text-blue-300">{dt('Të gjitha kontaktet')}</button>
        </div>
        <p className="mt-0.5 font-bold text-slate-900 dark:text-white">{primary.name}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{primary.level === 'central' ? dt('Qendror') : `${dt('Komunal')} · ${primary.office}`}</p>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{dt(resolution.reason)}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
          <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-bold', primary.sendable ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200' : 'bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200')}>
            <Mail className="h-3 w-3" aria-hidden="true" />
            {primary.sendable ? dt('Email gati') : primary.email ? dt('Email për verifikim') : dt('Pa email')}
          </span>
          {primary.email && <span className="break-all text-slate-600 dark:text-slate-300">{primary.email}</span>}
          {primary.phone && <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300"><Phone className="h-3 w-3" aria-hidden="true" />{primary.phone}</span>}
        </div>
        {!ready && <p className="mt-2 text-xs font-semibold text-amber-800 dark:text-amber-200">{dt('Plotësoni klasifikimin para aprovimit që raporti të shkojë te institucioni i duhur.')}</p>}
      </div>
      {directory && <ContactsDirectory onClose={() => setDirectory(false)} />}
    </section>
  );
}
