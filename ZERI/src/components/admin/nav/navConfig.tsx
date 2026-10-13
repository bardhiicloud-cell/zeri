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

export type NavGroupId = 'daily' | 'community' | 'team' | 'system';

export type NavIcon = React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;

export interface NavSection extends SearchableSection {
  id: AdminSection;
  icon: NavIcon;
  group: NavGroupId;
}

export const NAV_GROUPS: Record<NavGroupId, { label: string; order: number }> = {
  daily: { label: 'Punë ditore', order: 0 },
  community: { label: 'Komuniteti & përmbajtja', order: 1 },
  team: { label: 'Ekipi & monitorimi', order: 2 },
  system: { label: 'Sistemi', order: 3 },
};

export const NAV_SECTIONS: readonly NavSection[] = [
  // ── Daily ──────────────────────────────────────────────────────────────────
  {
    id: 'inbox', group: 'daily', icon: Inbox,
    nav: 'Kutia e punës', label: 'Kutia e Punës', hint: 'Gjithçka që pret veprim, sipas urgjencës',
    keywords: ['inbox', 'detyra', 'pret', 'urgjente', 'vonuara', 'todo', 'veprime'],
  },
  {
    id: 'dashboard', group: 'daily', icon: LayoutDashboard,
    nav: 'Paneli', label: 'Paneli i Përgjithshëm', hint: 'Numrat e ditës dhe çka kërkon vëmendje',
    keywords: ['kreu', 'home', 'overview', 'statistika', 'dashboard'],
  },
  {
    id: 'reports', group: 'daily', icon: FileText,
    nav: 'Raportet', label: 'Inspektimi i Raporteve', hint: 'Radha e raporteve të qytetarëve',
    keywords: ['raporte', 'dosje', 'ankesa', 'ankesë', 'complaints', 'reports', 'aprovim', 'approve'],
  },
  {
    id: 'workflow', group: 'daily', icon: ListChecks,
    nav: 'Rrjedha e aprovimit', label: 'Rrjedha e Aprovimit', hint: 'Raportuar, aprovuar, në pritje, përgjigje, përfunduar',
    keywords: ['aprovim', 'faza', 'stages', 'workflow', 'masiv', 'bulk', 'zgjidh të gjitha', 'përfunduar', 'në pritje', 'përgjigje', 'tabela'],
  },
  {
    id: 'support', group: 'daily', icon: Headphones,
    nav: 'Mbështetja', label: 'Kërkesat për Agjent', hint: 'Bisedat me qytetarë që kërkojnë ndihmë',
    keywords: ['chat', 'biseda', 'mesazhe', 'ndihmë', 'support', 'help', 'tiket'],
  },
  {
    id: 'health', group: 'daily', icon: HeartPulse,
    nav: 'Shëndetësia', label: 'Regjistri Shëndetësor & Spitalet', hint: 'Rastet shëndetësore të regjistruara',
    keywords: ['spital', 'spitale', 'mjekësor', 'health', 'raste', 'pacient'],
  },
  {
    id: 'donations', group: 'daily', icon: Heart,
    nav: 'Donacionet', label: 'Aprovimi i Donacioneve', hint: 'Kërkesat për fonde që presin vendim',
    keywords: ['donacion', 'fonde', 'ndihmë sociale', 'donations', 'solidaritet'],
  },
  {
    id: 'users', group: 'daily', icon: Users,
    nav: 'Qytetarët', label: 'Regjistri i Qytetarëve', hint: 'Llogaritë dhe statusi i tyre',
    keywords: ['përdorues', 'perdorues', 'llogari', 'users', 'citizens', 'ban', 'bllokim'],
  },

  // ── Community & content ────────────────────────────────────────────────────
  {
    id: 'forum', group: 'community', icon: MessageSquare,
    nav: 'Forumi', label: 'Moderimi i Debatit Publik', hint: 'Postimet dhe raportimet e komunitetit',
    keywords: ['debat', 'postime', 'komente', 'forum', 'moderim'],
  },
  {
    id: 'debate', group: 'community', icon: Landmark,
    nav: 'Admini i Debatit', label: 'Admini i Debatit Publik', hint: 'Pagesat me kod, ticku, reklamat dhe postimet',
    keywords: ['debat', 'pagesa', 'iban', 'paysera', 'tick', 'verifikim', 'reklama', 'debatwp'],
  },
  {
    id: 'polls', group: 'community', icon: Vote,
    nav: 'Sondazhet', label: 'Sondazhet Publike', hint: 'Pyetësorët dhe rezultatet',
    keywords: ['sondazh', 'votim', 'polls', 'pyetësor'],
  },
  {
    id: 'news', group: 'community', icon: Newspaper,
    nav: 'Lajmet', label: 'Menaxhimi i Lajmeve', hint: 'Botimi dhe redaktimi i lajmeve',
    keywords: ['artikuj', 'artikull', 'botim', 'news', 'redaktim', 'editorial'],
  },
  {
    id: 'notifications', group: 'community', icon: BellRing,
    nav: 'Njoftimet', label: 'Komunikimi & Njoftimet', hint: 'Njoftime dhe thirrje drejt qytetarëve',
    keywords: ['njoftim', 'broadcast', 'alarm', 'emergjent', 'alert', 'notifications'],
  },
  {
    id: 'videos', group: 'community', icon: Video,
    nav: 'Videot', label: 'Menaxhimi i Videove', hint: 'Video publike për sidebar dhe faqe',
    keywords: ['video', 'reels', 'media'],
  },
  {
    id: 'ads', group: 'community', icon: Megaphone,
    nav: 'Reklamat', label: 'Menaxhimi i Reklamave', hint: 'Sloti dhe fushatat',
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
  },
  {
    id: 'municipalities', group: 'team', icon: Building2,
    nav: 'Llogaritë e Komunave', label: 'Llogaritë e Komunave', hint: 'Krijimi i llogarive komunale me firewall editorial',
    keywords: ['komuna', 'komunë', 'llogari komunale', 'municipality', 'provisioning'],
  },
  {
    id: 'workfacts', group: 'team', icon: ClipboardCheck,
    nav: 'Faktet e Komunave', label: 'Faktet e Komunave', hint: 'Verifikimi i punimeve të raportuara nga komunat',
    keywords: ['punime', 'verifikim', 'work facts', 'fakte'],
  },
  {
    id: 'monitoring', group: 'team', icon: Activity,
    nav: 'Monitorimi i Agjentëve', label: 'Monitorimi i Agjentëve', hint: 'Aktiviteti, ngarkesa dhe anomalitë',
    keywords: ['performancë', 'ngarkesa', 'aktivitet', 'monitoring', 'agjent'],
  },
  {
    id: 'monitorim', group: 'team', icon: Eye,
    nav: 'Monitorim i Plotë', label: 'Monitorim i Plotë', hint: 'Mbikëqyrje e thellë e agjentëve dhe komunave',
    keywords: ['mbikëqyrje', 'monitorim', 'oversight', 'afate', 'vonesa'],
  },
  {
    id: 'agentpanel', group: 'team', icon: UserCheck,
    nav: 'Paneli i Agjentit', label: 'Paneli i Agjentëve', hint: 'Konsola e punës së agjentëve',
    keywords: ['agjent', 'kutia hyrëse', 'inbox', 'punët e mia'],
  },
  {
    id: 'komunapanel', group: 'team', icon: Landmark,
    nav: 'Paneli i Komunës', label: 'Paneli i Komunave', hint: 'Konsola e punëve të komunave',
    keywords: ['komuna', 'komunë', 'municipality', 'punët'],
  },
  {
    id: 'moderim', group: 'team', icon: ShieldAlert,
    nav: 'Qendra e Moderimit', label: 'Qendra e Moderimit', hint: 'Anomalitë, auditimi dhe moderimi',
    keywords: ['anomali', 'auditim', 'moderim', 'moderation', 'abuzim'],
  },
  {
    id: 'updates', group: 'team', icon: History,
    nav: 'Aktiviteti i stafit', label: 'Përditësimet e Adminit', hint: 'Çka ka bërë stafi së fundi',
    keywords: ['përditësime', 'historia', 'aktivitet', 'updates', 'log'],
  },

  // ── System ─────────────────────────────────────────────────────────────────
  {
    id: 'categories', group: 'system', icon: MapIcon,
    nav: 'Harta & GIS', label: 'Harta & GIS', hint: 'Ndarja gjeografike dhe rajonet',
    keywords: ['harta', 'gis', 'map', 'rajone', 'kategori', 'categories'],
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
