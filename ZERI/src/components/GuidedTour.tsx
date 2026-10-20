import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowDown, ArrowUp, BookOpen, Compass, HelpCircle, LifeBuoy, Sparkles, X } from 'lucide-react';
import { useLanguage } from '../lib/LanguageContext';
import {
  OPEN_TOUR_EVENT,
  PLATFORM_TOUR_ID,
  TOUR_MUTED_KEY,
  TOUR_PANEL_EVENT,
  genericTourFor,
  stepsForDevice,
  tourById,
  tourSeenKey,
  toursForRoute,
  type Tour,
  type TourDevice,
  type TourPanel,
  type TourStep,
} from '../lib/tours';

/**
 * Spotlight tour: dims the page, leaves the target lit, points an arrow at it and
 * explains it. Works the same on a phone and on a desktop: the card is clamped to the
 * viewport and sits above or below the target, whichever has room.
 *
 * The first time a visitor lands somewhere they are asked, once, whether they want to
 * see the guide ("Po, më trego" / "Jo, faleminderit" / "Mos më pyet më"). After that
 * only the round "?" button remains, on every page, and it never goes away: it replays
 * the page guide or the full platform tour.
 */
const PAD = 8;
const GAP = 18;
/** A target that has not shown up after this long is skipped instead of pointing at nothing. */
const MISSING_TARGET_MS = 1700;

const readFlag = (key: string) => { try { return localStorage.getItem(key) === '1'; } catch { return false; } };
const writeFlag = (key: string) => { try { localStorage.setItem(key, '1'); } catch { /* private mode: the question may return next visit, which is harmless */ } };
const readSeen = (id: string) => readFlag(tourSeenKey(id));
const markSeen = (id: string) => writeFlag(tourSeenKey(id));
const readMuted = () => readFlag(TOUR_MUTED_KEY);

const currentDevice = (): TourDevice => (window.matchMedia?.('(min-width: 768px)').matches ? 'desktop' : 'mobile');

function visible(el: Element | null): el is HTMLElement {
  if (!el) return false;
  const rect = el.getBoundingClientRect();
  if (rect.width < 4 || rect.height < 4) return false;
  const style = getComputedStyle(el);
  return style.visibility !== 'hidden' && style.display !== 'none';
}

export function findTarget(step: TourStep): HTMLElement | null {
  for (const selector of step.selectors) {
    let nodes: Element[];
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
  const navigate = useNavigate();
  const [tour, setTour] = useState<Tour | null>(null);
  const [device, setDevice] = useState<TourDevice>(currentDevice);
  const [index, setIndex] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [available, setAvailable] = useState<Tour | null>(null);
  const [ask, setAsk] = useState<Tour | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [, bump] = useState(0);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const nextRef = useRef<HTMLButtonElement | null>(null);
  const launcherRef = useRef<HTMLDivElement | null>(null);
  const direction = useRef(1);
  // One question per page visit: answering "no" to the platform tour must not be followed by a page question.
  const asked = useRef(false);
  const [cardHeight, setCardHeight] = useState(200);
  const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight });

  const steps = useMemo(() => (tour ? stepsForDevice(tour, device) : []), [tour, device]);
  const step: TourStep | undefined = steps[index];

  const start = useCallback((next: Tour) => {
    markSeen(next.id);
    direction.current = 1;
    setAsk(null);
    setMenuOpen(false);
    setDevice(currentDevice());
    setIndex(0);
    setTour(next);
    bump(n => n + 1);
  }, []);

  // Which tour fits what is on the page right now (a form step, an open dialog).
  useEffect(() => {
    const pick = () => {
      const candidates = toursForRoute(pathname).filter(t => !t.whenSelector || document.querySelector(t.whenSelector));
      const next = candidates[0] ?? genericTourFor(pathname);
      setAvailable(prev => (prev?.id === next.id ? prev : next));
    };
    pick();
    const timer = window.setInterval(pick, 700);
    return () => window.clearInterval(timer);
  }, [pathname]);

  // A route change ends the running tour and withdraws an unanswered question.
  useEffect(() => { setTour(null); setAsk(null); setMenuOpen(false); }, [pathname]);
  useEffect(() => { setAsk(null); }, [available?.id]);

  // First visit: ask once, after the page has settled. The platform tour is offered before any page guide.
  useEffect(() => {
    if (!available || tour || ask || asked.current || readMuted()) return;
    const offer = !readSeen(PLATFORM_TOUR_ID)
      ? tourById(PLATFORM_TOUR_ID)
      : (!available.generic && !readSeen(available.id) ? available : null);
    if (!offer) return;
    const timer = window.setInterval(() => {
      // Never over another dialog (the age gate, a consent prompt): retry until it is gone.
      if (document.querySelector('[aria-modal="true"], [role="dialog"]:not([data-tour-ui])')) return;
      asked.current = true;
      setAsk(offer);
      window.clearInterval(timer);
    }, 1500);
    return () => window.clearInterval(timer);
  }, [available, tour, ask]);

  // Anything can open a tour: the help page, a link, the "?" menu.
  useEffect(() => {
    const onOpen = (event: Event) => {
      const id = (event as CustomEvent<{ id?: string } | undefined>).detail?.id ?? PLATFORM_TOUR_ID;
      const next = tourById(id);
      if (next) start(next);
    };
    window.addEventListener(OPEN_TOUR_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_TOUR_EVENT, onOpen);
  }, [start]);

  const measure = useCallback(() => {
    setViewport({ w: window.innerWidth, h: window.innerHeight });
    if (!step) return;
    const el = findTarget(step);
    if (!el) { setBox(null); return; }
    const r = el.getBoundingClientRect();
    setBox({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 });
  }, [step]);

  // A step about something in the phone menu opens the menu (or the "+" list) and
  // closes it again when the tour moves on. One change per panel, so walking down the
  // menu does not close and reopen the sheet at every step.
  const panel: TourPanel | null = tour && step ? step.panel ?? null : null;
  const lastPanel = useRef<TourPanel | null>(null);
  useEffect(() => {
    if (panel === lastPanel.current) return;
    lastPanel.current = panel;
    window.dispatchEvent(new CustomEvent(TOUR_PANEL_EVENT, { detail: panel }));
  }, [panel]);
  useEffect(() => () => {
    if (lastPanel.current) window.dispatchEvent(new CustomEvent(TOUR_PANEL_EVENT, { detail: null }));
  }, []);

  // Bring the target into view once it exists (a panel may still be sliding in), then follow it while the page moves.
  useEffect(() => {
    if (!step) return;
    let scrolled = false;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let frame = 0;
    const loop = () => {
      if (!scrolled) {
        const el = findTarget(step);
        if (el) {
          scrolled = true;
          el.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
        }
      }
      measure();
      frame = window.requestAnimationFrame(loop);
    };
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
    bump(n => n + 1);
  }, [tour]);

  const go = useCallback((delta: number) => {
    direction.current = delta;
    const next = index + delta;
    if (next < 0) return;
    if (next >= steps.length) { close(true); return; }
    setIndex(next);
  }, [index, steps.length, close]);

  // A step whose target never appears is skipped, in the direction the visitor was travelling.
  useEffect(() => {
    if (!step || step.selectors.length === 0 || box) return;
    const timer = window.setTimeout(() => {
      if (!findTarget(step)) go(direction.current);
    }, MISSING_TARGET_MS);
    return () => window.clearTimeout(timer);
  }, [step, box, go]);

  // Keyboard users land on "Vazhdo" at every step.
  useEffect(() => { if (tour) nextRef.current?.focus({ preventScroll: true }); }, [tour, index]);

  useEffect(() => {
    if (!tour) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close(true);
      else if (event.key === 'ArrowRight') go(1);
      else if (event.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tour, go, close]);

  // The "?" menu closes on an outside tap and on Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (event: Event) => {
      if (launcherRef.current && !launcherRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onDown); window.removeEventListener('keydown', onKey); };
  }, [menuOpen]);

  const layout = useMemo(() => {
    const cardW = Math.min(352, viewport.w - 24);
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

  const touring = Boolean(tour && step);
  const platformSeen = readSeen(PLATFORM_TOUR_ID);
  const onHome = available?.id === PLATFORM_TOUR_ID;

  const launcher = available && (
    <div
      ref={launcherRef}
      className={`fixed bottom-24 left-3 z-[90] lg:bottom-6 ${touring ? 'pointer-events-none' : ''}`}
    >
      {menuOpen && !touring && (
        <div
          role="menu"
          aria-label={dt('Udhëzues')}
          className="absolute bottom-full left-0 mb-2 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-2xl dark:border-white/10 dark:bg-slate-900"
        >
          {!onHome && (
            <button type="button" role="menuitem" onClick={() => start(available)} className="flex min-h-12 w-full items-center gap-3 rounded-xl px-2.5 text-left transition-colors hover:bg-blue-50 dark:hover:bg-slate-800">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white"><BookOpen className="h-4 w-4" aria-hidden="true" /></span>
              <span className="min-w-0">
                <span className="block text-[13px] font-black text-slate-900 dark:text-white">{dt('Udhëzuesi i kësaj faqeje')}</span>
                <span className="block truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">{dt(available.label)}</span>
              </span>
            </button>
          )}
          <button type="button" role="menuitem" onClick={() => { const t = tourById(PLATFORM_TOUR_ID); if (t) start(t); }} className="flex min-h-12 w-full items-center gap-3 rounded-xl px-2.5 text-left transition-colors hover:bg-blue-50 dark:hover:bg-slate-800">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 text-white"><Compass className="h-4 w-4" aria-hidden="true" /></span>
            <span className="min-w-0">
              <span className="block text-[13px] font-black text-slate-900 dark:text-white">{dt('Turi i plotë i platformës')}</span>
              <span className="block truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">{dt('Harta, “+”, menuja dhe çdo faqe')}</span>
            </span>
          </button>
          <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); navigate('/ndihma'); }} className="flex min-h-12 w-full items-center gap-3 rounded-xl px-2.5 text-left transition-colors hover:bg-blue-50 dark:hover:bg-slate-800">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"><LifeBuoy className="h-4 w-4" aria-hidden="true" /></span>
            <span className="min-w-0">
              <span className="block text-[13px] font-black text-slate-900 dark:text-white">{dt('Qendra e ndihmës')}</span>
              <span className="block truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">{dt('Pyetje të shpeshta')}</span>
            </span>
          </button>
        </div>
      )}
      <button
        type="button"
        data-tour-launcher
        onClick={() => setMenuOpen(open => !open)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label={dt('Udhëzues: ') + dt(available.label)}
        title={dt('Udhëzues')}
        className={`relative flex h-11 items-center justify-center gap-2 rounded-full bg-gradient-to-br from-blue-600 to-blue-800 text-white shadow-lg ring-2 ring-white transition active:scale-95 dark:ring-slate-900 ${platformSeen ? 'w-11' : 'px-4'}`}
      >
        {!platformSeen && !touring && <span aria-hidden="true" className="absolute inset-0 rounded-full bg-blue-400/40 motion-safe:animate-ping motion-safe:[animation-duration:2.6s]" />}
        <HelpCircle className="relative h-6 w-6" aria-hidden="true" />
        {!platformSeen && <span className="relative text-xs font-black">{dt('Udhëzues')}</span>}
      </button>
    </div>
  );

  const askCard = ask && !touring && (
    <div
      data-tour-ui
      role="dialog"
      aria-modal="false"
      aria-label={dt(ask.id === PLATFORM_TOUR_ID ? 'Mirë se vini në Zëri' : 'Udhëzues për këtë faqe')}
      className="fixed bottom-40 left-3 right-3 z-[91] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 sm:right-auto sm:w-[372px] lg:bottom-20 dark:border-white/10 dark:bg-slate-900"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 text-white"><Sparkles className="h-5 w-5" aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-black text-slate-900 dark:text-white">
            {ask.id === PLATFORM_TOUR_ID ? dt('Mirë se vini në Zëri') : dt('Doni një udhëzues për këtë faqe?')}
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            {ask.id === PLATFORM_TOUR_ID
              ? dt('Doni t’ju tregojmë si funksionon platforma? Hartën, butonin “+”, menunë dhe çdo faqe, hap pas hapi. Zgjat dy minuta.')
              : dt('Ju tregojmë shkurt çfarë bën çdo pjesë e kësaj faqeje.')}
          </p>
        </div>
        <button type="button" onClick={() => { markSeen(ask.id); setAsk(null); bump(n => n + 1); }} aria-label={dt('Mbyll')} className="-mr-1 -mt-1 flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => start(ask)} className="min-h-11 rounded-xl bg-blue-700 px-3 text-sm font-black text-white hover:bg-blue-800">{dt('Po, më trego')}</button>
        <button type="button" onClick={() => { markSeen(ask.id); setAsk(null); bump(n => n + 1); }} className="min-h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-slate-800">{dt('Jo, faleminderit')}</button>
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-3 text-[11px] font-medium text-slate-500 dark:text-slate-400">
        <span>{dt('Butoni “?” mbetet gjithmonë këtu poshtë.')}</span>
        <button type="button" onClick={() => { writeFlag(TOUR_MUTED_KEY); markSeen(ask.id); setAsk(null); bump(n => n + 1); }} className="shrink-0 font-bold underline underline-offset-2 hover:text-slate-700 dark:hover:text-slate-200">{dt('Mos më pyet më')}</button>
      </div>
    </div>
  );

  if (!tour || !step) return <>{askCard}{launcher}</>;

  const last = index === steps.length - 1;
  const blockers = box ? [
    { top: 0, left: 0, width: viewport.w, height: Math.max(0, box.top) },
    { top: box.top + box.height, left: 0, width: viewport.w, height: Math.max(0, viewport.h - box.top - box.height) },
    { top: box.top, left: 0, width: Math.max(0, box.left), height: box.height },
    { top: box.top, left: box.left + box.width, width: Math.max(0, viewport.w - box.left - box.width), height: box.height },
  ] : [{ top: 0, left: 0, width: viewport.w, height: viewport.h }];

  return (
    <>
      <div data-tour-ui className="fixed inset-0 z-[100002]" role="dialog" aria-modal="false" aria-label={dt(step.title)}>
        {/* The dim area swallows taps: a stray tap must not end a two-minute tour. Close with the X, "Kapërce" or Escape. */}
        {blockers.map((b, i) => (
          <div key={i} className="absolute bg-slate-950/65" style={{ top: b.top, left: b.left, width: b.width, height: b.height }} />
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
          className="absolute overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-900"
          style={{ top: layout.cardTop, left: layout.cardLeft, width: layout.cardW }}
        >
          <div className="h-1 w-full bg-slate-100 dark:bg-slate-800" role="progressbar" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={index + 1} aria-label={dt('Përparimi i udhëzuesit')}>
            <div className="h-full bg-gradient-to-r from-blue-600 to-cyan-400 transition-[width] duration-300" style={{ width: `${((index + 1) / steps.length) * 100}%` }} />
          </div>
          <div className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-blue-700 dark:text-cyan-300">{dt(step.section ?? 'Udhëzues')}</p>
                <h2 className="mt-0.5 text-[15px] font-black leading-snug text-slate-900 dark:text-white">{dt(step.title)}</h2>
              </div>
              <button type="button" onClick={() => close(true)} aria-label={dt('Mbyll udhëzuesin')} className="-m-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <p className="mt-2 text-[13px] leading-relaxed text-slate-700 dark:text-slate-300" aria-live="polite">{dt(step.body)}</p>
            <div className="mt-4 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="text-[11px] font-bold tabular-nums text-slate-500 dark:text-slate-400">{index + 1} / {steps.length}</span>
                {!last && <button type="button" onClick={() => close(true)} className="text-[11px] font-bold text-slate-500 dark:text-slate-400 underline underline-offset-2 hover:text-slate-800 dark:hover:text-slate-200">{dt('Kapërce')}</button>}
              </div>
              <div className="flex gap-2">
                {index > 0 && (
                  <button type="button" onClick={() => go(-1)} className="min-h-10 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-700 dark:border-white/10 dark:text-slate-200">{dt('Mbrapa')}</button>
                )}
                <button ref={nextRef} type="button" onClick={() => go(1)} className="min-h-10 rounded-xl bg-blue-700 px-4 text-xs font-black text-white hover:bg-blue-800">{last ? dt('Mbaro') : dt('Vazhdo')}</button>
              </div>
            </div>
          </div>
        </div>
      </div>
      {launcher}
    </>
  );
}
