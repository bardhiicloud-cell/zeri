import type { LucideIcon } from 'lucide-react';
import {
  MapPin, Newspaper, Lightbulb, Vote, BarChart3, Wallet,
  Megaphone, Phone, Building2, Briefcase, Info, HeartPulse,
  Bot, ShieldAlert, ShieldCheck, MessageSquare, Radio,
  PlusCircle, FileText,
} from 'lucide-react';
import { KOSOVO_MUNICIPALITIES } from './constants';

/**
 * The single source of truth for site navigation.
 *
 * The navbar, the sidebar, the mobile sheet and the footer all used to declare
 * their own link lists, so a route renamed in one place stayed stale in the
 * others — the exact failure behind the sidebar showing "Buxhetimi" nowhere
 * while /buxheti 404'd. One table, four renderers.
 *
 * Search is deliberately absent from the link lists. It is behaviour, not
 * navigation: on desktop it is a ⌘K palette, on mobile it lives at the top of
 * the sheet, and the page hero has its own field. No list duplicates it.
 */

export interface NavLink {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Short line shown under the label in the expanded sidebar. */
  hint?: string;
}

export interface NavGroup {
  id: string;
  label: string;
  icon: LucideIcon;
  items: NavLink[];
}

/**
 * The functional modules that live in the left sidebar, ordered by how a
 * citizen actually works through them: report it, see it on the map, follow it
 * up, vote on it, then look up a service.
 */
export const SIDEBAR_GROUPS: NavGroup[] = [
  {
    id: 'operate',
    label: 'Veprimi qytetar',
    icon: Radio,
    items: [
      // The reporting flow sits first: it is the action a citizen came here to
      // take, and burying it under a browse entry is what made the module
      // look like a read-only registry.
      { label: 'Raporto një Problem', href: '/raporto', icon: PlusCircle, hint: 'Njofti institucionin përgjegjës' },
      { label: 'Harta e Raportimeve', href: '/harta', icon: MapPin, hint: 'Hartë interaktive e të gjitha raporteve' },
      { label: 'Raportimet', href: '/detailed-registry', icon: Newspaper, hint: 'Të gjitha ankesat e regjistruara' },
      { label: 'Gjej Raportin Tim', href: '/trackid', icon: FileText, hint: 'Ndjek rastin me Track ID' },
      { label: 'Banka e Ideve', href: '/Idea', icon: Lightbulb, hint: 'Propozimet dhe idetë e qytetarëve' },
      { label: 'Sondazhe & Votime', href: '/sondazhet', icon: Vote, hint: 'Pjesëmarrja në vendimmarrje' },
    ],
  },
  {
    id: 'transparency',
    label: 'Transparenca',
    icon: BarChart3,
    items: [
      { label: 'Statistikat & Analiza', href: '/statistikat', icon: BarChart3, hint: 'Të dhëna dhe krahasime' },
      { label: 'Buxhetimi me Pjesëmarrje', href: '/buxheti', icon: Wallet, hint: 'Ku investohen paratë publike' },
    ],
  },
  {
    id: 'services',
    label: 'Shërbimet',
    icon: HeartPulse,
    items: [
      { label: 'Numrat & Institucionet', href: '/kontakt-numrat', icon: Phone, hint: 'Kontakte dhe numra emergjentë' },
      { label: 'Regjistri Shëndetësor', href: '/shendetesia', icon: HeartPulse, hint: 'Rastet e regjistruara' },
      { label: 'Ndihma & Donacione', href: '/donacion', icon: Wallet, hint: 'Rastet sociale dhe fondet' },
      { label: 'Qendra e Ndihmës', href: '/ndihma', icon: Bot, hint: 'Pyetje të shpeshta' },
    ],
  },
  {
    id: 'community',
    label: 'Komuniteti',
    icon: MessageSquare,
    items: [
      { label: 'Debati Publik', href: '/forum', icon: MessageSquare, hint: 'Bisedo me qytetarët' },
      { label: 'Projektet Qytetare', href: '/projektet', icon: Briefcase, hint: 'Nisma dhe projekte komunitare' },
    ],
  },
  {
    id: 'institutional',
    label: 'Institucionale',
    icon: Building2,
    items: [
      // These live in the top bar on desktop, but the top bar is NOT rendered on
      // mobile (AppLayout hides it below `md`). Keeping them in the sidebar list
      // too is what makes every public page reachable from a phone's sheet —
      // MobileNav derives its groups from ALL_SIDEBAR_LINKS, so a page absent
      // here would be reachable on mobile only through search.
      { label: 'Lajme & Njoftime', href: '/lajme', icon: Newspaper, hint: 'Të reja nga komunat' },
      { label: 'Shërbimet Publike', href: '/sherbimet', icon: Briefcase, hint: 'Shërbime komunale e shtetërore' },
      { label: 'Komunat', href: '/komunat', icon: Building2, hint: 'Të 38 komunat e Kosovës' },
      { label: 'Kontakt', href: '/kontakt', icon: Phone, hint: 'Na shkruani ose na telefononi' },
      { label: 'Rreth Projektit', href: '/rreth-projektit', icon: Info, hint: 'Misioni dhe platforma' },
    ],
  },
];

/**
 * Top bar links. Deliberately short: the sidebar already carries the working
 * modules, so anything repeated here would compete with it for attention.
 */
export const TOP_NAV: NavLink[] = [
  // "Kryefaqja" is rendered separately by the top bar, and "Komunat" is inserted
  // next as a dropdown — both are positional, not part of this list.
  { label: 'Komunat', href: '/komunat', icon: Building2 },
  { label: 'Shërbimet Publike', href: '/sherbimet', icon: Briefcase },
  { label: 'Projektet', href: '/projektet', icon: Briefcase },
  { label: 'Lajme & Njoftime', href: '/lajme', icon: Newspaper },
  { label: 'Kontakt', href: '/kontakt', icon: Phone },
  { label: 'Rreth Projektit', href: '/rreth-projektit', icon: Info },
];

/**
 * The hrefs the top bar already owns, as a lookup set.
 *
 * The desktop sidebar subtracts these so the same page is never advertised
 * twice on one screen. The entries stay in `SIDEBAR_GROUPS` on purpose: the
 * mobile sheet and the ⌘K palette both derive from `ALL_SIDEBAR_LINKS`, and on a
 * phone — where no top bar is rendered — those links are the only way to reach
 * these pages. The duplication is a desktop-layout concern, so it is solved in
 * the desktop layout, not by deleting the links.
 */
export const TOP_NAV_HREFS: ReadonlySet<string> = new Set(TOP_NAV.map((link) => link.href));

/** Legal and policy links, shown in the sidebar footer and the site footer. */
export const LEGAL_NAV: NavLink[] = [
  { label: 'Kushtet e Përdorimit', href: '/kushtet-e-perdorimit', icon: ShieldAlert },
  { label: 'Politika e Privatësisë', href: '/privatesia', icon: ShieldCheck },
];

/**
 * The municipalities surfaced in the top-bar dropdown.
 *
 * All 38 are listed, but the first eight are the ones that matter for a
 * dropdown: listing 38 flat entries makes the control unusable and pushes the
 * link to the full page off the bottom of the viewport. The rest live under
 * "Shih të 38 komunat".
 */
export const FEATURED_MUNICIPALITIES = [
  'Prishtinë', 'Prizren', 'Pejë', 'Gjilan', 'Ferizaj',
  'Mitrovicë', 'Gjakovë', 'Podujevë',
] as const;

export const ALL_MUNICIPALITIES = KOSOVO_MUNICIPALITIES;

/** Flat lookup, used by the search results. */
export const ALL_SIDEBAR_LINKS: NavLink[] = SIDEBAR_GROUPS.flatMap((group) => group.items);
