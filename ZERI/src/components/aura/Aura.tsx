import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * Building blocks of the "Aura" public design system (styles/aura.css).
 * Presentational only: no data, routing or permissions.
 */

export type AuraTone = 'blue' | 'violet' | 'teal' | 'rose' | 'amber' | 'green' | 'slate';

/** Fades children in once when scrolled into view; no-op under reduced motion. */
export function Reveal({ children, delay = 0, className, as: Tag = 'div' }: { children: React.ReactNode; delay?: number; className?: string; as?: React.ElementType }) {
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) { setShown(true); io.disconnect(); }
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <Tag ref={ref} className={cn('au-reveal', shown && 'is-in', className)} style={{ ['--au-delay' as string]: `${delay}ms` }}>
      {children}
    </Tag>
  );
}

/** Page canvas. */
export function AuraPage({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('au-page min-h-screen px-3 pb-24 pt-3 sm:px-6 lg:px-8', className)}>
      <div className="mx-auto max-w-6xl space-y-8 sm:space-y-10">{children}</div>
    </div>
  );
}

/**
 * Compact page header: eyebrow, one-line title, short subtitle, actions, and an optional
 * aside (stats or a small glass card). Height stays around 200-260 px on desktop.
 */
export function AuraHero({ tone = 'blue', eyebrow, icon: Icon, title, subtitle, actions, aside, live = false, visual }: {
  tone?: AuraTone; eyebrow: string; icon?: LucideIcon; title: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode; aside?: React.ReactNode; live?: boolean; visual?: React.ReactNode;
}) {
  return (
    <header data-tone={tone} className="au-hero">
      <span aria-hidden="true" className="au-glow -right-10 -top-16 h-52 w-52" />
      <span aria-hidden="true" className="au-glow -bottom-20 left-10 h-40 w-40 opacity-30" />
      <div className={cn('grid gap-6 p-6 sm:p-10', (aside || visual) && 'md:grid-cols-[1fr_auto] md:items-center')}>
        <div className="max-w-2xl">
          <p className="inline-flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-white/70">
            {live ? <span className="au-dot au-pulse text-emerald-300" aria-hidden="true" /> : Icon ? <Icon className="h-3.5 w-3.5" aria-hidden="true" /> : null}
            {eyebrow}
          </p>
          <h1 className="mt-3 text-[32px] font-bold leading-[1.05] sm:text-[52px]">{title}</h1>
          {subtitle && <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-white/75 sm:text-[18px]">{subtitle}</p>}
          {actions && <div className="mt-5 flex flex-wrap items-center gap-2.5">{actions}</div>}
        </div>
        {(aside || visual) && (
          <div className="flex min-w-0 items-center gap-5 md:w-auto">
            {visual && <div className="hidden lg:block">{visual}</div>}
            {aside && <div className="min-w-0 flex-1 md:w-[15rem] md:flex-none">{aside}</div>}
          </div>
        )}
      </div>
    </header>
  );
}

/** Row of 2-4 compact numbers for a hero aside. */
export function AuraStats({ items }: { items: Array<{ value: React.ReactNode; label: string }> }) {
  return (
    <dl className="grid grid-cols-3 gap-2 md:grid-cols-1 md:gap-1.5">
      {items.map(i => (
        <div key={i.label} className="rounded-xl bg-white/10 px-3 py-2.5 backdrop-blur md:flex md:items-baseline md:justify-between md:gap-3">
          <dd className="text-[20px] font-semibold leading-none tabular-nums sm:text-[22px]">{i.value}</dd>
          <dt className="mt-1 text-[11px] leading-tight text-white/65 md:mt-0 md:text-right">{i.label}</dt>
        </div>
      ))}
    </dl>
  );
}

/** Section with a small title row. */
export function AuraSection({ title, kicker, action, children, id }: { title: React.ReactNode; kicker?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; id?: string }) {
  return (
    <section aria-labelledby={id}>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          {kicker && <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--au-accent)]">{kicker}</p>}
          <h2 id={id} className="text-[20px] font-semibold leading-tight sm:text-[24px]">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Icon + title + text, optionally a link tile. */
export function AuraNote({ tone = 'info', icon: Icon, children }: { tone?: 'info' | 'warn'; icon?: LucideIcon; children: React.ReactNode }) {
  return (
    <div role="note" className={cn('flex items-start gap-3 rounded-2xl px-4 py-3 text-[13px] leading-relaxed', tone === 'warn' ? 'bg-amber-500/10 text-amber-900 dark:text-amber-200' : 'bg-[var(--au-accent-soft)] text-[var(--au-text)]')}>
      {Icon && <Icon className="mt-0.5 h-4 w-4 shrink-0 opacity-80" aria-hidden="true" />}
      <div>{children}</div>
    </div>
  );
}

export function AuraEmpty({ icon: Icon, title, text, action }: { icon: LucideIcon; title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="au-tile px-6 py-10 text-center">
      <Icon className="mx-auto h-7 w-7 opacity-40" aria-hidden="true" />
      <p className="mt-3 text-[15px] font-semibold">{title}</p>
      {text && <p className="au-sub mx-auto mt-1 max-w-sm text-[13px]">{text}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

/** Fixed-ratio photo; shows the tint, never a broken image. */
export function AuraPhoto({ src, alt, ratio = '16/10', video = false, className, children }: { src?: string; alt: string; ratio?: string; video?: boolean; className?: string; children?: React.ReactNode }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={cn('au-photo', className)} style={{ aspectRatio: ratio }}>
      {src && !failed && (video
        ? <video src={src} muted playsInline preload="metadata" onError={() => setFailed(true)} />
        : <img src={src} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(true)} />)}
      {children}
    </div>
  );
}

/**
 * Orbit of icons around a core icon. Satellites are decorative unless `links` is given,
 * in which case each one is a real link (with an accessible name) to that route.
 */
export function AuraOrbit({ core: Core, icons, links }: { core: LucideIcon; icons: LucideIcon[]; links?: Array<{ to: string; label: string }> }) {
  const sats = icons.slice(0, 8);
  return (
    <div className="au-orbit" {...(links ? {} : { 'aria-hidden': true })}>
      <span aria-hidden="true" className="au-orbit-ring inset-[6%]" />
      <span aria-hidden="true" className="au-orbit-ring inset-[26%]" />
      <span aria-hidden="true" className="au-orbit-core"><Core className="h-7 w-7" /></span>
      {sats.map((Icon, i) => {
        const a = (i / sats.length) * Math.PI * 2 - Math.PI / 2;
        const r = i % 2 ? 34 : 46;
        const style = { left: `${50 + Math.cos(a) * r}%`, top: `${50 + Math.sin(a) * r}%`, animationDelay: `${i * 0.6}s` };
        const link = links?.[i];
        return link
          ? <Link key={i} to={link.to} aria-label={link.label} title={link.label} className="au-orbit-sat" style={style}><Icon className="h-[18px] w-[18px]" /></Link>
          : <span key={i} className="au-orbit-sat" style={style}><Icon className="h-[18px] w-[18px]" /></span>;
      })}
    </div>
  );
}
