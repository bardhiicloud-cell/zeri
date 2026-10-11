import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { dt } from '@/src/lib/dt';
import { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { useStore } from '../lib/store';
import { ShieldAlert, FileText, Users, ArrowLeft, LogOut, Shield, Settings, Map as MapIcon, Megaphone, Bell, Heart, LayoutDashboard, HeartPulse, ChevronDown, PanelLeftClose, PanelLeftOpen, MessageSquare, Vote, Newspaper, Headphones, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../lib/LanguageContext';
import { canAccessAdmin, canAccessSection, roleLabel, } from '../lib/adminPermissions';
/**
 * The panel is the heaviest surface in the product: sixteen views over
 * hundreds of thousands of documents. Importing all of them eagerly made the
 * admin bundle as large as the whole public site, so a district officer on a
 * slow connection paid for the security console before seeing a single report.
 * Each view is code-split and fetched the first time it is opened.
 */
const AdminDashboard = lazy(() => import('../components/admin/AdminDashboard'));
const AdminReports = lazy(() => import('../components/admin/AdminReports'));
const AdminUsers = lazy(() => import('../components/admin/AdminUsers'));
const AdminGIS = lazy(() => import('../components/admin/AdminGIS'));
const AdminSecurity = lazy(() => import('../components/admin/AdminSecurity'));
const AdminSettings = lazy(() => import('../components/admin/AdminSettings'));
const AdminAds = lazy(() => import('../components/admin/AdminAds'));
const AdminNotifications = lazy(() => import('../components/admin/AdminNotifications'));
const AdminDonations = lazy(() => import('../components/admin/AdminDonations'));
const AdminAgents = lazy(() => import('../components/admin/AdminAgents'));
const AdminHealthRegistry = lazy(() => import('../components/admin/AdminHealthRegistry'));
const AdminForum = lazy(() => import('../components/admin/AdminForum'));
const AdminPolls = lazy(() => import('../components/admin/AdminPolls'));
const AdminNews = lazy(() => import('../components/admin/AdminNews'));
const AdminSupportChats = lazy(() => import('../components/admin/AdminSupportChats'));
const AdminUpdates = lazy(() => import('../components/admin/AdminUpdates'));
const GROUP_LABELS = {
    overview: { label: 'Përmbledhje', order: 0 },
    operations: { label: 'Operacionet', order: 1 },
    citizens: { label: 'Qytetarët & Komuniteti', order: 2 },
    communications: { label: 'Komunikimi', order: 3 },
    system: { label: 'Sistemi', order: 4 },
};
const ALL_SECTIONS = [
    { id: 'dashboard', label: 'Paneli i Përgjithshëm', icon: LayoutDashboard, group: 'overview', hint: 'Numrat e ditës dhe ngarkesat aktive' },
    { id: 'updates', label: 'Përditësimet e Adminit', icon: Bell, group: 'overview', hint: 'Aktiviteti i fundit i stafit' },
    { id: 'reports', label: 'Inspektimi i Raporteve', icon: FileText, group: 'operations', hint: 'Radha e raporteve qytetarëve' },
    { id: 'health', label: 'Regjistri Shëndetësor & Spitalet', icon: HeartPulse, group: 'operations', hint: 'Rastet shëndetësore të regjistruara' },
    { id: 'donations', label: 'Aprovimi i Donacioneve', icon: Heart, group: 'operations', hint: 'Kërkesat për fonde' },
    { id: 'users', label: 'Regjistri i Qytetarëve', icon: Users, group: 'citizens', hint: 'Llogaritë dhe statusi i tyre' },
    { id: 'forum', label: 'Moderimi i Debatit Publik', icon: MessageSquare, group: 'citizens', hint: 'Postimet dhe raportimet' },
    { id: 'polls', label: 'Sondazhet Publike', icon: Vote, group: 'citizens', hint: 'Pyetësori dhe rezultatet' },
    { id: 'agents', label: 'Menaxhimi i Stafit & Agjentëve', icon: ShieldAlert, group: 'communications', hint: 'Rolet dhe lejet e stafit' },
    { id: 'support', label: 'Kërkesat për Agjent', icon: Headphones, group: 'communications', hint: 'Bisedat me qytetarë' },
    { id: 'ads', label: 'Menaxhimi i Reklamave', icon: Megaphone, group: 'communications', hint: 'Sloti dhe fushatat' },
    { id: 'notifications', label: 'Komunikimi & Njoftimet', icon: Bell, group: 'communications', hint: 'Broadcast drejt qytetarëve' },
    { id: 'news', label: 'Menaxhimi i Lajmeve', icon: Newspaper, group: 'communications', hint: 'Botimi dhe redaktimi' },
    { id: 'categories', label: 'Harta & GIS', icon: MapIcon, group: 'system', hint: 'Ndarja gjeografike dhe rajonet' },
    { id: 'security', label: 'Siguria dhe Auditimi', icon: Shield, group: 'system', hint: 'Regjistri i veprimeve' },
    { id: 'settings', label: 'Konfigurimet e Sistemit', icon: Settings, group: 'system', hint: 'Parametrat e platformës' },
];
export default function AdminPanel() {
    const currentUser = useStore(state => state.currentUser);
    const logout = useStore(state => state.logout);
    const navigate = useNavigate();
    const { language } = useLanguage();
    const [activeTab, setActiveTab] = useState('dashboard');
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [openAdminGroups, setOpenAdminGroups] = useState({
        overview: true,
        operations: false,
        citizens: false,
        communications: false,
        system: false,
    });
    /**
     * The visible list comes from a single capability check. Adding a role or a
     * section is one edit in adminPermissions.ts, and the sidebar can no longer
     * drift out of sync with what the server will actually accept.
     */
    const visibleSections = useMemo(() => ALL_SECTIONS.filter(section => canAccessSection(currentUser, section.id)), [currentUser]);
    const groupedSections = useMemo(() => {
        const byGroup = new Map();
        for (const section of visibleSections) {
            const bucket = byGroup.get(section.group) ?? [];
            bucket.push(section);
            byGroup.set(section.group, bucket);
        }
        return [...byGroup.entries()]
            .sort(([a], [b]) => GROUP_LABELS[a].order - GROUP_LABELS[b].order)
            .map(([id, items]) => ({ id, label: GROUP_LABELS[id].label, items }));
    }, [visibleSections]);
    const activeSection = visibleSections.find(section => section.id === activeTab) ?? null;
    if (!canAccessAdmin(currentUser)) {
        return (_jsx("div", { className: "flex flex-col items-center justify-center min-h-screen text-center px-4 bg-slate-50 dark:bg-slate-900 transition-colors", children: _jsxs("div", { className: "bg-white dark:bg-slate-900 p-10 rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 dark:border-white/5 flex flex-col items-center max-w-lg", children: [_jsx("div", { className: "w-24 h-24 bg-rose-50 rounded-full flex items-center justify-center mb-6 border border-rose-100", children: _jsx(ShieldAlert, { className: "w-12 h-12 text-rose-500" }) }), _jsx("h1", { className: "text-3xl font-bold text-slate-900 dark:text-white mb-3 title-serif", children: dt(`Qasje e Mohuar`) }), _jsx("p", { className: "text-slate-500 dark:text-slate-400 font-medium leading-relaxed", children: dt(`Kjo faqe është rreptësisht e rezervuar për stafin e autorizuar dhe administratorët e sistemit.`) }), _jsx("button", { onClick: () => window.location.href = '#/login', className: "mt-8 px-8 py-3.5 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 hover:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.08)] dark:shadow-none transition-all active:scale-95 w-full", children: dt(`Kthehu tek Hyrja`) })] }) }));
    }
    // Streamlined active system tabs (cleaned of obsolete forum/chat/live discussions/polls tabs)
    const systemTabs = visibleSections;
    const adminNavigationGroups = groupedSections;
    /**
     * Deep linking. Staff arrive from a notification or a support ticket, and
     * dropping them on the dashboard loses the context of why they clicked, so
     * /admin#reports and the legacy /approvals path open the matching section.
     */
    useEffect(() => {
        const hash = window.location.hash.toLowerCase();
        if (hash.includes('/approvals')) {
            if (canAccessSection(currentUser, 'reports'))
                setActiveTab('reports');
            return;
        }
        const match = ALL_SECTIONS.find(section => hash.includes(`/${section.id}`));
        if (match && canAccessSection(currentUser, match.id)) {
            setActiveTab(match.id);
            return;
        }
        // A staffer whose role cannot open the current section is moved to the first
        // one they can, rather than being shown an empty pane.
        if (visibleSections.length > 0 && !visibleSections.some(s => s.id === activeTab)) {
            setActiveTab(visibleSections[0].id);
        }
    }, [currentUser, visibleSections, activeTab]);
    /** Open whichever group contains the active section, so it is never hidden. */
    useEffect(() => {
        if (!activeSection)
            return;
        setOpenAdminGroups(groups => ({ ...groups, [activeSection.group]: true }));
    }, [activeSection]);
    return (_jsxs("div", { className: "min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors flex flex-col md:flex-row overflow-hidden font-sans", children: [_jsxs("aside", { className: cn("bg-slate-950 border-r border-white/5 flex flex-col md:h-screen shrink-0 relative z-30 transition-all duration-300 ease-in-out shadow-2xl", isSidebarCollapsed ? "w-full md:w-20" : "w-full md:w-72"), children: [_jsxs("div", { className: "p-3 md:p-4 border-b border-white/10 shrink-0 flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-3 overflow-hidden", children: [_jsx("div", { className: "w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500 to-rose-600 flex items-center justify-center shrink-0 shadow-lg shadow-rose-500/25", children: _jsx(Shield, { className: "w-5 h-5 text-white" }) }), !isSidebarCollapsed && (_jsxs("div", { className: "truncate", children: [_jsxs("h2", { className: "text-xl font-bold text-white tracking-wide leading-none", children: [dt(`Admin`), _jsx("span", { className: "text-rose-500", children: "." }), "KS"] }), _jsx("p", { className: "text-[10px] text-slate-400 font-bold tracking-widest mt-1 uppercase", children: dt(`Sistemi Qendror`) })] }))] }), _jsx("button", { onClick: () => setIsSidebarCollapsed(!isSidebarCollapsed), className: "hidden md:flex p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors", title: isSidebarCollapsed ? "Zgjero menunë" : "Palos menunë", children: isSidebarCollapsed ? _jsx(PanelLeftOpen, { className: "w-4 h-4" }) : _jsx(PanelLeftClose, { className: "w-4 h-4" }) })] }), _jsxs("div", { className: "p-2 flex-1 min-h-0 overflow-visible space-y-0.5 hidden md:block", children: [!isSidebarCollapsed && (_jsx("p", { className: "px-2 text-[9px] font-bold text-slate-400 tracking-wider mb-1 uppercase", children: dt(`Menaxhimi Administrativ`) })), isSidebarCollapsed ? (_jsx("div", { className: "space-y-0.5", children: systemTabs.map(tab => {
                                    const Icon = tab.icon;
                                    const isActive = activeTab === tab.id;
                                    return (_jsxs("button", { onClick: () => setActiveTab(tab.id), title: tab.label, "aria-label": tab.label, className: cn("group relative flex min-h-9 w-full items-center justify-center rounded-xl transition-all duration-150", isActive ? "bg-rose-600 text-white shadow-md shadow-rose-600/30" : "text-slate-300 hover:bg-white/5 hover:text-white"), children: [_jsx(Icon, { className: cn("h-4 w-4 shrink-0 transition-transform group-hover:scale-110", isActive ? "text-white" : "text-slate-400") }), isActive && _jsx("span", { className: "absolute right-1 h-5 w-1 rounded-full bg-white" })] }, tab.id));
                                }) })) : (_jsx("div", { className: "space-y-1", children: adminNavigationGroups.map((group) => {
                                    const isGroupOpen = openAdminGroups[group.id];
                                    return (_jsxs("section", { className: "space-y-0.5", children: [_jsxs("button", { type: "button", onClick: () => setOpenAdminGroups((groups) => Object.keys(groups).reduce((next, groupId) => {
                                                    next[groupId] = groupId === group.id ? !groups[groupId] : false;
                                                    return next;
                                                }, {})), className: "flex min-h-8 w-full items-center justify-between gap-2 rounded-lg px-2.5 text-left text-[9px] font-bold uppercase tracking-wider text-slate-400 transition-colors hover:bg-white/5 hover:text-white", "aria-expanded": isGroupOpen, "aria-controls": `admin-nav-group-${group.id}`, children: [_jsx("span", { className: "truncate", children: group.label }), _jsx(ChevronDown, { className: cn("h-3.5 w-3.5 shrink-0 transition-transform", isGroupOpen ? "rotate-180" : ""), "aria-hidden": "true" })] }), isGroupOpen && (_jsx("div", { id: `admin-nav-group-${group.id}`, className: "space-y-0.5", children: group.items.map(tab => {
                                                    const Icon = tab.icon;
                                                    const isActive = activeTab === tab.id;
                                                    return (_jsxs("button", { onClick: () => setActiveTab(tab.id), className: cn("group relative flex min-h-8 w-full items-center gap-2.5 rounded-lg px-3 text-left text-[11px] font-medium transition-all duration-150", isActive ? "bg-rose-600 text-white font-bold shadow-md shadow-rose-600/30" : "text-slate-300 hover:bg-white/5 hover:text-white"), "aria-current": isActive ? 'page' : undefined, children: [_jsx(Icon, { className: cn("h-4 w-4 shrink-0 transition-transform group-hover:scale-110", isActive ? "text-white" : "text-slate-400") }), _jsx("span", { className: "truncate", children: tab.label })] }, tab.id));
                                                }) }))] }, group.id));
                                }) }))] }), _jsx("div", { className: "md:hidden flex overflow-x-auto p-2.5 gap-2 border-b border-white/10 bg-slate-950 scrollbar-hide shrink-0", children: systemTabs.map(tab => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (_jsxs("button", { onClick: () => setActiveTab(tab.id), className: cn("flex items-center gap-1.5 px-3.5 py-2 font-bold text-xs whitespace-nowrap rounded-xl transition-all", isActive
                                    ? "bg-rose-600 text-white shadow-sm"
                                    : "text-slate-300 bg-white/5"), children: [_jsx(Icon, { className: "w-3.5 h-3.5" }), _jsx("span", { children: tab.label })] }, tab.id));
                        }) }), _jsxs("div", { className: "p-2 border-t border-white/10 hidden md:flex flex-col gap-1.5 shrink-0", children: [_jsxs("button", { onClick: () => navigate('/'), title: isSidebarCollapsed ? "Shiko Platformën" : undefined, className: cn("w-full flex items-center bg-white/5 text-slate-300 text-xs font-semibold hover:bg-white/10 hover:text-white rounded-xl transition-all", isSidebarCollapsed ? "justify-center p-2" : "gap-2 px-3 py-2"), children: [_jsx(ArrowLeft, { className: "w-4 h-4 shrink-0" }), !isSidebarCollapsed && _jsx("span", { children: dt(`Shiko Platformën`) })] }), _jsxs("button", { onClick: () => logout(), title: isSidebarCollapsed ? "Mbyll Sesionin" : undefined, className: cn("w-full flex items-center bg-rose-500/10 text-rose-400 text-xs font-semibold hover:bg-rose-600 hover:text-white rounded-xl transition-all", isSidebarCollapsed ? "justify-center p-2" : "gap-2 px-3 py-2"), children: [_jsx(LogOut, { className: "w-4 h-4 shrink-0" }), !isSidebarCollapsed && _jsx("span", { children: dt(`Mbyll Sesionin`) })] })] })] }), _jsxs("div", { className: "flex-1 flex flex-col h-[calc(100vh-140px)] md:h-screen w-full relative overflow-hidden", children: [_jsxs("div", { className: "bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-white/10 px-6 sm:px-8 py-4 flex items-center justify-between sticky top-0 z-20 shrink-0", children: [_jsxs("div", { className: "flex items-center gap-3 min-w-0", children: [_jsx("h1", { className: "flex items-center gap-2.5 truncate text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight", children: _jsx("span", { className: "truncate", children: activeSection?.label ?? dt('Paneli Administrativ') }) }), activeSection && (_jsx("span", { className: "hidden lg:inline text-[11px] text-slate-400 truncate", children: activeSection.hint }))] }), _jsxs("div", { className: "flex items-center gap-3.5", children: [_jsxs("div", { className: "hidden sm:flex flex-col text-right", children: [_jsx("span", { className: "max-w-[10rem] truncate text-xs font-bold text-slate-900 dark:text-white", children: currentUser.name }), _jsx("span", { className: "text-[10px] font-bold text-rose-500 tracking-wider uppercase", children: roleLabel(currentUser, language) })] }), _jsx("div", { className: "w-9 h-9 bg-slate-900 dark:bg-slate-800 text-rose-400 flex items-center justify-center font-bold text-xs rounded-xl shadow-xs border border-slate-700", children: currentUser.name.charAt(0) })] })] }), _jsx("div", { className: "flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-8 relative custom-scrollbar bg-slate-50/50 dark:bg-slate-950/40", children: _jsx(AnimatePresence, { mode: "wait", children: _jsx(motion.div, { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0 }, transition: { duration: 0.15 }, className: "min-h-full max-w-[1600px] mx-auto", children: _jsxs(Suspense, { fallback: _jsxs("div", { className: "flex h-64 flex-col items-center justify-center gap-3 text-slate-400", children: [_jsx(Loader2, { className: "w-6 h-6 animate-spin text-rose-500" }), _jsx("span", { className: "text-xs font-semibold", children: dt('Duke ngarkuar seksionin...') })] }), children: [activeTab === 'dashboard' && _jsx(AdminDashboard, { onTabChange: (t) => setActiveTab(t) }), activeTab === 'updates' && _jsx(AdminUpdates, { onTabChange: (t) => setActiveTab(t) }), activeTab === 'reports' && _jsx(AdminReports, {}), activeTab === 'health' && _jsx(AdminHealthRegistry, {}), activeTab === 'donations' && _jsx(AdminDonations, {}), activeTab === 'users' && _jsx(AdminUsers, {}), activeTab === 'agents' && _jsx(AdminAgents, {}), activeTab === 'ads' && _jsx(AdminAds, {}), activeTab === 'notifications' && _jsx(AdminNotifications, {}), activeTab === 'forum' && _jsx(AdminForum, {}), activeTab === 'support' && _jsx(AdminSupportChats, {}), activeTab === 'polls' && _jsx(AdminPolls, {}), activeTab === 'news' && _jsx(AdminNews, {}), activeTab === 'security' && _jsx(AdminSecurity, {}), activeTab === 'settings' && _jsx(AdminSettings, {}), activeTab === 'categories' && _jsx(AdminGIS, {})] }) }, activeTab) }) })] })] }));
}
