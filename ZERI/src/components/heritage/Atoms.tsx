import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, BadgeCheck, ChevronRight, CircleHelp, ExternalLink, Link2Off, ShieldAlert } from 'lucide-react';
import '../../styles/heritage.css';
import { parseProse, type Inline } from '../../lib/heritage/prose';
import { ui } from '../../lib/heritage/ui';
import {
  EVIDENCE, SOURCE_TYPE_LABELS, formatHeritageDate, hasLang, pick,
  type EvidenceStatus, type HeritageEntry, type HeritageLang, type HeritageSource, type MediaRef,
} from '../../lib/heritage/types';
import type { HeritageContent } from '../../lib/heritage/content';
import { sourcesFor } from '../../lib/heritage/content';

export { useHeritageLang } from '../../lib/heritage/useLang';

/** Public path of an entry. */
export const entryPath = (entry: Pick<HeritageEntry, 'area' | 'section' | 'id'>) =>
  `${entry.area === 'uck' ? '/historia-e-uck' : '/kosova'}/${entry.section}/${entry.id}`;
export const sectionPath = (area: 'kosova' | 'uck', section: string) => `${area === 'uck' ? '/historia-e-uck' : '/kosova'}/${section}`;

export function EvidenceBadge({ status, lang, className }: { status: EvidenceStatus; lang: HeritageLang; className?: string }) {
  const meta = EVIDENCE[status];
  return (
    <span className={`hx-badge ${className ?? ''}`} data-tone={meta.tone} title={meta.meaning[lang]}>
      {status === 'allegation' ? <ShieldAlert className="h-3 w-3" aria-hidden="true" /> : status === 'contested' ? <CircleHelp className="h-3 w-3" aria-hidden="true" /> : <BadgeCheck className="h-3 w-3" aria-hidden="true" />}
      {meta.label[lang]}
    </span>
  );
}

function Inlines({ nodes }: { nodes: Inline[] }) {
  return (
    <>
      {nodes.map((n, i) => {
        if (n.t === 'bold') return <strong key={i}>{n.v}</strong>;
        if (n.t === 'link') {
          return n.external
            ? <a key={i} href={n.href} target="_blank" rel="noopener noreferrer">{n.v}<ExternalLink className="ml-0.5 inline h-3 w-3" aria-hidden="true" /></a>
            : <Link key={i} to={n.href}>{n.v}</Link>;
        }
        return <React.Fragment key={i}>{n.v}</React.Fragment>;
      })}
    </>
  );
}

export function Prose({ text, dropcap }: { text: string; dropcap?: boolean }) {
  const blocks = React.useMemo(() => parseProse(text), [text]);
  return (
    <div className={`hx-prose ${dropcap ? 'hx-dropcap' : ''}`}>
      {blocks.map((b, i) => {
        if (b.t === 'ul') return <ul key={i}>{b.items.map((it, j) => <li key={j}><Inlines nodes={it} /></li>)}</ul>;
        if (b.t === 'quote') return <blockquote key={i}><Inlines nodes={b.inline} /></blockquote>;
        return <p key={i}><Inlines nodes={b.inline} /></p>;
      })}
    </div>
  );
}

export function SourceCitations({ sources, lang }: { sources: HeritageSource[]; lang: HeritageLang }) {
  if (!sources.length) return null;
  return (
    <ol className="space-y-2.5 text-sm">
      {sources.map((s, i) => (
        <li key={s.id} className="flex gap-3">
          <span className="mt-0.5 w-5 shrink-0 text-right font-black hx-brass" aria-hidden="true">{i + 1}</span>
          <div className="min-w-0">
            <p className="font-bold leading-snug" style={{ color: 'var(--hx-ink)' }}>
              {s.url ? <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline decoration-[var(--hx-rule)] underline-offset-4 hover:decoration-[var(--hx-brass-2)]">{s.title}</a> : s.title}
            </p>
            <p className="hx-ink-3 text-xs">
              {s.publisher} · {SOURCE_TYPE_LABELS[s.type][lang]}{s.date ? ` · ${s.date}` : ''}{s.reference ? ` · ${s.reference}` : ''}
            </p>
            <p className="mt-0.5 flex items-center gap-1 text-[11px]" style={{ color: s.linkChecked ? 'var(--hx-ok)' : 'var(--hx-warn)' }}>
              {s.linkChecked ? <BadgeCheck className="h-3 w-3" aria-hidden="true" /> : <Link2Off className="h-3 w-3" aria-hidden="true" />}
              {s.url ? (s.linkChecked ? `${ui('linkChecked', lang)}${s.linkCheckedAt ? ` ${s.linkCheckedAt}` : ''}` : ui('linkUnchecked', lang)) : ui('noLink', lang)}
            </p>
            {s.note && <p className="hx-ink-3 mt-0.5 text-xs italic">{s.note}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function ClaimsView({ entry, content, lang }: { entry: HeritageEntry; content: HeritageContent; lang: HeritageLang }) {
  if (!entry.claims.length) return null;
  return (
    <div className="space-y-3">
      {entry.claims.map((c) => (
        <figure key={c.id} className="hx-card p-4">
          <figcaption className="flex flex-wrap items-center gap-2">
            <EvidenceBadge status={c.evidence} lang={lang} />
            <span className="hx-ink-3 text-xs font-bold">{ui('asOf', lang)} {c.asOf}</span>
          </figcaption>
          <blockquote className="hx-serif mt-2 text-lg font-bold leading-snug" style={{ color: 'var(--hx-ink)' }}>{pick(c.text, lang)}</blockquote>
          {c.caveat && <p className="hx-ink-2 mt-1.5 text-sm">{pick(c.caveat, lang)}</p>}
          <p className="hx-ink-3 mt-2 text-xs">
            {c.sourceIds.map((id) => content.sources.get(id)).filter(Boolean).map((s) => s!.publisher).join(' · ')}
          </p>
        </figure>
      ))}
    </div>
  );
}

export function VerificationNote({ entry, lang }: { entry: HeritageEntry; lang: HeritageLang }) {
  if (entry.verification.state === 'verified') {
    return (
      <p className="flex items-start gap-2 text-sm" style={{ color: 'var(--hx-ok)' }}>
        <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{ui('verifiedOn', lang)} {entry.verification.at}.{entry.verification.note ? ` ${entry.verification.note}` : ''}</span>
      </p>
    );
  }
  // The KLA archive is shown to the public without the editorial "awaiting second check" notice.
  if (entry.area === 'uck') return null;
  return (
    <p className="flex items-start gap-2 text-sm" style={{ color: 'var(--hx-warn)' }}>
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{ui('unverifiedNote', lang)}</span>
    </p>
  );
}

export function EntryMeta({ entry, lang }: { entry: HeritageEntry; lang: HeritageLang }) {
  const date = formatHeritageDate(entry.date, lang);
  return (
    <p className="hx-ink-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold">
      {date && <span>{date}</span>}
      {entry.place && <span>{entry.place.name}{entry.place.municipality && entry.place.municipality !== entry.place.name ? `, ${entry.place.municipality}` : ''}</span>}
    </p>
  );
}

export function LangFallback({ entry, lang }: { entry: HeritageEntry; lang: HeritageLang }) {
  if (hasLang(entry.title, lang) && hasLang(entry.body, lang)) return null;
  return <p className="hx-ink-3 rounded-lg border px-3 py-2 text-xs hx-rule">{ui('fallbackLang', lang)}</p>;
}

export function MediaFigure({ media, lang }: { media: MediaRef; lang: HeritageLang }) {
  if (media.kind !== 'image' || !media.url) return null;
  return (
    <figure className="overflow-hidden rounded-2xl border hx-rule">
      <img src={media.url} alt={pick(media.alt, lang)} loading="lazy" decoding="async" className="w-full object-cover" />
      <figcaption className="hx-ink-3 px-3 py-2 text-xs">{pick(media.caption, lang)} <span className="font-bold">· {media.credit}</span></figcaption>
    </figure>
  );
}

/**
 * Content notice with an explicit choice. The decision is remembered for the tab only
 * (sessionStorage) so a reader who chose to continue is not nagged on every chapter, and
 * nothing about their choice is stored on a server.
 */
export function SensitiveGate({ kind, lang, children, onLeave, id }: {
  kind: 'graphic' | 'sexual-violence'; lang: HeritageLang; children: React.ReactNode; onLeave?: () => void; id: string;
}) {
  const key = `hx-gate-${id}`;
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try { if (sessionStorage.getItem(key) === '1') setOpen(true); } catch { /* storage may be blocked */ }
  }, [key]);
  if (open) return <>{children}</>;
  return (
    <div className="hx-gate p-5 sm:p-6" role="region" aria-labelledby={`${key}-t`}>
      <h2 id={`${key}-t`} className="flex items-center gap-2 text-base font-black" style={{ color: 'var(--hx-bad)' }}>
        <AlertTriangle className="h-5 w-5" aria-hidden="true" />{ui('warnTitle', lang)}
      </h2>
      <p className="hx-ink-2 mt-2 max-w-prose text-sm leading-relaxed">{kind === 'sexual-violence' ? ui('warnSV', lang) : ui('warnBody', lang)}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-4 text-sm font-black text-white" style={{ background: 'var(--hx-blue)', color: '#fff' }}
          onClick={() => { try { sessionStorage.setItem(key, '1'); } catch { /* ignore */ } setOpen(true); }}>
          {ui('warnShow', lang)}<ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
        {onLeave && <button type="button" className="hx-card inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-bold" onClick={onLeave}>{ui('warnLeave', lang)}</button>}
      </div>
    </div>
  );
}

/** JSON-LD for search engines: Article for narrative entries, Event for dated events. */
export function useJsonLd(data: Record<string, unknown> | null) {
  useEffect(() => {
    if (!data) return;
    const el = document.createElement('script');
    el.type = 'application/ld+json';
    el.dataset.hx = '1';
    el.text = JSON.stringify(data);
    document.head.appendChild(el);
    return () => { el.remove(); };
  }, [data]);
}

export function Crumbs({ items }: { items: Array<{ to?: string; label: string }> }) {
  return (
    <nav aria-label="Breadcrumb" className="hx-ink-3 hx-crumbs -mx-4 flex items-center gap-1 overflow-x-auto whitespace-nowrap px-4 py-1 text-xs font-semibold sm:mx-0 sm:flex-wrap sm:px-0">
      {items.map((it, i) => (
        <React.Fragment key={i}>
          {i > 0 && <ChevronRight className="h-3 w-3 shrink-0 opacity-60" aria-hidden="true" />}
          {it.to ? <Link to={it.to} className="shrink-0 hover:underline">{it.label}</Link> : <span aria-current="page" className="shrink-0" style={{ color: 'var(--hx-ink)' }}>{it.label}</span>}
        </React.Fragment>
      ))}
    </nav>
  );
}

export { sourcesFor };
