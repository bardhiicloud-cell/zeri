/**
 * Editorial rules of the heritage archive, as pure functions.
 *
 * They live outside the server route and outside the React form on purpose: the
 * editor UI uses them to explain *why* a button is disabled, the server uses the very
 * same functions to refuse the request, and the tests exercise them directly. A rule
 * that exists in only one of those places is a rule that can drift.
 *
 *   draft ─▶ review ─▶ approved ─▶ published ─▶ archived
 *      ▲        │          │                         │
 *      └────────┴──────────┴──── (send back, reason) ┘ (restore → draft)
 */
import {
  ENTRY_KINDS, EVIDENCE_STATUSES, findSection, isEvidenceStatus, RIGHTS, SOURCE_TYPES,
  type EntryStatus, type HeritageEntry, type HeritageSource, type L10n,
} from './types';

export interface Actor {
  uid: string;
  role: string;
  permissions?: readonly string[];
}

/** Roles that may open the heritage section at all (mirrors adminPermissions). */
const EDITOR_ROLES = new Set(['admin', 'superadmin', 'newsadmin']);
/** May approve another editor's work. */
const APPROVER_ROLES = new Set(['admin', 'superadmin', 'newsadmin']);
/** May publish, archive and remove from public view. */
const PUBLISHER_ROLES = new Set(['admin', 'superadmin']);

export const canEditHeritage = (actor: Actor): boolean =>
  EDITOR_ROLES.has(actor.role) || !!actor.permissions?.includes('heritage');
export const canApproveHeritage = (actor: Actor): boolean =>
  APPROVER_ROLES.has(actor.role) || !!actor.permissions?.includes('heritage-approve');
export const canPublishHeritage = (actor: Actor): boolean =>
  PUBLISHER_ROLES.has(actor.role) || !!actor.permissions?.includes('heritage-publish');

export interface Transition {
  to: EntryStatus;
  /** Moves backwards or takes content down: a reason is mandatory and goes to the audit trail. */
  needsReason: boolean;
}

const MOVES: Record<EntryStatus, Transition[]> = {
  draft: [{ to: 'review', needsReason: false }, { to: 'archived', needsReason: true }],
  review: [{ to: 'approved', needsReason: false }, { to: 'draft', needsReason: true }],
  approved: [{ to: 'published', needsReason: false }, { to: 'draft', needsReason: true }],
  published: [{ to: 'archived', needsReason: true }, { to: 'draft', needsReason: true }],
  archived: [{ to: 'draft', needsReason: false }],
};

export const nextMoves = (from: EntryStatus): Transition[] => MOVES[from] ?? [];

export type Denied = { ok: false; status: 400 | 403 | 409; error: string };
export type Allowed = { ok: true };

/**
 * Whether `actor` may move `entry` to `to`. Four-eyes principle: whoever last edited an
 * entry cannot also approve it (a superadmin may, so a one-person team is not locked out;
 * the audit trail records that it happened).
 */
export function checkTransition(
  entry: Pick<HeritageEntry, 'status' | 'updatedBy' | 'editedBy'>,
  to: EntryStatus,
  actor: Actor,
  reason: string,
): Allowed | Denied {
  const move = nextMoves(entry.status).find((m) => m.to === to);
  if (!move) return { ok: false, status: 409, error: `Kalimi ${entry.status} → ${to} nuk lejohet.` };
  if (move.needsReason && reason.trim().length < 8) {
    return { ok: false, status: 400, error: 'Shkruani arsyen (të paktën 8 shkronja) — ruhet në regjistrin e auditimit.' };
  }
  if (!canEditHeritage(actor)) return { ok: false, status: 403, error: 'Roli juaj nuk e ka lejen për arkivin e trashëgimisë.' };

  if (to === 'approved') {
    if (!canApproveHeritage(actor)) return { ok: false, status: 403, error: 'Aprovimi kërkon rolin e aprovuesit.' };
    const lastEditor = entry.editedBy ?? entry.updatedBy;
    if (lastEditor && lastEditor === actor.uid && actor.role !== 'superadmin') {
      return { ok: false, status: 403, error: 'Redaktori i fundit nuk mund ta aprovojë vetë përmbajtjen (parimi i dy syve).' };
    }
  }
  if (to === 'published' || to === 'archived' || (to === 'draft' && entry.status === 'published')) {
    if (!canPublishHeritage(actor)) return { ok: false, status: 403, error: 'Publikimi dhe tërheqja nga publiku kërkojnë administratorin.' };
  }
  return { ok: true };
}

export interface Blocker {
  code: string;
  message: string;
}

const QUANT = /\d[\d.,\s]*\s*(të vrarë|persona|viktima|civilë|refugjatë|deportuar|killed|victims|persons|people|civilians|refugees|missing|të zhdukur)/i;

/**
 * Everything that must be true before an entry can go public. Returned as a list so the
 * editor shows all of it at once instead of one surprise per click.
 */
export function publishBlockers(entry: HeritageEntry, sources: ReadonlyMap<string, HeritageSource>): Blocker[] {
  const out: Blocker[] = [];
  const add = (code: string, message: string) => out.push({ code, message });

  if (!entry.title.sq.trim()) add('title', 'Titulli shqip mungon.');
  if (!entry.summary.sq.trim()) add('summary', 'Përmbledhja shqip mungon.');
  if (!entry.title.en.trim() || !entry.summary.en.trim()) add('english', 'Titulli dhe përmbledhja në anglisht duhen për vizitorët ndërkombëtarë.');
  if (!entry.body.sq.trim() && entry.kind !== 'media') add('body', 'Teksti shqip mungon.');

  // Every entry that asserts something needs a traceable source.
  const needsSource = entry.kind !== 'media';
  if (needsSource && entry.sourceIds.length === 0) add('sources', 'Shtoni të paktën një burim për këtë shënim.');
  for (const id of entry.sourceIds) {
    if (!sources.has(id)) add('source-missing', `Burimi "${id}" nuk ekziston në regjistër.`);
  }

  if (entry.verification.state !== 'verified') {
    add('verification', 'Verifikimi faktik nuk është kryer. Një person tjetër duhet ta shënojë si "i verifikuar" pasi kontrollon burimet.');
  }

  entry.claims.forEach((claim, index) => {
    const label = `Pohimi ${index + 1}`;
    if (!claim.sourceIds.length) add('claim-source', `${label}: nuk ka burim.`);
    if (!/^\d{4}(-\d{2}(-\d{2})?)?$/.test(claim.asOf)) add('claim-date', `${label}: data "gjendja më" mungon ose është e pavlefshme.`);
    for (const id of claim.sourceIds) if (!sources.has(id)) add('source-missing', `${label}: burimi "${id}" nuk ekziston.`);
    if (!claim.text.sq.trim()) add('claim-text', `${label}: teksti mungon.`);
  });

  // A figure written into prose without being declared as a claim escapes the date/source rule.
  for (const lang of ['sq', 'en'] as const) {
    if (QUANT.test(entry.body[lang]) && entry.claims.length === 0 && entry.evidence !== 'allegation') {
      add('quantity', 'Teksti përmban një shifër viktimash/personash. Deklarojeni si "pohim" me burim dhe datë.');
      break;
    }
  }

  if (entry.sensitive === 'sexual-violence' && entry.media.some((m) => m.kind === 'image' || m.kind === 'video')) {
    add('sensitive-media', 'Dhuna seksuale: nuk lejohen foto ose video të personave. Hiqini mediat.');
  }

  entry.media.forEach((media, index) => {
    const label = `Media ${index + 1}`;
    if (!media.alt.sq.trim()) add('alt', `${label}: teksti alternativ mungon (aksesueshmëri).`);
    if (media.rights === 'unknown') add('rights', `${label}: e drejta e autorit është e panjohur.`);
    else if (!media.credit.trim() || !media.rightsRef.trim()) add('credit', `${label}: kredia dhe referenca e licencës/lejes mungojnë.`);
    if ((media.kind === 'image' || media.kind === 'video') && entry.sensitive !== 'none' && !media.privacyCleared) {
      add('privacy', `${label}: privatësia nuk është konfirmuar për përmbajtje të ndjeshme.`);
    }
  });

  if (entry.livingPerson && !entry.consentNote?.trim()) {
    add('consent', 'Person i gjallë: shënoni pëlqimin ose bazën publike (rol publik, burim i botuar).');
  }
  if (entry.evidence === 'allegation' && !/(pretend|akuz|allegation|alleged|nuk (është|eshte) vërtetuar|not (been )?(proven|established))/i.test(entry.body.sq + ' ' + entry.body.en + ' ' + entry.summary.sq + ' ' + entry.summary.en)) {
    add('allegation-wording', 'Pretendimi duhet të thotë qartë në tekst se nuk është vërtetuar gjyqësisht.');
  }

  return out;
}

// ── Input normalisation (server) ─────────────────────────────────────────────

const clip = (value: unknown, max: number): string =>
  // eslint-disable-next-line no-control-regex
  String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);

const l10n = (value: unknown, max: number): L10n => {
  const v = (value ?? {}) as Record<string, unknown>;
  return { sq: clip(v.sq, max), en: clip(v.en, max) };
};

const isoPartial = /^-?\d{1,4}(-\d{2}(-\d{2})?)?$/;
const slug = /^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$/;

export type Parsed<T> = { ok: true; value: T } | { ok: false; errors: Record<string, string> };

export function parseSource(input: unknown): Parsed<Omit<HeritageSource, 'origin' | 'updatedAt'>> {
  const v = (input ?? {}) as Record<string, unknown>;
  const errors: Record<string, string> = {};
  const id = clip(v.id, 80);
  if (!slug.test(id)) errors.id = 'ID: vetëm shkronja të vogla, numra dhe vizë (3–80).';
  const title = clip(v.title, 300);
  if (!title) errors.title = 'Titulli i burimit mungon.';
  const publisher = clip(v.publisher, 200);
  if (!publisher) errors.publisher = 'Botuesi/institucioni mungon.';
  const type = (SOURCE_TYPES as readonly string[]).includes(String(v.type)) ? (String(v.type) as HeritageSource['type']) : null;
  if (!type) errors.type = 'Lloji i burimit është i pavlefshëm.';
  const url = clip(v.url, 600);
  if (url && !/^https:\/\/[^\s]+$/.test(url)) errors.url = 'Lidhja duhet të fillojë me https://';
  const date = clip(v.date, 10);
  if (date && !isoPartial.test(date)) errors.date = 'Data: YYYY, YYYY-MM ose YYYY-MM-DD.';
  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      id, title, publisher, type: type!, ...(date ? { date } : {}), ...(url ? { url } : {}),
      ...(clip(v.reference, 200) ? { reference: clip(v.reference, 200) } : {}),
      linkChecked: v.linkChecked === true,
      ...(v.linkChecked === true && clip(v.linkCheckedAt, 10) ? { linkCheckedAt: clip(v.linkCheckedAt, 10) } : {}),
      ...(clip(v.note, 600) ? { note: clip(v.note, 600) } : {}),
    },
  };
}

/** Parse an editor's payload into a well-formed entry (status, version and audit fields are set by the server). */
export function parseEntryInput(input: unknown): Parsed<Omit<HeritageEntry, 'status' | 'version' | 'origin' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'editedBy' | 'publishedAt' | 'corrections' | 'verification'>> {
  const v = (input ?? {}) as Record<string, any>;
  const errors: Record<string, string> = {};

  const id = clip(v.id, 80);
  if (!slug.test(id)) errors.id = 'ID: vetëm shkronja të vogla, numra dhe vizë (3–80).';
  const area = v.area === 'uck' ? 'uck' : v.area === 'kosova' ? 'kosova' : null;
  if (!area) errors.area = 'Zona është e pavlefshme.';
  const section = clip(v.section, 40);
  if (area && !findSection(area, section)) errors.section = 'Seksioni nuk i përket kësaj zone.';
  const kind = (ENTRY_KINDS as readonly string[]).includes(String(v.kind)) ? v.kind : null;
  if (!kind) errors.kind = 'Lloji i shënimit është i pavlefshëm.';
  const evidence = isEvidenceStatus(v.evidence) ? v.evidence : null;
  if (!evidence) errors.evidence = `Statusi i provës duhet të jetë një nga: ${EVIDENCE_STATUSES.join(', ')}.`;

  const title = l10n(v.title, 200);
  if (!title.sq) errors.title = 'Titulli shqip mungon.';
  const summary = l10n(v.summary, 600);
  if (!summary.sq) errors.summary = 'Përmbledhja shqip mungon.';
  const body = l10n(v.body, 24000);

  const sensitive = v.sensitive === 'graphic' || v.sensitive === 'sexual-violence' ? v.sensitive : 'none';
  const sourceIds = Array.isArray(v.sourceIds) ? [...new Set(v.sourceIds.map((s: unknown) => clip(s, 80)).filter(Boolean))].slice(0, 40) : [];

  let date: HeritageEntry['date'];
  if (v.date && clip(v.date.from, 10)) {
    const from = clip(v.date.from, 10);
    const to = clip(v.date.to, 10);
    if (!isoPartial.test(from) || (to && !isoPartial.test(to))) errors.date = 'Data: YYYY, YYYY-MM ose YYYY-MM-DD.';
    else {
      const precision = ['year', 'month', 'day', 'circa', 'range'].includes(v.date.precision) ? v.date.precision : 'day';
      const display = l10n(v.date.display, 80);
      date = { from, ...(to ? { to } : {}), precision, ...(display.sq || display.en ? { display } : {}) };
    }
  }

  const claims = (Array.isArray(v.claims) ? v.claims : []).slice(0, 30).map((c: any, i: number) => ({
    id: clip(c?.id, 40) || `c${i + 1}`,
    text: l10n(c?.text, 400),
    evidence: isEvidenceStatus(c?.evidence) ? c.evidence : 'estimate',
    asOf: clip(c?.asOf, 10),
    sourceIds: Array.isArray(c?.sourceIds) ? [...new Set<string>(c.sourceIds.map((s: unknown) => clip(s, 80)).filter(Boolean))].slice(0, 20) : [],
    ...((c?.caveat?.sq || c?.caveat?.en) ? { caveat: l10n(c.caveat, 400) } : {}),
  }));

  const media = (Array.isArray(v.media) ? v.media : []).slice(0, 30).map((m: any, i: number) => ({
    id: clip(m?.id, 40) || `m${i + 1}`,
    kind: ['image', 'video', 'document', 'map'].includes(m?.kind) ? m.kind : 'image',
    url: /^https:\/\//.test(clip(m?.url, 800)) ? clip(m.url, 800) : '',
    alt: l10n(m?.alt, 300),
    caption: l10n(m?.caption, 400),
    credit: clip(m?.credit, 200),
    rights: (RIGHTS as readonly string[]).includes(m?.rights) ? m.rights : 'unknown',
    rightsRef: clip(m?.rightsRef, 300),
    privacyCleared: m?.privacyCleared === true,
  }));
  if (media.some((m: { url: string }) => !m.url)) errors.media = 'Çdo media duhet të ketë një lidhje https://.';

  if (Object.keys(errors).length) return { ok: false, errors };

  const era = v.era && (['ancient', 'medieval', 'ottoman', 'modern', 'yugoslav', 'nineties', 'war', 'unmik', 'state'] as string[]).includes(v.era) ? v.era : undefined;
  const placeName = clip(v.place?.name, 120);

  return {
    ok: true,
    value: {
      id, area: area!, section, kind: kind as HeritageEntry['kind'], title, summary, body,
      ...(date ? { date } : {}), ...(era ? { era } : {}),
      ...(placeName ? { place: { name: placeName, ...(clip(v.place?.municipality, 80) ? { municipality: clip(v.place.municipality, 80) } : {}) } } : {}),
      evidence: evidence!, sensitive, sourceIds, claims, media,
      ...(v.livingPerson === true ? { livingPerson: true } : {}),
      ...(clip(v.consentNote, 400) ? { consentNote: clip(v.consentNote, 400) } : {}),
      ...(v.featured === true ? { featured: true } : {}),
      ...(Number.isFinite(Number(v.order)) ? { order: Math.max(-9999, Math.min(9999, Math.trunc(Number(v.order)))) } : {}),
      tags: (Array.isArray(v.tags) ? v.tags : []).map((t: unknown) => clip(t, 40).toLowerCase()).filter(Boolean).slice(0, 15),
    },
  };
}
