import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { History, Loader2 } from 'lucide-react';
import { dt } from '@/src/lib/dt';
import { cn } from '../../lib/utils';
import { useStore } from '../../lib/store';
import { availableActions, type DecisionKind } from '../../lib/decisionRules';
import { loadDecisionHistory, takeDecision, type DecisionRecord } from '../../lib/decisionsApi';

/**
 * The buttons for deciding on one record, the same in every section.
 *
 * It draws only the actions the server will accept for this person and this
 * state (the rules are shared, src/lib/decisionRules.ts), asks for a reason where
 * one is required, and shows who decided what before. A refusal from the server
 * (someone else decided first, the grant was removed) is shown, never hidden.
 */

const TONES: Record<string, string> = {
  approve: 'bg-emerald-600 text-white hover:bg-emerald-500',
  publish: 'bg-emerald-600 text-white hover:bg-emerald-500',
  resolve: 'bg-sky-600 text-white hover:bg-sky-500',
  complete: 'bg-sky-600 text-white hover:bg-sky-500',
  reject: 'bg-rose-600 text-white hover:bg-rose-500',
  hide: 'bg-rose-600 text-white hover:bg-rose-500',
  unpublish: 'bg-amber-600 text-white hover:bg-amber-500',
};
const QUIET = 'border border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-slate-800';

const when = (iso: string) => {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t).toLocaleString('sq', { dateStyle: 'medium', timeStyle: 'short' }) : '';
};

export interface DecisionBarProps {
  kind: DecisionKind;
  id: string;
  /** The record as the screen has it; its state decides which buttons show. */
  doc: Record<string, any>;
  /** Called after a decision is saved, with the new state. */
  onDecided?: (state: string, action: string) => void;
  /** Extra values for one action, e.g. the campaign an ad request turned into. */
  extra?: { campaignId?: string };
  /** Hide some actions this screen handles its own way (e.g. approving an ad by building it). */
  hideActions?: readonly string[];
  size?: 'sm' | 'md';
  className?: string;
}

export default function DecisionBar({ kind, id, doc, onDecided, extra, hideActions = [], size = 'sm', className }: DecisionBarProps) {
  const currentUser = useStore(state => state.currentUser);
  const [busy, setBusy] = useState<string | null>(null);
  const [asking, setAsking] = useState<{ action: string; label: string } | null>(null);
  const [reason, setReason] = useState('');
  const [history, setHistory] = useState<DecisionRecord[] | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const actions = useMemo(() => {
    if (!currentUser) return [];
    const actor = {
      uid: currentUser.id,
      role: currentUser.role,
      municipality: currentUser.municipality ?? '',
      permissions: (currentUser.permissions ?? []) as readonly string[],
    };
    return availableActions(kind, doc, actor).filter(a => !hideActions.includes(a.action));
  }, [currentUser, kind, doc, hideActions]);

  const run = async (action: string, why = '') => {
    setBusy(action);
    try {
      const { state } = await takeDecision(kind, id, action, { reason: why || undefined, ...extra });
      toast.success(dt('Vendimi u ruajt.'));
      setAsking(null);
      setReason('');
      if (historyOpen) setHistory(await loadDecisionHistory(kind, id).catch(() => history));
      onDecided?.(state, action);
    } catch (error) {
      toast.error((error as Error)?.message || dt('Vendimi nuk u ruajt.'));
    } finally {
      setBusy(null);
    }
  };

  const toggleHistory = async () => {
    const next = !historyOpen;
    setHistoryOpen(next);
    if (next && history === null) {
      try {
        setHistory(await loadDecisionHistory(kind, id));
      } catch (error) {
        setHistory([]);
        toast.error((error as Error)?.message || dt('Historia nuk u lexua.'));
      }
    }
  };

  const pad = size === 'md' ? 'px-3.5 py-2 text-xs' : 'px-2.5 py-1.5 text-[11px]';

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex flex-wrap items-center gap-1.5">
        {actions.map(a => (
          <button
            key={a.action}
            type="button"
            disabled={busy !== null}
            onClick={() => (a.needsReason ? setAsking({ action: a.action, label: a.label }) : void run(a.action))}
            className={cn('inline-flex items-center gap-1 rounded-lg font-bold transition-colors disabled:opacity-40', pad, TONES[a.action] ?? QUIET)}
          >
            {busy === a.action && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
            {dt(a.label)}
          </button>
        ))}
        <button type="button" onClick={() => void toggleHistory()} className={cn('inline-flex items-center gap-1 rounded-lg font-semibold', pad, QUIET)} aria-expanded={historyOpen}>
          <History className="h-3.5 w-3.5" aria-hidden="true" /> {dt('Historia')}
        </button>
      </div>

      {asking && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 dark:border-white/10 dark:bg-slate-800/60">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
            {dt(asking.label)} — {dt('arsyeja (ruhet në histori)')}
          </label>
          <textarea
            autoFocus
            value={reason}
            onChange={e => setReason(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (reason.trim().length >= 5) void run(asking.action, reason.trim()); }
              if (e.key === 'Escape') setAsking(null);
            }}
            rows={2}
            maxLength={300}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-sm dark:border-white/10 dark:bg-slate-900 dark:text-white"
          />
          <div className="mt-1.5 flex justify-end gap-1.5">
            <button type="button" onClick={() => setAsking(null)} className={cn('rounded-lg font-semibold', pad, QUIET)}>{dt('Anulo')}</button>
            <button
              type="button"
              disabled={busy !== null || reason.trim().length < 5}
              onClick={() => void run(asking.action, reason.trim())}
              className={cn('rounded-lg font-bold disabled:opacity-40', pad, TONES[asking.action] ?? 'bg-slate-900 text-white')}
            >
              {dt(asking.label)}
            </button>
          </div>
        </div>
      )}

      {historyOpen && (
        <ol className="space-y-1.5 rounded-xl border border-slate-200 p-2.5 text-xs dark:border-white/10">
          {history === null ? (
            <li className="text-slate-400">{dt('Duke lexuar…')}</li>
          ) : history.length === 0 ? (
            <li className="text-slate-400">{dt('Asnjë vendim i regjistruar ende.')}</li>
          ) : (
            history.map(h => (
              <li key={h.id} className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-bold text-slate-800 dark:text-slate-100">{dt(h.label)}</span>
                <span className="text-slate-500">{h.byName} · {when(h.at)}</span>
                {h.reason && <span className="w-full text-slate-600 dark:text-slate-300">“{h.reason}”</span>}
              </li>
            ))
          )}
        </ol>
      )}
    </div>
  );
}
