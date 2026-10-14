import { CENTRAL_BODIES, MUNICIPAL_CONTACTS, isSendable, type ContactPoint, type EmailStatus } from '../data/institutionContacts';
import type { ReportTopicId } from './reportTopics';

/**
 * Who answers a report.
 *
 * The rule the platform follows: a matter inside an urban area belongs to the
 * municipality, outside it to the state. Some topics are always one or the other
 * (a municipal school directorate, a ministry-level tax matter), so each topic
 * carries a `rule`:
 *
 *  - `municipal`  always the municipality, whatever the zone.
 *  - `central`    always the central body.
 *  - `zone`       urban → municipality, rural → central body.
 *
 * Whether a place is urban or rural is a fact about the report, set by staff
 * during review. When it is not set yet, a `zone` topic goes to the municipality
 * (the closer, first-contact body) and the result says `needsZone`, so a bulk send
 * can ask rather than silently choosing.
 *
 * This table is a default routing, not law: it is meant to be reviewed by the
 * people who run the platform and overridden in the admin.
 */
export type Zone = 'urban' | 'rural';
export type Rule = 'municipal' | 'central' | 'zone';

interface TopicRoute {
  rule: Rule;
  /** Directorate inside the municipality that handles this topic. */
  office: string;
  /** Key into CENTRAL_BODIES. */
  central: keyof typeof CENTRAL_BODIES;
}

const SHERBIME = 'Drejtoria e Shërbimeve Publike';
const INFRA = 'Drejtoria e Infrastrukturës';
const URBANIZEM = 'Drejtoria e Urbanizmit';
const MJEDIS = 'Drejtoria e Mjedisit';
const SHENDETESI = 'Drejtoria e Shëndetësisë dhe Mirëqenies Sociale';
const KULTURE = 'Drejtoria e Kulturës, Rinisë dhe Sportit';
const ARSIM = 'Drejtoria e Arsimit';
const BUJQESI = 'Drejtoria e Bujqësisë dhe Zhvillimit Rural';
const KRYETARI = 'Zyra e Kryetarit';
const FINANCA = 'Drejtoria e Financave';
const EKONOMI = 'Drejtoria e Zhvillimit Ekonomik';

export const TOPIC_ROUTES: Record<ReportTopicId, TopicRoute> = {
  'politike': { rule: 'central', office: KRYETARI, central: 'zkm' },
  'komuna': { rule: 'municipal', office: KRYETARI, central: 'mapl' },
  'zgjedhje': { rule: 'central', office: KRYETARI, central: 'kqz' },
  'qeveri': { rule: 'central', office: KRYETARI, central: 'zkm' },
  'drejtesi': { rule: 'central', office: KRYETARI, central: 'mdrej' },
  'polici-siguri': { rule: 'central', office: SHERBIME, central: 'policia' },
  'emergjenca': { rule: 'central', office: SHERBIME, central: 'ame' },
  'ekonomi': { rule: 'central', office: EKONOMI, central: 'mek' },
  'punesim': { rule: 'central', office: EKONOMI, central: 'mf' },
  'biznes': { rule: 'municipal', office: EKONOMI, central: 'mint' },
  'tregti-cmime': { rule: 'central', office: EKONOMI, central: 'mint' },
  'financa-buxhet': { rule: 'municipal', office: FINANCA, central: 'mf' },
  'tatime-dogana': { rule: 'central', office: FINANCA, central: 'atk' },
  'infrastrukture': { rule: 'zone', office: INFRA, central: 'mmphi' },
  'rruge': { rule: 'zone', office: INFRA, central: 'mmphi' },
  'transport': { rule: 'zone', office: SHERBIME, central: 'mmphi' },
  'parking': { rule: 'municipal', office: SHERBIME, central: 'mmphi' },
  'ndertim-banim': { rule: 'municipal', office: URBANIZEM, central: 'mmphi' },
  'urbanizem': { rule: 'municipal', office: URBANIZEM, central: 'mmphi' },
  'uje-kanalizim': { rule: 'zone', office: SHERBIME, central: 'mmphi' },
  'mbeturina': { rule: 'zone', office: SHERBIME, central: 'mmphi' },
  'mjedis': { rule: 'zone', office: MJEDIS, central: 'mmphi' },
  'energji': { rule: 'central', office: SHERBIME, central: 'mek' },
  'telekomunikacion': { rule: 'central', office: SHERBIME, central: 'arkep' },
  'arsim': { rule: 'municipal', office: ARSIM, central: 'mashti' },
  'shkence-inovacion': { rule: 'central', office: ARSIM, central: 'mashti' },
  'shendetesi': { rule: 'municipal', office: SHENDETESI, central: 'msh' },
  'mireqenie-sociale': { rule: 'municipal', office: SHENDETESI, central: 'mf' },
  'femije-familje': { rule: 'municipal', office: SHENDETESI, central: 'mf' },
  'gruaja': { rule: 'municipal', office: SHENDETESI, central: 'zkm' },
  'rinia': { rule: 'municipal', office: KULTURE, central: 'mkrs' },
  'bujqesi': { rule: 'zone', office: BUJQESI, central: 'mbpzhr' },
  'blegtori': { rule: 'zone', office: BUJQESI, central: 'mbpzhr' },
  'pyje-natyre': { rule: 'central', office: MJEDIS, central: 'mbpzhr' },
  'industri': { rule: 'central', office: EKONOMI, central: 'mint' },
  'kulture-trashegimi': { rule: 'municipal', office: KULTURE, central: 'mkrs' },
  'sport': { rule: 'municipal', office: KULTURE, central: 'mkrs' },
  'diaspora': { rule: 'central', office: KRYETARI, central: 'mpjd' },
  'integrim-bota': { rule: 'central', office: KRYETARI, central: 'mpjd' },
  'teknologji-digjitalizim': { rule: 'central', office: KRYETARI, central: 'mashti' },
};

export interface Recipient {
  level: 'municipal' | 'central';
  /** "Komuna Prishtinë" (the form the municipalities print themselves) or the ministry's name. */
  name: string;
  /** The directorate (municipal) the report should reach. */
  office: string;
  email: string | null;
  emailStatus: EmailStatus;
  /** True when the address is safe for an automatic send. */
  sendable: boolean;
  phone?: string;
  /** The institution's own website: where its contact was read. */
  site?: string;
  note?: string;
}

export interface Resolution {
  primary: Recipient;
  /** The other level, kept as a copy/escalation target. */
  secondary: Recipient;
  rule: Rule;
  /** A `zone` topic with no zone given: the caller should ask. */
  needsZone: boolean;
  /** One plain sentence saying why this body was chosen. */
  reason: string;
}

const GENERIC_OFFICE = 'Zyra përkatëse';
const MUNICIPAL_FALLBACK: ContactPoint = { email: null, status: 'missing' };

function municipalRecipient(municipality: string, office: string): Recipient {
  const contact = MUNICIPAL_CONTACTS[municipality] ?? MUNICIPAL_FALLBACK;
  return {
    level: 'municipal',
    name: municipality ? `Komuna ${municipality}` : 'Komuna',
    office,
    email: contact.email,
    emailStatus: contact.status,
    sendable: Boolean(contact.email) && isSendable(contact.status),
    phone: contact.phone,
    site: contact.site,
    note: contact.note,
  };
}

function centralRecipient(key: keyof typeof CENTRAL_BODIES): Recipient {
  const body = CENTRAL_BODIES[key];
  return {
    level: 'central',
    name: body.name,
    office: body.name,
    email: body.contact.email,
    emailStatus: body.contact.status,
    sendable: Boolean(body.contact.email) && isSendable(body.contact.status),
    phone: body.contact.phone,
    site: body.contact.site,
    note: body.contact.note,
  };
}

export function resolveResponsible(input: { topicId: string | null | undefined; municipality: string; zone?: Zone | null }): Resolution {
  const route = TOPIC_ROUTES[input.topicId as ReportTopicId];
  if (!route) {
    // A legacy or missing category: the municipality is the first point of contact.
    const primary = municipalRecipient(input.municipality, GENERIC_OFFICE);
    return { primary, secondary: centralRecipient('mapl'), rule: 'municipal', needsZone: false, reason: 'Kategoria nuk është e njohur, ndaj raporti shkon te komuna.' };
  }

  const municipal = municipalRecipient(input.municipality, route.office);
  const central = centralRecipient(route.central);

  if (route.rule === 'municipal') {
    return { primary: municipal, secondary: central, rule: 'municipal', needsZone: false, reason: 'Kjo kategori është përgjegjësi e komunës.' };
  }
  if (route.rule === 'central') {
    return { primary: central, secondary: municipal, rule: 'central', needsZone: false, reason: 'Kjo kategori është përgjegjësi e institucionit qendror.' };
  }
  if (input.zone === 'rural') {
    return { primary: central, secondary: municipal, rule: 'zone', needsZone: false, reason: 'Vendi është jashtë zonës urbane, ndaj përgjegjës është shteti.' };
  }
  if (input.zone === 'urban') {
    return { primary: municipal, secondary: central, rule: 'zone', needsZone: false, reason: 'Vendi është brenda zonës urbane, ndaj përgjegjëse është komuna.' };
  }
  return { primary: municipal, secondary: central, rule: 'zone', needsZone: true, reason: 'Zona urbane/rurale nuk është caktuar; përkohësisht shkon te komuna.' };
}

/** Groups items by the body they would be sent to, for one export or mailing per recipient. */
export function groupByRecipient<T>(items: T[], resolve: (item: T) => Resolution): Array<{ key: string; recipient: Recipient; items: T[]; needsZone: number }> {
  const groups = new Map<string, { key: string; recipient: Recipient; items: T[]; needsZone: number }>();
  for (const item of items) {
    const resolution = resolve(item);
    const key = `${resolution.primary.level}:${resolution.primary.name}:${resolution.primary.office}`;
    const group = groups.get(key) ?? { key, recipient: resolution.primary, items: [], needsZone: 0 };
    group.items.push(item);
    if (resolution.needsZone) group.needsZone += 1;
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => b.items.length - a.items.length);
}
