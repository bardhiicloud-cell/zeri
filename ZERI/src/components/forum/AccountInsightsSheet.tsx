import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  BarChart3, Briefcase, Eye, Film, Globe, Heart, Mail, Megaphone, MessageCircle, MousePointerClick, Phone,
  Repeat2, TrendingDown, TrendingUp, Users, X,
} from 'lucide-react';
import { dt } from '@/src/lib/dt';
import { sponsoredLift, summarizeInsights, type InsightBucket, type InsightPost } from '../../lib/forumInsights';
import { fetchReelsByAuthor } from '../../lib/reelsSocial';
import {
  changePct, fetchMyInsights, shortDay, sumOf, topReels,
  type DailyInsights, type InsightsResponse,
} from '../../lib/forumAnalyticsApi';
import { cn } from '../../lib/utils';

type SheetPost = InsightPost & { id?: string; content?: string };

interface Props {
  authorId: string;
  posts: readonly SheetPost[];
  /** Business accounts get the detailed view; personal accounts get the basics and an upgrade prompt. */
  isBusiness: boolean;
  followersCount?: number;
  onUpgrade?: () => void;
  onClose: () => void;
}

const fmt = (n: number) => n.toLocaleString('de-DE');
const pct = (n: number | null) => (n === null ? '—' : `${n.toFixed(1)}%`);
type Period = 7 | 28 | 90;
type Metric = 'profileViews' | 'contactClicks' | 'reelViews';

function Delta({ current, previous }: { current: number; previous: number }) {
  const change = changePct(current, previous);
  if (change === null) return <span className="text-[10px] font-semibold text-slate-400">{dt('pa krahasim')}</span>;
  const up = change >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-[10px] font-black', up ? 'text-emerald-600' : 'text-rose-600')}>
      <Icon className="h-3 w-3" aria-hidden="true" />{up ? '+' : ''}{change.toFixed(0)}%
    </span>
  );
}

function Kpi({ icon: Icon, label, value, current, previous, tone }: { icon: typeof Eye; label: string; value: string; current?: number; previous?: number; tone: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 p-3 dark:border-zinc-700">
      <div className="flex items-center justify-between">
        <span className={cn('flex h-7 w-7 items-center justify-center rounded-lg', tone)}><Icon className="h-3.5 w-3.5" aria-hidden="true" /></span>
        {current !== undefined && previous !== undefined && <Delta current={current} previous={previous} />}
      </div>
      <p className="mt-2 text-xl font-black text-slate-900 dark:text-white">{value}</p>
      <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  );
}

/** Daily bars. Plain SVG: no chart library for seven to ninety bars. */
function Bars({ rows, pick, label }: { rows: readonly DailyInsights[]; pick: (d: DailyInsights) => number; label: string }) {
  const values = rows.map(pick);
  const max = Math.max(1, ...values);
  const total = values.reduce((a, b) => a + b, 0);
  const W = 300, H = 90, gap = rows.length > 40 ? 0.5 : 2;
  const bw = (W - gap * (rows.length - 1)) / rows.length;
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H + 14}`} role="img" aria-label={`${label}: ${total}`} className="w-full">
        {[0.25, 0.5, 0.75].map((f) => <line key={f} x1="0" x2={W} y1={H - H * f} y2={H - H * f} className="stroke-slate-100 dark:stroke-zinc-800" strokeWidth="1" />)}
        {values.map((v, i) => {
          const h = v === 0 ? 1.5 : Math.max(3, (v / max) * H);
          return (
            <rect key={rows[i].day} x={i * (bw + gap)} y={H - h} width={bw} height={h} rx={Math.min(2, bw / 2)}
              className={v === 0 ? 'fill-slate-200 dark:fill-zinc-700' : 'fill-blue-600'}>
              <title>{`${shortDay(rows[i].day)}: ${v}`}</title>
            </rect>
          );
        })}
        <text x="0" y={H + 11} className="fill-slate-400 text-[8px]">{shortDay(rows[0].day)}</text>
        <text x={W} y={H + 11} textAnchor="end" className="fill-slate-400 text-[8px]">{shortDay(rows[rows.length - 1].day)}</text>
      </svg>
    </figure>
  );
}

function Column({ title, tone, icon: Icon, bucket, note, showClicks }: { title: string; tone: string; icon: typeof Megaphone; bucket: InsightBucket; note?: string; showClicks?: boolean }) {
  const rows = [
    { icon: Eye, label: 'Shfaqje', value: fmt(bucket.views) },
    { icon: Heart, label: 'Pëlqime', value: fmt(bucket.likes) },
    { icon: MessageCircle, label: 'Përgjigje', value: fmt(bucket.replies) },
    { icon: Repeat2, label: 'Ripostime', value: fmt(bucket.reposts) },
    // Link clicks exist only for sponsored posts: the server redirect counts them once per visitor per day.
    ...(showClicks ? [{ icon: MousePointerClick, label: 'Klikime në lidhje', value: fmt(bucket.clicks) }] : []),
  ];
  return (
    <section className="rounded-2xl border border-slate-200 p-3 dark:border-zinc-700" aria-label={title}>
      <h3 className={`flex items-center gap-1.5 text-xs font-black uppercase tracking-wider ${tone}`}>
        <Icon className="h-3.5 w-3.5" aria-hidden="true" /> {title}
      </h3>
      <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{bucket.posts} <span className="text-xs font-bold text-slate-500">{dt('postime')}</span></p>
      <dl className="mt-2 space-y-1">
        {rows.map(({ icon: RowIcon, label, value }) => (
          <div key={label} className="flex items-center justify-between text-xs">
            <dt className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400"><RowIcon className="h-3 w-3" aria-hidden="true" />{dt(label)}</dt>
            <dd className="font-black text-slate-900 dark:text-white">{value}</dd>
          </div>
        ))}
        <div className="flex items-center justify-between border-t border-slate-100 pt-1 text-xs dark:border-zinc-800">
          <dt className="text-slate-500 dark:text-slate-400">{dt('Shkalla e angazhimit')}</dt>
          <dd className="font-black text-slate-900 dark:text-white">{pct(bucket.engagementRate)}</dd>
        </div>
        {showClicks && (
          <div className="flex items-center justify-between text-xs">
            <dt className="text-slate-500 dark:text-slate-400">{dt('Shkalla e klikimeve (CTR)')}</dt>
            <dd className="font-black text-slate-900 dark:text-white">{pct(bucket.ctr)}</dd>
          </div>
        )}
      </dl>
      {note && <p className="mt-2 text-[11px] leading-snug text-slate-500 dark:text-slate-400">{note}</p>}
    </section>
  );
}

const METRICS: { id: Metric; label: string; pick: (d: DailyInsights) => number }[] = [
  { id: 'profileViews', label: 'Shikime të profilit', pick: (d) => d.profileViews },
  { id: 'contactClicks', label: 'Klikime kontakti', pick: (d) => d.contactClicks },
  { id: 'reelViews', label: 'Shikime Reels', pick: (d) => d.reelViews },
];

/** Account insights for the signed-in author. Business accounts see the full picture. */
export function AccountInsightsSheet({ authorId, posts, isBusiness, followersCount = 0, onUpgrade, onClose }: Props) {
  const insights = useMemo(() => summarizeInsights(posts, authorId), [posts, authorId]);
  const lift = sponsoredLift(insights);
  const [reels, setReels] = useState<{ id: string; caption: string; likes: number }[] | 'error' | null>(null);
  const [period, setPeriod] = useState<Period>(28);
  const [metric, setMetric] = useState<Metric>('profileViews');
  const [series, setSeries] = useState<InsightsResponse | 'error' | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchReelsByAuthor(authorId, true)
      .then((list) => { if (!cancelled) setReels(list.map((r) => ({ id: r.id, caption: r.caption, likes: r.likedBy.length }))); })
      .catch(() => { if (!cancelled) setReels('error'); });
    return () => { cancelled = true; };
  }, [authorId]);

  useEffect(() => {
    if (!isBusiness) return;
    let cancelled = false;
    setSeries(null);
    fetchMyInsights(period)
      .then((data) => { if (!cancelled) setSeries(data); })
      .catch(() => { if (!cancelled) setSeries('error'); });
    return () => { cancelled = true; };
  }, [isBusiness, period]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = previous; };
  }, [onClose]);

  const data = series && series !== 'error' ? series : null;
  const cur = data?.current ?? [];
  const prev = data?.previous ?? [];
  const metricDef = METRICS.find((m) => m.id === metric)!;
  const topPosts = useMemo(
    () => [...posts]
      .filter((p) => p.authorId === authorId)
      .map((p) => ({ ...p, score: (Array.isArray(p.likes) ? p.likes.length : 0) + (Array.isArray(p.comments) ? p.comments.length : 0) + (Array.isArray(p.reposts) ? p.reposts.length : 0) }))
      .sort((a, b) => b.score - a.score || (b.viewCount ?? 0) - (a.viewCount ?? 0))
      .slice(0, 5),
    [posts, authorId],
  );
  const reelRank = data && reels && reels !== 'error' ? topReels(cur) : [];
  const contactTotal = sumOf(cur, (d) => d.contactClicks);

  return createPortal(
    <div className="fixed inset-0 z-[12000] flex items-end justify-center bg-black/60 md:backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={dt('Statistikat e llogarisë')}
        className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl dark:bg-zinc-900 sm:rounded-3xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-black text-slate-900 dark:text-white">
            <BarChart3 className="h-5 w-5 text-blue-600" aria-hidden="true" /> {dt('Statistikat e llogarisë')}
            {isBusiness && <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-black uppercase text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"><Briefcase className="h-3 w-3" aria-hidden="true" />{dt('Biznes')}</span>}
          </h2>
          <button type="button" onClick={onClose} aria-label={dt('Mbyll')} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {isBusiness ? (
          <>
            <div role="radiogroup" aria-label={dt('Periudha')} className="mb-3 inline-flex rounded-xl bg-slate-100 p-0.5 dark:bg-zinc-800">
              {([7, 28, 90] as Period[]).map((d) => (
                <button key={d} type="button" role="radio" aria-checked={period === d} onClick={() => setPeriod(d)}
                  className={cn('min-h-8 rounded-[10px] px-3 text-[11px] font-bold', period === d ? 'bg-white text-blue-700 shadow-sm dark:bg-zinc-700 dark:text-blue-200' : 'text-slate-500 dark:text-slate-400')}>
                  {d} {dt('ditë')}
                </button>
              ))}
            </div>

            {series === null && <p className="py-8 text-center text-xs font-semibold text-slate-500">{dt('Po ngarkohet…')}</p>}
            {series === 'error' && <p className="rounded-2xl bg-rose-50 p-3 text-xs font-semibold text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">{dt('Statistikat e periudhës nuk u ngarkuan. Provoni përsëri.')}</p>}

            {data && (
              <>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <Kpi icon={Eye} label={dt('Shikime të profilit')} tone="bg-blue-50 text-blue-600 dark:bg-blue-950/40" value={fmt(sumOf(cur, (d) => d.profileViews))} current={sumOf(cur, (d) => d.profileViews)} previous={sumOf(prev, (d) => d.profileViews)} />
                  <Kpi icon={Users} label={dt('Vizitorë (ditor, të ndryshëm)')} tone="bg-violet-50 text-violet-600 dark:bg-violet-950/40" value={fmt(sumOf(cur, (d) => d.profileViewers))} current={sumOf(cur, (d) => d.profileViewers)} previous={sumOf(prev, (d) => d.profileViewers)} />
                  <Kpi icon={MousePointerClick} label={dt('Klikime kontakti')} tone="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40" value={fmt(contactTotal)} current={contactTotal} previous={sumOf(prev, (d) => d.contactClicks)} />
                  <Kpi icon={Film} label={dt('Shikime Reels')} tone="bg-rose-50 text-rose-600 dark:bg-rose-950/40" value={fmt(sumOf(cur, (d) => d.reelViews))} current={sumOf(cur, (d) => d.reelViews)} previous={sumOf(prev, (d) => d.reelViews)} />
                  <Kpi icon={Users} label={dt('Ndjekës tani')} tone="bg-sky-50 text-sky-600 dark:bg-sky-950/40" value={fmt(followersCount)} />
                  <Kpi icon={Heart} label={dt('Shkalla e angazhimit')} tone="bg-amber-50 text-amber-600 dark:bg-amber-950/40" value={pct(insights.organic.engagementRate ?? insights.total.engagementRate)} />
                </div>

                <section className="mt-3 rounded-2xl border border-slate-200 p-3 dark:border-zinc-700" aria-label={dt('Grafiku ditor')}>
                  <div role="radiogroup" aria-label={dt('Metrika')} className="mb-2 flex flex-wrap gap-1">
                    {METRICS.map((m) => (
                      <button key={m.id} type="button" role="radio" aria-checked={metric === m.id} onClick={() => setMetric(m.id)}
                        className={cn('rounded-full px-3 py-1 text-[11px] font-bold', metric === m.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-slate-300')}>
                        {dt(m.label)}
                      </button>
                    ))}
                  </div>
                  <Bars rows={cur} pick={metricDef.pick} label={dt(metricDef.label)} />
                  {sumOf(cur, metricDef.pick) === 0 && <p className="mt-1 text-center text-[11px] text-slate-500 dark:text-slate-400">{dt('Ende nuk ka të dhëna për këtë periudhë. Numërimi nis nga momenti që llogaria është e biznesit.')}</p>}
                </section>

                <section className="mt-3 rounded-2xl border border-slate-200 p-3 dark:border-zinc-700" aria-label={dt('Veprimet në profil')}>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">{dt('Veprimet në profil')}</h3>
                  <div className="mt-2 space-y-2">
                    {([
                      { label: 'Email', icon: Mail, n: sumOf(cur, (d) => d.contactEmail) },
                      { label: 'Telefono', icon: Phone, n: sumOf(cur, (d) => d.contactPhone) },
                      { label: 'Faqja e internetit', icon: Globe, n: sumOf(cur, (d) => d.contactWebsite) },
                    ]).map(({ label, icon: Icon, n }) => (
                      <div key={label} className="flex items-center gap-2 text-xs">
                        <Icon className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                        <span className="w-32 shrink-0 text-slate-600 dark:text-slate-300">{dt(label)}</span>
                        <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800">
                          <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${contactTotal ? (n / contactTotal) * 100 : 0}%` }} />
                        </span>
                        <span className="w-8 text-right font-black text-slate-900 dark:text-white">{n}</span>
                      </div>
                    ))}
                  </div>
                </section>
              </>
            )}
          </>
        ) : (
          <div className="mb-3 flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950/30">
            <Briefcase className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" aria-hidden="true" />
            <div className="text-xs">
              <p className="font-black text-slate-900 dark:text-white">{dt('Dëshiron statistika të detajuara?')}</p>
              <p className="mt-0.5 leading-snug text-slate-600 dark:text-slate-300">{dt('Kalo në llogari biznesi për shikimet e profilit, klikimet e kontaktit, shikimet e Reels dhe krahasim me periudhën e kaluar.')}</p>
              {onUpgrade && (
                <button type="button" onClick={() => { onClose(); onUpgrade(); }} className="mt-2 rounded-lg bg-blue-700 px-3 py-1.5 text-[11px] font-black text-white hover:bg-blue-800">
                  {dt('Kalo në llogari biznesi')}
                </button>
              )}
            </div>
          </div>
        )}

        <h3 className="mt-4 text-xs font-black uppercase tracking-wider text-slate-500">{dt('Përmbajtja')}</h3>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <Column title={dt('Organike')} tone="text-emerald-600" icon={BarChart3} bucket={insights.organic} />
          <Column
            title={dt('Të sponsorizuara')} tone="text-amber-600" icon={Megaphone} bucket={insights.sponsored}
            showClicks
            note={insights.sponsored.posts === 0 ? dt('Nuk keni postime të sponsorizuara. Kërkoni reklamë nga menyja e postimit.') : undefined}
          />
        </div>

        <div className="mt-3 rounded-2xl bg-slate-50 p-3 text-xs text-slate-700 dark:bg-zinc-800 dark:text-slate-200">
          <p className="font-black">{dt('Krahasim')}</p>
          <p className="mt-1 leading-relaxed">
            {lift === null
              ? dt('Krahasimi shfaqet kur keni shfaqje si në postime organike ashtu edhe në ato të sponsorizuara.')
              : `${dt('Postimet e sponsorizuara kanë')} ${Math.abs(lift).toFixed(0)}% ${lift >= 0 ? dt('më shumë') : dt('më pak')} ${dt('angazhim për shfaqje se ato organike.')}`}
          </p>
        </div>

        {topPosts.length > 0 && (
          <section className="mt-3 rounded-2xl border border-slate-200 p-3 dark:border-zinc-700" aria-label={dt('Postimet më të mira')}>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">{dt('Postimet më të mira')}</h3>
            <ol className="mt-2 space-y-2">
              {topPosts.map((p, i) => (
                <li key={p.id ?? i} className="flex items-center gap-2 text-xs">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 font-black text-slate-600 dark:bg-zinc-800 dark:text-slate-300">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-200">{(p.content ?? '').trim().slice(0, 70) || dt('Postim me media')}</span>
                  <span className="shrink-0 text-[11px] font-bold text-slate-500">
                    {fmt(p.viewCount ?? 0)} <Eye className="inline h-3 w-3" aria-hidden="true" /> · {Array.isArray(p.likes) ? p.likes.length : 0} <Heart className="inline h-3 w-3" aria-hidden="true" />
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}

        <section className="mt-3 rounded-2xl border border-slate-200 p-3 dark:border-zinc-700" aria-label={dt('Reels')}>
          <h3 className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-500"><Film className="h-3.5 w-3.5" aria-hidden="true" />{dt('Reels')}</h3>
          {reels === null && <p className="mt-2 text-xs text-slate-500">{dt('Po ngarkohet…')}</p>}
          {reels === 'error' && <p className="mt-2 text-xs text-slate-500">{dt('Nuk u ngarkuan.')}</p>}
          {reels && reels !== 'error' && (
            <>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{reels.length} Reels · {reels.reduce((n, r) => n + r.likes, 0)} {dt('pëlqime')}</p>
              {isBusiness && reelRank.length > 0 && (
                <ol className="mt-2 space-y-1.5">
                  {reelRank.map((r, i) => {
                    const reel = reels.find((x) => x.id === r.id);
                    return (
                      <li key={r.id} className="flex items-center gap-2 text-xs">
                        <span className="w-4 font-black text-slate-400">{i + 1}</span>
                        <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-200">{reel?.caption?.trim() || dt('Reel pa përshkrim')}</span>
                        <span className="shrink-0 font-black text-slate-900 dark:text-white">{fmt(r.views)} <Eye className="inline h-3 w-3 text-slate-400" aria-hidden="true" /></span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </>
          )}
        </section>

        <p className="mt-3 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
          {dt('Të gjitha shifrat janë numërime reale të bëra nga serveri; asgjë nuk vlerësohet. Shikimet dhe klikimet e llogarisë tuaj nuk numërohen. Të dhëna për moshën, gjininë ose qytetin e vizitorëve nuk mblidhen, prandaj nuk shfaqen.')}
        </p>
      </div>
    </div>,
    document.body,
  );
}
