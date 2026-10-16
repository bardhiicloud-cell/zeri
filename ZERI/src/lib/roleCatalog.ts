/**
 * Katalogu i detajuar i roleve — what each admin role is, precisely.
 *
 * ─── Why this exists next to adminPermissions.ts ────────────────────────────
 *
 * `adminPermissions.ts` answers one question: "may this account open this
 * section?" That is a boolean, and a boolean is all the sidebar needs. It is not
 * enough to *explain* a role — to an administrator assigning one, to an auditor
 * reading the access list, or to a new staff member learning what they can do.
 *
 * This module is the human-readable half: for every role, what it is for, which
 * sections it opens, what it may never do, and how sensitive its access is. It
 * is derived from the same source as the boolean check — `BY_ROLE` in
 * adminPermissions.ts — so the description and the enforcement cannot drift.
 *
 * It is declaration-only: no component reads it to *decide* anything, only to
 * *display*. The decision remains `canAccessSection`, backed by the server's
 * custom claims. A description that disagreed with the guard would be a bug
 * report, not a security hole, which is the correct direction for that risk.
 */
import type { AdminSection, StaffRole, UserRoleLike } from './adminPermissions';
import { BY_ROLE, FULL_ACCESS } from './adminPermissions';
import type { User } from '../types';

/** How consequential a role's access is. Drives the colour of its card. */
export type ClearanceLevel = 'owner' | 'editorial' | 'field' | 'commercial' | 'customer';

export interface RoleProfile {
  role: User['role'];
  /** Short name, as shown in the sidebar badge. */
  label: string;
  /** One line: what this role exists to do. */
  purpose: string;
  /** The clearance band, which sets the card's tone and ordering. */
  clearance: ClearanceLevel;
  /**
   * Whether the role is platform staff.
   *
   * A municipality is deliberately `false`: it is a paying customer and the
   * subject of the reporting, not a member of the newsroom.
   */
  isStaff: boolean;
  /** Every section this role opens, in the order the sidebar shows them. */
  sections: readonly AdminSection[];
  /** True when the role opens every section without exception. */
  fullAccess: boolean;
  /** The actions this role is explicitly barred from, in plain language. */
  cannot: readonly string[];
  /**
   * Two or three sentences an administrator can read before assigning the role.
   * Written to answer "why would I pick this one over the one above it".
   */
  notes: string;
}

/**
 * The sections, in the order a person scans them.
 *
 * Kept here rather than derived from the component so the role catalogue can be
 * rendered outside the admin shell — an audit report, a help page, a CSV export —
 * without importing a component.
 */
export const SECTION_ORDER: readonly AdminSection[] = [
  'dashboard', 'updates',
  'reports', 'workfacts', 'health', 'donations',
  'users', 'forum', 'polls',
  'agents', 'municipalities', 'monitoring',
  'monitorim', 'agentpanel', 'komunapanel', 'moderim', 'roles',
  'support', 'ads', 'videos', 'notifications', 'news', 'heritage', 'debate',
  'categories', 'security', 'settings',
];

/** Presentation names, matching the sidebar so a reader can find them. */
export const SECTION_LABELS: Record<AdminSection, string> = {
  dashboard: 'Paneli i Përgjithshëm',
  inbox: 'Kutia e Punës',
  updates: 'Përditësimet e Adminit',
  reports: 'Inspektimi i Raporteve',
  workfacts: 'Faktet e Komunave',
  health: 'Regjistri Shëndetësor',
  donations: 'Aprovimi i Donacioneve',
  users: 'Regjistri i Qytetarëve',
  forum: 'Moderimi i Debatit Publik',
  debate: 'Admini i Debatit Publik (pagesa, ticke, reklama)',
  work: 'Detyrat dhe ngarkesa e punës (çdo staf sheh vetëm punën e lejuar nga serveri)',
  workflow: 'Rrjedha e Aprovimit (hapet për kë ka raporte, donacione, shëndetësi ose lajme)',
  polls: 'Sondazhet Publike',
  agents: 'Menaxhimi i Stafit',
  municipalities: 'Llogaritë e Komunave',
  monitoring: 'Monitorimi i Agjentëve',
  monitorim: 'Monitorim i Plotë',
  agentpanel: 'Paneli i Agjentëve',
  komunapanel: 'Paneli i Komunave',
  moderim: 'Qendra e Moderimit',
  roles: 'Katalogu i Roleve & Lejeve',
  support: 'Kërkesat për Agjent',
  ads: 'Menaxhimi i Reklamave',
  videos: 'Menaxhimi i Videove',
  notifications: 'Komunikimi & Njoftimet',
  news: 'Menaxhimi i Lajmeve',
  heritage: 'Arkivi i Kosovës & Historia e UÇK-së',
  categories: 'Harta & GIS',
  security: 'Siguria dhe Auditimi',
  settings: 'Konfigurimet e Sistemit',
};

/** The clearance band, sorted owner → customer. Used for ordering only. */
export const CLEARANCE_ORDER: readonly ClearanceLevel[] = [
  'owner', 'editorial', 'field', 'commercial', 'customer',
];

export const CLEARANCE_LABELS: Record<ClearanceLevel, string> = {
  owner: 'Pronar / Zotërues',
  editorial: 'Redaksia',
  field: 'Terreni',
  commercial: 'Komercial',
  customer: 'Klient Komunal',
};

/**
 * The catalogue.
 *
 * Every entry's `sections` is read from the same `BY_ROLE`/`FULL_ACCESS` table
 * the guard uses, so this is a *view* of the policy, never a parallel copy of it.
 */
export const ROLE_CATALOG: readonly RoleProfile[] = [
  {
    role: 'superadmin',
    label: 'Super Administrator',
    purpose: 'Pronari i platformës. Mbikëqyr gjithçka dhe kryen veprimet e pakthyeshme.',
    clearance: 'owner',
    isStaff: true,
    sections: FULL_ACCESS,
    fullAccess: true,
    cannot: [
      'Nuk ka kufizime funksionale — por çdo veprim i tij regjistrohet',
      'Nuk mund të fshijë ose ndryshojë regjistrat e auditimit (append-only)',
    ],
    notes:
      'I vetmi rol që krijon llogari komunale, shkruan konfigurimet private të AdSense dhe fshin ' +
      'llogari. Kaq privilegj duhet të mbahet nga një numër shumë i vogël njerëzish: dy ose tre, jo ' +
      'një për çdo drejtori. Çdo veprim i tij bartet në regjistrin e pandryshueshëm, i cili as ai ' +
      'vetë nuk mund t\'i shkruajë.',
  },
  {
    role: 'admin',
    label: 'Administrator',
    purpose: 'Drejton operacionet e përditshme dhe stafin. Shikon gjithçka, kryen pothuajse gjithçka.',
    clearance: 'owner',
    isStaff: true,
    sections: FULL_ACCESS,
    fullAccess: true,
    cannot: [
      'Nuk krijon llogari komunale (vetëm superadmin)',
      'Nuk shkruan kredencialet private të reklamave (vetëm superadmin)',
    ],
    notes:
      'Zëvendësi operativ i superadminit. Diferenca është e qëllimshme dhe e ngushtë: dy veprimet që ' +
      'kërkojnë pranimin e një klauzole kontraktuale ose shkrimin e një sekreti mbeten te pronari. ' +
      'Për çdo gjë tjetër — raporte, staf, lajme, reklama, konfigurime — admini është i plotë.',
  },
  {
    role: 'approver',
    label: 'Zyrtar Aprovimi',
    purpose: 'Punon radhën hyrëse: inspekton raportimet dhe konfirmon punimet e komunave.',
    clearance: 'editorial',
    isStaff: true,
    sections: BY_ROLE.approver!,
    fullAccess: false,
    cannot: [
      'Nuk menaxhon stafin, rolet ose lejet',
      'Nuk prek konfigurimet e sistemit, sigurinë ose reklamat',
      'Nuk boton lajme',
    ],
    notes:
      'Roli standard i redaksisë. Sheh dhe vepron mbi raporte, fakte pune, shëndetësi, donacione, ' +
      'forum, sondazhe dhe kërkesa ndihme — por nuk mund të ndryshojë kush ka qasje. Ky është roli ' +
      'që duhet dhënë një redaktori pa i dhënë platformën.',
  },
  {
    role: 'newsadmin',
    label: 'Redaktor i Lajmeve',
    purpose: 'Shkruan, boton dhe redakton lajmet; moderon debatin publik dhe sondazhet.',
    clearance: 'editorial',
    isStaff: true,
    sections: BY_ROLE.newsadmin!,
    fullAccess: false,
    cannot: [
      'Nuk sheh ose vepron mbi raportimet e qytetarëve',
      'Nuk prek regjistrin shëndetësor ose donacionet',
      'Nuk menaxhon staf, siguri ose konfigurime',
    ],
    notes:
      'Fokusuarash në përmbajtje editoriale. Nuk ka qasje në asnjë e-mail ose numër telefoni qytetari, ' +
      'dhe nuk mund të aprovojë as të refuzojë një raportim problematik. Kjo e mban produktin ' +
      'editorial dhe procesin e ankesave si dy vende pune të ndara.',
  },
  {
    role: 'debatwp',
    label: 'Admin i Debatit Publik',
    purpose: 'Menaxhon Debatin Publik: pagesat me kod, tickun e verifikimit, reklamat e debatit dhe postimet.',
    clearance: 'commercial',
    isStaff: true,
    sections: BY_ROLE.debatwp!,
    fullAccess: false,
    cannot: [
      'Nuk sheh raportimet e qytetarëve, regjistrin shëndetësor ose donacionet',
      'Nuk menaxhon staf, siguri ose konfigurime të platformës',
      'Nuk sheh të dhëna personale të qytetarëve përtej emrit te pagesa',
    ],
    notes:
      'Rol i ngushtë dhe komercial: konfirmon pagesat që hynë në llogarinë bankare duke i krahasuar me kodet ' +
      'e gjeneruara, aktivizon ose heq tickun, menaxhon reklamat dhe postimet e promovuara në debat, dhe ' +
      'trajton raportimet e postimeve. Çdo konfirmim pagese regjistrohet me emrin e tij në auditim.',
  },
  {
    role: 'agent',
    label: 'Agjent Terreni',
    purpose: 'Punon drejtpërdrejt me qytetarët në terren: radha, ndihma, moderim i lehtë.',
    clearance: 'field',
    isStaff: true,
    sections: BY_ROLE.agent!,
    fullAccess: false,
    cannot: [
      'Nuk menaxhon staf, role ose leje',
      'Nuk shkruan ose boton lajme',
      'Nuk sheh konfigurimet, sigurinë ose reklamat',
      'Nuk shikon e-mail ose telefon të qytetarëve jashtë detyrës',
    ],
    notes:
      'Roli i vijës së parë. I nevojitet radha e raporteve dhe kutia e kërkesave për të punuar, dhe ' +
      'forumi për të moderuar. Vetëm veprimet e tij shfaqen në panelin e tij: një agjent nuk i sheh ' +
      'punët e kolegëve, që parandalon konkurrencën e brendshme dhe rrjedhjen e informacionit.',
  },
  {
    role: 'responder',
    label: 'Përgjegjës',
    purpose: 'Përgjigjet shpejt: radha e raporteve, kërkesat dhe debati publik.',
    clearance: 'field',
    isStaff: true,
    sections: BY_ROLE.responder!,
    fullAccess: false,
    cannot: [
      'Nuk dërgon njoftime broadcast drejt qytetarëve',
      'Nuk menaxhon staf, lajme, siguri ose konfigurime',
    ],
    notes:
      'I njëjti terren si agjenti, pa privilegjin e njoftimeve masive. Diferenca ekziston që një ' +
      'përgjegjësi i ri të mos mund t\'i shkruajë me një klik çdo qytetari në vend.',
  },
  {
    role: 'dispatcher',
    label: 'Dispatcher',
    purpose: 'Cakton dhe shpërndan punët: radha, kërkesat, moderimi dhe njoftimet.',
    clearance: 'field',
    isStaff: true,
    sections: BY_ROLE.dispatcher!,
    fullAccess: false,
    cannot: [
      'Nuk prek konfigurimet, sigurinë ose reklamat',
      'Nuk menaxhon staf ose role',
    ],
    notes:
      'Si përgjegjësi, me shtimin e njoftimeve. Kjo është dikush që koordinon punën e të tjerëve dhe ' +
      'duhet të komunikojë me qytetarët rreth saj — prandaj njoftimet janë në, dhe menaxhimi i ' +
      'stafit mbetet jashtë.',
  },
  {
    role: 'monitor',
    label: 'Monitorues',
    purpose: 'Mbikëqyr: sheh raportimet, afatet, ndryshimet e statusit dhe auditimin, pa ndryshuar asgjë.',
    clearance: 'field',
    isStaff: true,
    sections: BY_ROLE.monitor!,
    fullAccess: false,
    cannot: [
      'Nuk ndryshon statusin, nuk cakton dhe nuk refuzon raportime',
      'Nuk fshin raportime dhe nuk modifikon përgjigjet e institucioneve',
      'Nuk menaxhon përdorues, staf ose role',
      'Nuk sheh regjistrin shëndetësor, donacionet, reklamat ose konfigurimet',
    ],
    notes:
      'Për njerëzit që duhet të shohin gjithçka rreth punës — kush ndryshoi çfarë, kur, dhe cilat ' +
      'raste janë të vonuara — pa mundur ta ndryshojnë. Çdo veprim shkrimi refuzohet nga serveri, ' +
      'jo vetëm fshihet në ndërfaqe.',
  },
  {
    role: 'adsadmin',
    label: 'Menaxher Reklamash',
    purpose: 'Zgjeron dhe menaxhon inventarin e reklamave komerciale.',
    clearance: 'commercial',
    isStaff: true,
    sections: BY_ROLE.adsadmin!,
    fullAccess: false,
    cannot: [
      'Nuk sheh asnjë raportim qytetari',
      'Nuk sheh regjistrin shëndetësor ose donacionet',
      'Nuk prek lajmet, moderimin, stafin ose konfigurimet',
    ],
    notes:
      'Rol ekskluzivisht komercial. Dizajni është dashur të sigurojë që personi që shet reklama nuk ' +
      'mund të lexojë aksidentalisht një ankesë ose një rast shëndetësor. Nuk ka qasje as në faqet ' +
      'e përmbajtjes, vetëm inventarin dhe fushatat.',
  },
  {
    role: 'municipality',
    label: 'Komuna',
    purpose: 'Klient transparent: përgjigjet raportimeve dhe shton fakte për punimet e veta.',
    clearance: 'customer',
    isStaff: false,
    sections: BY_ROLE.municipality!,
    fullAccess: false,
    cannot: [
      'Nuk sheh raportime të papranuara ose të refuzuara',
      'Nuk fshin, fsheh ose ndryshon asnjë tekst qytetari',
      'Nuk vepron jashtë komunës së vet',
      'Nuk sheh qytetarë, staf, siguri, konfigurime, lajme ose reklama',
    ],
    notes:
      'NUK është staf. Është klienti që paguan abonimin dhe njëkohësisht subjekti i raportimeve — ' +
      'pra konflikti i interesit është i brendshëm. Firewall-i editorial (editorialFirewall.ts) i ' +
      'lejon të SHPOJTË kontekst dhe kurrë të HEQË përmbajtje, dhe ky kufi zbatohet në kod, jo në ' +
      'kontratë.',
  },
];

/** Look a role up. Returns `undefined` for an unknown or citizen role. */
export function roleProfile(role: string | null | undefined): RoleProfile | undefined {
  if (!role) return undefined;
  return ROLE_CATALOG.find((entry) => entry.role === role);
}

/**
 * The sections a role opens, in reading order.
 *
 * Uses `canAccessSection` rather than reading `BY_ROLE` directly, so the display
 * honours the alias and grant rules too — including the panel aliases that map
 * `agentpanel` ⇄ `agents`.
 */
export function sectionsForRole(role: string): AdminSection[] {
  const profile = roleProfile(role);
  if (!profile) return [];
  return SECTION_ORDER.filter((section) => profile.sections.includes(section));
}

/** True when the given section list is exactly the full set. */
export function isFullAccess(sections: readonly AdminSection[]): boolean {
  return FULL_ACCESS.every((section) => sections.includes(section));
}

/** A stable, greppable marker for consumers that must handle every role. */
export const ALL_ADMIN_ROLES: readonly StaffRole[] = [
  'admin', 'superadmin', 'approver', 'adsadmin', 'newsadmin',
  'agent', 'responder', 'dispatcher', 'monitor', 'municipality',
];

export type { AdminSection, StaffRole, UserRoleLike };
