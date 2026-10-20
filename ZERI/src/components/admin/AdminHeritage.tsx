import { dt } from '@/src/lib/dt';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  AlertTriangle, ArchiveRestore, BadgeCheck, BookMarked, CheckCircle2, ChevronRight, Download, FilePlus2, History,
  Link2, Loader2, Plus, Save, Search, Settings2, ShieldCheck, Trash2, X,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { heritageAdmin, HeritageApiError, type AdminHeritageState, type Revision } from '../../lib/heritage/api';
import { SEED_ENTRIES } from '../../lib/heritage/seed';
import {
  ALL_SECTIONS, ENTRY_KINDS, ERAS, ERA_LABELS, EVIDENCE, EVIDENCE_STATUSES, KIND_LABELS, RIGHTS, SOURCE_TYPES,
  SOURCE_TYPE_LABELS, STATUS_LABELS, formatHeritageDate, sectionsOf,
  type Claim, type EntryStatus, type HeritageArea, type HeritageEntry, type HeritageSource, type MediaRef,
} from '../../lib/heritage/types';
import { checkTransition, nextMoves, publishBlockers, type Actor } from '../../lib/heritage/workflow';
import { askConfirm, askReason } from '../../lib/dialogs';

type Tab = 'entries' | 'sources' | 'log' | 'settings';
type Row = HeritageEntry & { inCms: boolean; withdrawn?: boolean };

const STATUS_TONE: Record<EntryStatus, string> = {
  draft: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  review: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200',
  approved: 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-200',
  published: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200',
  archived: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200',
};

const inputCls = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';
const btn = 'inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-40';
const btnPrimary = `${btn} bg-blue-700 text-white hover:bg-blue-800`;
const btnGhost = `${btn} border border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800`;
const btnDanger = `${btn} bg-rose-600 text-white hover:bg-rose-700`;

function blankEntry(area: HeritageArea): HeritageEntry {
  return {
    id: '', area, section: sectionsOf(area)[0].id, kind: 'article', title: { sq: '', en: '' }, summary: { sq: '', en: '' }, body: { sq: '', en: '' },
    evidence: 'established', sensitive: 'none', sourceIds: [], claims: [], media: [], tags: [], status: 'draft',
    verification: { state: 'unverified' }, corrections: [], version: 0, origin: 'cms',
  };
}

const slugify = (value: string) =>
  value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 78);

function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn('block space-y-1', className)}>
      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-slate-500">{hint}</span>}
    </label>
  );
}

export default function AdminHeritage() {
  const [state, setState] = useState<AdminHeritageState | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('entries');
  const [editing, setEditing] = useState<Row | 'new' | null>(null);

  const load = useCallback(async () => {
    try {
      setError('');
      setState(await heritageAdmin.load());
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  if (error) {
    return (
      <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
        <p className="font-bold">Arkivi nuk u ngarkua.</p>
        <p className="mt-1">{error}</p>
        <button type="button" className={cn(btnGhost, 'mt-3')} onClick={() => void load()}>Provo përsëri</button>
      </div>
    );
  }
  if (!state) {
    return <div className="flex h-48 items-center justify-center text-slate-400"><Loader2 className="h-6 w-6 animate-spin" aria-label={dt('Duke ngarkuar')} /></div>;
  }

  const tabs: Array<[Tab, string, React.ReactNode]> = [
    ['entries', 'Shënimet', <FilePlus2 key="e" className="h-4 w-4" />],
    ['sources', 'Burimet', <BookMarked key="s" className="h-4 w-4" />],
    ['log', 'Historiku & auditimi', <History key="l" className="h-4 w-4" />],
    ['settings', 'Cilësimet', <Settings2 key="c" className="h-4 w-4" />],
  ];

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white">Arkivi i Kosovës & Historia e UÇK-së</h2>
          <p className="text-xs text-slate-500">Shënime të strukturuara, burime, rishikim me dy sy, versione dhe regjistër auditimi.</p>
        </div>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label={dt('Pjesët e arkivit')}>
          {tabs.map(([id, label, icon]) => (
            <button key={id} role="tab" aria-selected={tab === id} type="button" onClick={() => { setTab(id); setEditing(null); }}
              className={cn(btn, tab === id ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'border border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300')}>
              {icon}{label}
            </button>
          ))}
        </div>
      </header>

      {tab === 'entries' && !editing && <EntryList state={state} onOpen={setEditing} onReload={load} />}
      {tab === 'entries' && editing && (
        <EntryEditor
          key={editing === 'new' ? 'new' : editing.id}
          state={state}
          initial={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onChanged={async () => { await load(); }}
        />
      )}
      {tab === 'sources' && <SourcesPanel state={state} onReload={load} />}
      {tab === 'log' && <LogPanel state={state} />}
      {tab === 'settings' && <SettingsPanel state={state} onReload={load} />}
    </div>
  );
}

/* ── List ─────────────────────────────────────────────────────────────────── */

function EntryList({ state, onOpen, onReload }: { state: AdminHeritageState; onOpen: (row: Row | 'new') => void; onReload: () => Promise<void> }) {
  const [area, setArea] = useState<HeritageArea | 'all'>('all');
  const [status, setStatus] = useState<EntryStatus | 'all' | 'seed'>('all');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);

  const rows: Row[] = useMemo(() => {
    const cms = new Map(state.entries.map((e) => [e.id, e]));
    const list: Row[] = state.entries.map((e) => ({ ...e, inCms: true }));
    for (const seed of SEED_ENTRIES) if (!cms.has(seed.id)) list.push({ ...seed, inCms: false });
    return list;
  }, [state.entries]);

  const filtered = rows.filter((r) => {
    if (area !== 'all' && r.area !== area) return false;
    if (status === 'seed' ? r.inCms : status !== 'all' && (!r.inCms || r.status !== status)) return false;
    if (query) {
      const q = query.toLowerCase();
      if (!`${r.title.sq} ${r.title.en} ${r.id} ${r.tags.join(' ')}`.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const counts = useMemo(() => {
    const c: Record<string, number> = { seed: rows.filter((r) => !r.inCms).length };
    for (const s of Object.keys(STATUS_LABELS)) c[s] = rows.filter((r) => r.inCms && r.status === s).length;
    return c;
  }, [rows]);

  const importAll = async () => {
    if (!await askConfirm(dt('Të importohen të gjitha tekstet fillestare në CMS si drafte? Teksti publik nuk ndryshon derisa t’i publikoni.'))) return;
    setBusy(true);
    try {
      const r = await heritageAdmin.importSeed();
      toast.success(`U importuan ${r.created}; ${r.skipped} ekzistonin.`);
      await onReload();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={dt('Kërko titull, ID ose etiketë')} aria-label={dt('Kërko shënime')} className={cn(inputCls, 'pl-9')} />
        </div>
        <select aria-label="Zona" value={area} onChange={(e) => setArea(e.target.value as HeritageArea | 'all')} className={cn(inputCls, 'w-auto')}>
          <option value="all">Të dyja zonat</option>
          <option value="kosova">Kosova (10 seksione)</option>
          <option value="uck">Historia e UÇK-së</option>
        </select>
        <select aria-label={dt('Statusi')} value={status} onChange={(e) => setStatus(e.target.value as EntryStatus | 'all' | 'seed')} className={cn(inputCls, 'w-auto')}>
          <option value="all">Çdo status</option>
          {(Object.keys(STATUS_LABELS) as EntryStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABELS[s]} ({counts[s]})</option>)}
          <option value="seed">Vetëm në paketë, jo ende në CMS ({counts.seed})</option>
        </select>
        {state.me.canEdit && <button type="button" className={btnPrimary} onClick={() => onOpen('new')}><Plus className="h-4 w-4" />Shënim i ri</button>}
        {state.me.canPublish && counts.seed > 0 && (
          <button type="button" className={btnGhost} disabled={busy} onClick={() => void importAll()}><Download className="h-4 w-4" />Importo përmbajtjen fillestare ({counts.seed})</button>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {filtered.slice(0, 300).map((row) => {
            const section = ALL_SECTIONS.find((s) => s.area === row.area && s.id === row.section);
            return (
              <li key={row.id}>
                <button type="button" onClick={() => onOpen(row)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-900 dark:text-white">{row.title.sq || row.id}</p>
                    <p className="truncate text-[11px] text-slate-500">
                      {row.area === 'uck' ? 'UÇK' : 'Kosova'} · {section?.title.sq} · {KIND_LABELS[row.kind].sq} · {EVIDENCE[row.evidence].label.sq}
                      {row.date ? ` · ${formatHeritageDate(row.date, 'sq')}` : ''}
                    </p>
                  </div>
                  <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-black', row.inCms ? STATUS_TONE[row.status] : 'bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-200')}>
                    {row.inCms ? STATUS_LABELS[row.status] : 'Paketë'}
                  </span>
                  <span className={cn('hidden rounded-full px-2 py-0.5 text-[11px] font-black sm:inline', row.verification.state === 'verified' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200' : 'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-200')}>
                    {row.verification.state === 'verified' ? 'I verifikuar' : 'Pa verifikuar'}
                  </span>
                  <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden="true" />
                </button>
              </li>
            );
          })}
          {filtered.length === 0 && <li className="px-4 py-10 text-center text-sm text-slate-500">Asnjë shënim nuk përputhet.</li>}
        </ul>
      </div>
    </section>
  );
}

/* ── Editor ───────────────────────────────────────────────────────────────── */

function EntryEditor({ state, initial, onClose, onChanged }: {
  state: AdminHeritageState; initial: Row | null; onClose: () => void; onChanged: () => Promise<void>;
}) {
  const isNew = initial === null;
  const needsImport = !!initial && !initial.inCms;
  const [model, setModel] = useState<HeritageEntry>(() => (initial ? structuredClone(initial) as HeritageEntry : blankEntry('kosova')));
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [revisions, setRevisions] = useState<Revision[] | null>(null);
  const [dialog, setDialog] = useState<null | { kind: 'transition'; to: EntryStatus } | { kind: 'verify' } | { kind: 'correct' }>(null);
  const [dialogText, setDialogText] = useState('');
  const [dialogEn, setDialogEn] = useState('');

  const editable = state.me.canEdit && (isNew || (initial!.inCms && (model.status === 'draft' || model.status === 'review')));
  const sourceMap = useMemo(() => new Map(state.sources.map((s) => [s.id, s])), [state.sources]);
  const actor: Actor = { uid: state.me.uid, role: state.me.role };
  const blockers = useMemo(() => publishBlockers(model, sourceMap), [model, sourceMap]);
  const set = <K extends keyof HeritageEntry>(key: K, value: HeritageEntry[K]) => setModel((m) => ({ ...m, [key]: value }));
  const setL = (key: 'title' | 'summary' | 'body', lang: 'sq' | 'en', value: string) => setModel((m) => ({ ...m, [key]: { ...m[key], [lang]: value } }));

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    setFieldErrors({});
    try {
      await fn();
      toast.success(ok);
      await onChanged();
    } catch (e) {
      if (e instanceof HeritageApiError && e.fields) setFieldErrors(e.fields);
      toast.error((e as Error).message, { duration: 7000 });
    } finally { setBusy(false); }
  };

  const save = () => run(async () => {
    const payload = { ...model, claims: model.claims, media: model.media };
    if (isNew) {
      const r = await heritageAdmin.create(payload);
      setModel(r.entry);
      onClose();
    } else {
      const r = await heritageAdmin.save(model.id, payload, model.version);
      setModel((m) => ({ ...m, ...r.entry }));
    }
  }, 'Shënimi u ruajt.');

  const importThis = () => run(async () => { await heritageAdmin.importSeed([model.id]); onClose(); }, 'Shënimi u kopjua në CMS si draft.');

  const submitDialog = () => {
    if (!dialog) return;
    const d = dialog;
    void run(async () => {
      if (d.kind === 'transition') await heritageAdmin.transition(model.id, d.to, dialogText);
      if (d.kind === 'verify') await heritageAdmin.verify(model.id, 'verified', dialogText);
      if (d.kind === 'correct') await heritageAdmin.correct(model.id, { sq: dialogText, en: dialogEn }, {});
      setDialog(null);
      setDialogText('');
      setDialogEn('');
      onClose();
    }, 'U krye.');
  };

  const moves = !isNew && initial!.inCms ? nextMoves(model.status) : [];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" className={btnGhost} onClick={onClose}><X className="h-4 w-4" />Mbyll</button>
        <div className="flex flex-wrap items-center gap-2">
          {!isNew && initial!.inCms && (
            <button type="button" className={btnGhost} onClick={async () => { try { setRevisions((await heritageAdmin.revisions(model.id)).revisions); } catch (e) { toast.error((e as Error).message); } }}>
              <History className="h-4 w-4" />Versionet
            </button>
          )}
          {needsImport && state.me.canPublish && <button type="button" className={btnPrimary} disabled={busy} onClick={() => void importThis()}><Download className="h-4 w-4" />Kopjo në CMS për ta redaktuar</button>}
          {editable && <button type="button" className={btnPrimary} disabled={busy || !model.id} onClick={() => void save()}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Ruaj</button>}
        </div>
      </div>

      {needsImport && (
        <p className="rounded-xl border border-violet-200 bg-violet-50 p-3 text-xs text-violet-900 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-100">
          Ky tekst vjen me aplikacionin dhe shfaqet publikisht si “në pritje të verifikimit”. Kopjojeni në CMS për ta redaktuar, verifikuar dhe publikuar me versione.
        </p>
      )}
      {!editable && !needsImport && !isNew && (
        <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-200">
          Shënimi është “{STATUS_LABELS[model.status]}” dhe nuk redaktohet drejtpërdrejt. Përdorni veprimet më poshtë: kthejeni në draft me arsye ose bëni një korrigjim të dukshëm.
        </p>
      )}

      {/* Workflow bar */}
      {!isNew && initial!.inCms && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-black', STATUS_TONE[model.status])}>{STATUS_LABELS[model.status]}</span>
            <span className="text-xs text-slate-500">versioni {model.version}</span>
            <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-black', model.verification.state === 'verified' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800')}>
              {model.verification.state === 'verified' ? `Verifikuar ${model.verification.at ?? ''}` : 'Pa verifikuar'}
            </span>
            <span className="mx-1 hidden h-4 w-px bg-slate-300 sm:block" />
            {moves.map((move) => {
              const check = checkTransition(model, move.to, actor, 'arsyeja e mjaftueshme');
              const blockedByContent = move.to === 'published' && blockers.length > 0;
              const disabled = busy || check.ok === false || blockedByContent;
              const label = { review: 'Dërgo në rishikim', approved: 'Aprovo', published: 'Publiko', draft: 'Kthe në draft', archived: 'Arkivo' }[move.to];
              return (
                <button key={move.to} type="button" disabled={disabled} className={move.to === 'archived' || move.needsReason ? btnGhost : btnPrimary}
                  title={check.ok === false ? check.error : blockedByContent ? 'Zgjidhni bllokuesit më poshtë' : undefined}
                  onClick={() => { setDialog({ kind: 'transition', to: move.to }); setDialogText(''); }}>
                  {move.to === 'archived' ? <ArchiveRestore className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}{label}
                </button>
              );
            })}
            {state.me.canApprove && model.verification.state !== 'verified' && model.status !== 'archived' && (
              <button type="button" className={btnGhost} disabled={busy} onClick={() => { setDialog({ kind: 'verify' }); setDialogText(''); }}><BadgeCheck className="h-4 w-4" />Shëno si i verifikuar</button>
            )}
            {state.me.canPublish && model.status === 'published' && (
              <button type="button" className={btnGhost} disabled={busy} onClick={() => { setDialog({ kind: 'correct' }); setDialogText(''); setDialogEn(''); }}><ShieldCheck className="h-4 w-4" />Korrigjim i dukshëm</button>
            )}
            {state.me.role === 'superadmin' && (model.status === 'draft' || model.status === 'archived') && (
              <button type="button" className={btnDanger} disabled={busy} onClick={async () => {
                const reason = await askReason(dt('Arsyeja e fshirjes së përhershme:'));
                if (!reason) return;
                await run(async () => { await heritageAdmin.remove(model.id, reason); onClose(); }, 'U fshi.');
              }}><Trash2 className="h-4 w-4" />Fshi</button>
            )}
          </div>

          {model.status !== 'published' && blockers.length > 0 && (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
              <p className="flex items-center gap-1.5 text-xs font-black text-amber-900 dark:text-amber-200"><AlertTriangle className="h-4 w-4" />Para publikimit ({blockers.length})</p>
              <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-xs text-amber-900 dark:text-amber-100">
                {blockers.map((b, i) => <li key={`${b.code}-${i}`}>{b.message}</li>)}
              </ul>
            </div>
          )}
          {model.corrections.length > 0 && (
            <div className="mt-3 text-xs text-slate-600 dark:text-slate-300">
              <p className="font-bold">Korrigjime publike</p>
              <ul className="mt-1 list-disc pl-5">{model.corrections.map((c, i) => <li key={i}>{c.at}: {c.text.sq}</li>)}</ul>
            </div>
          )}
        </div>
      )}

      {/* Form */}
      <fieldset disabled={!editable || busy} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Zona">
            <select className={inputCls} value={model.area} disabled={!isNew} onChange={(e) => { const a = e.target.value as HeritageArea; setModel((m) => ({ ...m, area: a, section: sectionsOf(a)[0].id })); }}>
              <option value="kosova">Kosova</option><option value="uck">Historia e UÇK-së</option>
            </select>
          </Field>
          <Field label="Seksioni">
            <select className={inputCls} value={model.section} onChange={(e) => set('section', e.target.value)}>
              {sectionsOf(model.area).map((s) => <option key={s.id} value={s.id}>{s.numeral} · {s.title.sq}</option>)}
            </select>
          </Field>
          <Field label="Lloji">
            <select className={inputCls} value={model.kind} onChange={(e) => set('kind', e.target.value as HeritageEntry['kind'])}>
              {ENTRY_KINDS.map((k) => <option key={k} value={k}>{KIND_LABELS[k].sq}</option>)}
            </select>
          </Field>
          <Field label="ID (URL)" hint={isNew ? 'Shkronja të vogla dhe vizë; nuk ndryshohet më pas.' : undefined}>
            <input className={inputCls} value={model.id} disabled={!isNew} onChange={(e) => set('id', slugify(e.target.value))} placeholder="p.sh. beteja-e-kosoves-1389" aria-invalid={!!fieldErrors.id} />
            {fieldErrors.id && <span className="text-[11px] text-rose-600">{fieldErrors.id}</span>}
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Statusi i provës" hint={EVIDENCE[model.evidence].meaning.sq}>
            <select className={inputCls} value={model.evidence} onChange={(e) => set('evidence', e.target.value as HeritageEntry['evidence'])}>
              {EVIDENCE_STATUSES.map((s) => <option key={s} value={s}>{EVIDENCE[s].label.sq}</option>)}
            </select>
          </Field>
          <Field label="Ndjeshmëria">
            <select className={inputCls} value={model.sensitive} onChange={(e) => set('sensitive', e.target.value as HeritageEntry['sensitive'])}>
              <option value="none">Normale</option><option value="graphic">Përmbajtje e rëndë (paralajmërim)</option><option value="sexual-violence">Dhunë seksuale (paralajmërim + pa media)</option>
            </select>
          </Field>
          <Field label="Periudha">
            <select className={inputCls} value={model.era ?? ''} onChange={(e) => set('era', (e.target.value || undefined) as HeritageEntry['era'])}>
              <option value="">—</option>{ERAS.map((e) => <option key={e} value={e}>{ERA_LABELS[e].sq}</option>)}
            </select>
          </Field>
          <Field label="Rendi">
            <input type="number" className={inputCls} value={model.order ?? 0} onChange={(e) => set('order', Number(e.target.value))} />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Data nga" hint="YYYY, YYYY-MM ose YYYY-MM-DD (p.e.s.: -0400)">
            <input className={inputCls} value={model.date?.from ?? ''} onChange={(e) => set('date', e.target.value ? { from: e.target.value, to: model.date?.to, precision: model.date?.precision ?? 'day', display: model.date?.display } : undefined)} />
          </Field>
          <Field label="Data deri (opsionale)">
            <input className={inputCls} value={model.date?.to ?? ''} disabled={!model.date} onChange={(e) => model.date && set('date', { ...model.date, to: e.target.value || undefined })} />
          </Field>
          <Field label="Saktësia e datës">
            <select className={inputCls} value={model.date?.precision ?? 'day'} disabled={!model.date} onChange={(e) => model.date && set('date', { ...model.date, precision: e.target.value as 'year' })}>
              <option value="day">Dita</option><option value="month">Muaji</option><option value="year">Viti</option><option value="circa">Afërsisht</option><option value="range">Interval</option>
            </select>
          </Field>
          <Field label="Vendi (emri)">
            <input className={inputCls} value={model.place?.name ?? ''} onChange={(e) => set('place', e.target.value ? { name: e.target.value, municipality: model.place?.municipality } : undefined)} />
          </Field>
        </div>

        {(['title', 'summary'] as const).map((key) => (
          <div key={key} className="grid gap-3 lg:grid-cols-2">
            <Field label={`${key === 'title' ? 'Titulli' : 'Përmbledhja'} — shqip`}>
              {key === 'title'
                ? <input className={inputCls} value={model.title.sq} onChange={(e) => setL('title', 'sq', e.target.value)} aria-invalid={!!fieldErrors.title} />
                : <textarea rows={2} className={inputCls} value={model.summary.sq} onChange={(e) => setL('summary', 'sq', e.target.value)} />}
            </Field>
            <Field label={`${key === 'title' ? 'Title' : 'Summary'} — English`}>
              {key === 'title'
                ? <input className={inputCls} value={model.title.en} onChange={(e) => setL('title', 'en', e.target.value)} />
                : <textarea rows={2} className={inputCls} value={model.summary.en} onChange={(e) => setL('summary', 'en', e.target.value)} />}
            </Field>
          </div>
        ))}
        <div className="grid gap-3 lg:grid-cols-2">
          <Field label="Teksti — shqip" hint="Paragrafë me rresht bosh; listë me “- ”; **e theksuar**; [tekst](/rruga) ose [tekst](https://…)">
            <textarea rows={12} className={cn(inputCls, 'font-mono')} value={model.body.sq} onChange={(e) => setL('body', 'sq', e.target.value)} />
          </Field>
          <Field label="Text — English">
            <textarea rows={12} className={cn(inputCls, 'font-mono')} value={model.body.en} onChange={(e) => setL('body', 'en', e.target.value)} />
          </Field>
        </div>

        <SourcePicker sources={state.sources} value={model.sourceIds} onChange={(ids) => set('sourceIds', ids)} />
        <ClaimsEditor claims={model.claims} sources={state.sources} onChange={(c) => set('claims', c)} />
        <MediaEditor media={model.media} onChange={(m) => set('media', m)} sensitive={model.sensitive} />

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Etiketa (të ndara me presje)"><input className={inputCls} value={model.tags.join(', ')} onChange={(e) => set('tags', e.target.value.split(',').map((t) => t.trim()).filter(Boolean))} /></Field>
          <div className="flex flex-wrap items-end gap-4 text-sm">
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={!!model.featured} onChange={(e) => set('featured', e.target.checked)} />Në pah</label>
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={!!model.livingPerson} onChange={(e) => set('livingPerson', e.target.checked)} />Përmend person të gjallë</label>
          </div>
          {model.livingPerson && (
            <Field label="Pëlqimi ose baza publike" className="sm:col-span-2">
              <input className={inputCls} value={model.consentNote ?? ''} onChange={(e) => set('consentNote', e.target.value)} placeholder="p.sh. figurë publike; fakte të botuara; pëlqim i shkruar më 2026-03-04" />
            </Field>
          )}
        </div>
      </fieldset>

      {revisions && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between"><h3 className="text-sm font-black">Historiku i versioneve</h3><button type="button" className={btnGhost} onClick={() => setRevisions(null)}><X className="h-4 w-4" /></button></div>
          <ul className="mt-2 divide-y divide-slate-100 text-xs dark:divide-slate-800">
            {revisions.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                <span className="font-black">v{r.version}</span><span>{r.action}</span><span className="text-slate-500">{STATUS_LABELS[r.status as EntryStatus] ?? r.status}</span>
                <span className="text-slate-500">{r.actorEmail} ({r.actorRole})</span><span className="text-slate-400">{r.at.replace('T', ' ').slice(0, 16)}</span>
                {r.reason && <span className="w-full text-slate-600 dark:text-slate-300">“{r.reason}”</span>}
              </li>
            ))}
            {revisions.length === 0 && <li className="py-3 text-slate-500">Asnjë version ende.</li>}
          </ul>
        </div>
      )}

      {dialog && (
        <div role="dialog" aria-modal="true" aria-label={dt('Konfirmim')} className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 sm:items-center" onClick={() => setDialog(null)}>
          <div className="w-full max-w-md space-y-3 rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-black">
              {dialog.kind === 'verify' ? 'Verifikimi faktik' : dialog.kind === 'correct' ? 'Korrigjim i dukshëm' : `Kalim në “${STATUS_LABELS[dialog.to]}”`}
            </h3>
            <p className="text-xs text-slate-500">
              {dialog.kind === 'verify' && 'Shkruani çfarë kontrolluat (burimet e hapura, shifrat e krahasuara). Redaktori i fundit nuk mund ta verifikojë vetë.'}
              {dialog.kind === 'correct' && 'Teksti shfaqet publikisht në shënim si korrigjim të datuar. Ndryshimi i vetë tekstit bëhet duke e kthyer në draft.'}
              {dialog.kind === 'transition' && (nextMoves(model.status).find((m) => m.to === dialog.to)?.needsReason ? 'Arsyeja është e detyrueshme dhe ruhet në auditim.' : 'Shënim opsional për auditimin.')}
            </p>
            <textarea autoFocus rows={3} className={inputCls} value={dialogText} onChange={(e) => setDialogText(e.target.value)} placeholder={dialog.kind === 'correct' ? 'Korrigjimi (shqip)' : 'Shënimi'} />
            {dialog.kind === 'correct' && <textarea rows={2} className={inputCls} value={dialogEn} onChange={(e) => setDialogEn(e.target.value)} placeholder={dt('Correction (English)')} />}
            <div className="flex justify-end gap-2"><button type="button" className={btnGhost} onClick={() => setDialog(null)}>Anulo</button><button type="button" className={btnPrimary} disabled={busy} onClick={submitDialog}>Konfirmo</button></div>
          </div>
        </div>
      )}
    </section>
  );
}

/* ── Sub-editors ──────────────────────────────────────────────────────────── */

function SourcePicker({ sources, value, onChange }: { sources: HeritageSource[]; value: string[]; onChange: (ids: string[]) => void }) {
  const [q, setQ] = useState('');
  const matches = q.trim()
    ? sources.filter((s) => !value.includes(s.id) && `${s.title} ${s.publisher} ${s.id}`.toLowerCase().includes(q.toLowerCase())).slice(0, 8)
    : [];
  return (
    <div className="space-y-2">
      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Burimet e shënimit ({value.length})</span>
      <div className="flex flex-wrap gap-1.5">
        {value.map((id) => {
          const s = sources.find((x) => x.id === id);
          return (
            <span key={id} className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold', s ? 'border-slate-300 dark:border-slate-700' : 'border-rose-300 bg-rose-50 text-rose-800')}>
              <Link2 className="h-3 w-3" aria-hidden="true" />{s ? s.publisher.slice(0, 28) + ' — ' + s.title.slice(0, 36) : `${id} (mungon)`}
              <button type="button" aria-label={`Hiq ${id}`} onClick={() => onChange(value.filter((x) => x !== id))}><X className="h-3 w-3" /></button>
            </span>
          );
        })}
      </div>
      <input className={inputCls} value={q} onChange={(e) => setQ(e.target.value)} placeholder={dt('Kërko burim për ta shtuar…')} aria-label={dt('Kërko burim')} />
      {matches.length > 0 && (
        <ul className="rounded-lg border border-slate-200 bg-white text-sm shadow-sm dark:border-slate-700 dark:bg-slate-900">
          {matches.map((s) => (
            <li key={s.id}><button type="button" className="w-full px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800" onClick={() => { onChange([...value, s.id]); setQ(''); }}>
              <span className="font-bold">{s.title}</span> <span className="text-xs text-slate-500">· {s.publisher}</span>
            </button></li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ClaimsEditor({ claims, sources, onChange }: { claims: Claim[]; sources: HeritageSource[]; onChange: (c: Claim[]) => void }) {
  const update = (i: number, patch: Partial<Claim>) => onChange(claims.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Pohimet sasiore / të varura nga koha ({claims.length})</span>
        <button type="button" className={btnGhost} onClick={() => onChange([...claims, { id: `c${claims.length + 1}`, text: { sq: '', en: '' }, evidence: 'estimate', asOf: '', sourceIds: [] }])}><Plus className="h-4 w-4" />Shto pohim</button>
      </div>
      {claims.map((c, i) => (
        <div key={c.id + i} className="grid gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-2 dark:border-slate-700">
          <input className={inputCls} placeholder={dt('Pohimi (shqip) p.sh. 13.535 persona…')} value={c.text.sq} onChange={(e) => update(i, { text: { ...c.text, sq: e.target.value } })} />
          <input className={inputCls} placeholder={dt('Claim (English)')} value={c.text.en} onChange={(e) => update(i, { text: { ...c.text, en: e.target.value } })} />
          <select className={inputCls} value={c.evidence} onChange={(e) => update(i, { evidence: e.target.value as Claim['evidence'] })}>{EVIDENCE_STATUSES.map((s) => <option key={s} value={s}>{EVIDENCE[s].label.sq}</option>)}</select>
          <input className={inputCls} placeholder={dt('Gjendja më (YYYY-MM-DD)')} value={c.asOf} onChange={(e) => update(i, { asOf: e.target.value })} />
          <select multiple className={cn(inputCls, 'h-24 sm:col-span-2')} aria-label={dt('Burimet e pohimit')} value={c.sourceIds} onChange={(e) => update(i, { sourceIds: Array.from(e.target.selectedOptions, (o) => o.value) })}>
            {sources.map((s) => <option key={s.id} value={s.id}>{s.publisher} — {s.title}</option>)}
          </select>
          <input className={cn(inputCls, 'sm:col-span-2')} placeholder={dt('Kujdes / kufizim (metodologji, pse nuk është përfundimtare)')} value={c.caveat?.sq ?? ''} onChange={(e) => update(i, { caveat: { sq: e.target.value, en: c.caveat?.en ?? '' } })} />
          <button type="button" className={cn(btnGhost, 'sm:col-span-2 justify-self-end')} onClick={() => onChange(claims.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" />Hiq</button>
        </div>
      ))}
    </div>
  );
}

function MediaEditor({ media, onChange, sensitive }: { media: MediaRef[]; onChange: (m: MediaRef[]) => void; sensitive: string }) {
  const update = (i: number, patch: Partial<MediaRef>) => onChange(media.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Foto, video, dokumente ({media.length})</span>
        <button type="button" className={btnGhost} disabled={sensitive === 'sexual-violence'} onClick={() => onChange([...media, { id: `m${media.length + 1}`, kind: 'image', url: '', alt: { sq: '', en: '' }, caption: { sq: '', en: '' }, credit: '', rights: 'unknown', rightsRef: '', privacyCleared: false }])}><Plus className="h-4 w-4" />Shto media</button>
      </div>
      {sensitive === 'sexual-violence' && <p className="text-xs text-rose-700">Dhunë seksuale: media me persona nuk lejohet.</p>}
      {media.map((m, i) => (
        <div key={m.id + i} className="grid gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-2 dark:border-slate-700">
          <input className={inputCls} placeholder="https://… (lidhja e skedarit)" value={m.url} onChange={(e) => update(i, { url: e.target.value })} />
          <select className={inputCls} value={m.kind} onChange={(e) => update(i, { kind: e.target.value as MediaRef['kind'] })}><option value="image">Foto</option><option value="video">Video</option><option value="document">Dokument</option><option value="map">Hartë</option></select>
          <input className={inputCls} placeholder={dt('Tekst alternativ (shqip) — i detyrueshëm')} value={m.alt.sq} onChange={(e) => update(i, { alt: { ...m.alt, sq: e.target.value } })} />
          <input className={inputCls} placeholder={dt('Alt text (English)')} value={m.alt.en} onChange={(e) => update(i, { alt: { ...m.alt, en: e.target.value } })} />
          <input className={inputCls} placeholder={dt('Titulli / përshkrimi (shqip)')} value={m.caption.sq} onChange={(e) => update(i, { caption: { ...m.caption, sq: e.target.value } })} />
          <input className={inputCls} placeholder={dt('Caption (English)')} value={m.caption.en} onChange={(e) => update(i, { caption: { ...m.caption, en: e.target.value } })} />
          <input className={inputCls} placeholder={dt('Kredia (autori / arkivi)')} value={m.credit} onChange={(e) => update(i, { credit: e.target.value })} />
          <select className={inputCls} value={m.rights} onChange={(e) => update(i, { rights: e.target.value as MediaRef['rights'] })}>
            {RIGHTS.map((r) => <option key={r} value={r}>{{ 'public-domain': 'Domen publik', cc: 'Creative Commons', licensed: 'Licencë e blerë', permission: 'Leje e shkruar', unknown: 'E panjohur (bllokon publikimin)' }[r]}</option>)}
          </select>
          <input className={cn(inputCls, 'sm:col-span-2')} placeholder={dt('Referenca e licencës ose e lejes')} value={m.rightsRef} onChange={(e) => update(i, { rightsRef: e.target.value })} />
          <label className="inline-flex items-center gap-2 text-xs"><input type="checkbox" checked={m.privacyCleared} onChange={(e) => update(i, { privacyCleared: e.target.checked })} />Privatësia e konfirmuar (persona të paraqitur)</label>
          <button type="button" className={cn(btnGhost, 'justify-self-end')} onClick={() => onChange(media.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" />Hiq</button>
        </div>
      ))}
    </div>
  );
}

/* ── Sources ──────────────────────────────────────────────────────────────── */

function SourcesPanel({ state, onReload }: { state: AdminHeritageState; onReload: () => Promise<void> }) {
  const [q, setQ] = useState('');
  const [only, setOnly] = useState<'all' | 'unchecked'>('all');
  const [edit, setEdit] = useState<Partial<HeritageSource> | null>(null);
  const [busy, setBusy] = useState(false);
  const list = state.sources.filter((s) => (only === 'all' || !s.linkChecked) && `${s.title} ${s.publisher} ${s.id}`.toLowerCase().includes(q.toLowerCase()));

  const save = async () => {
    if (!edit?.id) return;
    setBusy(true);
    try { await heritageAdmin.saveSource(edit as HeritageSource); toast.success(dt('Burimi u ruajt.')); setEdit(null); await onReload(); }
    catch (e) { toast.error((e as Error).message + (e instanceof HeritageApiError && e.fields ? ' ' + Object.values(e.fields).join(' ') : '')); }
    finally { setBusy(false); }
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input className={cn(inputCls, 'min-w-[200px] flex-1')} value={q} onChange={(e) => setQ(e.target.value)} placeholder={dt('Kërko burim')} aria-label={dt('Kërko burim')} />
        <select className={cn(inputCls, 'w-auto')} value={only} onChange={(e) => setOnly(e.target.value as 'all' | 'unchecked')} aria-label={dt('Filtri')}>
          <option value="all">Të gjitha ({state.sources.length})</option><option value="unchecked">Lidhja e pakontrolluar ({state.sources.filter((s) => !s.linkChecked).length})</option>
        </select>
        {state.me.canEdit && <button type="button" className={btnPrimary} onClick={() => setEdit({ id: '', type: 'other', title: '', publisher: '', linkChecked: false })}><Plus className="h-4 w-4" />Burim i ri</button>}
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {list.map((s) => (
            <li key={s.id}>
              <button type="button" className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60" onClick={() => setEdit(s)}>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">{s.title}</p>
                  <p className="text-[11px] text-slate-500">{s.publisher} · {SOURCE_TYPE_LABELS[s.type].sq}{s.date ? ` · ${s.date}` : ''}{s.reference ? ` · ${s.reference}` : ''}</p>
                </div>
                <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-black', s.linkChecked ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800')}>
                  {s.linkChecked ? `Lidhja u kontrollua ${s.linkCheckedAt ?? ''}` : s.url ? 'Lidhja e pakontrolluar' : 'Pa lidhje'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {edit && (
        <div role="dialog" aria-modal="true" aria-label={dt('Burimi')} className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 sm:items-center" onClick={() => setEdit(null)}>
          <div className="max-h-[90vh] w-full max-w-xl space-y-3 overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-black">{state.sources.some((s) => s.id === edit.id) ? 'Burimi' : 'Burim i ri'}</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="ID"><input className={inputCls} value={edit.id ?? ''} disabled={state.sources.some((s) => s.id === edit.id)} onChange={(e) => setEdit({ ...edit, id: slugify(e.target.value) })} /></Field>
              <Field label="Lloji"><select className={inputCls} value={edit.type} onChange={(e) => setEdit({ ...edit, type: e.target.value as HeritageSource['type'] })}>{SOURCE_TYPES.map((t) => <option key={t} value={t}>{SOURCE_TYPE_LABELS[t].sq}</option>)}</select></Field>
              <Field label="Titulli" className="sm:col-span-2"><input className={inputCls} value={edit.title ?? ''} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></Field>
              <Field label="Botuesi / institucioni"><input className={inputCls} value={edit.publisher ?? ''} onChange={(e) => setEdit({ ...edit, publisher: e.target.value })} /></Field>
              <Field label="Data e dokumentit"><input className={inputCls} value={edit.date ?? ''} onChange={(e) => setEdit({ ...edit, date: e.target.value })} placeholder={dt('YYYY-MM-DD')} /></Field>
              <Field label="Lidhja (https://)" className="sm:col-span-2"><input className={inputCls} value={edit.url ?? ''} onChange={(e) => setEdit({ ...edit, url: e.target.value })} /></Field>
              <Field label="Referenca (simbol, nr. çështjeje, arkiv)" className="sm:col-span-2"><input className={inputCls} value={edit.reference ?? ''} onChange={(e) => setEdit({ ...edit, reference: e.target.value })} /></Field>
              <Field label="Shënim" className="sm:col-span-2"><textarea rows={2} className={inputCls} value={edit.note ?? ''} onChange={(e) => setEdit({ ...edit, note: e.target.value })} /></Field>
              <label className="inline-flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={!!edit.linkChecked} onChange={(e) => setEdit({ ...edit, linkChecked: e.target.checked })} />E hapa lidhjen dhe konfirmoj që çon te ky dokument <span className="text-xs text-slate-500">(data vendoset nga serveri)</span></label>
            </div>
            <div className="flex flex-wrap justify-between gap-2">
              {state.me.canPublish && state.sources.some((s) => s.id === edit.id && s.origin === 'cms') ? (
                <button type="button" className={btnDanger} disabled={busy} onClick={async () => { try { await heritageAdmin.deleteSource(edit.id!); toast.success(dt('U fshi.')); setEdit(null); await onReload(); } catch (e) { toast.error((e as Error).message); } }}><Trash2 className="h-4 w-4" />Fshi</button>
              ) : <span />}
              <div className="flex gap-2"><button type="button" className={btnGhost} onClick={() => setEdit(null)}>Anulo</button>{state.me.canEdit && <button type="button" className={btnPrimary} disabled={busy} onClick={() => void save()}><Save className="h-4 w-4" />Ruaj</button>}</div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/* ── Log & settings ───────────────────────────────────────────────────────── */

function LogPanel({ state }: { state: AdminHeritageState }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <p className="border-b border-slate-100 px-4 py-3 text-xs text-slate-500 dark:border-slate-800">Regjistër vetëm-shtues: 100 veprimet e fundit. Çdo rresht është shkruar nga serveri me identitetin nga tokeni.</p>
      <ul className="divide-y divide-slate-100 text-xs dark:divide-slate-800">
        {state.log.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
            <span className="text-slate-400">{row.at.replace('T', ' ').slice(0, 16)}</span>
            <span className="font-black">{row.action}</span>
            <code className="rounded bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800">{row.entryId}</code>
            <span className="text-slate-500">v{row.version} · {row.status}</span>
            <span className="text-slate-500">{row.actorEmail} ({row.actorRole})</span>
            {row.reason && <span className="w-full text-slate-600 dark:text-slate-300">“{row.reason}”</span>}
          </li>
        ))}
        {state.log.length === 0 && <li className="px-4 py-8 text-center text-slate-500">Asnjë veprim ende.</li>}
      </ul>
    </section>
  );
}

function SettingsPanel({ state, onReload }: { state: AdminHeritageState; onReload: () => Promise<void> }) {
  const [s, setS] = useState({ heroImageUrl: state.settings.heroImageUrl ?? '', heroCredit: state.settings.heroCredit ?? '', heroRights: state.settings.heroRights ?? 'unknown', emblemUrl: state.settings.emblemUrl ?? '', featuredIds: (state.settings.featuredIds ?? []).join(', ') });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await heritageAdmin.saveSettings({ ...s, heroRights: s.heroRights as 'unknown', featuredIds: s.featuredIds.split(',').map((x) => x.trim()).filter(Boolean) });
      toast.success(dt('U ruajt.')); await onReload();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs text-slate-500">Foto e kreut dhe stema zyrtare vendosen vetëm nga burime të licencuara/zyrtare. Pa foto, faqja përdor ilustrimin e brendshëm.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Foto e kreut (https://)"><input className={inputCls} value={s.heroImageUrl} onChange={(e) => setS({ ...s, heroImageUrl: e.target.value })} disabled={!state.me.canPublish} /></Field>
        <Field label="Kredia e fotos"><input className={inputCls} value={s.heroCredit} onChange={(e) => setS({ ...s, heroCredit: e.target.value })} disabled={!state.me.canPublish} /></Field>
        <Field label="E drejta e përdorimit"><select className={inputCls} value={s.heroRights} onChange={(e) => setS({ ...s, heroRights: e.target.value as 'unknown' })} disabled={!state.me.canPublish}>{RIGHTS.map((r) => <option key={r} value={r}>{r}</option>)}</select></Field>
        <Field label="Stema zyrtare (https://, nga burim zyrtar)"><input className={inputCls} value={s.emblemUrl} onChange={(e) => setS({ ...s, emblemUrl: e.target.value })} disabled={!state.me.canPublish} /></Field>
        <Field label="ID-të e shënimeve në pah (me presje)" className="sm:col-span-2"><input className={inputCls} value={s.featuredIds} onChange={(e) => setS({ ...s, featuredIds: e.target.value })} disabled={!state.me.canPublish} /></Field>
      </div>
      {state.me.canPublish ? <button type="button" className={btnPrimary} disabled={busy} onClick={() => void save()}><Save className="h-4 w-4" />Ruaj</button> : <p className="text-xs text-amber-700">Vetëm administratori i ndryshon cilësimet.</p>}
    </section>
  );
}
