/**
 * ReviewCard — the inspector's view of one report.
 *
 * ─── What this component is for ─────────────────────────────────────────────
 *
 * An agent's job on a single report is a sequence: look at the photos, read the
 * description, confirm the location, check the report is complete, then pass it
 * on or reject it. That is one screen, not five, and the screen has to work on a
 * phone at the roadside as well as on a desk.
 *
 * The gallery is the part that earns its complexity. An agent deciding whether a
 * photo shows the reported problem needs to *look* at it: hovering previews it
 * without committing, clicking opens it full, and each thumbnail can be removed
 * if it is irrelevant (a screenshot of a conversation, someone's face). Removal
 * is local to the review and never deletes the citizen's original upload — it
 * marks the image as not useful for this inspection, which is an editorial note,
 * not a deletion.
 */
import { useState } from 'react';
import { MediaViewer, type ViewerItem } from './MediaViewer';
import { dt } from '../../lib/dt';
import type { Report } from '../../types';
import {
  completenessChecks,
  isReadyForMunicipality,
  stageOf,
  availableTransitions,
  STAGE_LABELS,
  STAGE_TONES,
  type Transition,
} from '../../lib/approvalPipeline';
import {
  MapPin, Camera, CheckCircle2, XCircle, Clock, Maximize2, Trash2,
  Eye, AlertTriangle, ChevronDown, ChevronRight, FileText, ShieldCheck,
} from 'lucide-react';

interface Props {
  report: Report;
  /** The role reviewing, which decides the available actions. */
  role: 'agent' | 'municipality' | 'staff';
  /** Called with the chosen transition and an optional note. */
  onTransition: (transition: Transition, note: string) => void;
  /** Ids of images the reviewer has marked as not useful for this inspection. */
  onMarkImage?: (imageUrl: string) => void;
  markedImages?: readonly string[];
}

const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('sq-AL', { dateStyle: 'short', timeStyle: 'short' }) : '—';

const hoursSince = (iso?: string) => {
  const t = Date.parse(iso ?? '');
  return Number.isFinite(t) ? Math.max(0, Math.round((Date.now() - t) / 36e5)) : 0;
};

export default function ReviewCard({ report, role, onTransition, onMarkImage, markedImages = [] }: Props) {
  const [note, setNote] = useState('');
  const [openImage, setOpenImage] = useState<string | null>(null);
  const [hoveredImage, setHoveredImage] = useState<string | null>(null);
  const [showFacts, setShowFacts] = useState(true);

  const stage = stageOf(report);
  const checks = completenessChecks(report);
  const ready = isReadyForMunicipality(report);
  const actions = availableTransitions(report, role);

  // Every image the citizen attached, from both fields the app has used.
  const images = [
    ...(report.images ?? []),
    ...((report.media ?? []).filter((m) => m.type === 'image').map((m) => m.url)),
  ].filter(Boolean);

  const marked = new Set(markedImages);

  // Photos first, then videos, documents and voice notes, in one sequence for the viewer.
  const others = (report.media ?? []).filter((m) => m.type !== 'image' && m.url);
  const viewerItems: ViewerItem[] = [
    ...images.map((url) => ({ url, type: 'image' as const })),
    ...others.map((m) => ({ url: m.url, type: m.type, name: m.name })),
  ];
  const [viewerAt, setViewerAt] = useState<number | null>(null);

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900">
      {/* Header: what it is, how urgent, how long it has waited */}
      <header className="border-b border-slate-100 p-4 dark:border-white/5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black ${STAGE_TONES[stage]}`}>
                {dt(STAGE_LABELS[stage])}
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {report.urgency}
              </span>
              {report.trackingId && (
                <span className="rounded-full bg-slate-900 px-2 py-0.5 font-mono text-[10px] font-black text-white dark:bg-slate-700">
                  {report.trackingId}
                </span>
              )}
            </div>
            <h3 className="mt-2 text-base font-black leading-tight text-slate-900 dark:text-white">
              {report.title}
            </h3>
          </div>

          <div className="shrink-0 text-right">
            <p className="flex items-center justify-end gap-1 text-[11px] font-bold text-slate-500">
              <Clock className="h-3 w-3" /> {hoursSince(report.createdAt)} {dt('orë')}
            </p>
            <p className="mt-0.5 text-[10px] text-slate-400">{fmtDate(report.createdAt)}</p>
          </div>
        </div>
      </header>

      <div className="space-y-4 p-4">
        {/* ---------------------------------------------------------------
            Gallery.
            Hover previews, click enlarges, and each thumbnail can be marked
            as not useful. The citizen's file is never deleted from here.
        ---------------------------------------------------------------- */}
        {images.length > 0 && (
          <section>
            <h4 className="mb-2 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-slate-500">
              <Camera className="h-3.5 w-3.5" /> {dt('Fotografitë')} ({images.length})
              <span className="font-normal normal-case tracking-normal text-slate-400">
                · {dt('kalo mausin për pamje, kliko për zmadhim')}
              </span>
            </h4>
            <div className="flex flex-wrap gap-2">
              {images.map((url, i) => {
                const isMarked = marked.has(url);
                return (
                  <div key={`${url}_${i}`} className="group relative">
                    <button
                      type="button"
                      onClick={() => setViewerAt(Math.max(0, images.indexOf(url)))}
                      onMouseEnter={() => setHoveredImage(url)}
                      onMouseLeave={() => setHoveredImage(null)}
                      onFocus={() => setHoveredImage(url)}
                      onBlur={() => setHoveredImage(null)}
                      aria-label={dt('Zmadho fotografinë')}
                      className={`block h-24 w-24 overflow-hidden rounded-xl border-2 transition ${isMarked
                          ? 'border-rose-400 opacity-45'
                          : 'border-slate-200 hover:border-blue-500 dark:border-white/10'
                        }`}
                    >
                      <img
                        src={url}
                        alt={dt('Fotografi e raportimit')}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    </button>

                    {/*
                      The actions appear on hover, and are always present for
                      keyboard users (the buttons are focusable, not revealed
                      only by a pointer event).
                    */}
                    <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1 rounded-b-xl bg-slate-900/75 p-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                      <button
                        type="button"
                        onClick={() => setViewerAt(Math.max(0, images.indexOf(url)))}
                        aria-label={dt('Zmadho')}
                        className="rounded p-1 text-white hover:bg-white/20"
                      >
                        <Maximize2 className="h-3 w-3" />
                      </button>
                      {onMarkImage && (
                        <button
                          type="button"
                          onClick={() => onMarkImage(url)}
                          aria-label={isMarked ? dt('Ktheje si të dobishme') : dt('Shëno si të padobishme')}
                          className="rounded p-1 text-white hover:bg-white/20"
                        >
                          {isMarked ? <CheckCircle2 className="h-3 w-3" /> : <Trash2 className="h-3 w-3" />}
                        </button>
                      )}
                    </div>

                    {isMarked && (
                      <span className="pointer-events-none absolute inset-0 grid place-items-center rounded-xl bg-rose-600/25">
                        <span className="rounded bg-rose-600 px-1.5 py-0.5 text-[9px] font-black text-white">
                          {dt('E papërdorshme')}
                        </span>
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Hover preview — a glance without committing to the full view. */}
            {hoveredImage && !openImage && (
              <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 dark:border-white/10">
                <img loading="lazy" decoding="async"
                  src={hoveredImage}
                  alt={dt('Pamje paraprake')}
                  className="max-h-72 w-full object-contain bg-slate-50 dark:bg-slate-950"
                />
              </div>
            )}
          </section>
        )}

        {others.length > 0 && (
          <section>
            <h4 className="mb-2 text-[11px] font-black uppercase tracking-wider text-slate-500">{dt('Video, dokumente dhe audio')} ({others.length})</h4>
            <div className="flex flex-wrap gap-2">
              {others.map((m, i) => (
                <button key={`${m.url}_${i}`} type="button" onClick={() => setViewerAt(images.length + i)}
                  className="relative grid h-24 w-32 place-items-center overflow-hidden rounded-xl border-2 border-slate-200 bg-slate-900 text-xs font-bold text-white hover:border-blue-500 dark:border-white/10">
                  {m.type === 'video'
                    ? <><video src={m.url} muted preload="metadata" className="absolute inset-0 h-full w-full object-cover opacity-80" /><span className="relative rounded-full bg-black/60 px-3 py-1">▶ {dt('Video')}</span></>
                    : <span className="px-2 text-center">{m.type === 'audio' ? dt('Audio') : dt('Dokument')}<br /><span className="font-normal text-white/70">{m.name}</span></span>}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Description */}
        <section>
          <h4 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-slate-500">
            <FileText className="h-3.5 w-3.5" /> {dt('Përshkrimi')}
          </h4>
          <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-700 dark:text-slate-200">
            {report.description}
          </p>
        </section>

        {/* Location — everything the router needs */}
        <section>
          <h4 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-slate-500">
            <MapPin className="h-3.5 w-3.5" /> {dt('Vendndodhja')}
          </h4>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-700 dark:text-slate-200">
            <span className="rounded-lg bg-slate-100 px-2 py-1 font-bold dark:bg-slate-800">
              {report.location?.municipality || dt('Pa komunë')}
            </span>
            {(report.location?.neighborhood || report.location?.address) && (
              <span className="text-slate-500">
                {[report.location?.neighborhood, report.location?.address].filter(Boolean).join(', ')}
              </span>
            )}
            {typeof report.location?.lat === 'number' && typeof report.location?.lng === 'number' && (
              <span className="font-mono text-[10px] text-slate-400">
                {report.location.lat.toFixed(5)}, {report.location.lng.toFixed(5)}
              </span>
            )}
          </div>
        </section>

        {/* Completeness — only meaningful for the agent's stage. */}
        {role === 'agent' && (
          <section
            className={`rounded-xl border p-3 ${ready
                ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-500/20 dark:bg-emerald-500/[0.06]'
                : 'border-amber-200 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-500/[0.06]'
              }`}
          >
            <h4 className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
              {ready ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />}
              {dt('Kontrolli i plotësisë')}
              <span className="font-normal normal-case tracking-normal text-slate-400">
                · {checks.filter((c) => c.ok).length}/{checks.length}
              </span>
            </h4>
            <ul className="mt-2 space-y-1.5">
              {checks.map((c) => (
                <li key={c.key} className="flex items-start gap-2 text-[11px]">
                  {c.ok ? (
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                  ) : (
                    <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                  )}
                  <span className={c.ok ? 'text-slate-600 dark:text-slate-300' : 'text-amber-900 dark:text-amber-200'}>
                    <strong>{dt(c.label)}</strong>
                    {!c.ok && <span className="block text-[10px] opacity-80">{dt(c.hint)}</span>}
                  </span>
                </li>
              ))}
            </ul>
            {!ready && (
              <p className="mt-2 text-[10px] leading-relaxed text-amber-800 dark:text-amber-200">
                {dt('Raportimi nuk mund të pasohet te komuna derisa kontrolli të kalojë plotësisht.')}
              </p>
            )}
          </section>
        )}

        {/* Timeline — what has happened so far, so the reviewer has context. */}
        {(report.timeline?.length ?? 0) > 0 && (
          <section>
            <button
              type="button"
              onClick={() => setShowFacts((v) => !v)}
              aria-expanded={showFacts}
              className="flex w-full items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-slate-500"
            >
              {showFacts ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              {dt('Historiku')} ({report.timeline?.length ?? 0})
            </button>
            {showFacts && (
              <ol className="mt-2 space-y-1.5 border-l-2 border-slate-100 pl-3 dark:border-white/10">
                {report.timeline.map((t) => (
                  <li key={t.id} className="text-[11px]">
                    <span className="font-bold text-slate-700 dark:text-slate-200">{t.status}</span>
                    <span className="text-slate-400"> · {t.updatedBy} · {fmtDate(t.date)}</span>
                    {t.comment && (
                      <p className="mt-0.5 leading-relaxed text-slate-500 dark:text-slate-400">{t.comment}</p>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </section>
        )}

        {/* Note + actions */}
        <section className="border-t border-slate-100 pt-3 dark:border-white/5">
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold text-slate-600 dark:text-slate-300">
              {dt('Shënim (i detyrueshëm për disa veprime)')}
            </span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={1200}
              placeholder={dt('Çka konstatove, çka mungon, çka duhet të bëhet…')}
              className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-blue-500 dark:border-white/10 dark:bg-slate-950 dark:text-white"
            />
          </label>

          <div className="mt-2 flex flex-wrap gap-2">
            {actions.map(({ rule, allowed, reason }) => (
              <button
                key={rule.transition}
                type="button"
                onClick={() => onTransition(rule.transition, note)}
                disabled={!allowed}
                title={allowed ? undefined : reason}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-black transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${rule.transition === 'reject'
                    ? 'bg-rose-600 text-white hover:bg-rose-700'
                    : rule.transition === 'pass_to_municipality'
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                      : 'bg-blue-700 text-white hover:bg-blue-800'
                  }`}
              >
                {rule.transition === 'reject' ? <XCircle className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                {dt(rule.label)}
              </button>
            ))}
          </div>

          {actions.some((a) => !a.allowed) && (
            <ul className="mt-2 space-y-1">
              {actions.filter((a) => !a.allowed).map((a) => (
                <li key={a.rule.transition} className="flex items-start gap-1.5 text-[10px] text-slate-400">
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                  <span><strong>{dt(a.rule.label)}</strong>: {dt(a.reason ?? '')}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {viewerAt !== null && viewerItems.length > 0 && <MediaViewer items={viewerItems} start={viewerAt} onClose={() => setViewerAt(null)} />}

      {/* Lightbox (kept for other callers of setOpenImage) */}
      {openImage && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/90 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setOpenImage(null)}
        >
          <button
            type="button"
            onClick={() => setOpenImage(null)}
            aria-label={dt('Mbyll')}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          >
            <XCircle className="h-6 w-6" />
          </button>
          <img loading="lazy" decoding="async"
            src={openImage}
            alt={dt('Fotografi e zmadhuar')}
            className="max-h-full max-w-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[11px] text-white/70">
            <Eye className="mr-1 inline h-3 w-3" />
            {dt("Kliko jashtë për t'u mbyllur")}
          </p>
        </div>
      )}
    </article>
  );
}
