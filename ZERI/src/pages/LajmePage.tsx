import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { dt } from '@/src/lib/dt';
import {
  Newspaper, Search, Calendar, MapPin, Share2,
  ArrowRight, Link2, ArrowLeft, Clock3, Mail, Copy, Info,
  Sun, Moon, Play, Pause, Megaphone, SlidersHorizontal,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useThemePreference } from '../lib/themePreference';
import { MunicipalityShield } from '../components/MunicipalityShield';
import { cn } from '../lib/utils';
import { collection, onSnapshot, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import AdBanner from '../components/AdBanner.tsx';
import { AnnouncementBanner } from '../components/AnnouncementBanner';
import { BroadcastStrip } from '../components/BroadcastLayer';
import { LiveNoticesFeed } from '../components/news/LiveNoticesFeed';
import { ShareSheet } from '../components/ShareSheet.tsx';
import toast from 'react-hot-toast';
import { useStore, type AdCampaign } from '../lib/store';
import { isSpecificScope, scopeKey } from '../lib/municipalityScope';
import { NEWS_CATEGORIES, EXTERNAL_CATEGORIES, PLATFORM_CATEGORIES, originOfCategory, type NewsOrigin } from '../lib/newsCategories';
import { BackLink } from '../components/BackLink';
import { DEMO_NEWS } from '../lib/demoNews';
import { layoutNews } from '../lib/newsPlacement';
import { HTML_LANG_TAGS, readStoredLanguage } from '../lib/languageConstants';
import { AuraHero, AuraStats, AuraOrbit } from '../components/aura/Aura';

const ALBANIAN_MONTHS = ['janar', 'shkurt', 'mars', 'prill', 'maj', 'qershor', 'korrik', 'gusht', 'shtator', 'tetor', 'nëntor', 'dhjetor'];

const ALBANIAN_WEEKDAYS = ['e diel', 'e hënë', 'e martë', 'e mërkurë', 'e enjte', 'e premte', 'e shtunë'];

/** The dateline. Browsers lack the sq-AL locale and fall back to English, so Albanian is spelled out. */
function todayLine(): string {
  const lang = readStoredLanguage();
  const now = new Date();
  if (lang !== 'sq') return now.toLocaleDateString(HTML_LANG_TAGS[lang], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const weekday = ALBANIAN_WEEKDAYS[now.getDay()];
  return `${weekday[0].toUpperCase()}${weekday.slice(1)}, ${now.getDate()} ${ALBANIAN_MONTHS[now.getMonth()]} ${now.getFullYear()}`;
}

/**
 * Article dates are stored as Albanian text ("05 tetor 2026"). For every other
 * language the date is re-rendered with the reader's locale, so an English page
 * does not show Albanian month names. Anything unrecognised is returned as is.
 */
function formatNewsDate(value: string): string {
  const lang = readStoredLanguage();
  if (!value || lang === 'sq') return value;
  const match = /^(\d{1,2})\s+(\p{L}+)\s+(\d{4})$/u.exec(value.trim());
  if (!match) return value;
  const month = ALBANIAN_MONTHS.indexOf(match[2].toLowerCase());
  if (month < 0) return value;
  try {
    return new Date(Number(match[3]), month, Number(match[1])).toLocaleDateString(HTML_LANG_TAGS[lang], {
      day: 'numeric', month: 'long', year: 'numeric',
    });
  } catch {
    return value;
  }
}

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
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [tickerPaused, setTickerPaused] = useState(false);
  const [selectedStream, setSelectedStream] = useState<'all' | 'news' | 'notices'>('all');
  const [selectedTopic, setSelectedTopic] = useState('all');
  const [selectedOrigin, setSelectedOrigin] = useState<NewsOrigin>('all');
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
  // Newest first (the Firestore listener above is live, so a fresh article joins the
  // ticker by itself). Repeated until one half of the track is wider than a screen,
  // otherwise a short list leaves a gap before the loop restarts.
  const tickerItems = useMemo(() => {
    const latest = allNews.slice(0, 10);
    if (latest.length === 0) return latest;
    return Array.from({ length: Math.max(1, Math.ceil(10 / latest.length)) }, () => latest).flat();
  }, [allNews]);

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

  const filteredNews = useMemo(() => {
    return allNews.filter(item => {
      const isOfficialNotice = item.category === 'Njoftim Zyrtar';
      const matchStream = selectedStream === 'all'
        || (selectedStream === 'news' && !isOfficialNotice)
        || (selectedStream === 'notices' && isOfficialNotice);
      const matchTopic = selectedTopic === 'all' || item.category === selectedTopic;
      const matchOrigin = selectedOrigin === 'all' || originOfCategory(item.category) === selectedOrigin;
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
      return matchStream && matchTopic && matchOrigin && matchSearch && matchScope && matchResolution;
    });
  }, [allNews, searchQuery, selectedStream, selectedTopic, selectedOrigin, scopeToMine, mineMunicipality, resolutionFilter, answerStatusFor]);

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

  // The same function the admin editor's placement preview uses.
  const { lead: leadArticle, feed: feedArticles, latest: latestArticles, rail: trendingArticles } = layoutNews(filteredNews);
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
      // HTML creatives have no image to show in a card, so they stay in banner slots.
      return ad.status === 'active' && ad.mediaType !== 'html' && Boolean(ad.mediaUrl) && isNewsCampaign && municipalityMatches;
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
      .filter((category) => selectedOrigin === 'all' || originOfCategory(category) === selectedOrigin)
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
      const topic = item.id.replace('topic:', '');
      setSelectedTopic(topic);
      setSelectedStream(topic === 'Njoftim Zyrtar' ? 'all' : 'news');
    }
  };


  useEffect(() => {
    setArchivePage(1);
  }, [selectedStream, selectedTopic, searchQuery, scopeToMine, resolutionFilter]);

  useEffect(() => {
    if (archivePage > archivePageCount) setArchivePage(archivePageCount);
  }, [archivePage, archivePageCount]);

  const clearNewsFilters = () => {
    setSelectedStream('all');
    setSelectedTopic('all');
    setSelectedOrigin('all');
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

  const readerRef = useRef<HTMLDivElement | null>(null);
  const [readProgress, setReadProgress] = useState(0);
  const relatedArticles = useMemo(() => {
    if (!activeArticle) return [];
    const others = allNews.filter(item => item.id !== activeArticle.id);
    const sameCategory = others.filter(item => item.category === activeArticle.category);
    return [...sameCategory, ...others.filter(item => item.category !== activeArticle.category)].slice(0, 4);
  }, [activeArticle, allNews]);

  const sidebarArticles = useMemo(() => {
    if (!activeArticle) return [];
    const seen = new Set<string>([activeArticle.id]);
    return [...relatedArticles, ...trendingArticles].filter(item => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    }).slice(0, 5);
  }, [activeArticle, relatedArticles, trendingArticles]);

  // Reader: reading-progress bar, Esc to close, and each newly opened article
  // starts at the top instead of inheriting the previous scroll offset.
  useEffect(() => {
    const node = readerRef.current;
    if (!activeArticle || !node) {
      setReadProgress(0);
      return;
    }
    node.scrollTo({ top: 0 });
    setReadProgress(0);
    const onScroll = () => {
      const max = node.scrollHeight - node.clientHeight;
      setReadProgress(max > 0 ? Math.min(100, Math.round((node.scrollTop / max) * 100)) : 0);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeArticle();
    };
    node.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('keydown', onKey);
    return () => {
      node.removeEventListener('scroll', onScroll);
      window.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeArticle?.id]);

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
    <div className="au-page min-h-screen">
      <div className="mx-auto max-w-[1280px] space-y-7 px-4 pb-14 pt-3 sm:px-7 sm:pt-5 lg:px-10">
        <AuraHero
          visual={<AuraOrbit core={Newspaper} />}
          tone="blue"
          eyebrow={dt('Informim publik · Komuniteti · Transparencë')}
          icon={Newspaper}
          live
          title={dt('Lajmet kryesore')}
          subtitle={dt('Lajme nga redaksia, njoftime zyrtare nga komunat dhe përgjigje ndaj raportimeve të qytetarëve, të renditura sipas temës dhe komunës.')}
          actions={<>
            <BackLink to="/" label="Platforma" />
            {allNews.length === 0 && <Link to="/lajmero" className="au-btn au-btn-glass !h-9 !text-[13px]"><Megaphone className="h-4 w-4" aria-hidden="true" /> {dt('Raporto lajm')}</Link>}
            <ThemeToggle />
          </>}
          aside={allNews.length > 0 ? (
            <AuraStats items={[
              { value: allNews.length, label: dt('Publikime') },
              { value: allNews.filter(item => item.category === 'Njoftim Zyrtar').length, label: dt('Njoftime zyrtare') },
              { value: new Set(allNews.map(item => item.municipality).filter(name => name && name !== 'Gjithë Kosova')).size, label: dt('Komuna') },
            ]} />
          ) : undefined}
        />

        {/* Filter bar: stays on screen while the reader scrolls. Nothing to filter on an empty feed. */}
        {allNews.length > 0 && <div className="sticky top-16 z-20 rounded-2xl border border-slate-200 bg-white/90 px-3 pt-3 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/90">
          <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
            <div role="tablist" aria-label={dt('Lloji i publikimit')} className="flex shrink-0 rounded-xl bg-slate-100 p-1 dark:bg-white/10">
              {streamOptions.map(({ id, label, count }) => {
                const on = activeRailId === `stream:${id}`;
                return (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => selectRailItem({ id: `stream:${id}`, label, count, kind: 'stream' })}
                    className={cn(
                      'relative flex-1 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition-colors sm:flex-none',
                      on ? 'text-slate-900 dark:text-white' : 'text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
                    )}
                  >
                    {on && (
                      <motion.span
                        layoutId="news-stream-pill"
                        aria-hidden="true"
                        className="absolute inset-0 rounded-lg bg-white shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-700 dark:ring-white/10"
                        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                      />
                    )}
                    <span className="relative">{dt(label)}<span className="ml-1.5 text-[11px] font-medium tabular-nums text-slate-600 dark:text-slate-300">{count}</span></span>
                  </button>
                );
              })}
            </div>

            <div className="relative min-w-0 flex-1">
              <label htmlFor="news-search" className="sr-only">{dt('Kërko lajme dhe njoftime')}</label>
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600 dark:text-slate-400" aria-hidden="true" />
              <input
                id="news-search"
                type="search"
                placeholder={dt('Kërko lajme, komuna, tema…')}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:bg-white/10"
              />
            </div>

            <Link
              to="/lajmero"
              className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-[13px] font-bold text-white transition hover:bg-slate-700 active:scale-[0.98] dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            >
              <Megaphone className="h-4 w-4" aria-hidden="true" />
              {dt('Raporto lajm')}
            </Link>
          </div>

          {/* Origin + categories: a glass segmented control, then clean pill chips. */}
          <div className="-mx-3 mt-3 rounded-b-2xl border-t border-slate-200/70 bg-slate-50/60 px-3 py-3 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="flex items-center gap-2">
              <div role="tablist" aria-label={dt('Burimi i lajmit')} className="flex min-w-0 flex-1 rounded-full sm:flex-none bg-slate-200/60 p-1 dark:bg-white/10">
                {([
                  { id: 'all', label: 'Të gjitha' },
                  { id: 'platform', label: 'Në platformë' },
                  { id: 'external', label: 'Jashtë platformës' },
                ] as const).map((option) => {
                  const on = selectedOrigin === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      role="tab"
                      aria-selected={on}
                      onClick={() => {
                        setSelectedOrigin(option.id);
                        setSelectedTopic('all');
                        setScopeToMine(false);
                      }}
                      className={cn(
                        'relative flex-1 whitespace-nowrap rounded-full px-2 py-1.5 text-[12px] font-semibold transition-colors sm:flex-none sm:px-3.5 sm:text-[13px]',
                        on ? 'text-slate-900 dark:text-white' : 'text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
                      )}
                    >
                      {on && (
                        <motion.span
                          layoutId="news-origin-pill"
                          aria-hidden="true"
                          className="absolute inset-0 rounded-full bg-white shadow-[0_1px_3px_rgba(15,23,42,0.15)] dark:bg-slate-700"
                          transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                        />
                      )}
                      <span className="relative">{dt(option.label)}</span>
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => setShowAdvancedFilters((open) => !open)}
                aria-expanded={showAdvancedFilters}
                aria-label={dt('Filtra')} className="ml-auto inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-semibold text-slate-600 transition-colors hover:bg-slate-200/60 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
              >
                <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">{dt('Filtra')}</span>
                {resolutionFilter !== 'all' && <span className="h-1.5 w-1.5 rounded-full bg-blue-600" aria-label={dt('Filtra aktivë')} />}
              </button>
            </div>

            <nav
              aria-label={dt('Kategoritë e publikimeve')}
              className="-mx-3 mt-3 flex items-center gap-2 overflow-x-auto px-3 pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {categoryRail.filter((item) => item.kind !== 'stream').map((item) => {
                const on = activeRailId === item.id;
                const isExternal = item.kind === 'topic' && (EXTERNAL_CATEGORIES as readonly string[]).includes(item.label);
                const isPlatform = item.kind === 'topic' && (PLATFORM_CATEGORIES as readonly string[]).includes(item.label);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectRailItem(item)}
                    aria-pressed={on}
                    className={cn(
                      'inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold transition active:scale-[0.97]',
                      on
                        ? 'border-slate-900 bg-slate-900 text-white shadow-sm dark:border-white dark:bg-white dark:text-slate-900'
                        : 'border-slate-200 bg-white/80 text-slate-600 backdrop-blur hover:border-slate-300 hover:text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:text-white'
                    )}
                  >
                    {item.kind === 'local' && <MapPin className={cn('h-3.5 w-3.5', on ? '' : 'text-rose-500')} aria-hidden="true" />}
                    {isPlatform && <span aria-hidden="true" className={cn('h-1.5 w-1.5 rounded-full', on ? 'bg-white dark:bg-slate-900' : 'bg-blue-500')} />}
                    {isExternal && <span aria-hidden="true" className={cn('h-1.5 w-1.5 rounded-full', on ? 'bg-white dark:bg-slate-900' : 'bg-amber-500')} />}
                    {dt(item.label)}
                    <span className={cn('text-[11px] font-medium tabular-nums', on ? 'opacity-70' : 'text-slate-600 dark:text-slate-400')}>{item.count}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {showAdvancedFilters && (
            <div className="-mx-3 flex flex-wrap items-center gap-2 border-t border-slate-100 bg-slate-50/70 px-3 py-3 dark:border-white/10 dark:bg-white/[0.03]">
              <span className="mr-1 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">{dt('Përgjigjja e komunës')}</span>
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
                    'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                    resolutionFilter === option.id
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                      : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100 dark:bg-white/5 dark:text-slate-300 dark:ring-white/10'
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
                    'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold sm:ml-auto',
                    scopeToMine ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 dark:bg-white/5 dark:text-slate-300 dark:ring-white/10'
                  )}
                >
                  <MapPin className="h-3.5 w-3.5" aria-hidden="true" /> {dt('Vetëm')} {mineMunicipality}
                </button>
              )}
            </div>
          )}
        </div>}

        {/* Newspaper strip: dateline, breaking ticker and a leaderboard slot. */}
        <div className="-mt-2 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-slate-900 pb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-600 dark:border-white dark:text-slate-400">
            <span>{todayLine()}</span>
            <span className="hidden sm:inline">{dt('Republika e Kosovës · 38 komuna')}</span>
            <span>{allNews.length} {dt('publikime')}</span>
          </div>
          {allNews.length > 0 && (
            <div className="flex items-stretch overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900">
              <span className="flex shrink-0 items-center gap-2 border-r border-slate-200 px-4 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-900 dark:border-white/10 dark:text-white">
                <span className="h-2 w-2 animate-pulse rounded-full bg-rose-500" aria-hidden="true" />
                {dt('Të fundit')}
              </span>
              <div
                data-paused={tickerPaused}
                className="news-ticker min-w-0 flex-1 overflow-hidden py-2.5 [mask-image:linear-gradient(to_right,transparent,black_1.5rem,black_calc(100%-1.5rem),transparent)]"
                style={{ ['--ticker-duration' as string]: `${Math.max(30, tickerItems.length * 6)}s` }}
                role="marquee"
                aria-label={dt('Lajmet më të reja')}
              >
                <div className="news-ticker-track">
                  {[0, 1].map(copy => (
                    <div key={copy} className="flex shrink-0 items-center gap-10 pr-10" aria-hidden={copy === 1 ? true : undefined}>
                      {tickerItems.map((item, index) => (
                        <button key={`ticker-${copy}-${index}-${item.id}`} type="button" tabIndex={copy === 1 ? -1 : 0} onClick={() => openArticle(item)} className="shrink-0 whitespace-nowrap text-xs font-bold text-slate-700 transition hover:text-blue-700 dark:text-slate-200 dark:hover:text-blue-300">
                          {item.title}
                          <span className="ml-2 font-medium text-slate-600 dark:text-slate-400">· {item.municipality}</span>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTickerPaused(value => !value)}
                aria-label={tickerPaused ? dt('Vazhdo lëvizjen e lajmeve') : dt('Ndalo lëvizjen e lajmeve')}
                aria-pressed={tickerPaused}
                className="relative z-10 flex min-h-8 w-9 shrink-0 items-center justify-center border-l border-slate-200 text-slate-600 dark:text-slate-400 transition hover:bg-slate-50 hover:text-blue-700 dark:border-white/10 dark:hover:bg-slate-800"
              >
                {tickerPaused ? <Play className="h-3.5 w-3.5" aria-hidden="true" /> : <Pause className="h-3.5 w-3.5" aria-hidden="true" />}
              </button>
            </div>
          )}
          <AdBanner position="feed" className="max-w-none" />
        </div>

        <BroadcastStrip placement="news" />
        <AnnouncementBanner />
        {import.meta.env.DEV && (
          // Prototype notice, deliberately quiet.
          //
          // This used to be a full-width amber panel with a border and heavy
          // padding, which sat above the first headline and read as more
          // important than the news itself. It is now a single low line: the
          // information is still there for anyone who reads it, but it no longer
          // competes with the content it is describing.
          <div className="flex items-center gap-2 text-[11px] leading-snug text-slate-600 dark:text-slate-400" role="status">
            <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{dt('Pamje prototipi: artikujt me etiketën DEMO janë shembuj të sajuar për testim dhe nuk publikohen për qytetarët.')}</span>
          </div>
        )}

        <section className="grid items-start gap-x-7 gap-y-8 lg:grid-cols-[minmax(0,1fr)_280px] xl:grid-cols-[230px_minmax(0,1fr)_280px]" aria-label={dt('Lajmet kryesore dhe lajmet e fundit')}>
          <aside className="hidden xl:order-1 xl:block">
            <div className="mb-3 flex items-center justify-between border-b border-slate-200 pb-2 dark:border-white/10">
              <h2 className="font-serif text-lg font-black text-slate-950 dark:text-white">{dt('Të veçuara')}</h2>
              <span aria-hidden="true" className="text-xl font-black text-slate-300">/</span>
            </div>
            <div className="divide-y divide-slate-200 dark:divide-white/10">
              {latestArticles.map(news => (
                <button key={news.id} type="button" onClick={() => openArticle(news)} className="group block w-full py-3 text-left">
                  {news.imageUrl && <img src={news.imageUrl} alt="" loading="lazy" className="mb-3 aspect-[16/9] w-full rounded-lg object-cover" />}
                  <span className="block text-[10px] font-bold text-emerald-700 dark:text-emerald-400">{dt(news.category)}</span>
                  <span className="mt-1 block text-sm font-extrabold leading-snug text-slate-950 group-hover:text-blue-700 dark:text-white dark:group-hover:text-blue-300">{news.title}</span>
                  <span className="mt-1.5 block text-[10px] text-slate-600 dark:text-slate-400">{news.municipality} · {formatNewsDate(news.date)}</span>
                </button>
              ))}
              {!latestArticles.length && !leadArticle && !newsLoadError && <p className="py-6 text-xs leading-relaxed text-slate-600 dark:text-slate-400">{dt('Lajmet e reja të redaksisë do të shfaqen këtu.')}</p>}
            </div>
            <div className="mt-5">
              <AdBanner position="sidebar" />
            </div>
          </aside>

          <div className="order-1 min-w-0 xl:order-2">
            <div className="mb-3 flex items-center justify-between border-b border-slate-200 pb-2 dark:border-white/10">
              <h2 className="font-serif text-lg font-black text-slate-950 dark:text-white">{dt('Lajmet e fundit')}</h2>
              <span aria-hidden="true" className="text-xl font-black text-slate-300">/</span>
            </div>
            {leadArticle ? (
              <button type="button" onClick={() => openArticle(leadArticle)} className="group block w-full text-left">
                <div className="au-photo overflow-hidden rounded-2xl" style={{ aspectRatio: '16/10' }}>
                  {leadArticle.imageUrl && <img loading="lazy" src={leadArticle.imageUrl} alt="" decoding="async" />}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
                  <span className="absolute left-3 top-3 z-10 rounded-full bg-rose-600 px-2.5 py-1 text-[11px] font-semibold text-white">{dt(leadArticle.category)}</span>
                  {leadArticle.isDemo && <span className="absolute right-3 top-3 z-10 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-900">Demo</span>}
                  <div className="absolute inset-x-0 bottom-0 z-10 p-4 sm:p-5">
                    <h3 className="text-[20px] font-semibold leading-tight text-white sm:text-[26px]">{leadArticle.title}</h3>
                    <p className="mt-1.5 line-clamp-2 max-w-xl text-[13px] leading-relaxed text-white/80">{leadArticle.summary}</p>
                    <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-white/70">{leadArticle.municipality} · {formatNewsDate(leadArticle.date)}</p>
                  </div>
                </div>
                {feedArticles[0] && (
                  <span className="au-tile mt-2.5 flex items-center gap-2 px-3.5 py-2.5 text-[13px] font-medium">
                    <span className="text-rose-500">›</span>{feedArticles[0].title}
                  </span>
                )}
              </button>
            ) : (
              <div className="flex min-h-64 flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-white px-6 py-10 text-center dark:border-white/10 dark:bg-slate-900">
                <Newspaper className="h-9 w-9 text-slate-300 dark:text-slate-600" aria-hidden="true" />
                <h3 className="mt-3 font-serif text-lg font-black text-slate-800 dark:text-slate-100">
                  {newsLoadError ? dt('Lajmet nuk u ngarkuan') : dt('Lajmet e reja së shpejti')}
                </h3>
                <p className="mt-1 max-w-sm text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  {newsLoadError ? dt('Nuk mundëm të marrim publikimet nga serveri. Ju lutemi provoni përsëri më vonë.') : dt('Publikimet e redaksisë do të shfaqen këtu sapo të jenë gati.')}
                </p>
              </div>
            )}
          </div>

          <aside className="hidden lg:col-start-2 lg:row-start-1 lg:order-2 lg:block xl:col-start-3 xl:order-3">
            <div className="mb-3 flex items-center justify-between border-b border-slate-200 pb-2 dark:border-white/10">
              <h2 className="font-serif text-lg font-black text-slate-950 dark:text-white">{dt('Në fokus')}</h2>
              <span aria-hidden="true" className="text-xl font-black text-slate-300">/</span>
            </div>
            <div className="divide-y divide-slate-200 dark:divide-white/10">
              {trendingArticles.map(news => (
                <button key={news.id} type="button" onClick={() => openArticle(news)} className="group flex w-full gap-3 py-3 text-left">
                  {news.imageUrl && <img loading="lazy" decoding="async" src={news.imageUrl} alt="" className="h-[76px] w-[112px] shrink-0 rounded-lg object-cover" />}
                  <span className="min-w-0">
                    <span className="block text-[10px] font-bold text-rose-700 dark:text-rose-400">{dt(news.category)}</span>
                    <span className="mt-1 line-clamp-3 block text-xs font-extrabold leading-snug text-slate-950 group-hover:text-blue-700 dark:text-white dark:group-hover:text-blue-300">{news.title}</span>
                    <span className="mt-1.5 block text-[10px] text-slate-600 dark:text-slate-400">{news.municipality}</span>
                  </span>
                </button>
              ))}
              {!trendingArticles.length && !newsLoadError && <p className="py-6 text-xs leading-relaxed text-slate-600 dark:text-slate-400">{dt('Më shumë lajme së shpejti.')}</p>}
            </div>
            <div className="mt-5">
              <AdBanner position="sidebar" />
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
        {allNews.length > 3 && (
          <section aria-labelledby="headline-index" className="border-y-2 border-slate-900 py-6 dark:border-white">
            <div className="mb-5 flex items-end justify-between gap-4">
              <h2 id="headline-index" className="font-serif text-2xl font-black text-slate-950 dark:text-white">{dt('Titujt e ditës')}</h2>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 dark:text-slate-400">{dt('Në një shikim')}</span>
            </div>
            <ol className="grid gap-x-8 gap-y-0 sm:grid-cols-2 lg:grid-cols-3">
              {allNews.slice(0, 9).map((item, index) => (
                <li key={'hl-' + item.id} className="border-b border-slate-200 dark:border-white/10">
                  <button type="button" onClick={() => openArticle(item)} className="group flex w-full items-start gap-3 py-3.5 text-left">
                    <span className="font-serif text-3xl font-black leading-none text-slate-500 transition-colors group-hover:text-rose-500 dark:text-slate-500">{String(index + 1).padStart(2, '0')}</span>
                    <span className="min-w-0">
                      <span className="block text-[10px] font-black uppercase tracking-wider text-rose-700 dark:text-rose-400">{dt(item.category)}</span>
                      <span className="mt-0.5 line-clamp-2 block text-sm font-extrabold leading-snug text-slate-900 group-hover:text-blue-700 dark:text-white dark:group-hover:text-blue-300">{item.title}</span>
                      <span className="mt-1 block text-[10px] text-slate-600 dark:text-slate-400">{item.municipality} · {formatNewsDate(item.date)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </section>
        )}

        <div className="xl:hidden">
          <LiveNoticesFeed />
        </div>

        {promotionalCampaigns.length > 0 && (
          <section aria-labelledby="news-promotions-heading" className="border-y border-slate-200 py-6 dark:border-white/10">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-600 dark:text-slate-400">{dt('Partnerë të platformës')}</p>
                <h2 id="news-promotions-heading" className="mt-1 font-serif text-2xl font-black text-slate-950 dark:text-white">{dt('Promovime')}</h2>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-bold text-slate-600 dark:border-white/10 dark:bg-slate-900 dark:text-slate-400">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-400" aria-hidden="true" />
                {dt('Përmbajtje e sponsorizuar')}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {promotionalCampaigns.map((promotion) => {
                const isLivePromotion = 'mediaUrl' in promotion;
                const imageUrl = isLivePromotion ? promotion.mediaUrl : promotion.imageUrl;
                const description = isLivePromotion
                  ? ((promotion as any).partnerDescription || dt('Promovim nga partner i platformës.'))
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
                      {isLivePromotion && (promotion as any).mediaType === 'video' ? (
                        <video
                          src={imageUrl}
                          muted
                          playsInline
                          autoPlay
                          loop
                          preload="metadata"
                          aria-hidden="true"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <img
                          src={imageUrl}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                        />
                      )}
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
                      <p className="mt-2 line-clamp-2 min-h-9 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
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
            <span className="text-right text-xs font-semibold text-slate-600 dark:text-slate-400">
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
            <article className="au-tile au-tile-link group flex flex-col justify-between overflow-hidden">
              {news.imageUrl && (
                <button
                  type="button"
                  onClick={() => openArticle(news)}
                  aria-label={dt('Hap lajmin')}
                  className="au-photo block w-full"
                  style={{ aspectRatio: '16/9' }}
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
                  <img src={news.imageUrl} alt="" loading="lazy" decoding="async" />
                  <span className="absolute left-2.5 top-2.5 z-10 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">{dt(news.category)}</span>
                  {news.isDemo && (
                    <span className="absolute right-3 top-3 rounded-full border border-amber-200 bg-amber-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-amber-900">
                      Demo
                    </span>
                  )}
                </button>
              )}
              <div className="flex flex-1 flex-col justify-between p-3.5">
              <div>
                {/* Header: Municipality Crest + Category */}
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <MunicipalityShield name={news.municipality} size="sm" />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Komuna e {news.municipality}
                    </span>
                  </div>

                  {!news.imageUrl && (
                    <span className="rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-0.5 text-[10px] font-bold text-cyan-800 dark:border-cyan-900 dark:bg-cyan-950/50 dark:text-cyan-200">
                      {dt(news.category)}
                    </span>
                  )}
                </div>

                {/* News Title */}
                <h3 className="mb-1.5 text-[15px] font-semibold leading-snug">
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
              <div className="pt-4 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                <div className="flex items-center gap-2 text-[11px]">
                  <Calendar className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                  <span>{formatNewsDate(news.date)}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleShare(news)}
                    title={dt('Shpërndaj në të gjitha platformat')}
                    aria-label={dt('Shpërndaj lajmin')}
                    className="cursor-pointer rounded-lg p-1.5 text-slate-600 dark:text-slate-400 transition-colors hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-800"
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
            <p className="mx-auto mt-2 max-w-sm text-sm text-slate-600 dark:text-slate-400">
              {newsLoadError
                ? 'Lajmet nuk mund të ngarkohen tani. Ju lutemi rifreskoni faqen pas pak.'
                : resolutionFilter !== 'all' || selectedStream !== 'all' || selectedTopic !== 'all' || searchQuery
                  ? dt('Provoni të hiqni filtrat ose të kërkoni një temë tjetër.')
                  : dt('Publikimet zyrtare shfaqen këtu pasi redaksia e Zërit të Qytetarëve t’i publikojë.')}
            </p>
            {(resolutionFilter !== 'all' || selectedStream !== 'all' || selectedTopic !== 'all' || selectedOrigin !== 'all' || searchQuery || scopeToMine) && (
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
          <aside className="hidden xl:block" aria-label={dt('Njoftime')}>
            <div className="sticky top-4">
              <LiveNoticesFeed className="h-[calc(100vh-2rem)]" />
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
                  {index > 0 && page - visiblePages[index - 1] > 1 && <span className="px-1 text-slate-600 dark:text-slate-400" aria-hidden="true">…</span>}
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
          <div ref={readerRef} role="dialog" aria-modal="true" aria-label={activeArticle.title} className="fixed inset-0 z-[100] overflow-y-auto bg-slate-50 dark:bg-slate-950">
            <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-white/10 dark:bg-slate-950/95">
              <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[3px] bg-transparent">
                <div className="h-full bg-gradient-to-r from-blue-600 via-violet-500 to-rose-500" style={{ width: `${readProgress}%` }} />
              </div>
              <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
                <button type="button" onClick={closeArticle} className="font-serif font-black text-slate-900 dark:text-white">{dt('Zëri i Qytetarëve')} <span className="text-blue-700 dark:text-blue-300">/ Lajme</span></button>
                <div className="flex items-center gap-2">
                  <span className="hidden text-[11px] font-bold tabular-nums text-slate-600 dark:text-slate-400 sm:inline">{readProgress}%</span>
                  <button type="button" onClick={() => handleShare(activeArticle)} aria-label={dt('Më shumë mënyra shpërndarjeje')} className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-700 transition hover:bg-blue-100 hover:text-blue-700 dark:bg-slate-800 dark:text-slate-200"><Share2 className="h-4 w-4" aria-hidden="true" /></button>
                  <BackLink onClick={closeArticle} label="Lajmet" />
                </div>
              </div>
            </header>

            <div className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6 lg:px-8">
              <AdBanner position="article" className="max-w-none" municipality={activeArticle.municipality} />

              {/* Cinematic feature header */}
              <section className="relative isolate overflow-hidden rounded-[28px] bg-slate-900 text-white shadow-2xl">
                {activeArticle.imageUrl ? (
                  <img loading="lazy" decoding="async" src={activeArticle.imageUrl} alt="" className="absolute inset-0 -z-20 h-full w-full object-cover" />
                ) : (
                  <div aria-hidden="true" className="absolute inset-0 -z-20 bg-gradient-to-br from-[#061226] via-[#0b2b57] to-[#14408a]" />
                )}
                <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-t from-slate-950 via-slate-950/70 to-slate-950/10" />
                <div className="flex min-h-[340px] flex-col justify-end p-6 sm:min-h-[460px] sm:p-10 lg:p-14">
                  <div className="mb-4 flex flex-wrap items-center gap-2.5 text-xs font-bold">
                    <span className="rounded bg-rose-600 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide">{dt(activeArticle.category)}</span>
                    {activeArticle.isDemo && <span className="rounded-full border border-amber-300/60 bg-amber-300/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-amber-200">{dt('Shembull demo · jo lajm real')}</span>}
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 py-1 pl-1.5 pr-3 backdrop-blur"><MunicipalityShield name={activeArticle.municipality} size="sm" />{activeArticle.municipality}</span>
                  </div>
                  <h1 className="max-w-4xl font-serif text-3xl font-black leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">{activeArticle.title}</h1>
                  <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-semibold text-slate-200">
                    <span className="inline-flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-full bg-white/15 text-[11px] font-black">ZQ</span>{activeArticle.author || 'Redaksia e Zërit të Qytetarëve'}</span>
                    <span className="inline-flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" aria-hidden="true" />{formatNewsDate(activeArticle.date)}</span>
                    <span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" aria-hidden="true" />{activeArticle.readTime || '3 min lexim'}</span>
                  </div>
                </div>
              </section>

              <div className="grid gap-8 lg:grid-cols-[56px_minmax(0,1fr)_320px] lg:items-start xl:gap-10">
                <aside aria-label={dt('Shpërndaje lajmin')} className="order-1 flex items-center gap-2 border-b border-slate-200 pb-4 dark:border-white/10 lg:sticky lg:top-24 lg:flex-col lg:items-start lg:border-0 lg:pb-0">
                  <span className="mr-1 text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 lg:mb-1 lg:mr-0">{dt('Shpërndaje')}</span>
                  <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(articleUrl)}`} target="_blank" rel="noreferrer" aria-label={dt('Shpërndaje në Facebook')} className="grid h-10 w-10 place-items-center rounded-full bg-[#1877f2] text-xs font-black text-white transition hover:scale-105">f</a>
                  <a href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(articleUrl)}&text=${encodeURIComponent(activeArticle.title)}`} target="_blank" rel="noreferrer" aria-label={dt('Shpërndaje në X')} className="grid h-10 w-10 place-items-center rounded-full bg-slate-900 text-sm font-black text-white transition hover:scale-105 dark:bg-slate-700">𝕏</a>
                  <a href={`mailto:?subject=${encodeURIComponent(activeArticle.title)}&body=${encodeURIComponent(articleUrl)}`} aria-label={dt('Dërgo lajmin me email')} className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-700 transition hover:bg-blue-100 hover:text-blue-700 dark:bg-slate-800 dark:text-slate-200"><Mail className="h-4 w-4" aria-hidden="true" /></a>
                  <button type="button" onClick={copyArticleLink} aria-label="Kopjo lidhjen e lajmit" className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-700 transition hover:bg-blue-100 hover:text-blue-700 dark:bg-slate-800 dark:text-slate-200"><Copy className="h-4 w-4" aria-hidden="true" /></button>
                </aside>

                <article className="order-2 min-w-0">
                  <p className="border-l-4 border-blue-600 pl-5 font-serif text-xl font-semibold leading-relaxed text-slate-700 dark:border-blue-400 dark:text-slate-200 sm:text-2xl sm:leading-relaxed">{activeArticle.summary}</p>

                  <div className="prose prose-slate mt-9 max-w-none whitespace-pre-line text-base leading-8 text-slate-700 first-letter:float-left first-letter:mr-3 first-letter:mt-1 first-letter:font-serif first-letter:text-6xl first-letter:font-black first-letter:leading-[0.85] first-letter:text-blue-700 dark:prose-invert dark:text-slate-300 dark:first-letter:text-blue-300 sm:text-[18px] sm:leading-9">
                    {activeArticle.content}
                  </div>

                  {(() => {
                    const inlineUrl = (activeArticle as any).inlineImageUrl as string | undefined;
                    const videoUrl = (activeArticle as any).videoUrl as string | undefined;
                    return (
                      <>
                        {inlineUrl && (
                          <figure className="mt-8"><img src={inlineUrl} alt="" loading="lazy" className="w-full rounded-2xl bg-slate-200 object-cover dark:bg-slate-800" /></figure>
                        )}
                        {videoUrl && (
                          <div className="mt-8 overflow-hidden rounded-2xl bg-slate-900">
                            {videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be') ? (
                              <iframe src={videoUrl.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/')} title="Video e lajmit" className="aspect-video w-full" allowFullScreen />
                            ) : (
                              <video src={videoUrl} controls className="aspect-video w-full" />
                            )}
                          </div>
                        )}
                      </>
                    );
                  })()}

                  {/* Key facts */}
                  <aside aria-label={dt('Në një shikim')} className="mt-9 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 text-sm dark:border-white/10 dark:bg-white/10 sm:grid-cols-4">
                    {[
                      { label: dt('Kategoria'), value: dt(activeArticle.category) },
                      { label: dt('Komuna'), value: activeArticle.municipality },
                      { label: dt('Publikuar'), value: formatNewsDate(activeArticle.date) },
                      { label: dt('Leximi'), value: activeArticle.readTime || '3 min' },
                    ].map(fact => (
                      <div key={fact.label} className="bg-white p-4 dark:bg-slate-900">
                        <div className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">{fact.label}</div>
                        <div className="mt-1 font-extrabold text-slate-900 dark:text-white">{fact.value}</div>
                      </div>
                    ))}
                  </aside>

                  {!!activeArticle.relatedReportIds?.length && (
                    <div className="mt-6 flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200">
                      <Link2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                      Ky njoftim lidhet me {activeArticle.relatedReportIds.length} raportime qytetare.
                    </div>
                  )}

                  <div className="mt-8"><AdBanner position="feed" className="max-w-none" municipality={activeArticle.municipality} /></div>

                  {/* Call to action */}
                  <section className="relative mt-8 overflow-hidden rounded-3xl bg-gradient-to-br from-[#0b2b57] to-[#14408a] p-6 text-white sm:p-8">
                    <div aria-hidden="true" className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-sky-300/20 blur-2xl" />
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-200">{dt('Zëri juaj ka rëndësi')}</p>
                    <h2 className="mt-2 font-serif text-2xl font-black leading-tight sm:text-3xl">{dt('Keni një problem në komunën tuaj?')}</h2>
                    <p className="mt-2 max-w-xl text-sm leading-relaxed text-blue-100">{dt('Raportojeni dhe ndiqeni me Track-ID derisa të zgjidhet.')}</p>
                    <div className="mt-5 flex flex-wrap gap-3">
                      <Link to="/raporto" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-5 text-xs font-black text-[#0b2b57] transition hover:bg-blue-50">{dt('Raporto një problem')} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></Link>
                      <Link to="/lajmero" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-5 text-xs font-bold backdrop-blur transition hover:bg-white/20">{dt('Lajmëro: dërgo një lajm')}</Link>
                      <Link to="/harta" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-5 text-xs font-bold backdrop-blur transition hover:bg-white/20">{dt('Shiko hartën')}</Link>
                    </div>
                  </section>

                  <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5 dark:border-white/10">
                    <BackLink onClick={closeArticle} label="Të gjitha lajmet" />
                    <button type="button" onClick={copyArticleLink} className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 transition hover:border-blue-300 hover:text-blue-700 dark:border-white/10 dark:text-slate-300">
                      <Copy className="h-3.5 w-3.5" aria-hidden="true" /> {dt('Kopjo lidhjen')}
                    </button>
                  </div>
                </article>

                <aside className="order-3 space-y-6 lg:sticky lg:top-24">
                  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-slate-900">
                    <h2 className="mb-1 flex items-center justify-between border-b border-slate-200 pb-3 font-serif text-lg font-black text-slate-950 dark:border-white/10 dark:text-white">{dt('Lajmet kryesore')}<span className="h-2 w-2 rounded-full bg-rose-600" aria-hidden="true" /></h2>
                    <div className="divide-y divide-slate-100 dark:divide-white/10">
                      {sidebarArticles.map((news, index) => (
                        <button key={news.id} type="button" onClick={() => openArticle(news)} className="group flex w-full gap-3 py-3 text-left">
                          <span className="font-serif text-2xl font-black leading-none text-slate-500 dark:text-slate-500">{index + 1}</span>
                          <span className="min-w-0">
                            <span className="block text-[10px] font-black uppercase tracking-wider text-rose-700 dark:text-rose-400">{dt(news.category)}</span>
                            <span className="mt-0.5 line-clamp-3 block text-xs font-extrabold leading-snug text-slate-950 group-hover:text-blue-700 dark:text-white dark:group-hover:text-blue-300">{news.title}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </section>
                  <AdBanner position="sidebar" municipality={activeArticle.municipality} />
                  <AdBanner position="sidebar" municipality={activeArticle.municipality} />
                </aside>
              </div>

              {relatedArticles.length > 0 && (
                <section aria-labelledby="related-heading" className="border-t-2 border-slate-900 pt-6 dark:border-white">
                  <h2 id="related-heading" className="mb-5 font-serif text-2xl font-black text-slate-950 dark:text-white">{dt('Lexo gjithashtu')}</h2>
                  <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                    {relatedArticles.map(related => (
                      <button key={related.id} type="button" onClick={() => openArticle(related)} className="group overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-xs transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg dark:border-white/10 dark:bg-slate-900">
                        {related.imageUrl && <img src={related.imageUrl} alt="" loading="lazy" className="aspect-[16/10] w-full object-cover transition duration-500 group-hover:scale-[1.03]" />}
                        <span className="block p-4">
                          <span className="block text-[10px] font-black uppercase tracking-wider text-rose-700 dark:text-rose-400">{dt(related.category)}</span>
                          <span className="mt-1.5 line-clamp-3 block text-sm font-extrabold leading-snug text-slate-900 group-hover:text-blue-700 dark:text-white dark:group-hover:text-blue-300">{related.title}</span>
                          <span className="mt-2 block text-[11px] text-slate-600 dark:text-slate-400">{related.municipality} · {formatNewsDate(related.date)}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              <AdBanner position="feed" className="max-w-none" municipality={activeArticle.municipality} />
            </div>
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
