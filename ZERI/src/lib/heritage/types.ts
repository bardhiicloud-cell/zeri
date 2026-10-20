/**
 * Content model of the Kosovo identity & history archive.
 *
 * One structured model serves both the public pages and the CMS, on the client and on
 * the server, so a field can never exist in the editor and be forgotten by the reader
 * (or the other way round). Nothing in the pages is hard-coded prose: every sentence
 * the visitor reads is an `HeritageEntry` that an editor can correct, with its sources.
 *
 * Two areas share the model:
 *   - `kosova`  the ten-part introduction to the country (/kosova)
 *   - `uck`     the historical archive of the KLA and the war (/historia-e-uck)
 */

export type HeritageLang = 'sq' | 'en';

/** Albanian is the source language; English is required to publish for international readers. */
export interface L10n {
  sq: string;
  en: string;
}

export type HeritageArea = 'kosova' | 'uck';

export interface SectionDef {
  id: string;
  area: HeritageArea;
  /** Roman numeral shown on the section plate. */
  numeral: string;
  title: L10n;
  lead: L10n;
  /** Lucide icon name, resolved by the UI. */
  icon: string;
  /** Hue (0-360) of the section's generated artwork. */
  hue: number;
}

/** The ten parts of /kosova, in reading order. */
export const KOSOVA_SECTIONS: readonly SectionDef[] = [
  { id: 'bashkon', area: 'kosova', numeral: 'I', icon: 'Users', hue: 215,
    title: { sq: 'Kosova na bashkon', en: 'Kosovo brings us together' },
    lead: { sq: 'Njerëzit, mikpritja, jeta e përbashkët dhe respekti për çdo komunitet që e quan Kosovën shtëpi.', en: 'The people, the hospitality, the shared life — and respect for every community that calls Kosovo home.' } },
  { id: 'historia', area: 'kosova', numeral: 'II', icon: 'Landmark', hue: 32,
    title: { sq: 'Historia e Kosovës', en: 'The history of Kosovo' },
    lead: { sq: 'Nga Dardania te shteti i sotëm: një kronologji e burimëzuar, me interpretimet e kontestuara të shënuara hapur.', en: 'From Dardania to today’s state: a sourced chronology, with contested interpretations marked openly.' } },
  { id: 'lufta', area: 'kosova', numeral: 'III', icon: 'Flame', hue: 8,
    title: { sq: 'UÇK-ja dhe lufta e Kosovës', en: 'The KLA and the Kosovo war' },
    lead: { sq: 'Konteksti, konflikti, vuajtjet e civilëve dhe pasojat — me dëshmi, dokumente dhe vendime gjyqësore.', en: 'The context, the conflict, civilian suffering and the consequences — through evidence, documents and judicial findings.' } },
  { id: 'pavaresia', area: 'kosova', numeral: 'IV', icon: 'Flag', hue: 222,
    title: { sq: 'Pavarësia e Kosovës', en: 'Kosovo’s independence' },
    lead: { sq: 'Rruga drejt 17 shkurtit 2008, Deklarata, Kushtetuta dhe ndërtimi i institucioneve.', en: 'The road to 17 February 2008, the Declaration, the Constitution and the building of institutions.' } },
  { id: 'siguria', area: 'kosova', numeral: 'V', icon: 'Shield', hue: 150,
    title: { sq: 'FSK-ja dhe siguria', en: 'The KSF and security' },
    lead: { sq: 'Zhvillimi institucional i Forcës së Sigurisë së Kosovës, vetëm nga burime zyrtare dhe të datuara.', en: 'The institutional development of the Kosovo Security Force, from official, dated sources only.' } },
  { id: 'kultura', area: 'kosova', numeral: 'VI', icon: 'Music', hue: 345,
    title: { sq: 'Kultura, gjuha dhe traditat', en: 'Culture, language and tradition' },
    lead: { sq: 'Gjuha shqipe, letërsia, muzika, veshja, kuzhina, zejet dhe trashëgimia e përbashkët.', en: 'The Albanian language, literature, music, dress, cuisine, crafts and shared heritage.' } },
  { id: 'sot', area: 'kosova', numeral: 'VII', icon: 'TrendingUp', hue: 190,
    title: { sq: 'Kosova sot', en: 'Kosovo today' },
    lead: { sq: 'Arsimi, teknologjia, ekonomia dhe institucionet — me arritjet dhe sfidat, pa e zbukuruar pamjen.', en: 'Education, technology, the economy and institutions — achievements and challenges, without a flattering filter.' } },
  { id: 'diaspora', area: 'kosova', numeral: 'VIII', icon: 'Globe', hue: 270,
    title: { sq: 'Rinia dhe diaspora', en: 'Youth and diaspora' },
    lead: { sq: 'Një brez i ri dhe një komunitet botëror: arsim, kreativitet, sipërmarrje dhe lidhje me vendlindjen.', en: 'A young generation and a worldwide community: education, creativity, enterprise and ties to home.' } },
  { id: 'vizitore', area: 'kosova', numeral: 'IX', icon: 'Compass', hue: 100,
    title: { sq: 'Kosova për vizitorët', en: 'Kosovo for visitors' },
    lead: { sq: 'Qytetet, malet, trashëgimia dhe informacioni praktik për ata që vijnë për herë të parë.', en: 'Cities, mountains, heritage and practical information for first-time visitors.' } },
  { id: 'bota', area: 'kosova', numeral: 'X', icon: 'Handshake', hue: 200,
    title: { sq: 'Kosova në botë', en: 'Kosovo in the world' },
    lead: { sq: 'Njohjet, organizatat, sporti, integrimi evropian — çdo pohim i varur nga koha ka datë.', en: 'Recognition, memberships, sport, European integration — every time-sensitive claim carries a date.' } },
];

/** The chapters of the KLA archive. */
export const UCK_SECTIONS: readonly SectionDef[] = [
  { id: 'background', area: 'uck', numeral: '01', icon: 'BookOpen', hue: 30,
    title: { sq: 'Prapavija e konfliktit', en: 'Background to the conflict' },
    lead: { sq: 'Nga heqja e autonomisë në 1989 te rezistenca paqësore dhe kriza e viteve ’90.', en: 'From the loss of autonomy in 1989 to non-violent resistance and the crisis of the 1990s.' } },
  { id: 'emergence', area: 'uck', numeral: '02', icon: 'Flag', hue: 150,
    title: { sq: 'Lindja e UÇK-së', en: 'The emergence of the KLA' },
    lead: { sq: 'Si lindi nga rezistenca e një populli të shtypur dhe u rrit në ushtrinë që e çliroi Kosovën.', en: 'How the Kosovo Liberation Army formed and grew, as documented by independent sources.' } },
  { id: 'timeline', area: 'uck', numeral: '03', icon: 'Clock', hue: 8,
    title: { sq: 'Kronologjia 1998–1999', en: 'Timeline 1998–1999' },
    lead: { sq: 'Ngjarjet kryesore, me datë, vend, burim dhe status prove.', en: 'The principal events, each with date, place, source and evidentiary status.' } },
  { id: 'events', area: 'uck', numeral: '04', icon: 'MapPin', hue: 215,
    title: { sq: 'Ngjarje dhe vende të dokumentuara', en: 'Documented events and places' },
    lead: { sq: 'Prekazi, Reçaku, Krusha, Meja dhe vende të tjera — me atë që thotë dëshmia dhe vendimi gjyqësor.', en: 'Prekaz, Račak, Krusha, Meja and other sites — what the evidence and the courts say.' } },
  { id: 'civilians', area: 'uck', numeral: '05', icon: 'Users', hue: 350,
    title: { sq: 'Civilët: vrasjet, shkatërrimi, zhvendosja', en: 'Civilians: killings, destruction, displacement' },
    lead: { sq: 'Vuajtja e popullit që UÇK-ja doli ta mbrojë: vrasjet, shkatërrimi dhe dëbimi nga Serbia.', en: 'The effect on the civilian population, on all sides, according to independent documentation.' } },
  { id: 'sexual-violence', area: 'uck', numeral: '06', icon: 'HeartHandshake', hue: 290,
    title: { sq: 'Dhuna seksuale e luftës dhe mbështetja', en: 'Conflict-related sexual violence and support' },
    lead: { sq: 'Njohja, drejtësia dhe mbështetja për të mbijetuarat dhe të mbijetuarit — me dinjitet dhe pa detaje grafike.', en: 'Recognition, justice and support for survivors — with dignity and without graphic detail.' } },
  { id: 'missing', area: 'uck', numeral: '07', icon: 'Search', hue: 260,
    title: { sq: 'Të zhdukurit dhe historitë e familjeve', en: 'The missing and family histories' },
    lead: { sq: 'Të zhdukurit, kërkimi i tyre dhe familjet që ende presin përgjigje — plaga që nuk harrohet.', en: 'The missing, the search for them, and the families still waiting for answers.' } },
  { id: 'intervention', area: 'uck', numeral: '08', icon: 'Globe', hue: 205,
    title: { sq: 'Ndërhyrja ndërkombëtare dhe fundi i luftës', en: 'International intervention and the end of the war' },
    lead: { sq: 'Rambuje, fushata e NATO-s, Kumanova, Rezoluta 1244 dhe administrimi ndërkombëtar.', en: 'Rambouillet, the NATO campaign, Kumanovo, Resolution 1244 and international administration.' } },
  { id: 'justice', area: 'uck', numeral: '09', icon: 'Scale', hue: 45,
    title: { sq: 'Drejtësia pas luftës dhe trashëgimia', en: 'Post-war justice and legacy' },
    lead: { sq: 'Drejtësia për viktimat, gjykimet për krimet e Serbisë dhe trashëgimia e luftës për liri.', en: 'The ICTY, EULEX, the Specialist Chambers — what has been established in court and what has not.' } },
  { id: 'documents', area: 'uck', numeral: '10', icon: 'FileText', hue: 20,
    title: { sq: 'Dokumente, fotografi, harta, arkiva', en: 'Documents, photographs, maps, archives' },
    lead: { sq: 'Regjistri i burimeve primare dhe i arkivave ku kërkuesi mund të verifikojë vetë.', en: 'The register of primary sources and archives where researchers can verify for themselves.' } },
];

export const ALL_SECTIONS: readonly SectionDef[] = [...KOSOVA_SECTIONS, ...UCK_SECTIONS];

export const sectionsOf = (area: HeritageArea): readonly SectionDef[] =>
  area === 'kosova' ? KOSOVA_SECTIONS : UCK_SECTIONS;

export const findSection = (area: HeritageArea, id: string): SectionDef | undefined =>
  sectionsOf(area).find((section) => section.id === id);

// ── Evidence status ──────────────────────────────────────────────────────────

/**
 * What kind of claim an entry makes. The brief demands that historical fact,
 * estimate, contested interpretation, official position, testimony and allegation
 * never blur into one another, so the status is a mandatory, visible field.
 */
export const EVIDENCE_STATUSES = [
  'established', 'court-finding', 'official-record', 'official-position',
  'estimate', 'testimony', 'contested', 'allegation',
] as const;
export type EvidenceStatus = (typeof EVIDENCE_STATUSES)[number];

export interface EvidenceMeta {
  label: L10n;
  /** One sentence telling the reader how far to trust the claim. */
  meaning: L10n;
  tone: 'solid' | 'legal' | 'record' | 'position' | 'estimate' | 'voice' | 'contested' | 'allegation';
}

export const EVIDENCE: Record<EvidenceStatus, EvidenceMeta> = {
  established: { tone: 'solid',
    label: { sq: 'Fakt i dokumentuar', en: 'Documented fact' },
    meaning: { sq: 'Pranohet gjerësisht nga burime të pavarura dhe nga kërkimi shkencor.', en: 'Widely accepted across independent sources and scholarship.' } },
  'court-finding': { tone: 'legal',
    label: { sq: 'Konstatim gjyqësor', en: 'Judicial finding' },
    meaning: { sq: 'E vërtetuar me vendim të një gjykate; citohet vendimi dhe shkalla e tij.', en: 'Established by a court decision; the decision and its instance are cited.' } },
  'official-record': { tone: 'record',
    label: { sq: 'Dokument zyrtar', en: 'Official record' },
    meaning: { sq: 'Del nga një akt, regjistër ose procesverbal zyrtar që mund të shihet.', en: 'Comes from an official act, register or minutes that can be inspected.' } },
  'official-position': { tone: 'position',
    label: { sq: 'Qëndrim zyrtar', en: 'Official position' },
    meaning: { sq: 'Pozicioni i një institucioni — jo domosdo një fakt i pranuar nga të gjithë.', en: 'The stance of an institution — not necessarily a fact accepted by everyone.' } },
  estimate: { tone: 'estimate',
    label: { sq: 'Vlerësim', en: 'Estimate' },
    meaning: { sq: 'Shifër e përafërt; metodologjia dhe data e burimit janë të shënuara.', en: 'An approximate figure; the source’s method and date are noted.' } },
  testimony: { tone: 'voice',
    label: { sq: 'Dëshmi personale', en: 'Personal testimony' },
    meaning: { sq: 'Përvoja e një personi, e dhënë me pëlqimin e tij; nuk zëvendëson provën gjyqësore.', en: 'One person’s account, given with consent; it does not replace judicial proof.' } },
  contested: { tone: 'contested',
    label: { sq: 'Interpretim i kontestuar', en: 'Contested interpretation' },
    meaning: { sq: 'Historianët ose palët nuk pajtohen; paraqiten pikëpamjet kryesore.', en: 'Historians or parties disagree; the main views are presented.' } },
  allegation: { tone: 'allegation',
    label: { sq: 'Pretendim (jo i provuar)', en: 'Allegation (not proven)' },
    meaning: { sq: 'Akuzë ose raport që nuk është vërtetuar gjyqësisht. Prezumimi i pafajësisë vlen.', en: 'A charge or report not judicially established. The presumption of innocence applies.' } },
};

export const isEvidenceStatus = (value: unknown): value is EvidenceStatus =>
  typeof value === 'string' && (EVIDENCE_STATUSES as readonly string[]).includes(value);

// ── Entries ──────────────────────────────────────────────────────────────────

export const ENTRY_KINDS = ['article', 'event', 'biography', 'institution', 'site', 'document', 'media', 'story'] as const;
export type EntryKind = (typeof ENTRY_KINDS)[number];

export const KIND_LABELS: Record<EntryKind, L10n> = {
  article: { sq: 'Artikull', en: 'Article' },
  event: { sq: 'Ngjarje', en: 'Event' },
  biography: { sq: 'Biografi', en: 'Biography' },
  institution: { sq: 'Institucion', en: 'Institution' },
  site: { sq: 'Vend / trashëgimi', en: 'Place / heritage' },
  document: { sq: 'Dokument', en: 'Document' },
  media: { sq: 'Foto / video', en: 'Photo / video' },
  story: { sq: 'Histori njerëzore', en: 'Human story' },
};

export const ERAS = ['ancient', 'medieval', 'ottoman', 'modern', 'yugoslav', 'nineties', 'war', 'unmik', 'state'] as const;
export type EraId = (typeof ERAS)[number];

export const ERA_LABELS: Record<EraId, L10n> = {
  ancient: { sq: 'Lashtësia', en: 'Antiquity' },
  medieval: { sq: 'Mesjeta', en: 'Middle Ages' },
  ottoman: { sq: 'Periudha osmane', en: 'Ottoman period' },
  modern: { sq: 'Fillimi i shekullit XX', en: 'Early 20th century' },
  yugoslav: { sq: 'Jugosllavia', en: 'Yugoslavia' },
  nineties: { sq: 'Vitet ’90', en: 'The 1990s' },
  war: { sq: 'Lufta 1998–1999', en: 'The war 1998–1999' },
  unmik: { sq: 'Administrimi ndërkombëtar', en: 'International administration' },
  state: { sq: 'Shteti i pavarur', en: 'The independent state' },
};

export type DatePrecision = 'year' | 'month' | 'day' | 'circa' | 'range';

export interface HeritageDate {
  /** ISO, partial allowed: `1389`, `1999-03`, `2008-02-17`. Negative years for BCE are written as `-0400`. */
  from: string;
  to?: string;
  precision: DatePrecision;
  /** Human wording when the ISO form would mislead ("shek. XIV"). */
  display?: L10n;
}

export interface Claim {
  id: string;
  /** The exact statement as shown, e.g. "13,535 persons killed or missing". */
  text: L10n;
  evidence: EvidenceStatus;
  /** The date the figure/statement refers to (not when it was typed in). */
  asOf: string;
  sourceIds: string[];
  /** Caveat shown next to the claim: method, scope, why it is not final. */
  caveat?: L10n;
}

export const RIGHTS = ['public-domain', 'cc', 'licensed', 'permission', 'unknown'] as const;
export type RightsKind = (typeof RIGHTS)[number];

export interface MediaRef {
  id: string;
  kind: 'image' | 'video' | 'document' | 'map';
  url: string;
  alt: L10n;
  caption: L10n;
  credit: string;
  rights: RightsKind;
  /** Licence text or the reference of the permission that was obtained. */
  rightsRef: string;
  /** For photos of people: someone confirmed it may be published, and the person is not a vulnerable survivor. */
  privacyCleared: boolean;
}

export type SensitiveKind = 'none' | 'graphic' | 'sexual-violence';

export interface Correction {
  at: string;
  text: L10n;
  by: string;
}

export const STATUSES = ['draft', 'review', 'approved', 'published', 'archived'] as const;
export type EntryStatus = (typeof STATUSES)[number];

export const STATUS_LABELS: Record<EntryStatus, string> = {
  draft: 'Draft', review: 'Në rishikim', approved: 'Aprovuar', published: 'Publikuar', archived: 'Arkivuar',
};

export type VerificationState = 'unverified' | 'in-review' | 'verified';

export interface Verification {
  state: VerificationState;
  by?: string;
  at?: string;
  note?: string;
}

export interface HeritageEntry {
  /** Stable slug, `[a-z0-9-]`. Also the URL segment. */
  id: string;
  area: HeritageArea;
  section: string;
  kind: EntryKind;
  title: L10n;
  summary: L10n;
  /** Lightweight markdown: paragraphs, `- ` lists, `**bold**`, `> quote`. Rendered without HTML. */
  body: L10n;
  date?: HeritageDate;
  era?: EraId;
  place?: { name: string; municipality?: string };
  evidence: EvidenceStatus;
  sensitive: SensitiveKind;
  sourceIds: string[];
  claims: Claim[];
  media: MediaRef[];
  /** A living person is named: needs a consent / public-role note before publishing. */
  livingPerson?: boolean;
  consentNote?: string;
  featured?: boolean;
  order?: number;
  tags: string[];
  status: EntryStatus;
  verification: Verification;
  corrections: Correction[];
  version: number;
  /** `seed` entries ship with the application; the CMS copy overrides them by id. */
  origin: 'seed' | 'cms';
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
  /** Last person who changed the *content* (not the status). Four-eyes checks use this one. */
  editedBy?: string;
  publishedAt?: string;
}

// ── Sources ──────────────────────────────────────────────────────────────────

export const SOURCE_TYPES = ['court', 'international', 'government', 'ngo', 'archive', 'academic', 'media', 'book', 'other'] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const SOURCE_TYPE_LABELS: Record<SourceType, L10n> = {
  court: { sq: 'Gjykatë / tribunal', en: 'Court / tribunal' },
  international: { sq: 'Organizatë ndërkombëtare', en: 'International organisation' },
  government: { sq: 'Institucion zyrtar', en: 'Official institution' },
  ngo: { sq: 'Organizatë e të drejtave të njeriut', en: 'Human-rights organisation' },
  archive: { sq: 'Arkiv / bazë dokumentare', en: 'Archive / document base' },
  academic: { sq: 'Kërkim akademik', en: 'Academic research' },
  media: { sq: 'Media', en: 'Media' },
  book: { sq: 'Libër', en: 'Book' },
  other: { sq: 'Tjetër', en: 'Other' },
};

export interface HeritageSource {
  id: string;
  title: string;
  publisher: string;
  type: SourceType;
  /** Publication date of the document, ISO partial. */
  date?: string;
  url?: string;
  /** Where to find it offline: archive code, document symbol, docket number. */
  reference?: string;
  /**
   * `true` only after a person opened the link and confirmed it leads to this document.
   * New sources are `false`: the UI says so instead of implying a check that never happened.
   */
  linkChecked: boolean;
  linkCheckedAt?: string;
  note?: string;
  origin: 'seed' | 'cms';
  updatedAt?: string;
}

export interface HeritageSettings {
  heroImageUrl?: string;
  heroCredit?: string;
  heroRights?: RightsKind;
  /** Official emblem asset, uploaded by an editor from an official source. */
  emblemUrl?: string;
  featuredIds?: string[];
  updatedAt?: string;
}

// ── Sorting & dates ──────────────────────────────────────────────────────────

/** Sortable number from a partial ISO date: `1999-03` → 1999.0300; BCE supported. */
export function dateKey(value: string | undefined): number {
  if (!value) return Number.POSITIVE_INFINITY;
  const m = /^(-?\d{1,4})(?:-(\d{2}))?(?:-(\d{2}))?$/.exec(value);
  if (!m) return Number.POSITIVE_INFINITY;
  const year = Number(m[1]);
  const month = m[2] ? Number(m[2]) : 0;
  const day = m[3] ? Number(m[3]) : 0;
  const fraction = month * 0.01 + day * 0.0001;
  return year < 0 ? year - fraction : year + fraction;
}

export const byDate = (a: HeritageEntry, b: HeritageEntry): number =>
  dateKey(a.date?.from) - dateKey(b.date?.from) || (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id);

const MONTHS: Record<HeritageLang, string[]> = {
  sq: ['janar', 'shkurt', 'mars', 'prill', 'maj', 'qershor', 'korrik', 'gusht', 'shtator', 'tetor', 'nëntor', 'dhjetor'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};

/** "17 shkurt 2008", "mars 1999", "1389", "shek. IV p.e.s." — never a fake precision. */
export function formatHeritageDate(date: HeritageDate | undefined, lang: HeritageLang): string {
  if (!date) return '';
  if (date.display?.[lang]) return date.display[lang];
  const one = (iso: string): string => {
    const m = /^(-?\d{1,4})(?:-(\d{2}))?(?:-(\d{2}))?$/.exec(iso);
    if (!m) return iso;
    const year = Number(m[1]);
    const yearText = year < 0 ? (lang === 'sq' ? `${-year} p.e.s.` : `${-year} BCE`) : String(year);
    const month = m[2] ? MONTHS[lang][Number(m[2]) - 1] : '';
    const day = m[3] ? String(Number(m[3])) : '';
    if (day && month) return lang === 'sq' ? `${day} ${month} ${yearText}` : `${day} ${month} ${yearText}`;
    if (month) return `${month} ${yearText}`;
    return yearText;
  };
  const start = one(date.from);
  const prefix = date.precision === 'circa' ? (lang === 'sq' ? 'rreth ' : 'c. ') : '';
  return date.to ? `${prefix}${start} – ${one(date.to)}` : `${prefix}${start}`;
}

export const pick = (value: L10n | undefined, lang: HeritageLang): string => {
  if (!value) return '';
  return (lang === 'en' ? value.en || value.sq : value.sq || value.en) ?? '';
};

/** Is the entry text available in the reader's language, or are they reading the Albanian fallback? */
export const hasLang = (value: L10n | undefined, lang: HeritageLang): boolean =>
  !!value && (lang === 'sq' ? !!value.sq : !!value.en);
