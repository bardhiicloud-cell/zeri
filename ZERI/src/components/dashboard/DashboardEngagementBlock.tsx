import { dt } from '@/src/lib/dt';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FileText, ArrowRight,
  Lightbulb,
} from 'lucide-react';
import AdBanner from '../AdBanner.tsx';


/**
 * Two-level engagement block: the sponsorship strip, then the two working
 * widgets.
 *
 * Placed directly under the map and the reports table because that is where a
 * citizen's attention lands after scanning what is happening locally — the two
 * actions available to them from there are "track what I filed" and "propose
 * something new". Both feed the platform's core loop, so they are worth the
 * space rather than being pushed below the fold.
 */
export function DashboardEngagementBlock({ municipality }: { municipality?: string }) {
  const navigate = useNavigate();
  const [trackId, setTrackId] = useState('');

  /**
   * Normalised to upper case and stripped of the leading '#', because a citizen
   * copying the number off a paper receipt will type any of "ZQ-20260101-ABC123",
   * "#ZQ-20260101-ABC123" or "zq 20260101 ABC123". Sending all three to the registry as-is means the
   * search silently returns nothing on two out of three attempts.
   */
  const submitTrackId = (value: string) => {
    const cleaned = value.trim().replace(/^#/, '').replace(/\s+/g, '-').toUpperCase();
    if (!cleaned) return;
    navigate(`/trackid?id=${encodeURIComponent(cleaned)}`);
  };

  return (
    <div className="space-y-5">
      <AdBanner position="inline" className="max-w-none" municipality={municipality} />

      {/* ── NIVELI 2: DY KARTELA KRAH PËR KRAH ──────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Track ID — dark, high contrast, the primary "I already filed" action. */}
        <section
          aria-label={dt('Gjurmimi i raportimit')}
          className="relative overflow-hidden rounded-3xl border border-blue-900/40 bg-gradient-to-br from-blue-950 via-slate-900 to-slate-950 p-6"
        >
          {/* Decorative glow; purely presentational. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-blue-600/20 blur-3xl"
          />

          <div className="relative">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold text-blue-200 backdrop-blur-sm">
              <FileText className="h-3 w-3" aria-hidden="true" />
              {dt('Gjurmimi i Raportimit (Track ID)')}
            </span>

            <h3 className="title-serif mt-3 text-2xl font-black leading-tight text-white">
              {dt('A keni raportuar një problem?')}
            </h3>

            <p className="mt-2 text-xs leading-relaxed text-slate-300">
              {dt('Futni Track-ID që morët kur dërguat raportin për të parë statusin publik dhe historikun e veprimeve.')}
            </p>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                submitTrackId(trackId);
              }}
              className="mt-4 space-y-2.5"
            >
              <div className="relative">
                <FileText
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  value={trackId}
                  onChange={(event) => setTrackId(event.target.value)}
                  placeholder={dt('SHËNO TRACK-ID (P.SH. ZQ-20260101-ABC123)')}
                  aria-label={dt('Numri i Track ID')}
                  className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-10 pr-3 font-mono text-sm uppercase tracking-wider text-white outline-none transition-colors placeholder:font-sans placeholder:text-[11px] placeholder:normal-case placeholder:tracking-normal placeholder:text-slate-500 focus:border-blue-500/60 focus:bg-white/10"
                />
              </div>

              <button
                type="submit"
                disabled={!trackId.trim()}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-white px-5 py-2.5 text-xs font-black text-slate-900 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {dt('Verifiko Statusin')}
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </form>

            <p className="mt-4 border-t border-white/10 pt-3 text-[11px] leading-relaxed text-slate-400">
              {dt('Track-ID merret pasi të dërgoni një raport, p.sh. ZQ-20260101-ABC123.')}
            </p>
          </div>
        </section>

        {/* Ideas bank — light, warm accent, the "I want to change something" action. */}
        <section
          aria-label={dt('Banka e ideve qytetare')}
          className="flex flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-700 dark:bg-amber-950/50 dark:text-amber-400">
              <Lightbulb className="h-3 w-3" aria-hidden="true" />
              {dt('Iniciativa Qytetare')}
            </span>
          </div>

          <h3 className="title-serif mt-3 text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            {dt('Laboratori i ideve')}
          </h3>

          <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            {dt('Keni një ide për të përmirësuar platformën ose shërbimet qytetare? Dërgojeni; ekipi i platformës i lexon idetë.')}
          </p>

          <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-4">
            <span className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
              {dt('Idea nuk është raport zyrtar dhe nuk garanton zbatim.')}
            </span>
            <Link
              to="/Idea"
              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-2 text-xs font-black text-white transition hover:brightness-110"
            >
              <Lightbulb className="h-3.5 w-3.5" aria-hidden="true" />
              {dt('Propozo një Ide')}
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
