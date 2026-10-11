import { MapPin, Newspaper, Lightbulb, Vote, BarChart3, Wallet, Megaphone, Phone, Building2, Briefcase, Info, HeartPulse, Bot, ShieldAlert, ShieldCheck, MessageSquare, Radio, PlusCircle, } from 'lucide-react';
import { KOSOVO_MUNICIPALITIES } from './constants';
/**
 * The functional modules that live in the left sidebar, ordered by how a
 * citizen actually works through them: report it, see it on the map, follow it
 * up, vote on it, then look up a service.
 */
export const SIDEBAR_GROUPS = [
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
        ],
    },
];
/**
 * Top bar links. Deliberately short: the sidebar already carries the working
 * modules, so anything repeated here would compete with it for attention.
 */
export const TOP_NAV = [
    // "Kryefaqja" is rendered separately by the top bar, and "Komunat" is inserted
    // next as a dropdown — both are positional, not part of this list.
    { label: 'Komunat', href: '/komunat', icon: Building2 },
    { label: 'Shërbimet Publike', href: '/sherbimet', icon: Briefcase },
    { label: 'Projektet', href: '/projektet', icon: Briefcase },
    { label: 'Lajme & Njoftime', href: '/lajme', icon: Newspaper },
    { label: 'Kontakt', href: '/kontakt', icon: Phone },
    { label: 'Rreth Projektit', href: '/rreth-projektit', icon: Info },
];
/** Legal and policy links, shown in the sidebar footer and the site footer. */
export const LEGAL_NAV = [
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
];
export const ALL_MUNICIPALITIES = KOSOVO_MUNICIPALITIES;
/** Flat lookup, used by the search results. */
export const ALL_SIDEBAR_LINKS = SIDEBAR_GROUPS.flatMap((group) => group.items);
