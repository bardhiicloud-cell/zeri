import React, { useState, useMemo, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { dt } from '@/src/lib/dt';
import {
  Newspaper, Search, Calendar, MapPin, Share2,
  ArrowRight, Link2, ArrowLeft, Clock3, Mail, Copy, Info, TrendingUp, Video, Play,
  Sun, Moon,
} from 'lucide-react';
import { useThemePreference } from '../lib/themePreference';
import { MunicipalityShield } from '../components/MunicipalityShield';
import { cn } from '../lib/utils';
import { collection, onSnapshot, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import AdBanner from '../components/AdBanner.tsx';
import { AnnouncementBanner } from '../components/AnnouncementBanner';
import { LiveNoticesFeed } from '../components/news/LiveNoticesFeed';
import { ShareSheet } from '../components/ShareSheet.tsx';
import toast from 'react-hot-toast';
import { useStore, type AdCampaign } from '../lib/store';
import { isSpecificScope, scopeKey } from '../lib/municipalityScope';
import { NEWS_CATEGORIES } from '../lib/newsCategories';
import { DEMO_NEWS } from '../lib/demoNews';

interface NewsArticle {
  id: string;
  title: string;
  municipality: string;
  category: string;
  date: string;
  author: string;
  readTime: string;
  summary: string;
  content: string;
  imageUrl?: string;
  videoUrl?: string;
  relatedReportIds?: string[];
  createdAt?: string;
  isDemo?: boolean;
  position?: 'featured' | 'feed' | 'sidebar';
}

export default function LajmePage() {
  const ARCHIVE_PAGE_SIZE = 9;
  const location = useLocation();
  const navigate = useNavigate();
  const userMunicipality = useStore((state) => state.userMunicipality);
  const reports = useStore((state) => state.reports);
  const ads = useStore((state) => state.ads);
  const incrementAdClick = useStore((state) => state.incrementAdClick);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStream, setSelectedStream] = useState<'all' | 'news' | 'notices'>('all');
  const [selectedTopic, setSelectedTopic] = useState('all');
  const [archivePage, setArchivePage] = useState(1);
  /**
   * `linked` is the editorial value that was missing entirely: a reader can ask
   * "show me only the notices that are attached to citizen reports", and a
   * further choice between the ones where the municipality has responded and
   * the ones still waiting. Without it the `relatedReportIds` field was stored
   * and never used for anything a citizen could see.
   */
  const [resolutionFilter, setResolutionFilter] = useState<'all' | 'resolved' | 'unresolved'>('all');
  const [activeArticle, setActiveArticle] = useState<NewsArticle | null>(null);
  const [sharingArticle, setSharingArticle] = useState<NewsArticle | null>(null);
  const [adminNews, setAdminNews] = useState<NewsArticle[]>([]);
  const [scopeToMine, setScopeToMine] = useState(false);
  const [newsLoadError, setNewsLoadError] = useState(false);

  /**
   * Only published articles are read, and only the newest batch.
   *
   * `onSnapshot(collection(db, 'newsArticles'))` delivered every article ever
   * written — including drafts meant for editorial review — to every reader who
   * opened the page, and kept a live listener on all of them. The filter was
   * applied in the browser after the fact, so the drafts were already on the
   * wire by then. Filtering in the query means unpublished work is never sent.
   */
  useEffect(() => onSnapshot(
    query(collection(db, 'newsArticles'), where('published', '==', true), orderBy('createdAt', 'desc'), limit(60)),
    snapshot => {
      setNewsLoadError(false);
      setAdminNews(snapshot.docs.map(item => ({ id: item.id, ...item.data() } as NewsArticle)));
    },
    error => {
      console.error('Lajmet e publikuara nuk u ngarkuan:', error);
      setNewsLoadError(true);
      setAdminNews([]);
    }
  ), []);

  const allNews = import.meta.env.DEV ? [...DEMO_NEWS, ...adminNews] : adminNews;

  /**
   * A notice is "resolved" when every report it is attached to has been closed.
   * Reports are matched by tracking id as well as document id, because the id
   * an editor picks in the admin panel is the Firestore key, while the citizen
   * knows the ZQ- number printed on their receipt.
   */
  const answerStatusFor = useMemo(() => {
    return (article: NewsArticle): 'resolved' | 'unresolved' | null => {
      const ids = article.relatedReportIds ?? [];
      if (ids.length === 0) return null;
      const linked = reports.filter(
        (report) => ids.includes(report.id) || (report.trackingId && ids.includes(report.trackingId))
      );
      if (linked.length === 0) return 'unresolved';
      return linked.every((report) => report.status === 'Resolved') ? 'resolved' : 'unresolved';
    };
  }, [reports]);

  /**
   * Deep link from the announcement banner: `/lajme?njoftim=<id>` opens that
   * notice immediately. Before this the banner's "lexo më shumë" had to be a
   * link to a page where the citizen then had to find the article themselves,
   * which is not "read more" by any definition.
   */
  useEffect(() => {
    const requested = new URLSearchParams(location.search).get('njoftim');
    if (!requested) {
      setActiveArticle(null);
      return;
    }
    const match = allNews.find((item) => item.id === requested);
    if (match) setActiveArticle(match);
  }, [location.search, allNews]);

  const mineMunicipality = isSpecificScope(userMunicipality) ? scopeKey(userMunicipality) : null;
  const categoryOptions = useMemo(
    () => Array.from(new Set([...NEWS_CATEGORIES, ...allNews.map(item => item.category).filter(Boolean)])),
    [allNews]
  );
  const editorialArticles = allNews.filter(item => item.category !== 'Njoftim Zyrtar');
  const officialNotices = allNews.filter(item => item.category === 'Njoftim Zyrtar');
  const videoArticles = allNews.filter(item => Boolean(item.videoUrl)).slice(0, 3);

  const filteredNews = useMemo(() => {
    return allNews.filter(item => {
      const isOfficialNotice = item.category === 'Njoftim Zyrtar';
      const matchStream = selectedStream === 'all'
        || (selectedStream === 'news' && !isOfficialNotice)
        || (selectedStream === 'notices' && isOfficialNotice);
      const matchTopic = selectedTopic === 'all' || item.category === selectedTopic;
      const query = searchQuery.toLowerCase();
      const matchSearch = !query ||
                          item.title.toLowerCase().includes(query) ||
                          item.summary.toLowerCase().includes(query) ||
                          item.municipality.toLowerCase().includes(query);
      const matchScope = !scopeToMine || !mineMunicipality || item.municipality === mineMunicipality;
      const answerStatus = answerStatusFor(item);
      const matchResolution =
        resolutionFilter === 'all' ||
        (resolutionFilter === 'resolved' && answerStatus === 'resolved') ||
        (resolutionFilter === 'unresolved' && answerStatus === 'unresolved');
      return matchStream && matchTopic && matchSearch && matchScope && matchResolution;
    });
  }, [allNews, searchQuery, selectedStream, selectedTopic, scopeToMine, mineMunicipality, resolutionFilter, answerStatusFor]);

  const handleShare = (item: NewsArticle) => {
    setSharingArticle(item);
  };

  const openArticle = (item: NewsArticle) => {
    setActiveArticle(item);
    navigate({ pathname: '/lajme', search: `?njoftim=${encodeURIComponent(item.id)}` });
  };

  const closeArticle = () => {
    setActiveArticle(null);
    navigate('/lajme');
  };

  const leadArticle = filteredNews.find(item => item.position === 'featured') ?? filteredNews[0];
  const feedArticles = leadArticle ? filteredNews.filter(item => item.id !== leadArticle.id) : filteredNews;
  const latestArticles = feedArticles.slice(0, 3);
  const trendingArticles = [...feedArticles].filter(item => item.position === 'sidebar').concat(feedArticles.filter(item => item.position !== 'sidebar')).slice(0, 5);
  const archivePageCount = Math.max(1, Math.ceil(filteredNews.length / ARCHIVE_PAGE_SIZE));
  const archiveArticles = filteredNews.slice(
    (archivePage - 1) * ARCHIVE_PAGE_SIZE,
    archivePage * ARCHIVE_PAGE_SIZE
  );
  const pageAds = useMemo(() => {
    const selectedMunicipality = isSpecificScope(mineMunicipality)
      ? scopeKey(mineMunicipality)
      : undefined;
    return ads.filter(ad => {
      const section = ad.section?.toLowerCase();
      const isNewsCampaign = section === 'lajme' || section === 'news' || section === 'all' || section === 'global';
      const municipalityMatches = ad.target === 'Nacionale'
        || (selectedMunicipality !== undefined && scopeKey(ad.target) === selectedMunicipality);
      return ad.status === 'active' && isNewsCampaign && municipalityMatches;
    }).slice(0, 4);
  }, [ads, mineMunicipality]);
  const demoPromotions = import.meta.env.DEV ? [
    { id: 'demo-promo-community', title: 'Promovoni biznesin tuaj në komunitet', description: 'Një hapësirë e dallueshme për biznese dhe shërbime lokale.', imageUrl: DEMO_NEWS[0].imageUrl },
    { id: 'demo-promo-mobility', title: 'Zgjidhje praktike për lëvizje në qytet', description: 'Shfaqni shërbimet që i ndihmojnë qytetarët çdo ditë.', imageUrl: DEMO_NEWS[1].imageUrl },
    { id: 'demo-promo-digital', title: 'Shërbime digjitale për qytetarë', description: 'Prezantoni produktin ose platformën tuaj në mënyrë të qartë.', imageUrl: DEMO_NEWS[7].imageUrl },
    { id: 'demo-promo-health', title: 'Kujdes dhe shërbime për familjen', description: 'Promovim i qartë me informacion të dobishëm për komunitetin.', imageUrl: DEMO_NEWS[4].imageUrl },
  ] : [];
  const promotionalCampaigns = pageAds.length > 0 ? pageAds : demoPromotions;
  const streamOptions: Array<{ id: typeof selectedStream; label: string; count: number }> = [
    { id: 'all', label: 'Të gjitha', count: allNews.length },
    { id: 'news', label: 'Lajmet', count: editorialArticles.length },
    { id: 'notices', label: 'Njoftimet', count: officialNotices.length },
  ];

  /**
   * The single category rail.
   *
   * These used to be split across two controls: a type rail (all/news/notices)
   * plus a separate "Filtro sipas temës" dropdown on its own row. The dropdown
   * cost a whole vertical row and two clicks to pick a topic. Both are folded
   * into one horizontal rail, so every filter is one click and the header no
   * longer pushes the first headline below the fold.
   *
   * "Lokale" is not a stored category — it is the municipality scope — so it is
   * handled as its own entry that toggles `scopeToMine`.
   */
  const categoryRail: Array<{
    id: string;
    label: string;
    count: number;
    kind: 'stream' | 'topic' | 'local';
  }> = [
    ...streamOptions.map(({ id, label, count }) => ({
      id: `stream:${id}`,
      label,
      count,
      kind: 'stream' as const,
    })),
    {
      id: 'local',
      label: 'Lokale',
      count: mineMunicipality
        ? allNews.filter((item) => scopeKey(item.municipality) === mineMunicipality).length
        : allNews.length,
      kind: 'local' as const,
    },
    ...categoryOptions
      .filter((category) => category !== 'Njoftim Zyrtar')
      .map((category) => ({
        id: `topic:${category}`,
        label: category,
        count: allNews.filter((item) => item.category === category).length,
        kind: 'topic' as const,
      })),
  ];

  /** Which rail entry is currently active, derived from the filter state. */
  const activeRailId = scopeToMine
    ? 'local'
    : selectedTopic !== 'all'
      ? `topic:${selectedTopic}`
      : `stream:${selectedStream}`;

  const selectRailItem = (item: (typeof categoryRail)[number]) => {
    if (item.kind === 'local') {
      setScopeToMine((current) => !current);
      setSelectedStream('all');
      setSelectedTopic('all');
      return;
    }
    setScopeToMine(false);
    if (item.kind === 'stream') {
      setSelectedStream(item.id.replace('stream:', '') as typeof selectedStream);
      setSelectedTopic('all');
    } else {
      setSelectedTopic(item.id.replace('topic:', ''));
      setSelectedStream('news');
    }
  };

  /**
   * Most-read ordering for the right rail.
   *
   * The read counter is not available for every item, so this sorts by votes and
   * view count where present and falls back to recency. The intent is "what is
   * the community actually looking at", which votes approximate well enough for
   * a rail that is a convenience rather than a ranking feature.
   */
  const mostReadArticles = useMemo(
    () => [...allNews]
      .sort((a, b) => {
        // Votes/views are optional on the article type, so they are read through
        // a lookup that tolerates their absence rather than casting the object.
        const metric = (n: typeof allNews[number], key: string) => {
          const value = (n as unknown as Record<string, unknown>)[key];
          return typeof value === 'number' ? value : 0;
        };
        const score = (n: typeof allNews[number]) => metric(n, 'votes') * 3 + metric(n, 'views');
        return score(b) - score(a);
      })
      .slice(0, 5),
    [allNews]
  );

  useEffect(() => {
    setArchivePage(1);
  }, [selectedStream, selectedTopic, searchQuery, scopeToMine, resolutionFilter]);

  useEffect(() => {
    if (archivePage > archivePageCount) setArchivePage(archivePageCount);
  }, [archivePage, archivePageCount]);

  const clearNewsFilters = () => {
    setSelectedStream('all');
    setSelectedTopic('all');
    setResolutionFilter('all');
    setSearchQuery('');
    setScopeToMine(false);
    setArchivePage(1);
  };

  const openPromotion = (campaign: AdCampaign) => {
    const url = typeof campaign.targetUrl === 'string' ? campaign.targetUrl.trim() : '';
    if (!url || url === '#') return;
    incrementAdClick(campaign.id);
    window.open(url, '_blank', 'noopener,noreferrer');
  };
  const articleUrl = activeArticle
    ? `${window.location.origin}/lajme?njoftim=${encodeURIComponent(activeArticle.id)}`
    : '';

  const copyArticleLink = async () => {
    if (!articleUrl) return;
    try {
      await navigator.clipboard.writeText(articleUrl);
      toast.success('Lidhja u kopjua.');
    } catch (error) {
      console.error('Lidhja e lajmit nuk u kopjua:', error);
      toast.error('Lidhja nuk u kopjua. Provoni përsëri.');
    }
  };

  return (
    <div className="page-shell min-h-screen bg-slate-50 text-slate-800 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-[1280px] space-y-7 px-4 pb-14 pt-3 sm:px-7 sm:pt-5 lg:px-10">
        <header className="border-b border-slate-200 bg-white dark:border-white/10 dark:bg-slate-950">
          {/*
            Brand row only.

            The two shortcut links that used to sit here ("Të fundit", "Lajme
            lokale") have been removed: they duplicated the category rail below
            and pushed the brand off-centre, which made a first-time reader
            wonder whether they were categories, tabs or something else. Their
            two jobs — recency and locality — are now the rail's "Të gjitha" and
            "Lokale" entries, one click away in the same place as every other
            filter.
          */}
          <div className="relative flex min-h-12 flex-wrap items-center justify-between gap-3 border-b border-slate-100 py-2 dark:border-white/10">
            <Link to="/" className="inline-flex items-center gap-2 text-sm font-black tracking-tight text-slate-950 dark:text-white sm:mx-auto lg:absolute lg:left-1/2 lg:-translate-x-1/2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-700 text-white"><Newspaper className="h-4 w-4" aria-hidden="true" /></span>
              Zëri i Qytetarëve <span className="font-medium text-blue-700 dark:text-blue-300">/ {dt('Lajme')}</span>
            </Link>
            <div className="ml-auto flex items-center gap-2">
              <ThemeToggle />
              <Link to="/" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3.5 text-xs font-bold text-slate-600 transition hover:border-blue-300 hover:text-blue-700 dark:border-white/10 dark:text-slate-300">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {dt('Kthehu te platforma')}
              </Link>
            </div>
          </div>

          <div className="flex flex-col gap-4 py-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-blue-700 dark:text-blue-300">Informim publik · Komuniteti · Transparencë</p>
              <h1 className="mt-2 font-serif text-4xl font-black tracking-tight text-slate-950 dark:text-white sm:text-5xl">{dt('Lajmet kryesore')}</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-500 dark:text-slate-400">{dt('Përditësime të rëndësishme për qytetarët, të renditura sipas temës dhe komunës.')}</p>
            </div>
          </div>

          {/*
            Integrated filter bar.

            One row, three controls: the category rail scrolls horizontally, the
            search field filters by title/topic/municipality, and "Filtra" opens
            the advanced panel. The old layout spent a separate vertical row on a
            "Filtro sipas temës" dropdown that required two clicks for what the
            rail now does in one, and cost more than 50% of the header height.
          */}
          <div className="space-y-3 border-y border-slate-100 py-3 dark:border-white/10">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              {/* Category rail: every filter is a pill, one click each. */}
              <nav
                aria-label={dt('Kategoritë e publikimeve')}
                className="-mx-1 flex flex-1 items-center gap-2 overflow-x-auto px-1 pb-1 scrollbar-none [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {categoryRail.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectRailItem(item)}
                    aria-pressed={activeRailId === item.id}
                    className={cn(
                      'inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-xs font-bold transition-colors',
                      activeRailId === item.id
                        ? 'bg-blue-700 text-white shadow-sm dark:bg-blue-500'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                    )}
                  >
                    {item.kind === 'local' && <MapPin className="h-3.5 w-3.5" aria-hidden="true" />}
                    {dt(item.label)}
                    <span className={cn(
                      'rounded-full px-1.5 py-0.5 text-[10px] tabular-nums',
                      activeRailId === item.id ? 'bg-white/15 text-white' : 'bg-white text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                    )}>{item.count}</span>
                  </button>
                ))}
              </nav>

              {/* Search + advanced filters, kept on the same row as the rail. */}
              <div className="flex shrink-0 items-center gap-2">
                <div className="relative flex-1 lg:w-64">
                  <input
                    type="search"
                    aria-label={dt('Kërko lajme dhe njoftime')}
                    placeholder={dt('Kërko...')}
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    className="min-h-10 w-full rounded-full border border-slate-200 bg-slate-50 pl-9 pr-4 text-xs outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-white/10 dark:bg-slate-900 dark:text-white"
                  />
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                </div>
              </div>
            </div>
          </div>

          <details className="border-t border-slate-100 py-2.5 dark:border-white/10">
            <summary className="flex min-h-9 cursor-pointer list-none items-center gap-2 text-[11px] font-bold text-slate-500 marker:hidden">
              <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
              {dt('Filtra të avancuar')}
              {resolutionFilter !== 'all' && <span className="h-1.5 w-1.5 rounded-full bg-blue-600" aria-label={dt('Filtra aktivë')} />}
            </summary>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="mr-1 text-[10px] font-black uppercase tracking-wider text-slate-400">{dt('Përgjigjja e komunës')}</span>
              {([
                { id: 'all', label: 'Të gjitha' },
                { id: 'resolved', label: 'Të zgjidhura' },
                { id: 'unresolved', label: 'Në pritje' },
              ] as const).map(option => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setResolutionFilter(option.id)}
                  aria-pressed={resolutionFilter === option.id}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-[11px] font-bold transition-colors',
                    resolutionFilter === option.id
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                  )}
                >
                  {dt(option.label)}
                </button>
              ))}
              {mineMunicipality && (
                <button
                  type="button"
                  onClick={() => setScopeToMine(value => !value)}
                  aria-pressed={scopeToMine}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold sm:ml-auto',
                    scopeToMine ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300'
                  )}
                >
                  <MapPin className="h-3.5 w-3.5" aria-hidden="true" /> {dt('Vetëm')} {mineMunicipality}
                </button>
              )}
            </div>
          </details>
        </header>

        <AnnouncementBanner />
        {import.meta.env.DEV && (
          // Prototype notice, deliberately quiet.
          //
          // This used to be a full-width amber panel with a border and heavy
          // padding, which sat above the first headline and read as more
          // important than the news itself. It is now a single low line: the
          // information is still there for anyone who reads it, but it no longer
          // competes with the content it is describing.
          <div className="flex items-center gap-2 text-[11px] leading-snug text-slate-400 dark:text-slate-500" role="status">
            <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{dt('Pamje prototipi: artikujt me etiketën DEMO janë shembuj të sajuar për testim dhe nuk publikohen për qytetarët.')}</span>
          </div>
        )}

        <section className="grid gap-x-7 gap-y-8 lg:grid-cols-[minmax(0,1fr)_280px] xl:grid-cols-[230px_minmax(0,1fr)_280px]" aria-label="Lajmet kryesore dhe lajmet e fundit">
          <aside className="hidden xl:order-1 xl:block">
            <div className="mb-3 flex items-center justify-between border-b border-slate-200 pb-2 dark:border-white/10">
              <h2 className="font-serif text-lg font-black text-slate-950 dark:text-white">Të veçuara</h2>
              <span aria-hidden="true" className="text-xl font-black text-slate-300">/</span>
            </div>
            <div className="divide-y divide-slate-200 dark:divide-white/10">
              {latestArticles.map(news => (
                <button key={news.id} type="button" onClick={() => openArticle(news)} className="group block w-full py-3 text-left">
                  {news.imageUrl && <img src={news.imageUrl} alt="" loading="lazy" className="mb-3 aspect-[16/9] w-full rounded-lg object-cover" />}
                  <span className="block text-[10px] font-bold text-emerald-700 dark:text-emerald-400">{news.category}</span>
                  <span className="mt-1 block text-sm font-extrabold leading-snug text-slate-950 group-hover:text-blue-700 dark:text-white dark:group-hover:text-blue-300">{news.title}</span>
                  <span className="mt-1.5 block text-[10px] text-slate-400">{news.municipality} · {news.date}</span>
                </button>
              ))}
              {!latestArticles.length && !leadArticle && !newsLoadError && <p className="py-6 text-xs leading-relaxed text-slate-500">Lajmet e reja të redaksisë do të shfaqen këtu.</p>}
            </div>
          </aside>

          <div className="order-1 min-w-0 xl:order-2">
            <div className="mb-3 flex items-center justify-between border-b border-slate-200 pb-2 dark:border-white/10">
              <h2 className="font-serif text-lg font-black text-slate-950 dark:text-white">Lajmet e fundit</h2>
              <span aria-hidden="true" className="text-xl font-black text-slate-300">/</span>
            </div>
            {leadArticle ? (
              <button type="button" onClick={() => openArticle(leadArticle)} className="group block w-full text-left">
                <div className="relative aspect-[16/9] overflow-hidden rounded-lg bg-slate-200 dark:bg-slate-800">
                  {leadArticle.imageUrl ? (
                    <img src={leadArticle.imageUrl} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.025]" />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-slate-300 via-blue-100 to-blue-300 dark:from-slate-800 dark:via-blue-950 dark:to-slate-700" />
                  )}
                  <span className="absolute left-3 top-3 rounded bg-rose-600 px-2 py-1 text-[10px] font-black uppercase text-white">{leadArticle.category}</span>
                  {leadArticle.isDemo && <span className="absolute right-3 top-3 rounded-full border border-amber-200 bg-amber-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-amber-900">Demo</span>}
                </div>
                <h3 className="mt-4 font-serif text-2xl font-black leading-tight text-slate-950 transition-colors group-hover:text-blue-700 dark:text-white dark:group-hover:text-blue-300 sm:text-3xl">{leadArticle.title}</h3>
                <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{leadArticle.summary}</p>
                <p className="mt-3 text-xs font-bold text-rose-600 dark:text-rose-400">{leadArticle.municipality} · {leadArticle.date}</p>
                {feedArticles[0] && (
                  <span className="mt-4 flex items-center gap-2 border-y border-slate-200 py-3 text-xs font-extrabold text-slate-800 transition-colors hover:text-blue-700 dark:border-white/10 dark:text-slate-200 dark:hover:text-blue-300">
                    <span className="text-rose-600">›</span>{feedArticles[0].title}
                  </span>
                )}
              </button>
            ) : (
              <div className="flex min-h-64 flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-white px-6 py-10 text-center dark:border-white/10 dark:bg-slate-900">
                <Newspaper className="h-9 w-9 text-slate-300 dark:text-slate-600" aria-hidden="true" />
                <h3 className="mt-3 font-serif text-lg font-black text-slate-800 dark:text-slate-100">
                  {newsLoadError ? 'Lajmet nuk u ngarkuan' : 'Lajmet e reja së shpejti'}
                </h3>
                <p className="mt-1 max-w-sm text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  {newsLoadError ? 'Nuk mundëm të marrim publikimet nga serveri. Ju lutemi provoni përsëri më vonë.' : 'Publikimet e redaksisë do të shfaqen këtu sapo të jenë gati.'}
                </p>
              </div>
            )}
          </div>

          <aside className="hidden lg:col-start-2 lg:row-start-1 lg:order-2 lg:block xl:col-start-3 xl:order-3">
            <div className="mb-3 flex items-center justify-between border-b border-slate-200 pb-2 dark:border-white/10">
              <h2 className="font-serif text-lg font-black text-slate-950 dark:text-white">Në fokus</h2>
              <span aria-hidden="true" className="text-xl font-black text-slate-300">/</span>
            </div>
            <div className="divide-y divide-slate-200 dark:divide-white/10">
              {trendingArticles.map(news => (
                <button key={news.id} type="button" onClick={() => openArticle(news)} className="group flex w-full gap-3 py-3 text-left">
                  {news.imageUrl && <img src={news.imageUrl} alt="" className="h-[76px] w-[112px] shrink-0 rounded-lg object-cover" />}
                  <span className="min-w-0">
                    <span className="block text-[10px] font-bold text-rose-600 dark:text-rose-400">{news.category}</span>
                    <span className="mt-1 line-clamp-3 block text-xs font-extrabold leading-snug text-slate-950 group-hover:text-blue-700 dark:text-white dark:group-hover:text-blue-300">{news.title}</span>
                    <span className="mt-1.5 block text-[10px] text-slate-400">{news.municipality}</span>
                  </span>
                </button>
              ))}
              {!trendingArticles.length && !newsLoadError && <p className="py-6 text-xs leading-relaxed text-slate-500">Më shumë lajme së shpejti.</p>}
            </div>
          </aside>
        </section>

        {/*
          Njoftime Live for widths where the sticky rail collapses away.

          The live commune-response feed (with its 38-commune filter and
          pagination) otherwise lives only in the `hidden xl:block` right rail,
          so a citizen on a phone or tablet could never reach it. Rendering a
          second instance below the featured stories keeps it one scroll away on
          narrow screens while the rail keeps owning it on wide ones.
        */}
        <div className="xl:hidden">
          <LiveNoticesFeed />
        </div>

        {promotionalCampaigns.length > 0 && (
          <section aria-labelledby="news-promotions-heading" className="border-y border-slate-200 py-6 dark:border-white/10">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{dt('Partnerë të platformës')}</p>
                <h2 id="news-promotions-heading" className="mt-1 font-serif text-2xl font-black text-slate-950 dark:text-white">{dt('Promovime')}</h2>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-bold text-slate-500 dark:border-white/10 dark:bg-slate-900 dark:text-slate-400">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-400" aria-hidden="true" />
                {dt('Përmbajtje e sponsorizuar')}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {promotionalCampaigns.map((promotion) => {
                const isLivePromotion = 'mediaUrl' in promotion;
                const imageUrl = isLivePromotion ? promotion.mediaUrl : promotion.imageUrl;
                const description = isLivePromotion
                  ? dt('Promovim nga partner i platformës.')
                  : promotion.description;

                return (
                  <button
                    key={promotion.id}
                    type="button"
                    onClick={() => {
                      if (isLivePromotion) openPromotion(promotion);
                    }}
                    className={cn(
                      'group overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg dark:border-white/10 dark:bg-slate-900 dark:hover:border-blue-900',
                      isLivePromotion ? 'cursor-pointer' : 'cursor-default'
                    )}
                  >
                    <div className="relative aspect-[16/9] overflow-hidden bg-slate-100 dark:bg-slate-800">
                      <img
                        src={imageUrl}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                      />
                      <span className="absolute left-3 top-3 rounded-md bg-slate-950/85 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-white backdrop-blur">
                        {dt('Reklamë')}
                      </span>
                      {!isLivePromotion && (
                        <span className="absolute right-3 top-3 rounded-md border border-amber-200 bg-amber-100 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-amber-950">
                          Demo
                        </span>
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="line-clamp-2 min-h-10 text-sm font-black leading-snug text-slate-900 transition-colors group-hover:text-blue-700 dark:text-white dark:group-hover:text-blue-300">
                        {promotion.title}
                      </h3>
                      <p className="mt-2 line-clamp-2 min-h-9 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                        {description}
                      </p>
                      {isLivePromotion && promotion.targetUrl && promotion.targetUrl !== '#' && (
                        <span className="mt-3 inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 dark:text-blue-300">
                          {dt('Shiko më shumë')} <ArrowRight className="h-3 w-3" aria-hidden="true" />
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        <AdBanner position="feed" className="max-w-none" />

        <section aria-labelledby="all-news-heading">
          <div className="mb-5 flex items-end justify-between gap-4 border-b border-slate-200 pb-3 dark:border-white/10">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-700 dark:text-blue-300">{dt('Arkivi i publikimeve')}</p>
              <h2 id="all-news-heading" className="mt-1 font-serif text-2xl font-black text-slate-950 dark:text-white">
                {selectedStream === 'notices'
                  ? dt('Arkivi i njoftimeve')
                  : selectedTopic !== 'all'
                    ? dt(selectedTopic)
                    : selectedStream === 'news' ? dt('Arkivi i lajmeve') : dt('Të gjitha publikimet')}
              </h2>
            </div>
            <span className="text-right text-xs font-semibold text-slate-500 dark:text-slate-400">
              {filteredNews.length === 0 ? dt('Asnjë rezultat') : `${(archivePage - 1) * ARCHIVE_PAGE_SIZE + 1}–${Math.min(archivePage * ARCHIVE_PAGE_SIZE, filteredNews.length)} / ${filteredNews.length}`}
            </span>
          </div>

        {/*
          Archive grid with a persistent right-hand rail.

          The rail is the "Njoftime / Live Feed" column the design calls for: a
          vertical strip that stays useful while the reader scrolls the archive,
          carrying the newest notices and the most-read articles. It is sticky so
          it travels with the reader instead of ending after one screen.

          Collapses to a single column below xl; at that width a side rail would
          squeeze the cards rather than help.
        */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {archiveArticles.map((news, index) => (
            <React.Fragment key={news.id}>
            <article
              className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-white/10 dark:bg-slate-900"
            >
              {news.imageUrl && (
                <button
                  type="button"
                  onClick={() => openArticle(news)}
                  aria-label={dt('Hap lajmin')}
                  className="relative block w-full overflow-hidden bg-slate-100 dark:bg-slate-800"
                >
                  {/*
                    aspect-[16/9] rather than a fixed height.

                    `h-48` used to crop every image to the same 192px band, so a
                    portrait photo and a wide photo were both sliced to the same
                    shape and the subject was frequently cut in half. A ratio box
                    keeps every thumbnail the same shape without discarding any
                    more of the image than necessary, and object-cover fills it
                    without stretching.
                  */}
                  <img
                    src={news.imageUrl}
                    alt=""
                    loading="lazy"
                    className="aspect-[16/9] w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                  />
                  {news.isDemo && (
                    <span className="absolute right-3 top-3 rounded-full border border-amber-200 bg-amber-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-amber-900">
                      Demo
                    </span>
                  )}
                </button>
              )}
              <div className="flex flex-1 flex-col justify-between p-5">
              <div>
                {/* Header: Municipality Crest + Category */}
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <MunicipalityShield name={news.municipality} size="sm" />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Komuna e {news.municipality}
                    </span>
                  </div>

                  <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900">
                    {news.category}
                  </span>
                </div>

                {/* News Title */}
                <h3 className="mb-2 text-base font-black leading-snug text-slate-900 dark:text-white">
                  <button
                    type="button"
                    onClick={() => openArticle(news)}
                    className="text-left transition-colors group-hover:text-blue-600"
                  >
                    {news.title}
                  </button>
                </h3>

                {/* Summary */}
                <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-3 leading-relaxed mb-4">
                  {news.summary}
                </p>
                {!!news.relatedReportIds?.length && (() => {
                  const status = answerStatusFor(news);
                  return (
                    <button
                      type="button"
                      onClick={() => openArticle(news)}
                      className={cn(
                        'mb-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold transition-colors',
                        status === 'resolved'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300'
                          : 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300'
                      )}
                    >
                      <Link2 className="h-3 w-3" aria-hidden="true" />
                      {news.relatedReportIds.length} {dt('raportime')}
                      <span aria-hidden="true">·</span>
                      {status === 'resolved' ? dt('Të zgjidhura') : dt('Të pazgjidhura')}
                    </button>
                  );
                })()}
              </div>

              {/* Card Footer: Metadata & Actions */}
              <div className="pt-4 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-xs text-slate-500">
                <div className="flex items-center gap-2 text-[11px]">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>{news.date}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleShare(news)}
                    title={dt('Shpërndaj në të gjitha platformat')}
                    aria-label={dt('Shpërndaj lajmin')}
                    className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-800"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => openArticle(news)}
                    className="ml-1 flex cursor-pointer items-center gap-1 font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400"
                  >
                    <span>{dt('Lexo')}</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
              </div>
            </article>
            {(index + 1) % 3 === 0 && index + 1 < archiveArticles.length && (
              <div className="md:col-span-2 xl:col-span-3">
                <AdBanner position="feed" className="max-w-none" />
              </div>
            )}
            </React.Fragment>
          ))}
        </div>

        {filteredNews.length === 0 && (
          <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-white px-6 py-16 text-center dark:border-white/10 dark:bg-slate-900">
            <Newspaper className="mx-auto mb-4 h-12 w-12 text-slate-300 dark:text-slate-600" aria-hidden="true" />
            <h3 className="text-lg font-black text-slate-800 dark:text-slate-200">
              {dt('Nuk u gjet asnjë njoftim')}
            </h3>
            <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500 dark:text-slate-400">
              {newsLoadError
                ? 'Lajmet nuk mund të ngarkohen tani. Ju lutemi rifreskoni faqen pas pak.'
                : resolutionFilter !== 'all' || selectedStream !== 'all' || selectedTopic !== 'all' || searchQuery
                  ? dt('Provoni të hiqni filtrat ose të kërkoni një temë tjetër.')
                  : dt('Publikimet zyrtare shfaqen këtu pasi redaksia e Zërit të Qytetarëve t’i publikojë.')}
            </p>
            {(resolutionFilter !== 'all' || selectedStream !== 'all' || selectedTopic !== 'all' || searchQuery || scopeToMine) && (
              <button
                type="button"
                onClick={clearNewsFilters}
                className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-100 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                {dt('Pastro filtrat')}
              </button>
            )}
          </div>
        )}

          {/*
            Right rail: notices and a live feed of the most recent items.

            Sticky so it remains available while the reader works down the
            archive. On screens below xl it collapses out of the grid instead of
            squeezing the cards, which is why it is its own grid child rather than
            a floated column.
          */}
          <aside className="hidden xl:block" aria-label={dt('Njoftime dhe lajme të shpejta')}>
            <div className="sticky top-4 space-y-4">
              <LiveNoticesFeed />

              {videoArticles.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-white/10 dark:bg-slate-900">
                  <div className="mb-3 flex items-center gap-2 border-b border-slate-200 pb-2 dark:border-white/10">
                    <Video className="h-3.5 w-3.5 text-blue-700 dark:text-blue-300" aria-hidden="true" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">{dt('Video')}</h3>
                  </div>
                  <div className="space-y-3">
                    {videoArticles.map((item) => (
                      <button
                        key={'rail-video-' + item.id}
                        type="button"
                        onClick={() => openArticle(item)}
                        className="group block w-full text-left"
                      >
                        <span className="relative block overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt="" loading="lazy" className="aspect-video w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
                          ) : (
                            <span className="flex aspect-video items-center justify-center"><Video className="h-6 w-6 text-slate-300" /></span>
                          )}
                          <span className="absolute inset-0 grid place-items-center">
                            <span className="grid h-9 w-9 place-items-center rounded-full bg-black/55 text-white backdrop-blur-sm transition group-hover:bg-blue-700">
                              <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                            </span>
                          </span>
                        </span>
                        <span className="mt-1.5 block line-clamp-2 text-xs font-bold leading-snug text-slate-800 group-hover:text-blue-700 dark:text-slate-200 dark:group-hover:text-blue-300">
                          {item.title}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-white/10 dark:bg-slate-900">
                <div className="mb-3 flex items-center gap-2 border-b border-slate-200 pb-2 dark:border-white/10">
                  <TrendingUp className="h-3.5 w-3.5 text-blue-700 dark:text-blue-300" aria-hidden="true" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">{dt('Më të lexuarat')}</h3>
                </div>
                <ol className="space-y-2.5">
                  {mostReadArticles.map((item, index) => (
                    <li key={'rail-top-' + item.id}>
                      <button type="button" onClick={() => openArticle(item)} className="group flex w-full items-start gap-2.5 text-left">
                        <span className="mt-0.5 font-mono text-lg font-black leading-none text-slate-200 dark:text-slate-700">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block line-clamp-2 text-xs font-bold leading-snug text-slate-800 group-hover:text-blue-700 dark:text-slate-200 dark:group-hover:text-blue-300">
                            {item.title}
                          </span>
                          <span className="mt-0.5 block text-[10px] text-slate-400">{dt(item.category)}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </aside>
        </div>
        {archivePageCount > 1 && (
          <nav className="mt-8 flex flex-wrap items-center justify-center gap-2" aria-label={dt('Faqet e arkivit')}>
            <button
              type="button"
              onClick={() => {
                setArchivePage(page => Math.max(1, page - 1));
                document.getElementById('all-news-heading')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              disabled={archivePage === 1}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:border-blue-300 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> {dt('Më parë')}
            </button>
            {Array.from({ length: archivePageCount }, (_, index) => index + 1)
              .filter(page => archivePageCount <= 7 || page === 1 || page === archivePageCount || Math.abs(page - archivePage) <= 1)
              .map((page, index, visiblePages) => (
                <React.Fragment key={page}>
                  {index > 0 && page - visiblePages[index - 1] > 1 && <span className="px-1 text-slate-400" aria-hidden="true">…</span>}
                  <button
                    type="button"
                    onClick={() => {
                      setArchivePage(page);
                      document.getElementById('all-news-heading')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    aria-current={archivePage === page ? 'page' : undefined}
                    aria-label={`${dt('Faqja')} ${page}`}
                    className={cn(
                      'grid h-10 min-w-10 place-items-center rounded-xl border px-3 text-xs font-black transition-colors',
                      archivePage === page
                        ? 'border-blue-700 bg-blue-700 text-white dark:border-blue-500 dark:bg-blue-500'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-700 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300'
                    )}
                  >
                    {page}
                  </button>
                </React.Fragment>
              ))}
            <button
              type="button"
              onClick={() => {
                setArchivePage(page => Math.min(archivePageCount, page + 1));
                document.getElementById('all-news-heading')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              disabled={archivePage === archivePageCount}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:border-blue-300 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200"
            >
              {dt('Tjetra')} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </nav>
        )}
        </section>

        {activeArticle && (
          <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-50 dark:bg-slate-950">
            <article className="min-h-full">
              <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-white/10 dark:bg-slate-950/95">
                <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
                  <button type="button" onClick={closeArticle} className="font-serif font-black text-slate-900 dark:text-white">Zëri i Qytetarëve <span className="text-blue-700 dark:text-blue-300">/ Lajme</span></button>
                  <button
                    type="button"
                    onClick={closeArticle}
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-slate-100 px-3.5 text-xs font-black text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  ><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Kthehu te lajmet</button>
                </div>
              </header>
              <div className="mx-auto max-w-6xl px-4 pt-5 sm:px-6">
                <AdBanner position="article" className="max-w-none" municipality={activeArticle.municipality} />
              </div>
              <div className="mx-auto grid max-w-6xl gap-7 px-4 py-7 sm:px-6 sm:py-9 lg:grid-cols-[64px_minmax(0,680px)_300px] lg:items-start">
                <aside aria-label="Shpërndaje lajmin" className="order-1 flex items-center gap-2 border-b border-slate-200 pb-4 dark:border-white/10 lg:sticky lg:top-24 lg:border-0 lg:pb-0 lg:flex-col lg:items-start">
                  <span className="mr-1 text-[10px] font-black uppercase tracking-wider text-slate-500 lg:mb-1 lg:mr-0">Shpërndaje</span>
                  <a
                    href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(articleUrl)}`}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Shpërndaje në Facebook"
                    className="grid h-10 w-10 place-items-center rounded-full bg-[#1877f2] text-xs font-black text-white transition hover:scale-105"
                  >f</a>
                  <a
                    href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(articleUrl)}&text=${encodeURIComponent(activeArticle.title)}`}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Shpërndaje në X"
                    className="grid h-10 w-10 place-items-center rounded-full bg-slate-900 text-sm font-black text-white transition hover:scale-105 dark:bg-slate-700"
                  >𝕏</a>
                  <a
                    href={`mailto:?subject=${encodeURIComponent(activeArticle.title)}&body=${encodeURIComponent(articleUrl)}`}
                    aria-label="Dërgo lajmin me email"
                    className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-700 transition hover:bg-blue-100 hover:text-blue-700 dark:bg-slate-800 dark:text-slate-200"
                  ><Mail className="h-4 w-4" aria-hidden="true" /></a>
                  <button
                    type="button"
                    onClick={copyArticleLink}
                    aria-label="Kopjo lidhjen e lajmit"
                    className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-700 transition hover:bg-blue-100 hover:text-blue-700 dark:bg-slate-800 dark:text-slate-200"
                  ><Copy className="h-4 w-4" aria-hidden="true" /></button>
                  <button
                    type="button"
                    onClick={() => handleShare(activeArticle)}
                    aria-label="Më shumë mënyra shpërndarjeje"
                    className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-700 transition hover:bg-blue-100 hover:text-blue-700 dark:bg-slate-800 dark:text-slate-200"
                  ><Share2 className="h-4 w-4" aria-hidden="true" /></button>
                </aside>

                <div className="order-2 min-w-0 lg:order-2">
                  <article>
                    <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs font-bold text-slate-500 dark:text-slate-400">
                      <span className="rounded bg-rose-600 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-white">{activeArticle.category}</span>
                      {activeArticle.isDemo && <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">Shembull demo · jo lajm real</span>}
                      <span className="inline-flex items-center gap-1.5"><MunicipalityShield name={activeArticle.municipality} size="sm" />{activeArticle.municipality}</span>
                    </div>
                    <h1 className="font-serif text-3xl font-black leading-[1.12] tracking-tight text-slate-950 dark:text-white sm:text-4xl">{activeArticle.title}</h1>
                    <p className="mt-4 text-lg leading-relaxed text-slate-600 dark:text-slate-300">{activeArticle.summary}</p>
                    <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-200 pb-4 text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">
                      <span className="font-bold text-slate-800 dark:text-slate-200">{activeArticle.author || 'Redaksia e Zërit të Qytetarëve'}</span>
                      <span>{activeArticle.date}</span>
                      <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" aria-hidden="true" />{activeArticle.readTime || '3 min lexim'}</span>
                    </div>
                    {activeArticle.imageUrl && (
                      <figure className="mt-6">
                        <img src={activeArticle.imageUrl} alt="" className="max-h-[560px] min-h-52 w-full rounded-lg bg-slate-200 object-cover dark:bg-slate-800 sm:min-h-80" />
                        <figcaption className="mt-2 text-[10px] text-slate-400">{activeArticle.municipality} · {activeArticle.date}</figcaption>
                      </figure>
                    )}
                    <div className="prose prose-slate mt-7 max-w-none whitespace-pre-line text-base leading-8 text-slate-700 dark:prose-invert dark:text-slate-300 sm:text-[17px]">
                      {activeArticle.content}
                    </div>
                    {(() => {
                      const inlineUrl = (activeArticle as any).inlineImageUrl as string | undefined;
                      const videoUrl = (activeArticle as any).videoUrl as string | undefined;
                      return (
                        <>
                          {inlineUrl && (
                            <figure className="mt-8">
                              <img src={inlineUrl} alt="" loading="lazy" className="w-full rounded-xl bg-slate-200 object-cover dark:bg-slate-800" />
                            </figure>
                          )}
                          {videoUrl && (
                            <div className="mt-8 overflow-hidden rounded-xl bg-slate-900">
                              {videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be') ? (
                                <iframe
                                  src={videoUrl.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/')}
                                  title="Video e lajmit"
                                  className="aspect-video w-full"
                                  allowFullScreen
                                />
                              ) : (
                                <video src={videoUrl} controls className="aspect-video w-full" />
                              )}
                            </div>
                          )}
                        </>
                      );
                    })()}
                    {!!activeArticle.relatedReportIds?.length && (
                      <div className="mt-8 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200">
                        Ky njoftim lidhet me {activeArticle.relatedReportIds.length} raportime qytetare.
                      </div>
                    )}
                    <div className="mt-9 border-t border-slate-200 pt-5 dark:border-white/10">
                      <button type="button" onClick={closeArticle} className="inline-flex items-center gap-2 text-xs font-black text-blue-700 transition hover:text-blue-900 dark:text-blue-300">
                        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Kthehu te të gjitha lajmet
                      </button>
                    </div>
                  </article>
                </div>

                <aside className="hidden space-y-6 lg:order-3 lg:block">
                  <section>
                    <h2 className="mb-3 border-b border-slate-200 pb-2 font-serif text-lg font-black text-rose-600 dark:border-white/10 dark:text-rose-400">Lajmet kryesore</h2>
                    <div className="divide-y divide-slate-200 dark:divide-white/10">
                      {trendingArticles.slice(0, 5).map(news => (
                        <button key={news.id} type="button" onClick={() => openArticle(news)} className="group flex w-full gap-3 py-3 text-left">
                          {news.imageUrl && <img src={news.imageUrl} alt="" className="h-[70px] w-[105px] shrink-0 rounded-md object-cover" />}
                          <span className="min-w-0">
                            <span className="block line-clamp-3 text-xs font-extrabold leading-snug text-slate-950 group-hover:text-blue-700 dark:text-white dark:group-hover:text-blue-300">{news.title}</span>
                            <span className="mt-1.5 block text-[10px] text-rose-600 dark:text-rose-400">{news.category}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </section>
                  <AdBanner position="sidebar" municipality={activeArticle.municipality} />
                </aside>
              </div>
            </article>
            </div>
        )}

      </div>

      {/*
        Share sheet. The link is a deep link to this specific notice, so a
        recipient lands on the article rather than on the news index.
      */}
      <ShareSheet
        isOpen={Boolean(sharingArticle)}
        onClose={() => setSharingArticle(null)}
        target={{
          url: sharingArticle
            ? `${window.location.origin}/lajme?njoftim=${encodeURIComponent(sharingArticle.id)}`
            : '',
          title: sharingArticle?.title ?? '',
          text: sharingArticle?.summary,
        }}
      />
    </div>
  );
}

/**
 * The dark-mode toggle for the news page.
 *
 * The news page renders outside the app shell (no TopNavbar), so it never had a
 * theme switch: a citizen reading at night was stuck in whatever mode the rest
 * of the app had chosen, with no way to flip it from here. This is the same
 * `useThemePreference` hook the shell's bar uses, rendered in the same visual
 * language as the page's own buttons, so the page matches the platform's
 * behaviour without adopting its layout.
 */
function ThemeToggle() {
  const { isDark, toggleTheme } = useThemePreference();
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? dt('Ndërro te dita') : dt('Ndërro te natë')}
      title={isDark ? dt('Ndërro te dita') : dt('Ndërro te natë')}
      className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-slate-600 transition hover:border-blue-300 hover:text-blue-700 dark:border-white/10 dark:text-slate-300 dark:hover:border-blue-500/40 dark:hover:text-blue-300"
    >
      {isDark ? <Sun className="h-4 w-4 text-amber-500" aria-hidden="true" /> : <Moon className="h-4 w-4 text-indigo-600" aria-hidden="true" />}
    </button>
  );
}
