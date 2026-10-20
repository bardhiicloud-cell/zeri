/**
 * Guided tours: which page has which steps, and where each arrow points.
 *
 * A step finds its target with CSS selectors, the first one that is visible on
 * screen wins (the same action lives in the top bar on a laptop and in the dock on a
 * phone). A step with no selectors is a centred card. A step whose target is not on
 * screen is skipped after a moment instead of pointing at nothing. Text is Albanian
 * source text; the component passes it through dt().
 *
 * Two kinds of tour exist:
 *  - the platform tour (`home`): map, "+", menu and then every menu entry in the order
 *    it appears on screen. It differs per device because a phone has a dock and a
 *    sheet while a laptop has a top bar and a sidebar.
 *  - one tour per page, plus a generic one for any page that has none, so the "?"
 *    button always has something to say.
 */
export type TourDevice = 'mobile' | 'desktop';

/** What the tour opens on a phone while a step is shown: the menu sheet or the "+" actions. */
export type TourPanel = 'menu' | 'create';

export interface TourStep {
  /** Selectors tried in order; an empty list makes a centred card. */
  selectors: string[];
  /** Resolve the matched element to its nearest <button>/<a> (an icon inside a button). */
  closestButton?: boolean;
  /** Phone only: the panel the tour opens itself so the visitor is shown the item instead of being told to hunt for it. */
  panel?: TourPanel;
  /** Only shown on this device class; unset means both. */
  device?: TourDevice;
  /** Small label above the title, e.g. the menu section the step belongs to. */
  section?: string;
  title: string;
  body: string;
}

export interface Tour {
  id: string;
  /** Route without language prefix; matched exactly. */
  route: string;
  /** Other routes that serve the same page. */
  aliases?: string[];
  /** Short name on the launcher. */
  label: string;
  /** The tour only applies while this selector is on the page (a form step or an open dialog). */
  whenSelector?: string;
  /** A fallback tour: reachable from "?" but never offered with the first-visit question. */
  generic?: boolean;
  steps: TourStep[];
}

/* ---------------------------------------------------------------- menu copy */

interface NavCopy { title: string; body: string }

/** One explanation per menu entry, keyed by href. Shared by the phone sheet, the sidebar and the top bar. */
const NAV_COPY: Record<string, NavCopy> = {
  '/raporto': { title: 'Raporto një problem', body: 'Gropë, mbeturina, ndriçim, ujë, shkollë... Shtoni foto dhe vendndodhjen dhe raporti shkon te institucioni përgjegjës. Nuk duhet llogari.' },
  '/harta': { title: 'Harta e raportimeve', body: 'Çdo raport në një hartë interaktive. Filtroni sipas komunës, temës ose urgjencës dhe prekni një pikë për detaje.' },
  '/detailed-registry': { title: 'Raportimet', body: 'Lista e plotë e ankesave të regjistruara nga të gjithë, me kërkim dhe filtra.' },
  '/raportet-e-mia': { title: 'Raportet e mia', body: 'Gjithçka që keni dërguar nga kjo pajisje ose llogaria juaj, me statusin e secilit raport.' },
  '/trackid': { title: 'Gjej raportin tim', body: 'Keni një Track-ID? Futeni këtu dhe shihni kush e ka marrë raportin dhe çfarë po bëhet me të.' },
  '/lajme': { title: 'Lajme dhe njoftime', body: 'Lajme të verifikuara nga redaksia dhe njoftime zyrtare nga komunat.' },
  '/kosova': { title: 'Kosova, historia dhe pavarësia', body: 'Historia, pavarësia dhe arkivi i UÇK-së në një vend.' },
  '/Idea': { title: 'Banka e ideve', body: 'Propozoni një ide për komunën tuaj. Të tjerët mund ta mbështesin dhe idetë më të mira shkojnë te institucionet.' },
  '/sondazhet': { title: 'Sondazhe dhe votime', body: 'Shprehni mendimin për çështje publike dhe shihni rezultatet.' },
  '/projektet': { title: 'Projektet qytetare', body: 'Nisma dhe projekte komunitare: ndiqni çfarë po bëhet dhe përfshihuni.' },
  '/statistikat': { title: 'Statistikat dhe analiza', body: 'Sa raporte janë dërguar dhe sa janë zgjidhur, sipas komunës dhe temës, të përditësuara vazhdimisht.' },
  '/kontakt-numrat': { title: 'Numrat dhe institucionet', body: 'Numrat emergjentë (112) dhe kontaktet e institucioneve, gati për t’u telefonuar me një prekje.' },
  '/shendetesia': { title: 'Regjistri shëndetësor', body: 'Për persona me sëmundje dhe nevojë për barna që spitalet nuk i kanë. Shënohet lloji i sëmundjes dhe medikamenti, që masat të merren saktë. Mund të mbeteni anonim për publikun.' },
  '/donacion': { title: 'Ndihma dhe donacione', body: 'Keni nevojë për ndihmë? Aplikoni për një rast social. Doni të ndihmoni? Shihni rastet e verifikuara dhe dhuroni.' },
  '/ndihma': { title: 'Qendra e ndihmës', body: 'Pyetje të shpeshta dhe udhëzime të shkurtra për raportimin, gjurmimin dhe përdorimin e platformës.' },
  '/sherbimet': { title: 'Shërbimet publike', body: 'Shërbime komunale e shtetërore: çfarë ju duhet, ku shkoni dhe si i kërkoni.' },
  '/komunat': { title: 'Komunat', body: 'Të 38 komunat e Kosovës. Zgjidhni komunën tuaj për të parë raportet dhe njoftimet e saj.' },
  '/kontakt': { title: 'Kontakt', body: 'Na shkruani ose na telefononi. Për ndihmë të menjëhershme përdorni asistentin.' },
  '/rreth-projektit': { title: 'Rreth projektit', body: 'Misioni i platformës, kush qëndron pas saj dhe si funksionon.' },
  '/partneret': { title: 'Partnerët dhe reklama', body: 'Për institucione, biznese dhe OJQ që duan të bëhen partnerë ose të reklamohen.' },
};

const menuStep = (href: string, section: string, device: TourDevice, panel?: TourPanel): TourStep => ({
  selectors: [`[data-tour-menu="${href}"]`],
  device,
  panel,
  section,
  title: NAV_COPY[href].title,
  body: NAV_COPY[href].body,
});

/** Phone sheet, in the order the entries appear once every group is unfolded. */
const MOBILE_MENU_ORDER: [string, string][] = [
  ['/raporto', 'Kryesore'], ['/harta', 'Kryesore'], ['/detailed-registry', 'Kryesore'], ['/raportet-e-mia', 'Kryesore'], ['/lajme', 'Kryesore'],
  ['/kosova', 'Kosova & Historia'],
  ['/Idea', 'Pjesëmarrja qytetare'], ['/sondazhet', 'Pjesëmarrja qytetare'], ['/projektet', 'Pjesëmarrja qytetare'],
  ['/statistikat', 'Shërbime & transparencë'], ['/kontakt-numrat', 'Shërbime & transparencë'], ['/shendetesia', 'Shërbime & transparencë'],
  ['/donacion', 'Shërbime & transparencë'], ['/ndihma', 'Shërbime & transparencë'], ['/sherbimet', 'Shërbime & transparencë'], ['/komunat', 'Shërbime & transparencë'],
  ['/trackid', 'Të tjera'], ['/kontakt', 'Të tjera'], ['/rreth-projektit', 'Të tjera'], ['/partneret', 'Të tjera'],
];

/** Laptop: top bar first, then the sidebar from top to bottom, as the eye travels. */
const DESKTOP_MENU_ORDER: [string, string][] = [
  ['/trackid', 'Shiriti lart'],
  ['/harta', 'Shiriti anësor'], ['/detailed-registry', 'Shiriti anësor'], ['/kosova', 'Shiriti anësor'], ['/sondazhet', 'Shiriti anësor'],
  ['/statistikat', 'Shiriti anësor'], ['/kontakt-numrat', 'Shiriti anësor'], ['/shendetesia', 'Shiriti anësor'], ['/donacion', 'Shiriti anësor'], ['/ndihma', 'Shiriti anësor'],
  ['/raportet-e-mia', 'Shiriti anësor'], ['/Idea', 'Shiriti anësor'], ['/partneret', 'Shiriti anësor'],
  ['/komunat', 'Shiriti lart'], ['/sherbimet', 'Shiriti lart'], ['/projektet', 'Shiriti lart'], ['/lajme', 'Shiriti lart'], ['/kontakt', 'Shiriti lart'], ['/rreth-projektit', 'Shiriti lart'],
];

/** Closing step of every tour that explains the "?" button. */
const HELP_BUTTON_STEP: TourStep = {
  selectors: ['[data-tour-launcher]'],
  title: 'Butoni “?” është gjithmonë këtu',
  body: 'Në çdo faqe, shtypni “?” për të parë sërish udhëzuesin e asaj faqeje ose turin e plotë të platformës. Nuk zhduket kurrë.',
};

const PLATFORM_TOUR: Tour = {
  id: 'home',
  route: '/',
  label: 'Si funksionon platforma',
  steps: [
    {
      selectors: [],
      title: 'Mirë se vini në Zëri',
      body: 'Do t’ju tregojmë gjithçka hap pas hapi: hartën, butonin “+”, menunë dhe çdo faqe në të. Zgjat rreth dy minuta dhe mund ta mbyllni kurdo.',
    },

    /* ---- phone: dock, "+", menu ---- */
    { selectors: ['[data-tour="dock-map"]'], device: 'mobile', section: 'Shiriti poshtë', title: 'Harta', body: 'Shihni çfarë po raportohet pranë jush dhe në komunën tuaj, në një hartë.' },
    { selectors: ['[data-tour="dock-create"]'], device: 'mobile', section: 'Shiriti poshtë', title: 'Butoni “+”', body: 'Butoni i madh në mes. Prej tij bëni gjithçka që dërgohet ose kërkohet: raport, lajm, ide, sondazh, ndihmë.' },
    { selectors: ['[data-tour="create-menu"]'], device: 'mobile', panel: 'create', section: 'Shiriti poshtë', title: 'Çfarë hapet me “+”', body: 'Raporto një problem, ndiq raportet e tua me Track-ID, dërgo lajm, propozo ide, voto, kërko ndihmë ose bëhu partner. Prekni një rresht dhe shkoni drejt e aty.' },
    { selectors: ['[data-tour="dock-news"]'], device: 'mobile', section: 'Shiriti poshtë', title: 'Lajme', body: 'Lajmet e verifikuara nga redaksia dhe njoftimet zyrtare të komunave.' },
    { selectors: ['[data-tour="dock-menu"]'], device: 'mobile', section: 'Shiriti poshtë', title: 'Menuja', body: 'Këtu është gjithçka tjetër. Po e hapim tani dhe po kalojmë një nga një nëpër të.' },
    { selectors: ['[data-tour="menu-search"]'], device: 'mobile', panel: 'menu', section: 'Menuja', title: 'Kërkimi', body: 'Shkruani një faqe ose komunë dhe shkoni drejt e aty, pa kaluar nëpër listë.' },
    { selectors: ['#mobile-scope-heading'], device: 'mobile', panel: 'menu', section: 'Menuja', title: 'Zona juaj', body: 'Zgjidhni komunën tuaj dhe e gjithë platforma filtrohet sipas saj: hartë, lajme, raporte.' },
    { selectors: ['#mobile-language-heading'], device: 'mobile', panel: 'menu', section: 'Menuja', title: 'Gjuha', body: 'Platforma është në shumë gjuhë. Ndërrojeni këtu, mbeteni në të njëjtën faqe.' },
    ...MOBILE_MENU_ORDER.map(([href, section]) => menuStep(href, section, 'mobile', 'menu')),

    /* ---- laptop: top bar and sidebar ---- */
    { selectors: ['[data-tour="top-report"]'], device: 'desktop', section: 'Shiriti lart', title: 'Raporto', body: 'Butoni kryesor, gjithmonë në krye. Shtypeni, shtoni foto dhe vendndodhjen, dhe raporti shkon te institucioni përgjegjës.' },
    ...DESKTOP_MENU_ORDER.map(([href, section]) => menuStep(href, section, 'desktop')),
    { selectors: [], device: 'desktop', section: 'Shkurtore', title: 'Kërkim i shpejtë', body: 'Shtypni Ctrl + K (ose ⌘ + K në Mac) për të kërkuar çdo faqe ose komunë nga kudo.' },

    HELP_BUTTON_STEP,
  ],
};

/* ----------------------------------------------------------------- page tours */

const MENU_HINT_MOBILE: TourStep = { selectors: ['[data-tour="dock-menu"]'], device: 'mobile', title: 'Menuja', body: 'Nga këtu arrini çdo faqe tjetër: raportim, hartë, regjistër shëndetësor, donacione, kontakt dhe më shumë.' };
const MENU_HINT_DESKTOP: TourStep = { selectors: ['aside nav a[href]'], device: 'desktop', title: 'Shiriti anësor', body: 'Nga këtu arrini çdo faqe tjetër: raportim, hartë, regjistër shëndetësor, donacione, kontakt dhe më shumë.' };
const HEADING = ['main h1', 'h1'];

/** A short page tour: what the page is for, then the menu, then the "?" button. */
const simplePage = (id: string, route: string, label: string, title: string, body: string, extra: Partial<Tour> = {}, middle: TourStep[] = []): Tour => ({
  id,
  route,
  label,
  ...extra,
  steps: [{ selectors: HEADING, title, body }, ...middle, MENU_HINT_MOBILE, MENU_HINT_DESKTOP, HELP_BUTTON_STEP],
});

export const TOURS: readonly Tour[] = [
  PLATFORM_TOUR,
  {
    id: 'report-1',
    route: '/raporto',
    label: 'Si të raportoj',
    whenSelector: '[data-tour="report-upload"]',
    steps: [
      { selectors: ['[data-tour="report-upload"]'], title: 'Hapi 1: Dëshmia', body: 'Shtypni këtu dhe zgjidhni foto, video, dokument ose audio. Fotot zvogëlohen automatikisht që të ngarkohen shpejt.' },
      { selectors: ['[data-tour="report-continue"]'], title: 'Vazhdoni', body: 'Kur dëshmia është shtuar, shtypni këtu për të konfirmuar vendndodhjen dhe llojin e raportit.' },
      HELP_BUTTON_STEP,
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
      { selectors: ['[data-tour="report-location"]'], title: 'Vendndodhja', body: 'Zgjidhni komunën, shtypni “Zbulo Lokacionin” ose klikoni në hartë për të vendosur gjilpërën saktë. Sistemi kontrollon që pika të jetë në komunën e zgjedhur.' },
      { selectors: ['[data-tour="report-identity"]', '[data-tour="report-anon"]'], title: 'Identiteti', body: 'Mund të raportoni si mysafir pa llogari. Shënoni emrin e telefonin ose zgjidhni statusin anonim.' },
      { selectors: ['[data-tour="report-submit"]'], title: 'Dërgoni', body: 'Shtypni për ta dërguar. Do të merrni Track-ID për ta ndjekur raportin; ruajeni.' },
      HELP_BUTTON_STEP,
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
      HELP_BUTTON_STEP,
    ],
  },
  {
    id: 'donations',
    route: '/donacion',
    label: 'Ndihmë dhe donacione',
    steps: [
      { selectors: ['[data-tour="donation-apply"]'], title: 'Keni nevojë për ndihmë?', body: 'Shtypni për të aplikuar për një rast ndihme. Rasti shqyrtohet para se të shfaqet publikisht.' },
      { selectors: ['[data-tour="donation-causes"]'], title: 'Doni të ndihmoni?', body: 'Filtroni sipas llojit, hapni një rast dhe ndiqni udhëzimet për dhurim.' },
      HELP_BUTTON_STEP,
    ],
  },
  {
    id: 'health',
    route: '/shendetesia',
    aliases: ['/semundjet'],
    label: 'Regjistri shëndetësor',
    steps: [
      { selectors: ['[data-tour="health-register"]'], title: 'Regjistroni një rast', body: 'Për sëmundje, barna që mungojnë ose ndihmë shëndetësore. Shënoni diagnozën, medikamentin e nevojshëm dhe urgjencën. Mund të zgjidhni të mbeteni anonim për publikun.' },
      { selectors: ['[data-tour="health-tabs"]'], title: 'Shikoni sipas llojit', body: 'Ndërroni mes rasteve, barnave që mungojnë dhe statistikave.' },
      { selectors: ['[data-tour="health-filters"]'], title: 'Filtroni', body: 'Sipas komunës dhe urgjencës, që institucionet të marrin masa në vendin e duhur.' },
      HELP_BUTTON_STEP,
    ],
  },
  {
    id: 'map',
    route: '/harta',
    label: 'Harta e raportimeve',
    steps: [
      { selectors: ['[data-tour="map-canvas"]', 'main h1'], title: 'Harta e raportimeve', body: 'Çdo pikë është një raport. Zmadhoni me dy gishta (ose rrotën e miut) dhe prekni një pikë për ta hapur: shihni foton, statusin dhe institucionin përgjegjës.' },
      { selectors: ['[data-tour="map-search"]'], device: 'mobile', title: 'Zgjidhni komunën', body: 'Ndërroni komunën këtu dhe harta shkon vetë aty. Për temën dhe urgjencën përdorni butonin e filtrave.' },
      MENU_HINT_MOBILE,
      MENU_HINT_DESKTOP,
      HELP_BUTTON_STEP,
    ],
  },
  simplePage('news-list', '/lajme', 'Lajmet', 'Lajmet', 'Lajmet e verifikuara nga redaksia dhe njoftimet e komunave. Prekni një lajm për ta lexuar të plotë.', { aliases: ['/lajmet'] }),
  simplePage('track', '/trackid', 'Ndiq një raport', 'Ndiq një raport', 'Futni Track-ID për të parë statusin e raportit. Raportet e dërguara nga kjo pajisje shfaqen këtu vetë.', { aliases: ['/raportet-e-mia', '/trackid/detaje'] }),
  simplePage('stats', '/statistikat', 'Statistikat', 'Statistikat', 'Numrat e raportimeve dhe zgjidhjeve, të përditësuar vazhdimisht. Krahasoni komunat dhe temat.', { aliases: ['/transparenca'] }),
  simplePage('polls', '/sondazhet', 'Sondazhet', 'Sondazhet', 'Votoni në çështje publike dhe shihni rezultatet. Një votë për sondazh.', { aliases: ['/sondazhe'] }),
  simplePage('ideas', '/Idea', 'Banka e ideve', 'Banka e ideve', 'Propozoni një ide për komunën tuaj; të tjerët mund ta mbështesin.'),
  simplePage('contact', '/kontakt', 'Kontakti', 'Kontakti', 'Na shkruani këtu. Për ndihmë të menjëhershme përdorni asistentin (butoni i rrumbullakët në këtë faqe).', { aliases: ['/kontakte'] }),
  simplePage('muni', '/komunat', 'Komunat', 'Komunat', 'Zgjidhni komunën tuaj për të parë raportet dhe njoftimet e saj.'),
  simplePage('registry', '/detailed-registry', 'Raportimet', 'Raportimet', 'Të gjitha ankesat e regjistruara, me kërkim dhe filtra. Hapni një rast për të parë historikun e tij.', { aliases: ['/regjistri', '/registry'] }),
  simplePage('numbers', '/kontakt-numrat', 'Numrat e rëndësishëm', 'Numrat dhe institucionet', 'Numrat emergjentë dhe kontaktet e institucioneve. Telefononi 112 për rrezik të menjëhershëm.'),
  simplePage('help', '/ndihma', 'Qendra e ndihmës', 'Qendra e ndihmës', 'Kërkoni një temë ose hapni një pyetje të shpeshtë. Këtu mund ta shihni edhe turin e plotë të platformës.'),
  simplePage('services', '/sherbimet', 'Shërbimet publike', 'Shërbimet publike', 'Shërbime komunale e shtetërore: çfarë ju duhet, ku shkoni dhe si i kërkoni.'),
  simplePage('projects', '/projektet', 'Projektet', 'Projektet qytetare', 'Nisma dhe projekte komunitare. Ndiqni çfarë po bëhet dhe përfshihuni.'),
  simplePage('partners', '/partneret', 'Partnerët', 'Partnerët dhe reklama', 'Për institucione, biznese dhe OJQ që duan të bëhen partnerë ose të reklamohen në platformë.'),
  simplePage('about', '/rreth-projektit', 'Rreth projektit', 'Rreth projektit', 'Misioni i platformës, kush qëndron pas saj dhe si funksionon.', { aliases: ['/rreth-nesh'] }),
  simplePage('kosova', '/kosova', 'Kosova', 'Kosova, historia dhe pavarësia', 'Historia, pavarësia dhe arkivi i UÇK-së. Zgjidhni një kapitull për ta lexuar.'),
];

/* --------------------------------------------------------------------- lookup */

const routesOf = (tour: Tour): string[] => [tour.route, ...(tour.aliases ?? [])];

/** Removes a leading `/sq`-style language segment. */
export function stripLanguage(pathname: string): string {
  const path = pathname.replace(/\/+$/, '') || '/';
  const match = /^\/[a-z]{2,3}(?:-[A-Za-z]+)?(\/.*)?$/.exec(path);
  // Only treat the first segment as a language when the rest is a known tour route or root.
  if (match && (TOURS.some(t => routesOf(t).includes(match[1] || '/')))) return match[1] || '/';
  return path;
}

export function toursForRoute(pathname: string): Tour[] {
  const route = stripLanguage(pathname);
  return TOURS.filter(tour => routesOf(tour).includes(route));
}

export function tourById(id: string): Tour | undefined {
  return TOURS.find(tour => tour.id === id);
}

/** The platform tour: the same on every page, so the "?" menu and the help page can start it from anywhere. */
export const PLATFORM_TOUR_ID = PLATFORM_TOUR.id;

/** A page without a tour of its own still gets a short one, so "?" is never empty. */
export function genericTourFor(pathname: string): Tour {
  const route = stripLanguage(pathname);
  return {
    id: `page${route.replace(/[^A-Za-z0-9]+/g, '-')}`,
    route,
    label: 'Si ta përdor këtë faqe',
    generic: true,
    steps: [
      { selectors: HEADING, title: 'Ku jeni', body: 'Titulli tregon në cilën faqe jeni. Përmbajtja më poshtë është e ndarë në pjesë; lëvizni poshtë për të parë të gjitha.' },
      MENU_HINT_MOBILE,
      MENU_HINT_DESKTOP,
      HELP_BUTTON_STEP,
    ],
  };
}

/** Steps that fit the screen the visitor is on. */
export function stepsForDevice(tour: Tour, device: TourDevice): TourStep[] {
  return tour.steps.filter(step => !step.device || step.device === device);
}

export const tourSeenKey = (id: string) => `zq_tour_seen_${id}`;
/** Set when the visitor chose "do not ask me again": the "?" button stays, the questions stop. */
export const TOUR_MUTED_KEY = 'zq_tour_muted';
/** Fired (optionally with `{ detail: { id } }`) to open a tour from anywhere; defaults to the platform tour. */
export const OPEN_TOUR_EVENT = 'zeri:open-tour';
/** Fired by the tour to open or close the phone's "+" list and menu sheet; detail is `'menu' | 'create' | null`. */
export const TOUR_PANEL_EVENT = 'zq:tour-panel';
