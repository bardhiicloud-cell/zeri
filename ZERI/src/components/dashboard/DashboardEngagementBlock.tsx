import { dt } from '@/src/lib/dt';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FileText, ArrowRight,
  Lightbulb, Star, MapPin, TrendingUp,
} from 'lucide-react';
import { useStore } from '../../lib/store';
import AdBanner from '../AdBanner.tsx';

const SAMPLE_TRACK_IDS = ['ZQ-4587', 'ZQ-4586', 'ZQ-4584'];

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
  const donationCauses = useStore((state) => state.donationCauses ?? []);

  const [trackId, setTrackId] = useState('');

  /**
   * Normalised to upper case and stripped of the leading '#', because a citizen
   * copying the number off a paper receipt will type any of "ZQ-4587",
   * "#ZQ-4587" or "zq 4587". Sending all three to the registry as-is means the
   * search silently returns nothing on two out of three attempts.
   */
  const submitTrackId = (value: string) => {
    const cleaned = value.trim().replace(/^#/, '').replace(/\s+/g, '-').toUpperCase();
    if (!cleaned) return;
    navigate(`/trackid?id=${encodeURIComponent(cleaned)}`);
  };

  /**
   * The store has no dedicated ideas collection, so the most recent donation
   * causes stand in as the featured civic proposals. This keeps the card
   * populated from data the app already holds instead of opening another
   * Firestore listener for a card most visitors scroll past.
   */
  const featuredIdeas = donationCauses.length >= 2
    ? donationCauses.slice(0, 2).map((cause: any, index: number) => ({
        id: cause.id ?? `idea-${index}`,
        title: cause.title ?? cause.name ?? 'Projekt qytetar',
        municipality: cause.municipality ?? 'Kosovë',
        votes: Number(cause.backers ?? cause.votes ?? 0),
      }))
    : [
        { id: 'idea-sample-1', title: 'Korsi e dedikuar biçikletash në Rrugën B', municipality: 'Prishtinë', votes: 184 },
        { id: 'idea-sample-2', title: 'Ndriçim inteligjent dhe Wi-Fi publik në Shadërvan', municipality: 'Prizren', votes: 142 },
      ];

  return (
    <div className="space-y-5">
      <AdBanner position="inline" className="max-w-none" municipality={municipality} />

      {/* ── NIVELI 2: DY KARTELA KRAH PËR KRAH ──────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Track ID — dark, high contrast, the primary "I already filed" action. */}
        <section
          aria-label="Gjurmimi i raportimit"
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
              {dt('Futni numrin unik të referencës (p.sh. ZQ-4587) për të kontrolluar statusin në kohë reale, zyrtarin përgjegjës dhe hapat e ndërmarrë.')}
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
                  placeholder={dt('SHËNO NUMRIN E TRACK ID (P.SH. ZQ-4587)...')}
                  aria-label={dt('Numri i Track ID')}
                  className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-10 pr-3 font-mono text-sm uppercase tracking-wider text-white outline-none transition-colors placeholder:font-sans placeholder:text-[11px] placeholder:normal-case placeholder:tracking-normal placeholder:text-slate-500 focus:border-blue-500/60 focus:bg-white/10"
                />
              </div>

              <button
                type="submit"
                disabled={!trackId.trim()}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-white px-5 py-2.5 text-xs font-black text-slate-900 transition-all hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {dt('Verifiko Statusin')}
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </form>

            <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1.5 border-t border-white/10 pt-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {dt('Shembuj të shpejtë:')}
              </span>
              {SAMPLE_TRACK_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setTrackId(id);
                    submitTrackId(id);
                  }}
                  className="rounded-lg bg-white/5 px-2 py-0.5 font-mono text-[10px] font-bold text-blue-300 transition-colors hover:bg-white/10 hover:text-blue-200"
                >
                  #{id}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Ideas bank — light, warm accent, the "I want to change something" action. */}
        <section
          aria-label="Banka e ideve qytetare"
          className="flex flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-700 dark:bg-amber-950/50 dark:text-amber-400">
              <Lightbulb className="h-3 w-3" aria-hidden="true" />
              {dt('Iniciativa Qytetare')}
            </span>
            <Link
              to="/Idea"
              className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-400"
            >
              {dt('Shiko të gjitha idetë')}
              <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          </div>

          <h3 className="title-serif mt-3 text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            {dt('Banka e Ideve Qytetare')}
          </h3>

          <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            {dt('Keni një ide për parqe të reja, transport publik apo digjitalizim? Propozoni projektin tuaj dhe mblidhni mbështetjen e komunitetit.')}
          </p>

          <ul className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {featuredIdeas.map((idea: any) => (
              <li key={idea.id}>
                <Link
                  to="/Idea"
                  className="group flex h-full flex-col rounded-2xl border border-slate-200 p-3.5 transition-all hover:-translate-y-0.5 hover:border-amber-300 hover:bg-amber-50/40 dark:border-white/10 dark:hover:border-amber-500/40 dark:hover:bg-amber-950/20"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                      <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                      <span className="truncate">{idea.municipality ?? 'Kosovë'}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1 text-[10px] font-black text-amber-600 dark:text-amber-400">
                      <Star className="h-3 w-3 fill-current" aria-hidden="true" />
                      {idea.votes ?? 0}
                    </span>
                  </div>
                  <p className="mt-1.5 line-clamp-3 text-[11px] font-bold leading-snug text-slate-800 dark:text-slate-200">
                    {idea.title}
                  </p>
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-4">
            <span className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              <TrendingUp className="h-3.5 w-3.5 shrink-0 text-emerald-500" aria-hidden="true" />
              {dt('Mbi 24 ide të pranuara këtë muaj')}
            </span>
            <Link
              to="/Idea"
              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-2 text-xs font-black text-white transition-all hover:brightness-110"
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
