import { getMunicipalityHeroImage } from './municipalityHeroImages';

export interface DemoNewsArticle {
  id: string;
  title: string;
  municipality: string;
  category: string;
  date: string;
  author: string;
  readTime: string;
  summary: string;
  content: string;
  imageUrl: string;
  videoUrl?: string;
  relatedReportIds?: string[];
  createdAt: string;
  published: false;
  isTicker: false;
  isDemo: true;
  position: 'featured' | 'feed' | 'sidebar';
}

const demoItems = [
  {
    id: 'demo-news-prishtine-public-spaces',
    title: 'Shembull: Hapësira publike më të gjelbra për lagjet e Prishtinës',
    municipality: 'Prishtinë',
    category: 'Komuna & Shërbime',
    summary: 'Përmbajtje demonstrative për të parë paraqitjen e një lajmi komunal me fotografi, përmbledhje dhe lexim të plotë.',
    content: 'Ky është artikull shembull për prototipin e faqes së lajmeve. Nuk përshkruan një vendim të marrë dhe nuk është njoftim zyrtar. Në publikimet reale, redaksia do të shtojë burimin, datën, hollësitë dhe materialet e verifikuara.',
    position: 'featured',
  },
  {
    id: 'demo-news-prizren-mobility',
    title: 'Shembull: Ide për lëvizje më të lehtë në qendrën historike',
    municipality: 'Prizren',
    category: 'Infrastrukturë & Transport',
    summary: 'Një model artikulli për planifikimin urban, transportin publik dhe qasjen e sigurt për këmbësorë.',
    content: 'Përmbajtje demonstrative për rubrikën e infrastrukturës. Teksti shërben vetëm për të testuar paraqitjen, ndarjen në paragrafë dhe fotografinë në artikull.',
    position: 'sidebar',
  },
  {
    id: 'demo-news-peje-parks',
    title: 'Shembull: Si mund të kujdesemi më mirë për parqet e qytetit',
    municipality: 'Pejë',
    category: 'Mjedis & Energji',
    summary: 'Shembull editorial për mirëmbajtjen e hapësirave të gjelbra dhe pjesëmarrjen e banorëve.',
    content: 'Ky tekst është krijuar për demonstrim. Një lajm i publikuar duhet të përmbajë fakte të kontrolluara, burime dhe kontekst të qartë.',
    position: 'feed',
  },
  {
    id: 'demo-news-gjilan-youth',
    title: 'Shembull: Punëtori komunitare për të rinjtë dhe aftësitë digjitale',
    municipality: 'Gjilan',
    category: 'Arsim & Rini',
    summary: 'Kartë shembull për nisma arsimore, aktivitete rinore dhe shërbime komunitare.',
    content: 'Përmbajtje demonstrative — nuk njofton për një aktivitet real. Në këtë hapësirë mund të paraqiten më vonë programi, organizatori, orari dhe mënyra e regjistrimit.',
    position: 'feed',
  },
  {
    id: 'demo-news-gjakove-health',
    title: 'Shembull: Informim më i qartë për shërbimet shëndetësore lokale',
    municipality: 'Gjakovë',
    category: 'Shëndetësi',
    summary: 'Model për një artikull informues që orienton qytetarët te burimet zyrtare shëndetësore.',
    content: 'Ky artikull është vetëm demonstrues. Përmbajtja shëndetësore reale duhet të mbështetet në informata zyrtare dhe të përfshijë lidhje të besueshme për qytetarët.',
    position: 'feed',
  },
  {
    id: 'demo-news-ferizaj-budget',
    title: 'Shembull: Buxheti komunal i shpjeguar me gjuhë të thjeshtë',
    municipality: 'Ferizaj',
    category: 'Financa & Buxhet',
    summary: 'Paraqitje demonstrative për transparencën buxhetore dhe mënyrën si shpjegohen investimet publike.',
    content: 'Ky material nuk përmban të dhëna reale buxhetore. Në publikimin përfundimtar duhen përfshirë dokumentet burimore, periudha dhe shifrat e verifikuara.',
    position: 'feed',
  },
  {
    id: 'demo-news-mitrovice-local-business',
    title: 'Shembull: Ide për mbështetjen e bizneseve të vogla lokale',
    municipality: 'Mitrovicë',
    category: 'Ekonomi & Punësim',
    summary: 'Shembull i një lajmi ekonomik që mund të përmbledhë programe, mundësi punësimi dhe burime zyrtare.',
    content: 'Teksti dhe titulli janë shembuj të sajuar për prototipin. Nuk shpallin grant, konkurs apo vendim real.',
    position: 'feed',
  },
  {
    id: 'demo-news-vushtrri-digital-services',
    title: 'Shembull: Shërbimet digjitale që kursejnë kohën e qytetarëve',
    municipality: 'Vushtrri',
    category: 'Teknologji & Digjitalizim',
    summary: 'Kartë demonstrimi për përditësime rreth portalit, aplikimeve elektronike dhe qasjes në shërbime.',
    content: 'Shembull për paraqitjen e temave të digjitalizimit. Përmbajtja reale duhet të tregojë saktë cilat shërbime janë aktive dhe ku mund të përdoren.',
    position: 'feed',
  },
  {
    id: 'demo-news-rahovec-safety',
    title: 'Shembull: Udhëzues informues për përgatitjen ndaj emergjencave',
    municipality: 'Rahovec',
    category: 'Siguri & Emergjenca',
    summary: 'Model për një lajm praktik me hapa të qartë dhe kontakte të verifikuara për raste urgjente.',
    content: 'Ky është vetëm tekst demonstrues. Në një publikim real, udhëzimet dhe numrat e kontaktit duhet të verifikohen me institucionet kompetente.',
    position: 'feed',
  },
  {
    id: 'demo-news-kacanik-culture',
    title: 'Shembull: Kultura dhe sporti si pika takimi për komunitetin',
    municipality: 'Kaçanik',
    category: 'Kulturë & Sport',
    summary: 'Shembull editorial për aktivitete kulturore, sport dhe pjesëmarrje në jetën e komunitetit.',
    content: 'Përmbajtje e sajuar për demonstrim. Ky shembull nuk paraqet ngjarje të konfirmuar në kalendarin e komunës.',
    position: 'feed',
  },
  {
    id: 'demo-news-lipjan-public-notice',
    title: 'Shembull njoftimi: Informacion për orarin e shërbimeve komunale',
    municipality: 'Lipjan',
    category: 'Njoftim Zyrtar',
    summary: 'Ky njoftim ilustrues tregon ku paraqitet një komunikim i shkurtër dhe i dallueshëm për qytetarët.',
    content: 'NJOFTIM DEMONSTRUES — ky tekst nuk është njoftim zyrtar dhe nuk ndryshon orarin e asnjë shërbimi. Përdoret vetëm për testimin vizual të prototipit.',
    position: 'feed',
  },
  {
    id: 'demo-news-suhareke-public-consultation',
    title: 'Shembull njoftimi: Ftesë për konsultim publik me banorët',
    municipality: 'Suharekë',
    category: 'Njoftim Zyrtar',
    summary: 'Model demonstrues i një thirrjeje publike, me hapësirë për datën, vendin dhe dokumentet përkatëse.',
    content: 'NJOFTIM DEMONSTRUES — nuk është ftesë reale dhe nuk përmban datë apo vend të vlefshëm. Publikimet zyrtare duhet të verifikohen dhe të plotësohen nga institucioni përgjegjës.',
    position: 'feed',
  },
] as const;

export const DEMO_NEWS: DemoNewsArticle[] = demoItems.map((item, index) => ({
  ...item,
  date: '05 tetor 2026',
  author: 'Shembull demonstrues',
  readTime: `${Math.max(1, Math.ceil(item.content.length / 900))} min lexim`,
  imageUrl: getMunicipalityHeroImage(item.municipality),
  createdAt: new Date(Date.UTC(2026, 9, 5, 13, 0 - index * 4)).toISOString(),
  published: false,
  isTicker: false,
  isDemo: true,
}));
