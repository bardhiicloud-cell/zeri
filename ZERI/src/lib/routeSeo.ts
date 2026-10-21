/**
 * Single source of truth for the SEO of the public, crawlable routes.
 *
 * Two consumers read this table:
 *  - scripts/prerender.ts writes it into the static HTML of every route at build
 *    time, so the title, description, canonical URL and a semantic summary are in
 *    the first response, before any JavaScript runs;
 *  - usePageMeta applies the same strings after the app mounts, so what a crawler
 *    reads and what the browser tab shows can never disagree.
 *
 * Only add a route here when it is public, exists in the router and carries no
 * user-specific data. Report-tracking, account and staff pages stay out.
 * Keep this file free of imports from the app: the build script loads it in Node.
 */

export const SITE_URL = 'https://zeriqytetarve.com';
export const SITE_BRAND = 'Zëri Qytetarëve';

/** Default (homepage) metadata. These exact strings are part of the SEO contract. */
export const HOME_TITLE = 'Zëri Qytetarëve — Platforma Kombëtare e Angazhimit Qytetar të Kosovës';
export const HOME_DESCRIPTION =
  'Raportoni çështjet në komunën tuaj, ndiqni zgjidhjen e tyre, votoni në sondazhe dhe lexoni lajme të verifikuara në Kosovë.';

export interface PublicRouteSeo {
  /** Router path, no language prefix, no trailing slash. */
  path: string;
  /** Short page name; the document title becomes "<title> — Zëri Qytetarëve". */
  title: string;
  description: string;
  /** Visible heading of the static summary. */
  h1: string;
  /** One or two plain sentences describing what the page is for. */
  intro: string;
}

export const PUBLIC_ROUTES: readonly PublicRouteSeo[] = [
  {
    path: '/raporto',
    title: 'Raporto një problem',
    description: 'Raportoni një çështje në komunën tuaj dhe merrni një Track ID për të ndjekur zgjidhjen e saj.',
    h1: 'Raporto një problem në komunën tënde',
    intro: 'Përshkruani çështjen, shtoni vendndodhjen dhe fotografi, dhe dërgojeni te komuna. Pas dërgimit merrni një Track ID me të cilin e ndiqni raportin.',
  },
  {
    path: '/lajme',
    title: 'Lajmet',
    description: 'Lajme të verifikuara nga Kosova dhe komunat e saj, të mbledhura në një vend.',
    h1: 'Lajme nga Kosova',
    intro: 'Lajme të verifikuara për çështjet që prekin qytetarët dhe komunat e Kosovës.',
  },
  {
    path: '/harta',
    title: 'Harta e raporteve',
    description: 'Harta e raportimeve të qytetarëve në Kosovë: shihni ku janë raportuar çështje dhe në çfarë gjendje janë.',
    h1: 'Harta e raportimeve',
    intro: 'Harta tregon çështjet e raportuara nga qytetarët në komunat e Kosovës dhe gjendjen e secilës.',
  },
  {
    path: '/komunat',
    title: 'Komunat',
    description: 'Komunat e Kosovës dhe çështjet e raportuara në secilën prej tyre.',
    h1: 'Komunat e Kosovës',
    intro: 'Zgjidhni komunën tuaj për të parë çështjet e raportuara dhe zgjidhjen e tyre.',
  },
  {
    path: '/sondazhet',
    title: 'Sondazhet publike',
    description: 'Votoni në sondazhe publike dhe shihni rezultatet e opinionit të qytetarëve në Kosovë.',
    h1: 'Sondazhet publike',
    intro: 'Merrni pjesë në sondazhe mbi çështje që kanë rëndësi për qytetarët dhe shihni rezultatet.',
  },
  {
    path: '/statistikat',
    title: 'Statistikat',
    description: 'Statistika të raportimeve të qytetarëve dhe të zgjidhjes së tyre në komunat e Kosovës.',
    h1: 'Statistikat e raportimeve',
    intro: 'Pasqyrë e raportimeve të qytetarëve dhe e ecurisë së zgjidhjes së tyre.',
  },
  {
    path: '/sherbimet',
    title: 'Shërbimet',
    description: 'Shërbimet e platformës Zëri Qytetarëve për qytetarët e Kosovës.',
    h1: 'Shërbimet',
    intro: 'Shërbimet që platforma u ofron qytetarëve për raportim, ndjekje dhe pjesëmarrje.',
  },
  {
    path: '/ndihma',
    title: 'Qendra e ndihmës',
    description: 'Udhëzime se si të raportoni një çështje, të ndiqni një raport dhe të përdorni platformën.',
    h1: 'Qendra e ndihmës',
    intro: 'Përgjigje dhe udhëzime për përdorimin e platformës Zëri Qytetarëve.',
  },
  {
    path: '/kontakt',
    title: 'Kontakt',
    description: 'Kontaktoni ekipin e Zëri Qytetarëve.',
    h1: 'Kontakt',
    intro: 'Na shkruani për pyetje, sugjerime ose bashkëpunim.',
  },
  {
    path: '/rreth-projektit',
    title: 'Rreth projektit',
    description: 'Çfarë është Zëri Qytetarëve dhe pse u krijua: një platformë qytetare për Kosovën.',
    h1: 'Rreth projektit Zëri Qytetarëve',
    intro: 'Zëri Qytetarëve është platformë që i lidh qytetarët e Kosovës me komunat e tyre.',
  },
  {
    path: '/kosova',
    title: 'Kosova — një popull, një histori, një e ardhme',
    description: 'Historia, kultura dhe e sotmja e Kosovës: një udhëzues për qytetarët, diasporën dhe vizitorët.',
    h1: 'Kosova — një popull, një histori, një e ardhme',
    intro: 'Kapituj mbi historinë, pavarësinë, kulturën dhe jetën e sotme në Kosovë.',
  },
  {
    path: '/historia-e-uck',
    title: 'Historia e UÇK-së',
    description: 'Arkivi i historisë së Ushtrisë Çlirimtare të Kosovës dhe luftës së lirisë.',
    h1: 'Historia e UÇK-së',
    intro: 'Arkiv i organizuar në kapituj mbi sfondin, shfaqjen, kronologjinë dhe ngjarjet e luftës së lirisë.',
  },
  {
    path: '/privatesia',
    title: 'Politika e privatësisë',
    description: 'Si Zëri Qytetarëve mbledh, përdor dhe mbron të dhënat personale.',
    h1: 'Politika e privatësisë',
    intro: 'Informacion mbi të dhënat që përpunohen dhe të drejtat e përdoruesve.',
  },
  {
    path: '/kushtet-e-perdorimit',
    title: 'Kushtet e përdorimit',
    description: 'Kushtet e përdorimit të platformës Zëri Qytetarëve.',
    h1: 'Kushtet e përdorimit',
    intro: 'Rregullat që vlejnë për përdorimin e platformës.',
  },
] as const;

const BY_PATH = new Map(PUBLIC_ROUTES.map((r) => [r.path, r]));

export function findPublicRoute(pagePath: string): PublicRouteSeo | undefined {
  return BY_PATH.get(pagePath);
}

export function documentTitleFor(route: PublicRouteSeo): string {
  return `${route.title} — ${SITE_BRAND}`;
}
