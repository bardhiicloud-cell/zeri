import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, Flag, Gavel, History, RefreshCw, ShieldAlert, UserX } from 'lucide-react';
import toast from 'react-hot-toast';
import { dt } from '@/src/lib/dt';
import { auth } from '../../lib/firebase';
import { useStore } from '../../lib/store';
import { cn } from '../../lib/utils';
import {
  ACTION_LABELS, EFFECT_LABELS, KIND_LABELS, REASON_LABELS, STATUS_LABELS, moderationApi,
  type CaseAction, type CaseHistoryEntry, type CaseKind, type CaseSubject, type CaseView, type ModerationCase, type ModerationSummary,
} from '../../lib/moderationApi';
import { Badge, Empty, ErrorNote, Panel, Spinner, Stat, btn, inputClass } from './ui';

/**
 * The moderation desk of the public debate.
 *
 * Left: the queue (one line per reported post, comment, account or ad, however many people
 * reported it), ordered by harm and then by how recently it was reported. Right: the case
 * with what was reported, why, the account's record, the history, and the decisions this
 * moderator may take. Every decision is applied by the server to the real content or
 * account and can be undone ("Rikthe") or appealed by the person concerned.
 */
const VIEWS: ReadonlyArray<{ id: CaseView; label: string }> = [
  { id: 'queue', label: 'Radha' },
  { id: 'mine', label: 'Të miat' },
  { id: 'escalated', label: 'Të eskaluara' },
  { id: 'appealed', label: 'Apelime' },
  { id: 'violation_confirmed', label: 'Shkelje' },
  { id: 'restricted', label: 'Llogari të kufizuara' },
  { id: 'no_violation', label: 'Pa shkelje' },
  { id: 'resolved', label: 'Të mbyllura' },
];

const PRIORITY_TONE = { urgent: 'rose', high: 'amber', normal: 'blue', low: 'slate' } as const;
const PRIORITY_LABEL = { urgent: 'Urgjent', high: 'I lartë', normal: 'Normal', low: 'I ulët' } as const;
const fmt = (ms: number | null | undefined) => (ms ? new Date(ms).toLocaleString('sq-AL', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

/** The moves worth showing for this case and this person. The server re-checks every one. */
export function actionsFor(item: ModerationCase, me: { uid: string; role: string }): CaseAction[] {
  const admin = me.role === 'admin' || me.role === 'superadmin';
  const mine = item.assigneeUid === me.uid;
  const free = !item.assigneeUid;
  const decisions: CaseAction[] = ['dismiss'];
  if (item.kind === 'post' || item.kind === 'ad') decisions.push('hide');
  if (item.kind !== 'user') decisions.push('remove');
  if (item.kind === 'ad') decisions.push('unpromote');
  if (item.subjectUid) decisions.push('warn', 'suspend', ...(admin ? ['ban' as const] : []));
  switch (item.status) {
    case 'flagged':
      return free || admin ? ['claim', ...decisions, 'escalate'] : [];
    case 'under_review':
      if (mine || admin) return [...decisions, 'escalate', 'release'];
      return [];
    case 'violation_confirmed':
    case 'restricted':
      return item.lastEffect && (item.lastEffect.type !== 'ban' || admin) ? ['restore'] : [];
    case 'appealed':
      if (item.decidedBy === me.uid) return [];
      if (free) return ['claim', 'uphold', 'overturn'];
      return mine || admin ? ['uphold', 'overturn', 'release'] : [];
    default:
      return [];
  }
}

const NEEDS_REASON: readonly CaseAction[] = ['dismiss', 'hide', 'remove', 'unpromote', 'warn', 'suspend', 'ban', 'restore', 'uphold', 'overturn', 'escalate'];
const DESTRUCTIVE: readonly CaseAction[] = ['remove', 'suspend', 'ban'];

export function DebateModeration({ onChanged }: { onChanged?: () => void }) {
  const role = useStore(state => state.currentUser?.role) ?? '';
  const me = { uid: auth.currentUser?.uid ?? '', role };
  const [view, setView] = useState<CaseView>('queue');
  const [kind, setKind] = useState<CaseKind | ''>('');
  const [rows, setRows] = useState<ModerationCase[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState<ModerationSummary | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const load = useCallback(async (after: string | null) => {
    setLoading(true); setError('');
    try {
      const page = await moderationApi.list({ view, kind: view === 'queue' ? kind : '', cursor: after, limit: 30 });
      setRows(previous => (after ? [...previous, ...page.cases] : page.cases));
      setCursor(page.nextCursor);
    } catch (e) { setError((e as Error).message); if (!after) setRows([]); } finally { setLoading(false); }
  }, [view, kind]);

  const refreshSummary = useCallback(() => { moderationApi.summary().then(setSummary).catch(() => setSummary(null)); }, []);
  useEffect(() => { void load(null); }, [load]);
  useEffect(() => { refreshSummary(); }, [refreshSummary]);

  const changed = (updated?: ModerationCase) => {
    if (updated) setRows(previous => previous.map(row => (row.id === updated.id ? updated : row)));
    refreshSummary();
    onChanged?.();
  };

  const importOld = async () => {
    setImporting(true);
    try {
      const result = await moderationApi.backfill();
      toast.success(`${dt('Raste të reja nga raportimet e vjetra')}: ${result.created}${result.more ? ` (${dt('ka ende; provoni përsëri')})` : ''}`);
      await load(null); refreshSummary();
    } catch (e) { toast.error((e as Error).message); } finally { setImporting(false); }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Të raportuara" value={summary?.flagged ?? '—'} tone="rose" hint={summary?.oldestFlaggedAgeHours != null ? `${dt('më i vjetri')}: ${summary.oldestFlaggedAgeHours} ${dt('orë')}` : undefined} />
        <Stat label="Në shqyrtim" value={summary?.underReview ?? '—'} tone="blue" />
        <Stat label="Urgjente" value={summary?.urgent ?? '—'} tone="rose" />
        <Stat label="Të eskaluara" value={summary?.escalated ?? '—'} tone="amber" />
        <Stat label="Apelime" value={summary?.appealed ?? '—'} tone="amber" />
        <Stat label="Të miat" value={summary?.mine ?? '—'} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {VIEWS.map(entry => (
          <button key={entry.id} type="button" aria-pressed={view === entry.id} onClick={() => { setView(entry.id); setSelected(null); }}
            className={cn('min-h-9 rounded-full px-3 text-sm font-bold', view === entry.id ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300')}>
            {dt(entry.label)}
          </button>
        ))}
        {view === 'queue' && (
          <select aria-label={dt('Lloji')} value={kind} onChange={e => setKind(e.target.value as CaseKind | '')} className={cn(inputClass, 'w-auto')}>
            <option value="">{dt('Të gjitha llojet')}</option>
            {(Object.keys(KIND_LABELS) as CaseKind[]).map(k => <option key={k} value={k}>{dt(KIND_LABELS[k])}</option>)}
          </select>
        )}
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={() => { void load(null); refreshSummary(); }} className={cn(btn.ghost, 'min-h-9 px-3')} aria-label={dt('Rifresko')}><RefreshCw className="h-4 w-4" aria-hidden="true" /></button>
          <button type="button" onClick={() => void importOld()} disabled={importing} className={cn(btn.ghost, 'min-h-9 px-3 text-xs')} title={dt('Krijon raste për raportimet e bëra para se të ekzistonte radha. Nuk dyfishon.')}>
            {importing ? <Spinner /> : <History className="h-4 w-4" aria-hidden="true" />}{dt('Importo raportimet e vjetra')}
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <div className={cn('space-y-2 lg:col-span-5', selected && 'hidden lg:block')}>
          <ErrorNote message={error} />
          {rows.map(row => (
            <button key={row.id} type="button" onClick={() => setSelected(row.id)} aria-current={selected === row.id}
              className={cn('block w-full rounded-2xl border bg-white p-3 text-left transition hover:border-blue-400 dark:bg-slate-900',
                selected === row.id ? 'border-blue-500 ring-2 ring-blue-500/30' : 'border-slate-200 dark:border-white/10')}>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge tone={PRIORITY_TONE[row.priority]}>{dt(PRIORITY_LABEL[row.priority])}</Badge>
                <Badge>{dt(KIND_LABELS[row.kind])}</Badge>
                <Badge tone={row.open ? 'blue' : 'slate'}>{dt(STATUS_LABELS[row.status])}</Badge>
                {row.escalated && <Badge tone="rose">{dt('Eskaluar')}</Badge>}
                <span className="ml-auto text-xs font-bold text-slate-500"><Flag className="mr-1 inline h-3 w-3" aria-hidden="true" />{row.reportCount}</span>
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-slate-800 dark:text-slate-100">{row.snapshot.excerpt || row.snapshot.name || '—'}</p>
              <p className="mt-1 text-xs text-slate-500">
                {row.snapshot.authorName || row.snapshot.name || ''} · {fmt(row.lastReportedAtMs)}{row.assigneeName ? ` · ${dt('te')} ${row.assigneeName}` : ''}
              </p>
            </button>
          ))}
          {loading && <div className="flex justify-center p-4 text-slate-400"><Spinner className="h-5 w-5" /></div>}
          {!loading && !error && rows.length === 0 && <Panel><Empty>{view === 'queue' ? dt('Nuk ka raportime që presin. Radha është e pastër.') : dt('Asnjë rast në këtë pamje.')}</Empty></Panel>}
          {cursor && !loading && <button type="button" onClick={() => void load(cursor)} className={cn(btn.ghost, 'w-full')}>{dt('Ngarko më shumë')}</button>}
        </div>

        <div className={cn('lg:col-span-7', !selected && 'hidden lg:block')}>
          {selected
            ? <CaseDetail key={selected} id={selected} me={me} onBack={() => setSelected(null)} onChanged={changed} />
            : <Panel><Empty>{dt('Zgjidhni një rast nga radha për ta shqyrtuar.')}</Empty></Panel>}
        </div>
      </div>
    </div>
  );
}

function CaseDetail({ id, me, onBack, onChanged }: { id: string; me: { uid: string; role: string }; onBack: () => void; onChanged: (updated?: ModerationCase) => void }) {
  const [data, setData] = useState<{ case: ModerationCase; history: CaseHistoryEntry[]; subject: CaseSubject | null } | null>(null);
  const [error, setError] = useState('');
  const [chosen, setChosen] = useState<CaseAction | null>(null);

  const load = useCallback(async () => {
    setError('');
    try { setData(await moderationApi.detail(id)); } catch (e) { setError((e as Error).message); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  const item = data?.case;
  const actions = useMemo(() => (item ? actionsFor(item, me) : []), [item, me.uid, me.role]); // eslint-disable-line react-hooks/exhaustive-deps

  const runQuick = async (action: CaseAction) => {
    if (!item) return;
    try {
      const result = await moderationApi.decide(id, { action, expectedVersion: item.version });
      toast.success(dt(ACTION_LABELS[action]));
      onChanged(result.case); await load();
    } catch (e) { toast.error((e as Error).message); await load(); }
  };

  if (error) return <Panel><ErrorNote message={error} /><button type="button" onClick={() => void load()} className={cn(btn.ghost, 'mt-3')}>{dt('Provo përsëri')}</button></Panel>;
  if (!data || !item) return <Panel><div className="flex justify-center p-10 text-slate-400"><Spinner className="h-6 w-6" /></div></Panel>;

  return (
    <div className="space-y-4">
      <Panel>
        <button type="button" onClick={onBack} className="mb-3 inline-flex items-center gap-1 text-sm font-bold text-slate-500 lg:hidden"><ArrowLeft className="h-4 w-4" aria-hidden="true" />{dt('Radha')}</button>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={PRIORITY_TONE[item.priority]}>{dt(PRIORITY_LABEL[item.priority])}</Badge>
          <Badge>{dt(KIND_LABELS[item.kind])}</Badge>
          <Badge tone={item.open ? 'blue' : 'slate'}>{dt(STATUS_LABELS[item.status])}</Badge>
          {item.escalated && <Badge tone="rose">{dt('Eskaluar')}</Badge>}
          <span className="ml-auto font-mono text-[11px] text-slate-400">{item.id}</span>
        </div>

        <h3 className="mt-4 text-xs font-black uppercase tracking-wider text-slate-500">{dt('Çfarë u raportua')}</h3>
        <blockquote className="mt-1 whitespace-pre-wrap rounded-xl border-l-4 border-rose-400 bg-slate-50 p-3 text-sm text-slate-800 dark:bg-slate-950 dark:text-slate-100">
          {item.snapshot.excerpt || item.snapshot.name || dt('(pa tekst)')}
        </blockquote>
        {item.snapshot.imageUrl && <img src={item.snapshot.imageUrl} alt={dt('Imazhi i postimit të raportuar')} className="mt-2 max-h-48 rounded-xl object-cover" />}
        <p className="mt-1 text-xs text-slate-500">
          {dt('Autori')}: {item.snapshot.authorName || data.subject?.name || '—'}
          {item.postId && <> · {dt('Postimi')}: <span className="font-mono">{item.postId}</span></>}
        </p>

        <h3 className="mt-4 text-xs font-black uppercase tracking-wider text-slate-500">{dt('Arsyet e raportimit')} ({item.reportCount})</h3>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {Object.entries(item.reasons).sort((a, b) => b[1] - a[1]).map(([reason, count]) => <Badge key={reason} tone={reason === 'violence' || reason === 'illegal' ? 'rose' : 'slate'}>{dt(REASON_LABELS[reason] ?? reason)} × {count}</Badge>)}
        </div>
        <p className="mt-2 text-xs text-slate-500">{dt('Raportuar së pari')}: {fmt(item.firstReportedAtMs)} · {dt('së fundi')}: {fmt(item.lastReportedAtMs)}</p>

        {item.decision && (
          <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-950">
            <p className="font-bold">{dt('Vendimi')}: {dt(EFFECT_LABELS[item.lastEffect?.type ?? item.decision.action] ?? ACTION_LABELS[item.decision.action as CaseAction] ?? item.decision.action)}{item.decision.days ? ` · ${item.decision.days} ${dt('ditë')}` : ''}</p>
            <p className="text-slate-600 dark:text-slate-300">{item.decision.reason}</p>
            <p className="text-xs text-slate-500">{fmt(item.decision.atMs)}</p>
          </div>
        )}
        {item.appeal && (
          <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-500/40 dark:bg-amber-950/30">
            <p className="font-bold text-amber-900 dark:text-amber-200"><Gavel className="mr-1 inline h-4 w-4" aria-hidden="true" />{dt('Apelimi i personit')}{item.appeal.outcome ? ` · ${item.appeal.outcome === 'upheld' ? dt('vendimi u mbajt') : dt('vendimi u rrëzua')}` : ''}</p>
            <p className="text-amber-900 dark:text-amber-100">{item.appeal.text}</p>
            <p className="text-xs text-amber-700">{fmt(item.appeal.atMs)}</p>
          </div>
        )}
      </Panel>

      {data.subject && (
        <Panel>
          <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-500"><UserX className="h-4 w-4" aria-hidden="true" />{dt('Llogaria e lidhur')}: {data.subject.name || data.subject.uid}</h3>
          <div className="mt-2 flex flex-wrap gap-2 text-sm">
            <Badge tone={data.subject.warningCount > 0 ? 'amber' : 'slate'}>{dt('Paralajmërime')}: {data.subject.warningCount}</Badge>
            {data.subject.restriction
              ? <Badge tone="rose">{data.subject.restriction.kind === 'ban' ? dt('E ndaluar') : `${dt('E pezulluar deri')} ${fmt(data.subject.restriction.untilMs)}`}</Badge>
              : <Badge tone="emerald">{dt('Pa kufizim aktiv')}</Badge>}
          </div>
          {data.subject.priorCases.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-300">
              {data.subject.priorCases.map(prior => (
                <li key={prior.id}>{fmt(prior.atMs)} · {dt(KIND_LABELS[prior.kind])} · {dt(STATUS_LABELS[prior.status])}{prior.effect ? ` · ${dt(EFFECT_LABELS[prior.effect] ?? prior.effect)}` : ''}</li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-slate-500">{dt('Vendimet duhet të jenë proporcionale: një paralajmërim para pezullimit, pezullim para ndalimit, përveç dhunës ose përmbajtjes së paligjshme.')}</p>
        </Panel>
      )}

      <Panel>
        <h3 className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-500"><ShieldAlert className="h-4 w-4" aria-hidden="true" />{dt('Vendimi')}</h3>
        {item.assigneeUid && item.assigneeUid !== me.uid && actions.length === 0 && <p className="text-sm text-slate-500">{dt('Po e shqyrton')} {item.assigneeName || dt('një moderator tjetër')}.</p>}
        {item.status === 'appealed' && item.decidedBy === me.uid && <p className="text-sm text-slate-500">{dt('Ju e morët vendimin e parë; apelimin e shqyrton një moderator tjetër.')}</p>}
        {chosen ? (
          <DecisionForm action={chosen} item={item} onCancel={() => setChosen(null)} onDone={async updated => { setChosen(null); onChanged(updated); await load(); }} />
        ) : (
          <div className="flex flex-wrap gap-2">
            {actions.map(action => (
              <button key={action} type="button"
                onClick={() => (action === 'claim' || (action === 'release' && item.assigneeUid === me.uid) ? void runQuick(action) : setChosen(action))}
                className={cn(DESTRUCTIVE.includes(action) ? btn.danger : action === 'claim' ? btn.primary : btn.ghost, 'min-h-9 px-3 text-xs')}>
                {dt(ACTION_LABELS[action])}
              </button>
            ))}
            {actions.length === 0 && !item.open && <p className="text-sm text-slate-500">{dt('Rasti është vendosur. Nuk ka veprime të mëtejshme për ju.')}</p>}
          </div>
        )}
      </Panel>

      <Panel>
        <h3 className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-500"><History className="h-4 w-4" aria-hidden="true" />{dt('Historiku')}</h3>
        <ol className="space-y-2 border-l-2 border-slate-200 pl-4 dark:border-white/10">
          {data.history.map(entry => (
            <li key={entry.id} className="text-sm">
              <p className="font-bold text-slate-800 dark:text-slate-100">
                {dt(ACTION_LABELS[entry.action as CaseAction] ?? entry.action)}
                {entry.from && entry.to && entry.from !== entry.to && <span className="ml-2 font-normal text-slate-500">{dt(STATUS_LABELS[entry.from as keyof typeof STATUS_LABELS] ?? entry.from)} → {dt(STATUS_LABELS[entry.to as keyof typeof STATUS_LABELS] ?? entry.to)}</span>}
              </p>
              <p className="text-xs text-slate-500">{entry.actorName || (entry.actorUid === 'system' ? dt('Sistemi') : entry.actorUid)} · {fmt(entry.atMs)}{entry.days ? ` · ${entry.days} ${dt('ditë')}` : ''}</p>
              {entry.reason && <p className="text-slate-700 dark:text-slate-300">{entry.action === 'report' ? dt(REASON_LABELS[entry.reason] ?? entry.reason) : entry.reason}</p>}
            </li>
          ))}
        </ol>
      </Panel>
    </div>
  );
}

function DecisionForm({ action, item, onCancel, onDone }: { action: CaseAction; item: ModerationCase; onCancel: () => void; onDone: (updated: ModerationCase) => Promise<void> }) {
  const [reason, setReason] = useState('');
  const [days, setDays] = useState('7');
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const destructive = DESTRUCTIVE.includes(action);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      const result = await moderationApi.decide(item.id, {
        action, expectedVersion: item.version,
        ...(NEEDS_REASON.includes(action) || reason.trim() ? { reason: reason.trim() } : {}),
        ...(action === 'suspend' ? { days: Number(days) } : {}),
      });
      if (result.warning) toast(result.warning, { icon: '⚠️' }); else toast.success(dt(ACTION_LABELS[action]));
      await onDone(result.case);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  const explain: Partial<Record<CaseAction, string>> = {
    dismiss: 'Raportimet mbyllen; përmbajtja dhe llogaria mbeten siç janë.',
    hide: 'Postimi nuk shfaqet më publikisht, por nuk fshihet. Mund të rikthehet.',
    remove: 'Përmbajtja hiqet nga debati. Një kopje mbahet vetëm për shqyrtim dhe apelim.',
    unpromote: 'Reklama nuk promovohet më; postimi mbetet.',
    warn: 'Personi njoftohet dhe paralajmërimi shtohet në llogarinë e tij.',
    suspend: 'Personi nuk mund të postojë, komentojë apo dërgojë mesazhe deri në datën e caktuar. Pezullimi mbaron vetvetiu.',
    ban: 'Llogaria kufizohet pa afat dhe hyrja çaktivizohet. Vetëm për shkelje të rënda ose të përsëritura.',
    restore: 'Efekti i vendimit të fundit zhbëhet dhe personi njoftohet.',
    uphold: 'Vendimi mbetet; personi njoftohet me arsyen.',
    overturn: 'Vendimi rrëzohet dhe efekti i tij zhbëhet.',
    escalate: 'Rasti shënohet për vëmendjen e administratorit.',
    release: 'Rasti kthehet në radhë për një moderator tjetër.',
  };

  return (
    <form onSubmit={submit} className={cn('space-y-3 rounded-xl border p-4', destructive ? 'border-rose-300 bg-rose-50/60 dark:border-rose-500/40 dark:bg-rose-950/20' : 'border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-slate-950')}>
      <p className="flex items-center gap-2 text-sm font-black">{destructive && <AlertTriangle className="h-4 w-4 text-rose-600" aria-hidden="true" />}{dt(ACTION_LABELS[action])}</p>
      {explain[action] && <p className="text-xs text-slate-600 dark:text-slate-300">{dt(explain[action]!)}</p>}
      {action === 'suspend' && (
        <label className="block text-sm font-bold">{dt('Kohëzgjatja (ditë, 1-90)')}
          <input type="number" min={1} max={90} required value={days} onChange={e => setDays(e.target.value)} className={cn(inputClass, 'mt-1 w-32')} />
        </label>
      )}
      {(NEEDS_REASON.includes(action) || action === 'release') && (
        <label className="block text-sm font-bold">{dt('Arsyeja (i tregohet personit dhe mbetet në historik)')}
          <textarea required={NEEDS_REASON.includes(action)} minLength={5} maxLength={300} rows={3} value={reason} onChange={e => setReason(e.target.value)} className={cn(inputClass, 'mt-1 py-2')} />
        </label>
      )}
      {destructive && (
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={sure} onChange={e => setSure(e.target.checked)} className="mt-1" />
          <span>{dt('E kam shqyrtuar përmbajtjen dhe historikun e llogarisë; ky vendim është proporcional.')}</span>
        </label>
      )}
      <ErrorNote message={error} />
      <div className="flex gap-2">
        <button type="submit" disabled={busy || (destructive && !sure)} className={cn(destructive ? btn.danger : btn.primary)}>{busy ? <Spinner /> : null}{dt('Konfirmo')}</button>
        <button type="button" onClick={onCancel} className={btn.ghost}>{dt('Anulo')}</button>
      </div>
    </form>
  );
}
