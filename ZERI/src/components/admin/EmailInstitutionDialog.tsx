import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { CheckCircle2, Clock, Loader2, Mail, RotateCw, XCircle, X } from 'lucide-react';
import { dt } from '@/src/lib/dt';
import { cn } from '../../lib/utils';
import { getMailStatus, listReportEmails, retryEmail, sendReportEmail, type MailStatus, type SentEmail } from '../../lib/institutionMailApi';

/**
 * Send a report to the institution responsible for it, and see what was sent.
 *
 * The platform sends the message and keeps a record of every send. When no email
 * provider is configured the dialog says so plainly: a send is then kept in the
 * queue (and can be retried once a provider is set), and the staffer can still open
 * their own mail program with the same text instead.
 */
export interface EmailInstitutionDialogProps {
  reportId: string;
  reportTitle: string;
  contact: { id: string; name: string; email: string; institution: string };
  canRetry: boolean;
  onClose: () => void;
  /** Opens the person's own mail program with the same message (always available). */
  onUseMailProgram: () => void;
}

const STATE: Record<SentEmail['status'], { label: string; tone: string; icon: typeof Clock }> = {
  sent: { label: 'U dërgua', tone: 'text-emerald-700 bg-emerald-50', icon: CheckCircle2 },
  queued: { label: 'Në radhë', tone: 'text-amber-700 bg-amber-50', icon: Clock },
  failed: { label: 'Dështoi', tone: 'text-rose-700 bg-rose-50', icon: XCircle },
};

const when = (iso: string | null) => (iso && Number.isFinite(Date.parse(iso)) ? new Date(iso).toLocaleString('sq-AL', { dateStyle: 'short', timeStyle: 'short' }) : '');

export default function EmailInstitutionDialog({ reportId, reportTitle, contact, canRetry, onClose, onUseMailProgram }: EmailInstitutionDialogProps) {
  const [status, setStatus] = useState<MailStatus | null>(null);
  const [history, setHistory] = useState<SentEmail[] | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try { setHistory(await listReportEmails(reportId)); } catch { setHistory([]); }
  }, [reportId]);

  useEffect(() => {
    void getMailStatus().then(setStatus).catch(() => setStatus({ configured: false, provider: null }));
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const send = async () => {
    setBusy(true);
    try {
      const result = await sendReportEmail(reportId, contact.id, note.trim());
      if (result.status === 'sent') toast.success(dt('Emaili u dërgua dhe u regjistrua.'));
      else if (result.status === 'queued') toast(dt('U ruajt në radhë: ofruesi i emailit nuk është konfiguruar.'));
      else toast.error(result.error || dt('Ofruesi nuk e pranoi dërgimin.'));
      setNote('');
      await refresh();
    } catch (error) {
      toast.error((error as Error).message || dt('Dërgimi nuk u krye.'));
    } finally {
      setBusy(false);
    }
  };

  const retry = async (id: string) => {
    setBusy(true);
    try {
      const result = await retryEmail(id);
      if (result.status === 'sent') toast.success(dt('Emaili u dërgua.'));
      else toast.error(result.error || dt('Riprovimi dështoi.'));
      await refresh();
    } catch (error) {
      toast.error((error as Error).message || dt('Riprovimi nuk u krye.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[570] flex items-center justify-center bg-slate-950/60 p-4 md:backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={dt('Dërgo te institucioni')}>
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
        <header className="flex items-start gap-3 border-b border-slate-200 p-5 dark:border-white/10">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-600 text-white"><Mail className="h-4 w-4" aria-hidden="true" /></span>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">{dt('Dërgo te')} {contact.institution}</h3>
            <p className="truncate text-xs text-slate-500">{contact.name} · <span className="font-mono">{contact.email}</span></p>
            <p className="mt-0.5 truncate text-xs text-slate-400">{reportTitle}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={dt('Mbyll')} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-5 w-5" /></button>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5 text-sm">
          {status && !status.configured && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
              {dt('Emaili automatik nuk është konfiguruar ende. Dërgimi do të ruhet në radhë dhe mund të riprovohet kur të vendoset ofruesi. Ose hapni programin tuaj të emailit me të njëjtin tekst.')}
            </p>
          )}

          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400" htmlFor="mail-note">{dt('Shënim nga ju (opsional)')}</label>
            <textarea id="mail-note" value={note} onChange={event => setNote(event.target.value)} rows={3} maxLength={600} placeholder={dt('p.sh. Ka rrezik për kalimtarët, ju lutemi trajtoni sa më parë.')} className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm dark:border-white/10 dark:bg-slate-800 dark:text-white" />
            <p className="mt-1 text-[11px] text-slate-400">{dt('Mesazhi përmban raportimin me foto dhe vendndodhje, por kurrë emrin e atij që e ka raportuar.')}</p>
          </div>

          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{dt('Çfarë është dërguar për këtë raportim')}</h4>
            {history === null ? (
              <p className="mt-2 text-xs text-slate-400"><Loader2 className="inline h-3.5 w-3.5 animate-spin" /> {dt('Duke lexuar…')}</p>
            ) : history.length === 0 ? (
              <p className="mt-2 text-xs text-slate-400">{dt('Ende asgjë.')}</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {history.map(row => {
                  const state = STATE[row.status] ?? STATE.queued;
                  const Icon = state.icon;
                  return (
                    <li key={row.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-100 p-2 text-xs dark:border-white/5">
                      <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-bold', state.tone)}><Icon className="h-3 w-3" aria-hidden="true" /> {dt(state.label)}</span>
                      <span className="min-w-0 flex-1 truncate text-slate-600 dark:text-slate-300">{row.institution || row.to}</span>
                      <span className="text-slate-400">{row.byName} · {when(row.at)}</span>
                      {row.error && <span className="w-full text-rose-600">{row.error}</span>}
                      {canRetry && row.status !== 'sent' && status?.configured && (
                        <button type="button" disabled={busy} onClick={() => void retry(row.id)} className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-0.5 font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-white/10 dark:text-slate-300">
                          <RotateCw className="h-3 w-3" aria-hidden="true" /> {dt('Riprovo')}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 p-4 dark:border-white/10">
          <button type="button" onClick={onUseMailProgram} className="text-xs font-semibold text-slate-500 underline-offset-2 hover:underline">{dt('Hap programin tim të emailit')}</button>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 dark:border-white/10 dark:text-slate-300">{dt('Mbyll')}</button>
            <button type="button" disabled={busy} onClick={() => void send()} className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500 disabled:opacity-40">
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {dt('Dërgo')}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
