import type React from 'react';
import {
  Activity, BellRing, Building2, ClipboardCheck, Eye, FileText, Headphones, Heart, HeartPulse,
  History, Inbox, KeyRound, Landmark, LayoutDashboard, Map as MapIcon, Megaphone, MessageSquare,
  ListChecks, Newspaper, Settings, ShieldAlert, ShieldCheck, UserCheck, UserCog, Users, Video, Vote,
} from 'lucide-react';
import type { AdminSection } from '../../../lib/adminPermissions';
import type { SearchableSection } from '../../../lib/adminNav';

/**
 * The admin menu, as data.
 *
 * Twenty-five sections used to sit in five accordion groups where opening one
 * closed the others, and the groups did not match how people work: the same
 * daily task could be in "Operacionet", "Qytetarët" or "Komunikimi". They are
 * now grouped by *how often they are used*:
 *
 *   daily      – what a staffer opens every shift; always visible, never folded
 *   community  – content and audience: forum, news, notices, ads
 *   team       – people and oversight: staff, roles, monitoring, role consoles
 *   system     – configuration and audit
 *
 * `label` is the page title; `nav` is the short sidebar name; `keywords` are the
 * words a person might type that are not in either (synonyms, English, old
 * names) so the "go to…" search finds what they mean.
 */

export type NavGroupId = 'daily' | 'services' | 'community' | 'team' | 'system';

export type NavIcon = React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;

export interface NavSection extends SearchableSection {
  id: AdminSection;
  icon: NavIcon;
  group: NavGroupId;
  /**
   * A module that has been folded into another one. It is not deleted: its page, its route,
   * its permissions and its data stay exactly as they were. It only stops taking a line of
   * its own in the sidebar when the viewer can open the parent; it is then reached from the
   * parent's tab strip. A role that cannot open the parent (e.g. a monitor without
   * `monitoring`) still sees it in the sidebar as before.
   */
  mergedInto?: AdminSection;
}

export const NAV_GROUPS: Record<NavGroupId, { label: string; order: number }> = {
  daily: { label: 'Përmbledhje', order: 0 },
  services: { label: 'Shërbimet për qytetarët', order: 1 },
  community: { label: 'Përmbajtja & komunikimi', order: 2 },
  team: { label: 'Organizimi & operacionet', order: 3 },
  system: { label: 'Sistemi & siguria', order: 4 },
};

export const NAV_SECTIONS: readonly NavSection[] = [
  // ── Daily ──────────────────────────────────────────────────────────────────
  {
    id: 'dashboard', group: 'daily', icon: LayoutDashboard,
    nav: 'Paneli', label: 'Paneli i Përgjithshëm', hint: 'Numrat e ditës dhe çka kërkon vëmendje',
    keywords: ['kreu', 'home', 'overview', 'statistika', 'dashboard'],
  },
  {
    id: 'inbox', group: 'daily', icon: Inbox,
    nav: 'Kutia e punës', label: 'Kutia e Punës', hint: 'Gjithçka që pret veprim, sipas urgjencës',
    keywords: ['inbox', 'detyra', 'pret', 'urgjente', 'vonuara', 'todo', 'veprime'],
  },
  {
    id: 'reports', group: 'daily', icon: FileText,
    nav: 'Raportet', label: 'Raportet sipas fazës', hint: 'Në pritje, U aprovua, I caktuar, Në proces, U zgjidh, U mbyll, Të refuzuara',
    keywords: ['raporte', 'dosje', 'ankesa', 'ankesë', 'complaints', 'reports', 'aprovim', 'approve'],
  },
  {
    id: 'work', group: 'daily', icon: ClipboardCheck,
    nav: 'Detyrat', label: 'Detyrat', hint: 'Detyrat e mia nga raportet, ato që kërkojnë caktim dhe afatet',
    keywords: ['detyra', 'task', 'tasks', 'ngarkesa', 'workload', 'ekipi', 'afate', 'sla', 'caktim', 'radha', 'queue', 'kapaciteti'],
    mergedInto: 'inbox',
  },
  {
    id: 'workflow', group: 'daily', icon: ListChecks,
    nav: 'Aprovime të tjera', label: 'Donacione, Shëndetësi, Lajme', hint: 'Aprovimi i kërkesave që nuk janë raportime',
    keywords: ['aprovim', 'faza', 'stages', 'workflow', 'masiv', 'bulk', 'zgjidh të gjitha', 'përfunduar', 'në pritje', 'përgjigje', 'tabela'],
  },
  {
    id: 'support', group: 'daily', icon: Headphones,
    nav: 'Qendra e mbështetjes', label: 'Kërkesat për Agjent', hint: 'Bisedat me qytetarë që kërkojnë ndihmë',
    keywords: ['chat', 'biseda', 'mesazhe', 'ndihmë', 'support', 'help', 'tiket'],
    mergedInto: 'inbox',
  },

  // ── Citizen services ──────────────────────────────────────────────────────
  {
    id: 'health', group: 'services', icon: HeartPulse,
    nav: 'Shëndetësia', label: 'Regjistri Shëndetësor & Spitalet', hint: 'Rastet shëndetësore të regjistruara',
    keywords: ['spital', 'spitale', 'mjekësor', 'health', 'raste', 'pacient'],
  },
  {
    id: 'donations', group: 'services', icon: Heart,
    nav: 'Donacionet', label: 'Aprovimi i Donacioneve', hint: 'Kërkesat për fonde që presin vendim',
    keywords: ['donacion', 'fonde', 'ndihmë sociale', 'donations', 'solidaritet'],
    mergedInto: 'workflow',
  },
  {
    id: 'debate', group: 'services', icon: Landmark,
    nav: 'Debati qytetar', label: 'Debati Qytetar', hint: 'Moderimi, llogaritë, pagesat, verifikimet dhe promovimet e debatit',
    keywords: ['debat', 'pagesa', 'iban', 'paysera', 'tick', 'verifikim', 'reklama', 'debatwp'],
  },
  {
    id: 'polls', group: 'services', icon: Vote,
    nav: 'Sondazhet & anketat', label: 'Sondazhet Publike', hint: 'Pyetësorët dhe rezultatet',
    keywords: ['sondazh', 'votim', 'polls', 'pyetësor'],
    mergedInto: 'debate',
  },
  {
    id: 'forum', group: 'services', icon: MessageSquare,
    nav: 'Moderimi i postimeve', label: 'Moderimi i Debatit Publik', hint: 'Postimet dhe raportimet e komunitetit',
    keywords: ['debat', 'postime', 'komente', 'forum', 'moderim'],
    mergedInto: 'debate',
  },
  {
    id: 'users', group: 'services', icon: Users,
    nav: 'Llogaritë e qytetarëve', label: 'Regjistri i Qytetarëve', hint: 'Llogaritë dhe statusi i tyre',
    keywords: ['përdorues', 'perdorues', 'llogari', 'users', 'citizens', 'ban', 'bllokim'],
    mergedInto: 'debate',
  },

  // ── Community & content ────────────────────────────────────────────────────
  {
    id: 'news', group: 'community', icon: Newspaper,
    nav: 'Redaksia', label: 'Menaxhimi i Lajmeve', hint: 'Botimi dhe redaktimi i lajmeve',
    keywords: ['artikuj', 'artikull', 'botim', 'news', 'redaktim', 'editorial'],
  },
  {
    id: 'notifications', group: 'community', icon: BellRing,
    nav: 'Njoftimet', label: 'Komunikimi & Njoftimet', hint: 'Njoftime dhe thirrje drejt qytetarëve',
    keywords: ['njoftim', 'broadcast', 'alarm', 'emergjent', 'alert', 'notifications'],
    mergedInto: 'news',
  },
  {
    id: 'videos', group: 'community', icon: Video,
    nav: 'Videot', label: 'Menaxhimi i Videove', hint: 'Video publike për sidebar dhe faqe',
    keywords: ['video', 'reels', 'media'],
    mergedInto: 'news',
  },
  {
    id: 'ads', group: 'community', icon: Megaphone,
    nav: 'Reklamat & partneritetet', label: 'Reklamat & Partneritetet', hint: 'Sloti dhe fushatat',
    keywords: ['reklamë', 'reklame', 'fushata', 'ads', 'slot', 'banner'],
  },

  // ── Team & oversight ───────────────────────────────────────────────────────
  {
    id: 'agents', group: 'team', icon: UserCog,
    nav: 'Stafi & Agjentët', label: 'Menaxhimi i Stafit & Agjentëve', hint: 'Krijo agjentë, cakto role dhe leje',
    keywords: ['staf', 'staff', 'agjent', 'punonjës', 'ekipi', 'shto agjent', 'leje', 'permissions'],
  },
  {
    id: 'roles', group: 'team', icon: KeyRound,
    nav: 'Rolet & Lejet', label: 'Katalogu i Roleve & Lejeve', hint: 'Çka hap dhe çka nuk lejohet çdo rol',
    keywords: ['rbac', 'permissions', 'leje', 'rol', 'roles', 'qasje', 'access'],
    mergedInto: 'agents',
  },
  {
    id: 'municipalities', group: 'team', icon: Building2,
    nav: 'Llogaritë e Komunave', label: 'Llogaritë e Komunave', hint: 'Krijimi i llogarive komunale me firewall editorial',
    keywords: ['komuna', 'komunë', 'llogari komunale', 'municipality', 'provisioning'],
  },
  {
    id: 'workfacts', group: 'team', icon: ClipboardCheck,
    nav: 'Të dhënat e komunave', label: 'Të Dhënat e Komunave', hint: 'Verifikimi i punimeve të raportuara nga komunat',
    keywords: ['punime', 'verifikim', 'work facts', 'fakte'],
    mergedInto: 'municipalities',
  },
  {
    id: 'monitoring', group: 'team', icon: Activity,
    nav: 'Monitorimi operacional', label: 'Monitorimi Operacional', hint: 'Ngarkesa e agjentëve, afatet e komunave, pengesat e rrjedhës',
    keywords: ['performancë', 'ngarkesa', 'aktivitet', 'monitoring', 'agjent'],
  },
  {
    id: 'monitorim', group: 'team', icon: Eye,
    nav: 'Monitorim i Plotë', label: 'Monitorim i Plotë', hint: 'Mbikëqyrje e thellë e agjentëve dhe komunave',
    keywords: ['mbikëqyrje', 'monitorim', 'oversight', 'afate', 'vonesa'],
    mergedInto: 'monitoring',
  },
  {
    id: 'agentpanel', group: 'team', icon: UserCheck,
    nav: 'Paneli i Agjentit', label: 'Paneli i Agjentëve', hint: 'Konsola e punës së agjentëve',
    keywords: ['agjent', 'kutia hyrëse', 'inbox', 'punët e mia'],
    mergedInto: 'monitoring',
  },
  {
    id: 'komunapanel', group: 'team', icon: Landmark,
    nav: 'Paneli i Komunës', label: 'Paneli i Komunave', hint: 'Konsola e punëve të komunave',
    keywords: ['komuna', 'komunë', 'municipality', 'punët'],
    mergedInto: 'municipalities',
  },
  {
    id: 'moderim', group: 'team', icon: ShieldAlert,
    nav: 'Qendra e Moderimit', label: 'Qendra e Moderimit', hint: 'Anomalitë, auditimi dhe moderimi',
    keywords: ['anomali', 'auditim', 'moderim', 'moderation', 'abuzim'],
    mergedInto: 'debate',
  },
  {
    id: 'updates', group: 'team', icon: History,
    nav: 'Aktiviteti & auditimi', label: 'Aktiviteti i Stafit & Auditimi', hint: 'Çka ka bërë stafi së fundi',
    keywords: ['përditësime', 'historia', 'aktivitet', 'updates', 'log'],
    mergedInto: 'security',
  },

  // ── System ─────────────────────────────────────────────────────────────────
  {
    id: 'categories', group: 'system', icon: MapIcon,
    nav: 'Harta & GIS', label: 'Harta & GIS', hint: 'Ndarja gjeografike dhe rajonet',
    keywords: ['harta', 'gis', 'map', 'rajone', 'kategori', 'categories'],
    mergedInto: 'settings',
  },
  {
    id: 'security', group: 'system', icon: ShieldCheck,
    nav: 'Siguria & Auditimi', label: 'Siguria dhe Auditimi', hint: 'Regjistri i veprimeve',
    keywords: ['siguri', 'audit', 'log', 'security', 'regjistri', 'veprime'],
  },
  {
    id: 'settings', group: 'system', icon: Settings,
    nav: 'Cilësimet', label: 'Konfigurimet e Sistemit', hint: 'Parametrat e platformës',
    keywords: ['konfigurim', 'settings', 'cilësime', 'parametra'],
  },
];

export const NAV_BY_ID: ReadonlyMap<AdminSection, NavSection> = new Map(
  NAV_SECTIONS.map(section => [section.id, section] as const)
);

/**
 * The sections that take a line in the sidebar: those the viewer may open, minus the ones
 * folded into a parent the viewer can also open.
 */
export function sidebarSections(visible: readonly NavSection[]): NavSection[] {
  const ids = new Set(visible.map(section => section.id));
  return visible.filter(section => !(section.mergedInto && ids.has(section.mergedInto)));
}

/**
 * The tab strip of a consolidated module: the parent first, then the folded modules the
 * viewer may open. Empty when nothing is folded into it, so no strip is drawn.
 */
export function moduleTabs(activeId: AdminSection, visible: readonly NavSection[]): NavSection[] {
  const ids = new Set(visible.map(section => section.id));
  const active = NAV_BY_ID.get(activeId);
  const parent = active?.mergedInto && ids.has(active.mergedInto) ? active.mergedInto : activeId;
  const children = visible.filter(section => section.mergedInto === parent);
  const head = visible.find(section => section.id === parent);
  return children.length && head ? [head, ...children] : [];
}

/** Groups in display order, each with the sections the viewer may open. */
export function groupVisible(
  visible: readonly NavSection[]
): Array<{ id: NavGroupId; label: string; items: NavSection[] }> {
  return (Object.keys(NAV_GROUPS) as NavGroupId[])
    .sort((a, b) => NAV_GROUPS[a].order - NAV_GROUPS[b].order)
    .map(id => ({
      id,
      label: NAV_GROUPS[id].label,
      items: visible.filter(section => section.group === id),
    }))
    .filter(group => group.items.length > 0);
}
