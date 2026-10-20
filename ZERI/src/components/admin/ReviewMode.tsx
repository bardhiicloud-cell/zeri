import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Crop, HelpCircle, ImageOff, Loader2, MapPin, Send, StickyNote, Trash2, Undo2, X, XCircle } from 'lucide-react';
import { dt } from '@/src/lib/dt';
import { cn } from '../../lib/utils';
import type { Report } from '../../types';
import { statusMeta, TONE_CLASSES } from '../../lib/reportStatus';
import { advanceAfterAction, clampPhotoIndex, reviewProgress, stepIndex } from '../../lib/reviewQueue';
import { removeReportPhoto, restoreReportPhoto, uncropReportPhoto } from '../../lib/reportMediaApi';
import PhotoCropper from './PhotoCropper';
import CaseThreadPanel from './CaseThreadPanel';
import HandoverHistoryPanel from './HandoverHistoryPanel';
import { loadTeamOverview } from '../../lib/teamOverviewApi';
import { addNote, escalateReport, loadCase, requestInfo, resolveEscalation, type CaseThread } from '../../lib/reportCaseApi';
import { assignReport, releaseReport, type Holder } from '../../lib/reportAssignmentApi';
import { useStore } from '../../lib/store';
import { useStaffDirectory } from '../../lib/useCitizenDirectory';
import ReviewRouting from './ReviewRouting';
import { routeReport } from '../../lib/routingExport';
import { contactRefFor, ensureContact } from '../../lib/routingContacts';
import { sendReportEmail } from '../../lib/institutionMailApi';
import type { ClassifyChange } from '../../lib/reportClassifyApi';
import { contactLine, useReportContact } from '../../lib/useReportContact';
import { askConfirm, askReason } from '../../lib/dialogs';

/**
 * Review Mode: open a record, check it, act, and move to the next one.
 *
 * The list is the place to find work; this is the place to do it. Nothing here
 * is new authority: approve, reject, delete and photo changes call the same
 * server-checked actions as everywhere else, and a refusal is shown, not hidden.
 *
 *   ← →   previous / next        A  approve        R  reject (asks why)
 *   X     take this photo down (asks why)          Esc  close
 */

export interface ReviewModeProps {
  /** The records to go through, in order. Fixed for the session. */
  queue: readonly Report[];
  startId?: string;
  /** Looks up the freshest copy of a record (the list may have refreshed). */
  getReport: (id: string) => Report | undefined;
  canApprove: boolean;
  canReject: boolean;
  canDelete: boolean;
  /** Take photos down and put them back (administrators and agents). */
  canEditPhotos: boolean;
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string, reason: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  /** Open the full record (timeline, comments, routing) without leaving the queue behind. */
  onOpenFull: (id: string) => void;
  onClose: () => void;
}

type Ask = { kind: 'reject' | 'photo' | 'info' | 'note' | 'escalate' | 'handover'; text: string; assignUid?: string } | null;

const when = (iso?: string) => {
  if (!iso) return '—';
  const time = Date.parse(iso);
  return Number.isFinite(time) ? new Date(time).toLocaleString('sq', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
};

export default function ReviewMode({
  queue, startId, getReport, canApprove, canReject, canDelete, canEditPhotos, onApprove, onReject, onDelete, onOpenFull, onClose,
}: ReviewModeProps) {
  const ids = useMemo(() => queue.map(report => report.id), [queue]);
  const [index, setIndex] = useState(() => Math.max(0, startId ? ids.indexOf(startId) : 0));
  const [handled, setHandled] = useState<ReadonlySet<string>>(new Set());
  const [outcomes, setOutcomes] = useState<Record<string, string>>({});
  const [photoIndex, setPhotoIndex] = useState(0);
  /** Photo lists as the server returned them after a change, per record. */
  const [photos, setPhotos] = useState<Record<string, string[]>>({});
  const [lastTakenDown, setLastTakenDown] = useState<{ reportId: string; url: string } | null>(null);
  const [ask, setAsk] = useState<Ask>(null);
  const [busy, setBusy] = useState(false);
  const [zoom, setZoom] = useState(false);
  /** The photo being cropped, if the cropper is open. */
  const [cropping, setCropping] = useState<string | null>(null);
  /** The conversation around the current record (questions to the citizen, answers, internal notes). */
  const [thread, setThread] = useState<CaseThread | null>(null);
  /** Photos known to be cropped versions (from the record, or cropped in this session). */
  const [croppedNow, setCroppedNow] = useState<string[]>([]);
  const askRef = useRef<HTMLTextAreaElement>(null);
  const me = useStore(state => state.currentUser);
  const isOwner = me?.role === 'admin' || me?.role === 'superadmin';
  const isDispatcher = me?.role === 'dispatcher';
  /** Who may hand a report to someone else; the server decides again. */
  const canAssign = isOwner || isDispatcher;
  /** Who holds each record, as the server last told us (overrides the list copy). */
  const [holders, setHolders] = useState<Record<string, Holder>>({});
  const [assignTo, setAssignTo] = useState('');
  const { staff } = useStaffDirectory();
  // A dispatcher cannot read the user directory; the server's team view lists the agents they may hand work to.
  const [teamAgents, setTeamAgents] = useState<Array<{ id: string; name: string; email: string; role: string }>>([]);
  useEffect(() => {
    if (!isDispatcher) return;
    let alive = true;
    loadTeamOverview().then(overview => {
      if (alive) setTeamAgents(overview.agents.map(agent => ({ id: agent.uid, name: agent.name, email: agent.email, role: agent.role })));
    }).catch(() => { if (alive) setTeamAgents([]); });
    return () => { alive = false; };
  }, [isDispatcher]);
  const agents = useMemo(
    () => (isDispatcher ? teamAgents : staff).filter(person => ['agent', 'responder', 'dispatcher', 'moderator', 'approver'].includes(String(person.role))),
    [staff, teamAgents, isDispatcher]
  );

  /** Classification saved during this review, shown at once instead of after the list reloads. */
  const [classified, setClassified] = useState<Record<string, ClassifyChange>>({});
  const baseCurrent = ids[index] ? getReport(ids[index]) ?? queue[index] : undefined;
  const current = useMemo(() => {
    if (!baseCurrent) return undefined;
    const saved = classified[baseCurrent.id];
    if (!saved) return baseCurrent;
    return {
      ...baseCurrent,
      ...(saved.topicCategory ? { topicCategory: saved.topicCategory } : {}),
      ...(saved.zone ? { zone: saved.zone } : {}),
      ...(saved.municipality ? { location: { ...baseCurrent.location, municipality: saved.municipality } } : {}),
    } as Report;
  }, [baseCurrent, classified]);
  const contact = useReportContact(current?.id);
  const routed = useMemo(() => (current ? routeReport(current) : null), [current]);
  const images = current ? photos[current.id] ?? current.images ?? [] : [];
  const progress = reviewProgress(ids, handled);
  const finished = progress.remaining === 0 && ids.length > 0;
  const summary = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const outcome of Object.values(outcomes)) counts[outcome] = (counts[outcome] ?? 0) + 1;
    return Object.entries(counts).map(([name, count]) => `${name}: ${count}`).join(' · ');
  }, [outcomes]);

  useEffect(() => { setPhotoIndex(0); setZoom(false); setAsk(null); }, [index]);
  const reloadThread = useCallback(async (id?: string) => {
    const target = id ?? current?.id;
    if (!target || !canEditPhotos) { setThread(null); return; }
    try { setThread(await loadCase(target)); } catch { setThread(null); }
  }, [current?.id, canEditPhotos]);
  useEffect(() => { void reloadThread(); }, [reloadThread]);
  useEffect(() => { if (ask) askRef.current?.focus(); }, [ask]);
  useEffect(() => { setPhotoIndex(i => clampPhotoIndex(i, images.length)); }, [images.length]);

  const go = useCallback((direction: 1 | -1) => {
    const next = stepIndex(ids, handled, index, direction, direction === 1);
    if (next !== null) setIndex(next);
  }, [ids, handled, index]);

  const finishRecord = useCallback((id: string, outcome: string) => {
    const nextHandled = new Set(handled).add(id);
    setHandled(nextHandled);
    setOutcomes(previous => ({ ...previous, [id]: outcome }));
    const next = advanceAfterAction(ids, nextHandled, index);
    if (next !== null) setIndex(next);
  }, [handled, ids, index]);

  const run = useCallback(async (work: () => Promise<void>, id: string, outcome: string) => {
    setBusy(true);
    try {
      await work();
      finishRecord(id, outcome);
    } catch (error) {
      toast.error((error as Error)?.message || dt('Veprimi nuk u krye.'));
    } finally {
      setBusy(false);
    }
  }, [finishRecord]);

  const approve = () => { if (current && canApprove && !busy) void run(() => onApprove(current.id), current.id, dt('Aprovuar')); };
  /** Approve, then hand the report to the body that answers it, in one step. */
  const approveAndSend = () => {
    if (!current || !routed || !canApprove || busy) return;
    const recipient = routed.resolution.primary;
    void run(async () => {
      await onApprove(current.id);
      await ensureContact(recipient, routed.municipality);
      try {
        await sendReportEmail(current.id, contactRefFor(recipient, routed.municipality).id, '');
        toast.success(`${dt('U dërgua te')} ${recipient.name}.`);
      } catch (error) {
        toast.error(`${dt('Aprovuar, por emaili nuk u dërgua')}: ${(error as Error)?.message ?? ''}`);
      }
    }, current.id, dt('Aprovuar dhe dërguar'));
  };
  const reject = (reason: string) => { if (current) void run(() => onReject(current.id, reason), current.id, dt('Refuzuar')).then(() => setAsk(null)); };
  const remove = async () => {
    if (!current || !canDelete || busy) return;
    if (await askConfirm(`${dt('Të fshihet përgjithmonë raporti')} "${current.title}"? ${dt('Ky veprim nuk mund të zhbëhet.')}`)) {
      void run(() => onDelete(current.id), current.id, dt('Fshirë'));
    }
  };

  const takeDownPhoto = async (reason: string) => {
    if (!current) return;
    const url = images[photoIndex];
    if (!url) return;
    setBusy(true);
    try {
      const result = await removeReportPhoto(current.id, url, reason);
      setPhotos(previous => ({ ...previous, [current.id]: result.images }));
      setLastTakenDown({ reportId: current.id, url });
      setAsk(null);
      toast.success(dt('Fotoja u hoq nga raportimi. Mund ta zhbëni.'));
    } catch (error) {
      toast.error((error as Error)?.message || dt('Fotoja nuk u hoq.'));
    } finally {
      setBusy(false);
    }
  };

  const undoTakeDown = async () => {
    if (!lastTakenDown) return;
    setBusy(true);
    try {
      const result = await restoreReportPhoto(lastTakenDown.reportId, lastTakenDown.url);
      setPhotos(previous => ({ ...previous, [lastTakenDown.reportId]: result.images }));
      setLastTakenDown(null);
      toast.success(dt('Fotoja u rikthye.'));
    } catch (error) {
      toast.error((error as Error)?.message || dt('Fotoja nuk u rikthye.'));
    } finally {
      setBusy(false);
    }
  };

  const holderOf = (report: Report): Holder => holders[report.id] ?? { assignedToUid: report.assignedToUid ?? '', assignedTo: report.assignedTo ?? '' };

  const changeHolder = async (work: () => Promise<Holder | void>, fallback: Holder, done: string) => {
    if (!current) return;
    setBusy(true);
    try {
      const result = await work();
      setHolders(previous => ({ ...previous, [current.id]: (result as Holder | undefined) ?? fallback }));
      toast.success(done);
    } catch (error) {
      toast.error((error as Error)?.message || dt('Caktimi nuk u ruajt.'));
    } finally {
      setBusy(false);
    }
  };

  const isCropped = (url: string) =>
    croppedNow.includes(url) || Boolean(current?.media?.some(item => item.url === url && (item as { editedAt?: string }).editedAt));

  const undoCrop = async (url: string) => {
    if (!current) return;
    setBusy(true);
    try {
      const result = await uncropReportPhoto(current.id, url);
      setPhotos(previous => ({ ...previous, [current.id]: result.images }));
      setCroppedNow(list => list.filter(u => u !== url));
      toast.success(dt('U rikthye fotoja origjinale.'));
    } catch (error) {
      toast.error((error as Error)?.message || dt('Origjinali nuk u rikthye.'));
    } finally {
      setBusy(false);
    }
  };

  /** Ask the citizen, leave a note, or escalate: the three things that are not a decision. */
  const sendCase = async (kind: 'info' | 'note' | 'escalate', text: string) => {
    if (!current) return;
    setBusy(true);
    try {
      if (kind === 'info') await requestInfo(current.id, text);
      else if (kind === 'note') await addNote(current.id, text);
      else await escalateReport(current.id, text);
      toast.success(kind === 'info' ? dt('Pyetja iu dërgua qytetarit.') : kind === 'note' ? dt('Shënimi u ruajt.') : dt('Raportimi u eskalua te administratori.'));
      setAsk(null);
      await reloadThread();
    } catch (error) {
      toast.error((error as Error)?.message || dt('Veprimi nuk u krye.'));
    } finally {
      setBusy(false);
    }
  };

  const closeEscalation = async () => {
    if (!current) return;
    const reason = await askReason(dt('Shënim për mbylljen e eskalimit:'));
    if (!reason) return;
    setBusy(true);
    try {
      await resolveEscalation(current.id, reason);
      toast.success(dt('Eskalimi u mbyll.'));
      await reloadThread();
    } catch (error) {
      toast.error((error as Error)?.message || dt('Eskalimi nuk u mbyll.'));
    } finally {
      setBusy(false);
    }
  };

  const submitAsk = () => {
    if (!ask) return;
    const reason = ask.text.trim();
    if (reason.length < 5) { toast.error(dt('Shkruani një arsye (të paktën 5 shkronja).')); return; }
    if (ask.kind === 'reject') reject(reason);
    else if (ask.kind === 'photo') void takeDownPhoto(reason);
    else if (ask.kind === 'handover') {
      if (!current) return;
      const held = holderOf(current).assignedToUid;
      const assignUid = ask.assignUid;
      void (assignUid
        ? changeHolder(() => assignReport(current.id, assignUid, { reason, expectedHolderUid: held }), { assignedToUid: assignUid, assignedTo: '' }, dt('Raportimi iu caktua.')).then(() => setAssignTo(''))
        : changeHolder(() => releaseReport(current.id, { reason, expectedHolderUid: held }), { assignedToUid: '', assignedTo: '' }, dt('U kthye në radhën e përbashkët.'))
      ).then(() => setAsk(null));
    }
    else void sendCase(ask.kind, reason);
  };

  // Keyboard: never while typing a reason.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (cropping) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT')) {
        if (event.key === 'Escape') setAsk(null);
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      switch (event.key) {
        case 'ArrowRight': go(1); break;
        case 'ArrowLeft': go(-1); break;
        case 'Escape': if (ask) setAsk(null); else onClose(); break;
        case 'a': case 'A': approve(); break;
        case 'r': case 'R': if (canReject && current) { event.preventDefault(); setAsk({ kind: 'reject', text: '' }); } break;
        case 'x': case 'X': if (canEditPhotos && images[photoIndex]) { event.preventDefault(); setAsk({ kind: 'photo', text: '' }); } break;
        default: return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const meta = current ? statusMeta(current.status) : null;
  const photo = images[photoIndex];

  return (
    <div className="fixed inset-0 z-[560] flex flex-col bg-slate-950/90 md:backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={dt('Modaliteti i rishikimit')}>
      {/* Top bar: where you are */}
      <div className="flex shrink-0 items-center gap-3 border-b border-white/10 px-4 py-3 text-white">
        <span className="text-sm font-bold">{dt('Rishikim')}</span>
        <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-bold tabular-nums">
          {Math.min(index + 1, ids.length)} / {ids.length}
        </span>
        <div className="mx-2 hidden h-1.5 flex-1 overflow-hidden rounded-full bg-white/10 sm:block" aria-hidden="true">
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${progress.percent}%` }} />
        </div>
        <span className="ml-auto text-xs text-slate-300 sm:ml-0">{progress.handled} {dt('të kryera')} · {progress.remaining} {dt('mbeten')}</span>
        <button type="button" onClick={onClose} aria-label={dt('Mbyll rishikimin')} className="rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white">
          <X className="h-5 w-5" />
        </button>
      </div>

      {ids.length === 0 || finished || !current ? (
        <div className="grid flex-1 place-items-center p-6 text-center text-white">
          <div>
            <Check className="mx-auto h-12 w-12 text-emerald-400" aria-hidden="true" />
            <p className="mt-3 text-lg font-bold">{ids.length === 0 ? dt('Nuk ka çfarë të rishikohet.') : dt('Rradha u krye.')}</p>
            {ids.length > 0 && (
              <p className="mt-1 text-sm text-slate-300">{summary}</p>
            )}
            <button type="button" onClick={onClose} className="mt-5 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-slate-900 hover:bg-slate-100">{dt('Mbyll')}</button>
          </div>
        </div>
      ) : (
        <>
          <div className="grid min-h-0 flex-1 gap-0 overflow-hidden lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            {/* The photo */}
            <div className="flex min-h-0 flex-col bg-black/40">
              <div className={cn('relative grid min-h-0 flex-1 place-items-center', zoom ? 'overflow-auto' : 'overflow-hidden')}>
                {photo ? (
                  <img
                    src={photo}
                    alt={`${current.title} — ${photoIndex + 1}/${images.length}`}
                    onClick={() => setZoom(value => !value)}
                    className={cn('select-none', zoom ? 'max-w-none cursor-zoom-out' : 'max-h-full max-w-full cursor-zoom-in object-contain')}
                    draggable={false}
                  />
                ) : (
                  <div className="text-center text-slate-400">
                    <ImageOff className="mx-auto h-10 w-10" aria-hidden="true" />
                    <p className="mt-2 text-sm">{dt('Ky raportim nuk ka foto.')}</p>
                  </div>
                )}
                {images.length > 1 && (
                  <>
                    <button type="button" aria-label={dt('Foto e mëparshme')} onClick={() => setPhotoIndex(i => clampPhotoIndex(i - 1, images.length))} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"><ChevronLeft className="h-5 w-5" /></button>
                    <button type="button" aria-label={dt('Foto tjetër')} onClick={() => setPhotoIndex(i => clampPhotoIndex(i + 1, images.length))} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"><ChevronRight className="h-5 w-5" /></button>
                  </>
                )}
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-white/10 p-3">
                <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto">
                  {images.map((url, i) => (
                    <button key={url} type="button" onClick={() => setPhotoIndex(i)} aria-label={`${dt('Foto')} ${i + 1}`} className={cn('h-12 w-12 shrink-0 overflow-hidden rounded-lg border-2', i === photoIndex ? 'border-rose-500' : 'border-transparent opacity-70 hover:opacity-100')}>
                      <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
                    </button>
                  ))}
                </div>
                {canEditPhotos && photo && isCropped(photo) && (
                  <button type="button" disabled={busy} onClick={() => void undoCrop(photo)} className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/20 disabled:opacity-40">
                    <Undo2 className="h-3.5 w-3.5" aria-hidden="true" /> {dt('Rikthe origjinalin')}
                  </button>
                )}
                {canEditPhotos && photo && (
                  <button type="button" disabled={busy} onClick={() => setCropping(photo)} className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/20 disabled:opacity-40">
                    <Crop className="h-3.5 w-3.5" aria-hidden="true" /> {dt('Prit')}
                  </button>
                )}
                {canEditPhotos && photo && (
                  <button type="button" disabled={busy} onClick={() => setAsk({ kind: 'photo', text: '' })} className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-xs font-bold text-white hover:bg-rose-500 disabled:opacity-40">
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> {dt('Hiq foton')} <kbd className="rounded bg-white/20 px-1 text-[11px]">X</kbd>
                  </button>
                )}
                {lastTakenDown && (
                  <button type="button" disabled={busy} onClick={() => void undoTakeDown()} className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/20 disabled:opacity-40">
                    <Undo2 className="h-3.5 w-3.5" aria-hidden="true" /> {dt('Zhbëj heqjen')}
                  </button>
                )}
              </div>
            </div>

            {/* The record */}
            <div className="min-h-0 overflow-y-auto bg-white p-5 dark:bg-slate-900">
              <div className="flex flex-wrap items-center gap-2">
                {meta && <span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-bold', TONE_CLASSES[meta.tone])}>{dt(meta.label)}</span>}
                {current.trackingId && <span className="font-mono text-xs text-slate-500">#{current.trackingId}</span>}
                {outcomes[current.id] && <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">{outcomes[current.id]}</span>}
              </div>
              <h2 className="mt-2 text-xl font-bold text-slate-900 dark:text-white">{current.title}</h2>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-300">{current.description}</p>

              <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <Fact label={dt('Kategoria')} value={current.category} />
                <Fact label={dt('Urgjenca')} value={String(current.urgency)} />
                <Fact label={dt('Komuna')} value={current.location?.municipality} />
                <Fact label={dt('Dërguar')} value={when(current.createdAt)} />
                <Fact label={dt('Raportuesi')} value={current.isAnonymous ? dt('Anonim') : contactLine(contact, current.authorName)} />
                <Fact label={dt('Institucioni')} value={current.responsibleInstitution} />
              </dl>
              {current.location?.address && (
                <p className="mt-4 flex items-start gap-1.5 text-sm text-slate-600 dark:text-slate-300">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" /> {current.location.address}
                </p>
              )}
              <ReviewRouting report={current} canClassify={canEditPhotos} onClassified={(id, change) => setClassified(previous => ({ ...previous, [id]: { ...previous[id], ...change } }))} />
              {['Draft', 'Pending Review'].includes(current.status) && (() => {
                const holder = holderOf(current);
                const mine = holder.assignedToUid && holder.assignedToUid === me?.id;
                return (
                  <div className="mt-5 rounded-xl border border-slate-200 p-3 dark:border-white/10">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{dt('Shqyrtuesi i caktuar')}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {holder.assignedTo ? (mine ? `${holder.assignedTo} (${dt('ju')})` : holder.assignedTo) : dt('Pa shqyrtues — pret caktimin nga sistemi ose menaxheri')}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {/* No self-claim: the system or a manager assigns the reviewer (Detyrat). */}
                      {holder.assignedToUid && (mine || canAssign) && (
                        <button type="button" disabled={busy} onClick={() => (mine ? void changeHolder(() => releaseReport(current.id, { expectedHolderUid: holder.assignedToUid }), { assignedToUid: '', assignedTo: '' }, dt('U kthye në radhën e përbashkët.')) : setAsk({ kind: 'handover', text: '' }))} className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-white/10 dark:text-slate-200">
                          {dt('Lësho')}
                        </button>
                      )}
                      {canAssign && agents.length > 0 && (
                        <>
                          <select value={assignTo} onChange={event => setAssignTo(event.target.value)} aria-label={dt('Cakto te agjenti')} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] dark:border-white/10 dark:bg-slate-800 dark:text-slate-100">
                            <option value="">{dt('Cakto te…')}</option>
                            {agents.map(person => <option key={person.id} value={person.id}>{person.name || person.email}</option>)}
                          </select>
                          <button type="button" disabled={busy || !assignTo} onClick={() => (holder.assignedToUid && !mine ? setAsk({ kind: 'handover', text: '', assignUid: assignTo }) : void changeHolder(() => assignReport(current.id, assignTo, { expectedHolderUid: holder.assignedToUid }), { assignedToUid: assignTo, assignedTo: '' }, dt('Raportimi iu caktua.')).then(() => setAssignTo(''))) } className="rounded-lg bg-indigo-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-indigo-500 disabled:opacity-40">
                            {dt('Cakto')}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })()}
              <CaseThreadPanel thread={thread} />
              <HandoverHistoryPanel reportId={current.id} refreshKey={holderOf(current).assignedToUid} />
              <button type="button" onClick={() => onOpenFull(current.id)} className="mt-5 text-xs font-bold text-indigo-600 hover:underline dark:text-indigo-300">
                {dt('Hap dosjen e plotë (historiku, komentet, dërgimi)')}
              </button>
            </div>
          </div>

          {/* Reason prompt, when an action needs one */}
          {ask && (
            <div className="shrink-0 border-t border-white/10 bg-slate-900 p-3">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                {ask.kind === 'reject' ? dt('Pse po refuzohet? (e lexon qytetari)')
                  : ask.kind === 'info' ? dt('Çfarë informacioni i duhet qytetarit? (e lexon qytetari, jo publiku)')
                  : ask.kind === 'note' ? dt('Shënim i brendshëm (vetëm stafi e lexon)')
                  : ask.kind === 'escalate' ? dt('Pse po eskalohet te administratori? (vetëm stafi e lexon)')
                  : ask.kind === 'handover' ? dt('Pse po kalon puna te dikush tjetër? (e lexon stafi në historikun e caktimeve)')
                  : dt('Pse po hiqet fotoja? (mbetet vetëm në regjistër)')}
              </label>
              <div className="mt-1.5 flex flex-wrap gap-2">
                <textarea
                  ref={askRef}
                  value={ask.text}
                  onChange={event => setAsk({ ...ask, text: event.target.value })}
                  onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submitAsk(); } }}
                  rows={2}
                  maxLength={300}
                  className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-800 p-2.5 text-sm text-white"
                />
                <div className="flex flex-col gap-1.5">
                  <button type="button" disabled={busy} onClick={submitAsk} className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-500 disabled:opacity-40">
                    {ask.kind === 'reject' ? dt('Refuzo') : ask.kind === 'info' ? dt('Dërgo pyetjen') : ask.kind === 'note' ? dt('Ruaj shënimin') : ask.kind === 'escalate' ? dt('Eskalo') : ask.kind === 'handover' ? dt('Ruaj kalimin') : dt('Hiq foton')}
                  </button>
                  <button type="button" onClick={() => setAsk(null)} className="rounded-lg px-4 py-1.5 text-xs font-bold text-slate-300 hover:text-white">{dt('Anulo')}</button>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-white/10 bg-slate-950 px-4 py-3">
            <button type="button" onClick={() => go(-1)} disabled={stepIndex(ids, handled, index, -1, false) === null} className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/20 disabled:opacity-30">
              <ChevronLeft className="h-4 w-4" aria-hidden="true" /> {dt('Mbrapa')}
            </button>
            <button type="button" onClick={() => go(1)} disabled={stepIndex(ids, handled, index, 1) === null} className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/20 disabled:opacity-30">
              {dt('Kalo')} <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
            <span className="mx-1 hidden h-6 w-px bg-white/10 sm:block" />
            {canApprove && current.status === 'Pending Review' && !thread?.awaitingInfo && (
              <button type="button" onClick={approve} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-40">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" aria-hidden="true" />} {dt('Aprovo & vazhdo')} <kbd className="rounded bg-white/20 px-1 text-[11px]">A</kbd>
              </button>
            )}
            {canApprove && current.status === 'Pending Review' && !thread?.awaitingInfo && routed?.resolution.primary.sendable && (
              <button type="button" onClick={approveAndSend} disabled={busy} title={routed.resolution.primary.name} className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-xs font-bold text-white hover:bg-teal-500 disabled:opacity-40">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" aria-hidden="true" />} {dt('Aprovo & dërgo te institucioni')}
              </button>
            )}
            {canEditPhotos && ['Pending Review', 'Draft'].includes(current.status) && !thread?.awaitingInfo && (
              <button type="button" onClick={() => setAsk({ kind: 'info', text: '' })} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-sky-700 px-3 py-2 text-xs font-bold text-white hover:bg-sky-600 disabled:opacity-40">
                <HelpCircle className="h-4 w-4" aria-hidden="true" /> {dt('Kërko informacion')}
              </button>
            )}
            {canEditPhotos && (
              <button type="button" onClick={() => setAsk({ kind: 'note', text: '' })} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/20 disabled:opacity-40">
                <StickyNote className="h-4 w-4" aria-hidden="true" /> {dt('Shënim')}
              </button>
            )}
            {canEditPhotos && !thread?.escalated && (
              <button type="button" onClick={() => setAsk({ kind: 'escalate', text: '' })} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/20 disabled:opacity-40">
                <AlertTriangle className="h-4 w-4" aria-hidden="true" /> {dt('Eskalo')}
              </button>
            )}
            {canEditPhotos && thread?.escalated && isOwner && (
              <button type="button" onClick={() => void closeEscalation()} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-rose-700 px-3 py-2 text-xs font-bold text-white hover:bg-rose-600 disabled:opacity-40">
                <AlertTriangle className="h-4 w-4" aria-hidden="true" /> {dt('Mbyll eskalimin')}
              </button>
            )}
            {canReject && (
              <button type="button" onClick={() => setAsk({ kind: 'reject', text: '' })} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-500 disabled:opacity-40">
                <XCircle className="h-4 w-4" aria-hidden="true" /> {dt('Refuzo')} <kbd className="rounded bg-white/20 px-1 text-[11px]">R</kbd>
              </button>
            )}
            {canDelete && (
              <button type="button" onClick={remove} disabled={busy} className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-rose-500/60 px-3 py-2 text-xs font-bold text-rose-300 hover:bg-rose-600 hover:text-white disabled:opacity-40">
                <Trash2 className="h-4 w-4" aria-hidden="true" /> {dt('Fshi raportin')}
              </button>
            )}
          </div>
        </>
      )}
      {cropping && current && (
        <PhotoCropper
          reportId={current.id}
          url={cropping}
          onClose={() => setCropping(null)}
          onCropped={images => {
            setPhotos(previous => ({ ...previous, [current.id]: images }));
            // The cropped photo is the one that was not in the list before.
            const before = photos[current.id] ?? current.images ?? [];
            setCroppedNow(list => [...list, ...images.filter(u => !before.includes(u))]);
            setCropping(null);
          }}
        />
      )}
    </div>
  );
}

function Fact({ label, value }: { label: string; value?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</dt>
      <dd className="mt-0.5 truncate font-medium text-slate-800 dark:text-slate-100">{value || '—'}</dd>
    </div>
  );
}
