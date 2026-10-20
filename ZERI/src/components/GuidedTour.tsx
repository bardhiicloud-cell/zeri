import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ArrowDown, ArrowUp, HelpCircle, X } from 'lucide-react';
import { useLanguage } from '../lib/LanguageContext';
import { tourSeenKey, toursForRoute, type Tour, type TourStep } from '../lib/tours';

/**
 * Spotlight tour: dims the page, leaves the target lit and clickable, points an
 * arrow at it and explains it. Works the same on a phone and on a desktop: the card is
 * clamped to the viewport and sits above or below the target, whichever has room.
 * A first visit starts the page's tour once; the "?" button replays it any time.
 */
const PAD = 8;
const GAP = 18;

const readSeen = (id: string) => { try { return localStorage.getItem(tourSeenKey(id)) === '1'; } catch { return false; } };
const markSeen = (id: string) => { try { localStorage.setItem(tourSeenKey(id), '1'); } catch { /* private mode */ } };

function visible(el: Element | null): el is HTMLElement {
  if (!el) return false;
  const rect = el.getBoundingClientRect();
  if (rect.width < 4 || rect.height < 4) return false;
  const style = getComputedStyle(el);
  return style.visibility !== 'hidden' && style.display !== 'none';
}

export function findTarget(step: TourStep): HTMLElement | null {
  for (const selector of step.selectors) {
    let nodes: Element[] = [];
    try { nodes = Array.from(document.querySelectorAll(selector)); } catch { continue; }
    for (const node of nodes) {
      const el = step.closestButton ? (node.closest('button, a') ?? node) : node;
      if (visible(el)) return el;
    }
  }
  return null;
}

interface Box { top: number; left: number; width: number; height: number }

export default function GuidedTour() {
  const { dt } = useLanguage();
  const { pathname } = useLocation();
  const [tour, setTour] = useState<Tour | null>(null);
  const [index, setIndex] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [available, setAvailable] = useState<Tour | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [cardHeight, setCardHeight] = useState(180);
  const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight });

  // Which tour fits what is on the page right now (a form step, an open dialog).
  useEffect(() => {
    const pick = () => {
      const candidates = toursForRoute(pathname).filter(t => !t.whenSelector || document.querySelector(t.whenSelector));
      const next = candidates[0] ?? null;
      setAvailable(prev => (prev?.id === next?.id ? prev : next));
    };
    pick();
    const timer = window.setInterval(pick, 700);
    return () => window.clearInterval(timer);
  }, [pathname]);

  // First visit: start once, after the page has settled.
  useEffect(() => {
    if (!available || tour || readSeen(available.id)) return;
    // Never over another dialog (the age gate, a consent prompt): retry until it is gone.
    const timer = window.setInterval(() => {
      if (document.querySelector('[aria-modal="true"], [role="dialog"]:not([data-tour-ui])')) return;
      setIndex(0);
      setTour(available);
    }, 1200);
    return () => window.clearInterval(timer);
  }, [available, tour]);

  // A route change ends the running tour.
  useEffect(() => { setTour(null); }, [pathname]);

  const steps = tour?.steps ?? [];
  const step = steps[index];

  const measure = useCallback(() => {
    setViewport({ w: window.innerWidth, h: window.innerHeight });
    if (!step) return;
    const el = findTarget(step);
    if (!el) { setBox(null); return; }
    const r = el.getBoundingClientRect();
    setBox({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 });
  }, [step]);

  // A step about something in the menu opens the menu (phone) and closes it again afterwards.
  const menuOpened = useRef(false);
  const setMenu = useCallback((open: boolean) => {
    window.dispatchEvent(new CustomEvent('zq:mobile-menu', { detail: open }));
    menuOpened.current = open;
  }, []);
  useEffect(() => {
    if (!step?.inMenu) return;
    if (!findTarget(step)) setMenu(true);
    return () => { if (menuOpened.current) setMenu(false); };
  }, [step, setMenu]);

  // Bring the target into view, then follow it while the page moves.
  useEffect(() => {
    if (!step) return;
    const el = findTarget(step);
    if (el) {
      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      el.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
    }
    measure();
    let frame = 0;
    const loop = () => { measure(); frame = window.requestAnimationFrame(loop); };
    // rAF follows smooth scrolling and layout shifts; it is cheap while the tour is open only.
    frame = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(frame);
  }, [step, measure]);

  useLayoutEffect(() => {
    if (cardRef.current) setCardHeight(cardRef.current.offsetHeight);
  }, [index, tour, box, viewport.w]);

  const close = useCallback((done: boolean) => {
    if (tour && done) markSeen(tour.id);
    setTour(null);
  }, [tour]);

  const go = useCallback((delta: number) => {
    const next = index + delta;
    if (next < 0) return;
    if (next >= steps.length) { close(true); return; }
    setIndex(next);
  }, [index, steps.length, close]);

  useEffect(() => {
    if (!tour) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close(true);
      else if (event.key === 'ArrowRight' || event.key === 'Enter') go(1);
      else if (event.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tour, go, close]);

  const layout = useMemo(() => {
    const cardW = Math.min(340, viewport.w - 24);
    if (!box) {
      return { cardW, cardTop: Math.max(12, (viewport.h - cardHeight) / 2), cardLeft: (viewport.w - cardW) / 2, placement: 'center' as const, arrowX: 0 };
    }
    const spaceBelow = viewport.h - (box.top + box.height);
    const placement = spaceBelow >= cardHeight + GAP + 36 ? ('below' as const) : ('above' as const);
    const rawTop = placement === 'below' ? box.top + box.height + GAP + 28 : box.top - GAP - 28 - cardHeight;
    const cardTop = Math.min(Math.max(12, rawTop), viewport.h - cardHeight - 12);
    const centre = box.left + box.width / 2;
    const cardLeft = Math.min(Math.max(12, centre - cardW / 2), viewport.w - cardW - 12);
    return { cardW, cardTop, cardLeft, placement, arrowX: Math.min(Math.max(centre, 24), viewport.w - 24) };
  }, [box, cardHeight, viewport]);

  const launcher = available && !tour && (
    <button
      type="button"
      onClick={() => { setIndex(0); setTour(available); }}
      aria-label={dt('Udhëzues: ' + available.label)}
      title={dt(available.label)}
      className="fixed bottom-24 left-3 z-[90] flex h-11 items-center gap-2 rounded-full border border-blue-200 bg-white px-3 text-xs font-black text-blue-800 shadow-lg transition hover:bg-blue-50 lg:bottom-6 dark:border-blue-900 dark:bg-slate-900 dark:text-blue-200"
    >
      <HelpCircle className="h-5 w-5" aria-hidden="true" />
      <span className="hidden sm:inline">{dt('Udhëzues')}</span>
    </button>
  );

  if (!tour || !step) return <>{launcher}</>;

  const last = index === steps.length - 1;
  const blockers = box ? [
    { top: 0, left: 0, width: viewport.w, height: Math.max(0, box.top) },
    { top: box.top + box.height, left: 0, width: viewport.w, height: Math.max(0, viewport.h - box.top - box.height) },
    { top: box.top, left: 0, width: Math.max(0, box.left), height: box.height },
    { top: box.top, left: box.left + box.width, width: Math.max(0, viewport.w - box.left - box.width), height: box.height },
  ] : [{ top: 0, left: 0, width: viewport.w, height: viewport.h }];

  return (
    <div data-tour-ui className="fixed inset-0 z-[100002]" role="dialog" aria-modal="false" aria-label={dt(step.title)}>
      {blockers.map((b, i) => (
        <div key={i} onClick={() => close(true)} className="absolute bg-slate-950/65" style={{ top: b.top, left: b.left, width: b.width, height: b.height }} />
      ))}
      {box && (
        <div
          className="pointer-events-none absolute rounded-2xl ring-4 ring-amber-400 motion-safe:animate-pulse"
          style={{ top: box.top, left: box.left, width: box.width, height: box.height, boxShadow: '0 0 0 2px #fff, 0 0 28px 6px rgba(251,191,36,.55)' }}
        />
      )}
      {box && layout.placement !== 'center' && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 text-amber-400 drop-shadow-lg motion-safe:animate-bounce"
          style={{
            left: layout.arrowX,
            top: layout.placement === 'below' ? box.top + box.height + 2 : box.top - 36,
          }}
          aria-hidden="true"
        >
          {layout.placement === 'below' ? <ArrowUp className="h-8 w-8" strokeWidth={3.2} /> : <ArrowDown className="h-8 w-8" strokeWidth={3.2} />}
        </div>
      )}
      <div
        ref={cardRef}
        className="absolute rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-white/10 dark:bg-slate-900"
        style={{ top: layout.cardTop, left: layout.cardLeft, width: layout.cardW }}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-sm font-black text-slate-900 dark:text-white">{dt(step.title)}</h2>
          <button type="button" onClick={() => close(true)} aria-label={dt('Mbyll udhëzuesin')} className="-m-1 flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-slate-700 dark:text-slate-300" aria-live="polite">
          {dt(step.body)}
          {!box && <span className="mt-1 block font-semibold text-slate-500">{dt('Ky element shfaqet në pamjen tjetër ose te menuja.')}</span>}
        </p>
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold text-slate-500">{index + 1} / {steps.length}</span>
          <div className="flex gap-2">
            {index > 0 && (
              <button type="button" onClick={() => go(-1)} className="min-h-9 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-700 dark:border-white/10 dark:text-slate-200">{dt('Mbrapa')}</button>
            )}
            <button type="button" onClick={() => go(1)} className="min-h-9 rounded-xl bg-blue-700 px-4 text-xs font-black text-white hover:bg-blue-800">{last ? dt('Mbaro') : dt('Vazhdo')}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
