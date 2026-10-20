import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { AlertTriangle, CheckCircle2, ChevronDown, FileDown, X, FileText, Loader2, Mail, Printer, Send, Tags } from 'lucide-react';
import { dt } from '@/src/lib/dt';
import { cn } from '../../../lib/utils';
import type { Report } from '../../../types';
import { KOSOVO_MUNICIPALITIES } from '../../../lib/constants';
import type { Zone } from '../../../lib/responsibility';
import { CSV_HEADERS, csvText, downloadText, printHtml, routeReports, routingCsvRows, routingHtml, type RoutedGroup } from '../../../lib/routingExport';
import { classifyReports, type ClassifyChange } from '../../../lib/reportClassifyApi';
import { contactRefFor, ensureContact } from '../../../lib/routingContacts';
import { sendReportEmail } from '../../../lib/institutionMailApi';
import SectorPicker from '../SectorPicker';
import ContactsDirectory from '../ContactsDirectory';
import { askConfirm, askReason } from '../../../lib/dialogs';

/**
 * What staff do with a set of selected reports besides moving them along the board:
 * say what they are (category, municipality, urban/rural), see who answers each one,
 * hand that list over as a document, or send each report to the body that answers it.
 *
 * Everything here goes through checks that already exist: the classification and the
 * email are server routes with their own permission rules, and the documents leave out
 * the reporter (lib/routingExport.ts).
 */

/** Statuses before a report is public record; the server refuses to email these. */
const NOT_YET_PUBLIC = new Set(['Pending Review', 'Rejected', 'Draft']);

const STATUS_CHIP: Record<string, string> = {
  ready: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200',
  review: 'bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200',
  none: 'bg-rose-50 text-rose-800 dark:bg-rose-500/15 dark:text-rose-200',
};

const field = 'min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-white/10 dark:bg-slate-900 dark:text-white';

interface SendLine { id: string; title: string; outcome: 'sent' | 'queued' | 'skipped' | 'failed'; detail: string }

export interface ReportsBulkToolsProps {
  /** The selected reports, as full records. */
  reports: readonly Report[];
  /** Called after a change that the list should reload for. */
  onChanged: () => void;
}

export function ReportsBulkTools({ reports, onChanged }: ReportsBulkToolsProps) {
  const [open, setOpen] = useState(true);
  const [topic, setTopic] = useState('');
  const [municipality, setMunicipality] = useState('');
  const [zone, setZone] = useState<'' | Zone>('');
  const [busy, setBusy] = useState<null | 'classify' | 'send'>(null);
  const [note, setNote] = useState('');
  const [lines, setLines] = useState<SendLine[] | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [directory, setDirectory] = useState(false);

  const groups = useMemo(() => routeReports(reports), [reports]);
  const needsZone = groups.reduce((sum, group) => sum + group.needsZone, 0);
  const sendableCount = groups.filter(group => group.recipient.sendable).reduce((sum, group) => sum + group.items.length, 0);
  const change: ClassifyChange = {
    ...(topic ? { topicCategory: topic } : {}),
    ...(municipality ? { municipality } : {}),
    ...(zone ? { zone } : {}),
  };
  const hasChange = Object.keys(change).length > 0;

  const apply = async () => {
    if (!hasChange || busy) return;
    setBusy('classify');
    try {
      const result = await classifyReports(reports.map(report => report.id), change);
      toast.success(`${result.updated} ${dt('raporte u klasifikuan.')}`);
      setTopic(''); setMunicipality(''); setZone('');
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : dt('Klasifikimi nuk u krye.'));
    } finally {
      setBusy(null);
    }
  };

  const subtitle = `${reports.length} ${dt('raporte të zgjedhura')}`;
  const stamp = new Date().toISOString().slice(0, 10);
  const exportCsv = () => downloadText(`raportime-${stamp}.csv`, csvText(CSV_HEADERS, routingCsvRows(groups)), 'text/csv');
  const exportHtml = () => downloadText(`raportime-${stamp}.html`, routingHtml(groups, subtitle), 'text/html');
  const exportPdf = () => { if (!printHtml(routingHtml(groups, subtitle))) toast.error(dt('Shfletuesi bllokoi dritaren e printimit.')); };

  const send = async () => {
    if (busy || sendableCount === 0) return;
    const eligible = groups.filter(group => group.recipient.sendable).reduce((sum, group) => sum + group.items.filter(item => !NOT_YET_PUBLIC.has(String(item.report.status))).length, 0);
    if (eligible === 0) { toast.error(dt('Asnjë nga raportet e zgjedhura nuk është aprovuar ende.')); return; }
    const text = `${dt('Do të dërgohen')} ${eligible} ${dt('raportime, secili te institucioni që përgjigjet për të. Vetëm raportet e aprovuara dërgohen; një raport nuk i dërgohet të njëjtit kontakt dy herë brenda 24 orëve. Vazhdoni?')}`;
    if (!await askConfirm(text)) return;

    setBusy('send');
    setLines(null);
    const out: SendLine[] = [];
    const total = groups.filter(group => group.recipient.sendable).reduce((sum, group) => sum + group.items.length, 0);
    setProgress({ done: 0, total });
    let done = 0;
    for (const group of groups) {
      if (!group.recipient.sendable) continue;
      for (const { report, municipality: reportMunicipality } of group.items) {
        const label = report.title || report.trackingId || report.id;
        if (NOT_YET_PUBLIC.has(String(report.status))) {
          out.push({ id: report.id, title: label, outcome: 'skipped', detail: dt('Ende nuk është aprovuar.') });
        } else {
          try {
            await ensureContact(group.recipient, reportMunicipality);
            const ref = contactRefFor(group.recipient, reportMunicipality);
            const result = await sendReportEmail(report.id, ref.id, note.trim());
            out.push({
              id: report.id, title: label,
              outcome: result.status === 'sent' ? 'sent' : result.status === 'queued' ? 'queued' : 'failed',
              detail: result.status === 'queued' ? dt('Në radhë: ofruesi i emailit nuk është konfiguruar.') : result.error ?? '',
            });
          } catch (error) {
            out.push({ id: report.id, title: label, outcome: 'skipped', detail: error instanceof Error ? error.message : dt('Dërgimi nuk u krye.') });
          }
        }
        done += 1;
        setProgress({ done, total });
      }
    }
    setLines(out);
    setProgress(null);
    setBusy(null);
    const sent = out.filter(line => line.outcome === 'sent').length;
    if (sent) toast.success(`${sent} ${dt('emaile u dërguan.')}`);
    onChanged();
  };

  return (
    <section aria-label={dt('Rrugëzimi dhe dërgimi')} className="rounded-2xl border border-blue-200 bg-white dark:border-blue-900/50 dark:bg-slate-900">
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        aria-expanded={open}
        className="flex min-h-12 w-full items-center justify-between gap-3 px-4 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-white">
          <Tags className="h-4 w-4 text-blue-600" aria-hidden="true" />
          {dt('Rrugëzimi dhe dërgimi')} · {reports.length}
        </span>
        <ChevronDown className={cn('h-4 w-4 text-slate-500 transition-transform', open && 'rotate-180')} aria-hidden="true" />
      </button>

      {open && (
        <div className="space-y-4 border-t border-blue-200/70 px-4 pb-4 pt-3 dark:border-blue-900/40">
          {/* 1. Classify */}
          <div>
            <h3 className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">1 · {dt('Cakto kategorinë, komunën dhe zonën')}</h3>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              <div className="text-xs font-bold text-slate-600 dark:text-slate-300">
                {dt('Sektori / Ministria')}
                <SectorPicker value={topic} onChange={setTopic} emptyLabel={dt('Pa ndryshim')} className="mt-1" />
              </div>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                {dt('Komuna')}
                <select value={municipality} onChange={event => setMunicipality(event.target.value)} className={cn(field, 'mt-1')}>
                  <option value="">{dt('Pa ndryshim')}</option>
                  {KOSOVO_MUNICIPALITIES.map(name => <option key={name} value={name}>{name}</option>)}
                </select>
              </label>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                {dt('Zona')}
                <select value={zone} onChange={event => setZone(event.target.value as '' | Zone)} className={cn(field, 'mt-1')}>
                  <option value="">{dt('Pa ndryshim')}</option>
                  <option value="urban">{dt('Urbane (përgjigjet komuna)')}</option>
                  <option value="rural">{dt('Rurale (përgjigjet shteti)')}</option>
                </select>
              </label>
            </div>
            <button
              type="button"
              onClick={apply}
              disabled={!hasChange || busy !== null}
              className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-black text-white disabled:opacity-40"
            >
              {busy === 'classify' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
              {dt('Apliko te')} {reports.length} {dt('raporte')}
            </button>
          </div>

          {/* 2. Recipients */}
          <div>
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">2 · {dt('Kush përgjigjet')}</h3>
              <button type="button" onClick={() => setDirectory(true)} className="min-h-9 rounded-lg px-2 text-xs font-bold text-blue-700 hover:underline dark:text-blue-300">{dt('Të gjitha kontaktet')}</button>
            </div>
            {needsZone > 0 && (
              <p className="mt-2 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                {needsZone} {dt('raporte nuk kanë zonë të caktuar; përkohësisht shkojnë te komuna. Caktoni zonën më sipër që të shkojnë te institucioni i duhur.')}
              </p>
            )}
            <ul className="mt-2 space-y-2">
              {groups.map(group => <RecipientRow key={group.key} group={group} />)}
            </ul>
          </div>

          {/* 3. Export and send */}
          <div>
            <h3 className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">3 · {dt('Eksporto ose dërgo')}</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={exportCsv} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"><FileDown className="h-4 w-4" aria-hidden="true" />CSV</button>
              <button type="button" onClick={exportHtml} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"><FileText className="h-4 w-4" aria-hidden="true" />HTML</button>
              <button type="button" onClick={exportPdf} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"><Printer className="h-4 w-4" aria-hidden="true" />PDF</button>
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">{dt('Dokumentet grupohen sipas institucionit dhe nuk përmbajnë emrin e qytetarit.')}</p>

            <label className="mt-3 block text-xs font-bold text-slate-600 dark:text-slate-300">
              {dt('Shënim për institucionin (opsional)')}
              <textarea
                value={note}
                onChange={event => setNote(event.target.value.slice(0, 600))}
                rows={2}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 dark:border-white/10 dark:bg-slate-900 dark:text-white"
              />
            </label>
            <button
              type="button"
              onClick={send}
              disabled={busy !== null || sendableCount === 0}
              className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-black text-white disabled:opacity-40"
            >
              {busy === 'send' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
              {busy === 'send' && progress ? `${progress.done}/${progress.total}` : `${dt('Dërgo me email')} (${sendableCount})`}
            </button>
            {sendableCount === 0 && <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">{dt('Asnjë marrës nuk ka adresë të verifikuar. Eksportoni dokumentin ose plotësoni kontaktet.')}</p>}
          </div>

          {lines && (
            <div role="status" className="rounded-xl border border-slate-200 bg-white p-3 text-xs dark:border-white/10 dark:bg-slate-900">
              <p className="font-black text-slate-900 dark:text-white">
                {lines.filter(line => line.outcome === 'sent').length} {dt('të dërguara')} · {lines.filter(line => line.outcome === 'queued').length} {dt('në radhë')} · {lines.filter(line => line.outcome === 'skipped' || line.outcome === 'failed').length} {dt('jo të dërguara')}
              </p>
              <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                {lines.filter(line => line.outcome !== 'sent').map(line => (
                  <li key={line.id} className="text-slate-600 dark:text-slate-300"><strong className="text-slate-900 dark:text-white">{line.title}</strong> — {line.detail}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      {directory && <ContactsDirectory onClose={() => setDirectory(false)} />}
    </section>
  );
}

function RecipientRow({ group }: { group: RoutedGroup }) {
  const { recipient } = group;
  const state = recipient.sendable ? 'ready' : recipient.email ? 'review' : 'none';
  const label = recipient.sendable ? dt('Gati për dërgim') : recipient.email ? dt('Duhet verifikuar') : dt('Pa adresë');
  return (
    <li className="rounded-xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-slate-900 dark:text-white">{recipient.name}</p>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
            {recipient.level === 'central' ? dt('Qendror') : `${dt('Komunal')} · ${recipient.office}`}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-800 dark:bg-white/10 dark:text-slate-100">{group.items.length}</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
        <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-bold', STATUS_CHIP[state])}>
          <Mail className="h-3 w-3" aria-hidden="true" />{label}
        </span>
        {recipient.email && <span className="truncate text-slate-500 dark:text-slate-400">{recipient.email}</span>}
        {recipient.note && <span className="text-slate-500 dark:text-slate-400">· {recipient.note}</span>}
      </div>
    </li>
  );
}

/**
 * The panel as a side drawer, opened from a button that appears once something is
 * selected. A drawer sits above the page instead of inside it, so the list does not jump
 * when the first report is ticked and nothing shows through it.
 */
export function ReportsBulkDrawer({ reports, onChanged }: ReportsBulkToolsProps) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  // Nothing selected: nothing to act on, and a drawer left open should close itself.
  useEffect(() => { if (reports.length === 0) setOpen(false); }, [reports.length]);
  if (reports.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-40 inline-flex min-h-12 items-center gap-2 rounded-full bg-blue-600 px-5 text-sm font-black text-white shadow-xl shadow-blue-600/30"
      >
        <Tags className="h-4 w-4" aria-hidden="true" />
        {dt('Rrugëzim dhe dërgim')} · {reports.length}
      </button>
      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={dt('Rrugëzimi dhe dërgimi')}>
          <button type="button" aria-label={dt('Mbyll')} onClick={() => setOpen(false)} className="absolute inset-0 bg-slate-950/50" />
          <div className="absolute inset-y-0 right-0 flex w-full max-w-xl flex-col bg-white shadow-2xl dark:bg-slate-900">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-white/10">
              <p className="text-sm font-black text-slate-900 dark:text-white">{dt('Rrugëzimi dhe dërgimi')} · {reports.length} {dt('raporte')}</p>
              <button type="button" onClick={() => setOpen(false)} aria-label={dt('Mbyll')} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-white/10">
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <ReportsBulkTools reports={reports} onChanged={onChanged} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
