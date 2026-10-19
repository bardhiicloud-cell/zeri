/**
 * Guided tours: which page has which steps, and where each arrow points.
 *
 * A step finds its target with CSS selectors, the first one that is visible on
 * screen wins (the same action lives in the top bar on a laptop and in the dock on a
 * phone). A step whose target is not on screen shows as a centred card instead of
 * pointing at nothing. Text is Albanian source text; the component passes it through dt().
 */
export interface TourStep {
  /** Selectors tried in order; `target:closest(...)` is not supported, use `closestButton`. */
  selectors: string[];
  /** Resolve the matched element to its nearest <button>/<a> (an icon inside a button). */
  closestButton?: boolean;
  title: string;
  body: string;
}

export interface Tour {
  id: string;
  /** Route without language prefix; matched exactly. */
  route: string;
  /** Short name on the launcher. */
  label: string;
  /** The tour only applies while this selector is on the page (a form step or an open dialog). */
  whenSelector?: string;
  steps: TourStep[];
}

export const TOURS: readonly Tour[] = [
  {
    id: 'home',
    route: '/',
    label: 'Si funksionon platforma',
    steps: [
      {
        selectors: ['header a[href$="/raporto"]', 'a[href$="/raporto"]'],
        title: 'Raporto një problem',
        body: 'Gropë në rrugë, mbeturina, ndriçim, ujë, shkollë, spital... Shtypni këtu, shtoni foto dhe vendndodhjen, dhe raporti shkon te institucioni përgjegjës. Nuk duhet regjistrim.',
      },
      {
        selectors: ['a[href$="/lajmero"]'],
        title: 'Raporto një lajm',
        body: 'Keni parë diçka që duhet ditur? Dërgojani redaksisë tekstin, foton ose videon. Merrni një kod për ta ndjekur.',
      },
      {
        selectors: ['a[href$="/donacion"]'],
        title: 'Ndihmë dhe donacione',
        body: 'Nëse keni nevojë për ndihmë, aplikoni për një rast social. Nëse doni të ndihmoni, shihni rastet e verifikuara dhe dhuroni.',
      },
      {
        selectors: ['a[href$="/shendetesia"]'],
        title: 'Regjistri shëndetësor',
        body: 'Për persona me sëmundje dhe nevojë për barna që spitalet nuk i kanë. Shënohet lloji i sëmundjes dhe medikamenti, që masat të merren saktë.',
      },
      {
        selectors: ['a[href$="/trackid"]', 'a[href$="/raportet-e-mia"]'],
        title: 'Ndiqni çdo dërgesë',
        body: 'Çdo raport merr një Track-ID. Futeni këtu për të parë statusin në çdo moment.',
      },
      {
        selectors: ['nav[aria-label] .lucide-plus'],
        closestButton: true,
        title: 'Butoni "+" në telefon',
        body: 'Në telefon, shtypni "+" për të raportuar problem, lajm, ide ose për të kërkuar ndihmë.',
      },
    ],
  },
  {
    id: 'report-1',
    route: '/raporto',
    label: 'Si të raportoj',
    whenSelector: '[data-tour="report-upload"]',
    steps: [
      { selectors: ['[data-tour="report-upload"]'], title: 'Hapi 1: Dëshmia', body: 'Shtypni këtu dhe zgjidhni foto, video, dokument ose audio. Fotot zvogëlohen automatikisht që të ngarkohen shpejt.' },
      { selectors: ['[data-tour="report-continue"]'], title: 'Vazhdoni', body: 'Kur dëshmia është shtuar, shtypni këtu për të konfirmuar vendndodhjen dhe llojin e raportit.' },
    ],
  },
  {
    id: 'report-2',
    route: '/raporto',
    label: 'Si të raportoj',
    whenSelector: '[data-tour="report-topic"]',
    steps: [
      { selectors: ['[data-tour="report-ai"]'], title: 'Krijim me AI', body: 'Opsionale: AI lexon foton dhe plotëson titullin, kategorinë dhe rëndësinë.' },
      { selectors: ['[data-tour="report-topic"]'], title: 'Zgjidhni kategorinë', body: 'Pas zgjedhjes, më poshtë shfaqen sugjerime për institucionin që e zgjidh problemin.' },
      { selectors: ['[data-tour="report-sector"]'], title: 'Institucioni përgjegjës', body: 'Sistemi sugjeron komunën ose ministrinë e duhur sipas kategorisë dhe vendit. Mund ta ndryshoni ose ta kërkoni vetë.' },
      { selectors: ['[data-tour="report-location"]'], title: 'Vendndodhja', body: 'Zgjidhni komunën, shtypni "Zbulo Lokacionin" ose klikoni në hartë për të vendosur gjilpërën saktë. Sistemi kontrollon që pika të jetë në komunën e zgjedhur.' },
      { selectors: ['[data-tour="report-identity"]', '[data-tour="report-anon"]'], title: 'Identiteti', body: 'Mund të raportoni si mysafir pa llogari. Shënoni emrin e telefonin ose zgjidhni statusin anonim.' },
      { selectors: ['[data-tour="report-submit"]'], title: 'Dërgoni', body: 'Shtypni për ta dërguar. Do të merrni Track-ID për ta ndjekur raportin; ruajeni.' },
    ],
  },
  {
    id: 'news',
    route: '/lajmero',
    label: 'Si të dërgoj lajm',
    whenSelector: '#tip-body',
    steps: [
      { selectors: ['#tip-cat'], title: 'Kategoria dhe komuna', body: 'Zgjidhni llojin e lajmit dhe komunën ku ndodhi.' },
      { selectors: ['#tip-body'], title: 'Shkruani çfarë ndodhi', body: 'Përshkruani faktet: çfarë, ku, kur. Pa spekulime.' },
      { selectors: ['[data-tour="tip-media"]'], title: 'Foto dhe video', body: 'Shtoni dëshmi nëse keni. Ndihmon që redaksia ta verifikojë më shpejt.' },
      { selectors: ['[data-tour="tip-submit"]'], title: 'Dërgoni', body: 'Pas dërgimit merrni një kod ndjekjeje.' },
    ],
  },
  {
    id: 'donations',
    route: '/donacion',
    label: 'Ndihmë dhe donacione',
    steps: [
      { selectors: ['[data-tour="donation-apply"]'], title: 'Keni nevojë për ndihmë?', body: 'Shtypni për të aplikuar për një rast ndihme. Rasti shqyrtohet para se të shfaqet publikisht.' },
      { selectors: ['[data-tour="donation-causes"]'], title: 'Doni të ndihmoni?', body: 'Filtroni sipas llojit, hapni një rast dhe ndiqni udhëzimet për dhurim.' },
    ],
  },
  {
    id: 'health',
    route: '/shendetesia',
    label: 'Regjistri shëndetësor',
    steps: [
      { selectors: ['[data-tour="health-register"]'], title: 'Regjistroni një rast', body: 'Për sëmundje, barna që mungojnë ose ndihmë shëndetësore. Shënoni diagnozën, medikamentin e nevojshëm dhe urgjencën. Mund të zgjidhni të mbeteni anonim për publikun.' },
      { selectors: ['[data-tour="health-tabs"]'], title: 'Shikoni sipas llojit', body: 'Ndërroni mes rasteve, barnave që mungojnë dhe statistikave.' },
      { selectors: ['[data-tour="health-filters"]'], title: 'Filtroni', body: 'Sipas komunës dhe urgjencës, që institucionet të marrin masa në vendin e duhur.' },
    ],
  },
];

/** Removes a leading `/sq`-style language segment. */
export function stripLanguage(pathname: string): string {
  const path = pathname.replace(/\/+$/, '') || '/';
  const match = /^\/[a-z]{2,3}(?:-[A-Za-z]+)?(\/.*)?$/.exec(path);
  // Only treat the first segment as a language when the rest is a known tour route or root.
  if (match && (TOURS.some(t => t.route === (match[1] || '/')))) return match[1] || '/';
  return path;
}

export function toursForRoute(pathname: string): Tour[] {
  const route = stripLanguage(pathname);
  return TOURS.filter(tour => tour.route === route);
}

export const tourSeenKey = (id: string) => `zq_tour_seen_${id}`;
