import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import React, { useState } from 'react';
import { useStore } from '../lib/store';
import { ThumbsUp, MessageCircle, MapPin, CheckCircle2, AlertTriangle, TrendingUp, Search, Filter, Layers, Heart, ArrowRight, Share2, X, Award, QrCode, CloudSun, Wind } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import { KOSOVO_MUNICIPALITIES } from '../lib/constants';
import ReportDetailModal from '../components/ReportDetailModal';
import AdBanner from '../components/AdBanner';
import { MunicipalityHealthCheck } from '../components/MunicipalityHealthCheck';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../lib/LanguageContext';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, Legend, PieChart, Pie, Cell } from 'recharts';
import toast from 'react-hot-toast';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
const urgencyConfig = {
    'Kritike': 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    'E lartë': 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    'Mesatare': 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    'E ulët': 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    'Baxhë': 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
};
const statusConfig = {
    'Pending Review': { label: 'Në Pritje', classes: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20' },
    'Approved': { label: 'Aprovuar', classes: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20' },
    'Assigned': { label: 'Caktuar', classes: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' },
    'In Progress': { label: 'Në Progres', classes: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
    'Resolved': { label: 'E Zgjidhur', classes: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
    'Rejected': { label: 'Refuzuar', classes: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' }
};
const MUNICIPAL_AQI_DATA = {};
const REWARDS_LIST = [
    { id: 'rew-1', title: 'Tiketë Autobusi Publik', desc: 'Biletë njëditore falas për transportin urban në komunën tuaj.', cost: 80 },
    { id: 'rew-2', title: 'Mbill një Pemë', desc: 'Komuna do të mbjellë një pemë në emrin tuaj në parkun e qytetit.', cost: 150 },
    { id: 'rew-3', title: 'Hyrje në Pishinën e Qytetit', desc: 'Biletë hyrjeje njëditore për pishinën publike të qytetit.', cost: 200 },
    { id: 'rew-4', title: 'Biletë për Teatrin/Kinemanë', desc: 'Hyrje për një shfaqje apo film në teatrin/kinemanë publike.', cost: 120 }
];
export default function Dashboard() {
    const { t, dt, language } = useLanguage();
    const reports = useStore((state) => state.reports);
    const currentUser = useStore((state) => state.currentUser);
    const upvoteReport = useStore((state) => state.upvoteReport);
    const updateUser = useStore((state) => state.updateUser);
    const navigate = useNavigate();
    const userMunicipality = useStore((state) => state.userMunicipality);
    const [activeTab, setActiveTab] = useState('dash_recent');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedMunicipality, setSelectedMunicipality] = useState(userMunicipality === 'Të gjitha Komunat' ? '' : (userMunicipality || ''));
    const [selectedReportId, setSelectedReportId] = useState(null);
    const [showFilters, setShowFilters] = useState(false);
    const [viewMode, setViewMode] = useState('active');
    const [isLoading, setIsLoading] = useState(true);
    const [tips, setTips] = useState([]);
    const [tipsLoading, setTipsLoading] = useState(false);
    const [redeemedReward, setRedeemedReward] = useState(null);
    const [activeAlerts, setActiveAlerts] = useState([]);
    const [newsLoading, setNewsLoading] = useState(false);
    const [detectedCity, setDetectedCity] = useState(null);
    const [ipAddress, setIpAddress] = useState(null);
    const [ipVerified, setIpVerified] = useState(false);
    const [aiScanning, setAiScanning] = useState(false);
    const [expandedAlerts, setExpandedAlerts] = useState({});
    const [currentAlertIndex, setCurrentAlertIndex] = useState(0);
    const [realUsers, setRealUsers] = useState([]);
    const [weatherData, setWeatherData] = useState({});
    const MUNICIPAL_COORDS = {
        'Prishtinë': { lat: 42.6629, lng: 21.1655 },
        'Prizren': { lat: 42.2139, lng: 20.7397 },
        'Pejë': { lat: 42.6591, lng: 20.2883 },
        'Gjakovë': { lat: 42.3803, lng: 20.4308 },
        'Gjilan': { lat: 42.4636, lng: 21.4678 },
        'Mitrovicë': { lat: 42.8914, lng: 20.8661 },
        'Ferizaj': { lat: 42.3702, lng: 21.1553 },
    };
    // Live weather & AQI queries
    React.useEffect(() => {
        const fetchWeather = async () => {
            const muni = selectedMunicipality || 'Prishtinë';
            const coords = MUNICIPAL_COORDS[muni] || MUNICIPAL_COORDS['Prishtinë'];
            try {
                const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lng}&current_weather=true`);
                const airRes = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${coords.lat}&longitude=${coords.lng}&current=us_aqi`);
                let temp = '22°C';
                let aqi = 44;
                if (weatherRes.ok) {
                    const wData = await weatherRes.json();
                    if (wData?.current_weather) {
                        temp = `${Math.round(wData.current_weather.temperature)}°C`;
                    }
                }
                if (airRes.ok) {
                    const aData = await airRes.json();
                    if (aData?.current?.us_aqi !== undefined) {
                        aqi = Math.round(aData.current.us_aqi);
                    }
                }
                let status = 'E mirë';
                let aqiDesc = 'Ajër i pastër, i përshtatshëm për aktivitete jashtë.';
                if (aqi > 50) {
                    status = 'Mesatare';
                    aqiDesc = 'Ndotje e ulët, e pranueshme për shumicën e njerëzve.';
                }
                if (aqi > 100) {
                    status = 'E dëmshme';
                    aqiDesc = 'Rekomandohet reduktimi i aktiviteteve të gjata jashtë.';
                }
                setWeatherData(prev => ({
                    ...prev,
                    [muni]: { aqi, temp, status, aqiDesc }
                }));
            }
            catch (err) {
                console.error("Error fetching live weather/aqi:", err);
            }
        };
        fetchWeather();
    }, [selectedMunicipality]);
    const selectedAqi = weatherData[selectedMunicipality || 'Prishtinë'] || { aqi: 0, temp: '--°C', status: 'Duke ngarkuar...', aqiDesc: 'Të dhënat reale nuk janë gati.' };
    // Real-time user database subscription
    React.useEffect(() => {
        let unsubscribe = () => { };
        const subscribeUsers = async () => {
            try {
                const { db } = await import('../lib/firebase');
                const { collection, onSnapshot, query, orderBy, limit } = await import('firebase/firestore');
                const q = query(collection(db, 'users'), orderBy('points', 'desc'), limit(15));
                unsubscribe = onSnapshot(q, (snapshot) => {
                    const list = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));
                    setRealUsers(list);
                }, (err) => {
                    console.error("Error subscribing users:", err);
                });
            }
            catch (e) {
                console.error("Error setting up real users listener:", e);
            }
        };
        subscribeUsers();
        return () => unsubscribe();
    }, [reports, currentUser]);
    const handleRedeem = (reward) => {
        if (!currentUser) {
            toast.error(dt("Ju lutem kyçuni për të shfrytëzuar pikët dhe përfituar shpërblime!"));
            return;
        }
        if ((currentUser.points || 0) < reward.cost) {
            toast.error(`${dt("Ju nuk keni pikë të mjaftueshme! Ju duhen edhe")} ${reward.cost - (currentUser.points || 0)} ${dt("pikë.")}`);
            return;
        }
        // Deduct points
        const newPoints = (currentUser.points || 0) - reward.cost;
        const claimed = currentUser.claimedRewards || [];
        const updatedClaimed = [...claimed, reward.id];
        updateUser(currentUser.id, {
            points: newPoints,
            claimedRewards: updatedClaimed
        });
        // Set redeemed reward to show QR Code modal
        const simulatedCode = `CITY-REP-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
        setRedeemedReward({
            id: reward.id,
            title: reward.title,
            cost: reward.cost,
            code: simulatedCode
        });
        toast.success(dt("Shpërblimi u përfitua me sukses!"));
    };
    // Generate last 7 days data for the chart
    const chartData = React.useMemo(() => {
        const days = [];
        const now = new Date();
        // Start from 6 days ago to today (7 days in total)
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(now.getDate() - i);
            const dateString = d.toLocaleDateString('sq', { month: 'short', day: 'numeric' });
            // Count reports submitted on this day
            const startOfDay = new Date(d.setHours(0, 0, 0, 0)).getTime();
            const endOfDay = new Date(d.setHours(23, 59, 59, 999)).getTime();
            const newCount = reports.filter(r => {
                const t = new Date(r.createdAt).getTime();
                return t >= startOfDay && t <= endOfDay;
            }).length;
            // Count resolved reports on this day
            const resolvedCountOnDay = reports.filter(r => {
                if (r.status !== 'Resolved')
                    return false;
                const t = new Date(r.updatedAt || r.createdAt).getTime();
                return t >= startOfDay && t <= endOfDay;
            }).length;
            days.push({
                name: dateString,
                'Raportime të Reja': newCount,
                'Raste të Zgjidhura': resolvedCountOnDay,
            });
        }
        return days;
    }, [reports]);
    // Status ratio data for PieChart
    const statusRatioData = React.useMemo(() => {
        const zgjidhura = reports.filter(r => r.status === 'Resolved').length;
        const neProces = reports.filter(r => r.status !== 'Resolved' && r.status !== 'Rejected' && r.status !== 'Draft').length;
        return [
            { name: 'Të Zgjidhura', value: zgjidhura, color: '#10b981' },
            { name: 'Në Proces', value: neProces, color: '#f59e0b' }
        ];
    }, [reports]);
    const resolvedPercent = React.useMemo(() => {
        const total = statusRatioData[0].value + statusRatioData[1].value;
        return total > 0 ? Math.round((statusRatioData[0].value / total) * 100) : 0;
    }, [statusRatioData]);
    React.useEffect(() => {
        const fetchTips = async () => {
            setTipsLoading(true);
            try {
                const userReports = reports.filter(r => currentUser && r.authorId === currentUser.id).map(r => ({
                    title: r.title,
                    category: r.category,
                    urgency: r.urgency
                }));
                const userPoints = currentUser?.points || 0;
                const res = await fetch('/api/dashboard/reporting-tips', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ userReports, userPoints })
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.tips) {
                        setTips(data.tips);
                    }
                }
            }
            catch (err) {
                console.error("Failed to fetch reporting tips from backend:", err);
            }
            finally {
                setTipsLoading(false);
            }
        };
        fetchTips();
    }, [reports, currentUser]);
    // Fetch AI-generated news / alerts based on selected municipality
    const loadAINews = async (muni, isManualScan = false) => {
        if (isManualScan) {
            setAiScanning(true);
        }
        else {
            setNewsLoading(true);
        }
        try {
            const res = await fetch('/api/dashboard/ai-news', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ municipality: muni })
            });
            if (res.ok) {
                const data = await res.json();
                if (data && data.alerts) {
                    setActiveAlerts(data.alerts);
                    setCurrentAlertIndex(0);
                }
            }
        }
        catch (err) {
            console.error("Dështoi marrja e lajmeve AI:", err);
        }
        finally {
            setNewsLoading(false);
            setAiScanning(false);
        }
    };
    React.useEffect(() => {
        const targetMuni = selectedMunicipality || detectedCity || 'Prishtinë';
        loadAINews(targetMuni);
    }, [selectedMunicipality, detectedCity]);
    React.useEffect(() => {
        setIsLoading(true);
        const timer = setTimeout(() => {
            setIsLoading(false);
        }, 1200);
        return () => clearTimeout(timer);
    }, [viewMode, activeTab, selectedMunicipality, searchQuery]);
    // Filter for visibility
    const visibleReports = reports.filter(r => {
        if (currentUser?.role === 'admin')
            return true;
        if (currentUser && r.authorId === currentUser.id && r.authorId !== 'guest')
            return true;
        return r.status !== 'Pending Review' && r.status !== 'Rejected';
    });
    const activeReports = visibleReports.filter(r => r.status !== 'Resolved' && r.status !== 'Rejected');
    const resolvedCount = visibleReports.filter(r => r.status === 'Resolved').length;
    // Primary filtering depending on viewMode
    let baseReports = viewMode === 'active' ? activeReports : viewMode === 'resolved' ? visibleReports.filter(r => r.status === 'Resolved') : visibleReports;
    let filteredReports = [...baseReports];
    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        filteredReports = filteredReports.filter(r => (r.title && r.title.toLowerCase().includes(q)) ||
            (r.id && r.id.toLowerCase().includes(q)) ||
            (r.location?.address && r.location.address.toLowerCase().includes(q)) ||
            (r.description && r.description.toLowerCase().includes(q)));
    }
    if (selectedMunicipality) {
        filteredReports = filteredReports.filter(r => r.location?.municipality === selectedMunicipality);
    }
    if (activeTab === 'dash_most_voted') {
        filteredReports.sort((a, b) => b.upvotes - a.upvotes);
    }
    else if (activeTab === 'dash_critical') {
        filteredReports = filteredReports.filter(r => r.urgency === 'Kritike');
    }
    else if (activeTab === 'dash_recent') {
        filteredReports.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    else {
        // Të Gjitha
        filteredReports.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    const handleShare = (e, title, id) => {
        e.stopPropagation();
        const url = `${window.location.origin}/detailed-registry?report=${encodeURIComponent(id)}`;
        if (navigator.share) {
            navigator.share({
                title: `Raportim: ${title}`,
                text: `Shikoni këtë raportim qytetar: "${title}"`,
                url: url
            }).catch(console.error);
        }
        else {
            navigator.clipboard.writeText(url);
            toast.success(dt("Linku i raportimit u kopjua!"));
        }
    };
    const fallbackTips = [
        "Shto përshkrime më të detajuara për lokacionin për të ndihmuar ekipet administrative të gjejnë shpejt problemin.",
        "Ngarko fotografi me dritë më të mirë dhe nga distanca të ndryshme (të afërt dhe të largët) si dëshmi.",
        "Përdor opsionin 'Zgjedh në Hartë' për të vendosur saktë koordinatat e problemit që raporton."
    ];
    const activeTips = tips.length > 0 ? tips : fallbackTips;
    const topCategories = React.useMemo(() => {
        const categoryCounts = {};
        reports.forEach(r => {
            const cat = r.category || 'Tjetër';
            categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
        });
        const sorted = Object.entries(categoryCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([category, count]) => ({ category, count }));
        while (sorted.length < 3) {
            sorted.push({ category: 'Nuk ka raste', count: 0 });
        }
        return sorted;
    }, [reports]);
    return (_jsxs(motion.div, { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -10 }, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] }, className: "max-w-6xl mx-auto pt-6 pb-32 md:py-12 px-4 sm:px-6 lg:px-8", children: [_jsxs("div", { className: "flex flex-col md:flex-row justify-between items-center mb-[var(--spacing-12)] gap-[var(--spacing-8)]", children: [_jsxs("div", { className: "max-w-2xl", children: [_jsxs(Badge, { variant: "info", className: "mb-[var(--spacing-4)]", children: [_jsxs("span", { className: "relative flex h-2 w-2 mr-2", children: [_jsx("span", { className: "animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" }), _jsx("span", { className: "relative inline-flex rounded-full h-2 w-2 bg-blue-500" })] }), t('dash_hero_tag')] }), _jsxs("h1", { className: "text-4xl sm:text-5xl lg:text-6xl font-black text-[var(--color-text)] dark:text-white tracking-tight leading-tight mb-[var(--spacing-4)] title-serif", children: [t('dash_title1'), " ", _jsx("br", { className: "hidden sm:block" }), _jsxs("span", { className: "text-[var(--color-primary)]", children: [t('dash_title2'), "."] })] }), _jsx("p", { className: "text-lg text-[var(--color-text-muted)] leading-relaxed mb-[var(--spacing-6)]", children: t('dash_subtitle') }), _jsxs("div", { className: "flex flex-wrap items-center gap-[var(--spacing-4)] mb-[var(--spacing-8)]", children: [_jsx(Button, { size: "lg", variant: "primary", onClick: () => navigate('/raporto'), children: "Raporto nj\u00EB problem" }), _jsx(Button, { size: "lg", variant: "outline", onClick: () => {
                                            document.getElementById('raportimet-section')?.scrollIntoView({ behavior: 'smooth' });
                                        }, children: "Shfleto Raportimet" })] }), _jsxs("div", { className: "relative max-w-md", children: [_jsx(Search, { className: "absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" }), _jsx("input", { type: "text", placeholder: "K\u00EBrko raporte, zona ose kategori...", value: searchQuery, onChange: (e) => setSearchQuery(e.target.value), className: "w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-slate-900 dark:text-white" })] })] }), _jsxs("div", { className: "w-full md:w-auto grid grid-cols-2 gap-[var(--spacing-4)]", children: [_jsxs("button", { type: "button", onClick: () => {
                                    setViewMode('active');
                                    document.getElementById('raportimet-section')?.scrollIntoView({ behavior: 'smooth' });
                                }, className: cn("p-[var(--spacing-6)] flex flex-col justify-center border-none text-white rounded-xl text-left transition-all outline-none", viewMode === 'active' ? "bg-[var(--color-primary)] shadow-lg ring-2 ring-[var(--color-primary)] ring-offset-2 dark:ring-offset-slate-900" : "bg-[var(--color-primary)]/80 hover:bg-[var(--color-primary)]"), children: [_jsx("span", { className: "text-xs font-bold tracking-wide mb-1 opacity-90 uppercase", children: t('dash_active') }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-4xl font-black", children: activeReports.length }), _jsx(AlertTriangle, { className: "w-5 h-5 text-blue-300" })] })] }), _jsxs("button", { type: "button", onClick: () => {
                                    setViewMode('resolved');
                                    document.getElementById('raportimet-section')?.scrollIntoView({ behavior: 'smooth' });
                                }, className: cn("p-[var(--spacing-6)] flex flex-col justify-center border-none text-white rounded-xl text-left transition-all outline-none", viewMode === 'resolved' ? "bg-[#10b981] shadow-lg ring-2 ring-[#10b981] ring-offset-2 dark:ring-offset-slate-900" : "bg-[#10b981]/80 hover:bg-[#10b981]"), children: [_jsx("span", { className: "text-xs font-bold tracking-wide mb-1 opacity-90 uppercase", children: t('dash_resolved') }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-4xl font-black", children: resolvedCount }), _jsx(CheckCircle2, { className: "w-5 h-5 text-emerald-200" })] })] })] })] }), _jsxs(AnimatePresence, { mode: "wait", children: [viewMode !== 'stats' && (_jsx(motion.div, { initial: { opacity: 0, height: 0 }, animate: { opacity: 1, height: "auto" }, exit: { opacity: 0, height: 0 }, transition: { duration: 0.3 }, className: "overflow-hidden", children: _jsxs("div", { className: "mb-4 md:mb-6 bg-rose-600 dark:bg-rose-500 rounded-xl p-5 md:p-8 text-white flex flex-col md:flex-row items-center justify-between gap-[var(--spacing-6)] relative overflow-hidden shadow-[0_20px_40px_-10px_rgba(0,0,0,0.08)]", children: [_jsx("div", { className: "absolute top-0 right-0 -mr-16 -mt-16 opacity-10 pointer-events-none", children: _jsx(Heart, { className: "w-48 h-48" }) }), _jsxs("div", { className: "relative z-10 flex-1", children: [_jsxs("div", { className: "inline-flex items-center gap-1.5 px-3 py-1 bg-white/20 dark:bg-slate-900/20 text-white text-xs font-bold tracking-wide rounded-full border border-white/30 mb-3", children: [_jsx("span", { className: "w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" }), dt(`FUSHATË AKTIVE`)] }), _jsx("h2", { className: "text-xl md:text-2xl font-bold title-serif mb-1.5", children: dt(`Ndihmo Njerëz Me Nevojë`) }), _jsx("p", { className: "text-xs md:text-sm text-rose-100 max-w-xl font-medium", children: dt(`Platforma jonë tashmë mbështet mbledhjen e fondeve për qytetarët që janë në nevojë ekstreme financiare apo shëndetësore. Shihni se si mund të kontribuoni.`) })] }), _jsx("div", { className: "relative z-10 w-full md:w-auto shrink-0 flex items-center justify-center", children: _jsxs(Link, { to: "/donacion", className: "w-full sm:w-auto px-6 py-3 bg-white dark:bg-slate-900 text-rose-600 font-bold rounded-xl text-sm text-center shadow-sm hover:shadow-md transition-all hover:bg-rose-50 flex items-center justify-center gap-2", children: [dt(`Nis Kontributin Këtu`), " ", _jsx(ArrowRight, { className: "w-3.5 h-3.5 ml-0.5" })] }) })] }) }, "active")), viewMode === 'stats' && (_jsxs(motion.div, { initial: { opacity: 0, height: 0 }, animate: { opacity: 1, height: "auto" }, exit: { opacity: 0, height: 0 }, transition: { duration: 0.3 }, className: "overflow-hidden", children: [_jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-12 gap-[var(--spacing-6)] mb-8", children: [_jsxs("div", { className: "lg:col-span-5 bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-white/10 p-5 md:p-6 shadow-sm dark:shadow-none flex flex-col justify-between", children: [_jsxs("div", { children: [_jsxs("div", { className: "flex items-center gap-2 mb-1", children: [_jsx("span", { className: "p-1.5 bg-indigo-50 text-indigo-600 rounded-xl", children: _jsx(TrendingUp, { className: "w-4 h-4" }) }), _jsx("h3", { className: "text-lg font-bold text-[var(--color-text)] dark:text-white title-serif", children: dt(`Ecuria e Raportimeve`) })] }), _jsx("p", { className: "text-xs text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)] font-medium mb-6", children: dt(`Raportet e reja vs. ato të zgjidhura në 7 ditët e fundit.`) })] }), _jsx("div", { className: "w-full h-56 md:h-64", children: _jsx(ResponsiveContainer, { width: "100%", height: "100%", children: _jsxs(AreaChart, { data: chartData, margin: { top: 10, right: 10, left: -25, bottom: 0 }, children: [_jsxs("defs", { children: [_jsxs("linearGradient", { id: "colorNew", x1: "0", y1: "0", x2: "0", y2: "1", children: [_jsx("stop", { offset: "5%", stopColor: "#4f46e5", stopOpacity: 0.2 }), _jsx("stop", { offset: "95%", stopColor: "#4f46e5", stopOpacity: 0 })] }), _jsxs("linearGradient", { id: "colorResolved", x1: "0", y1: "0", x2: "0", y2: "1", children: [_jsx("stop", { offset: "5%", stopColor: "#10b981", stopOpacity: 0.2 }), _jsx("stop", { offset: "95%", stopColor: "#10b981", stopOpacity: 0 })] })] }), _jsx(CartesianGrid, { strokeDasharray: "3 3", vertical: false, stroke: "#f1f5f9" }), _jsx(XAxis, { dataKey: "name", stroke: "#94a3b8", fontSize: 11, tickLine: false, axisLine: false }), _jsx(YAxis, { stroke: "#94a3b8", fontSize: 11, tickLine: false, axisLine: false, allowDecimals: false }), _jsx(Tooltip, { contentStyle: { backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }, labelStyle: { fontWeight: 'bold', color: '#1e293b', fontSize: '12px' }, itemStyle: { fontSize: '12px', padding: '2px 0' } }), _jsx(Legend, { iconType: "circle", iconSize: 8, wrapperStyle: { fontSize: '12px', paddingTop: '15px' } }), _jsx(Area, { type: "monotone", dataKey: "Raportime t\u00EB Reja", stroke: "#4f46e5", strokeWidth: 2.5, fillOpacity: 1, fill: "url(#colorNew)" }), _jsx(Area, { type: "monotone", dataKey: "Raste t\u00EB Zgjidhura", stroke: "#10b981", strokeWidth: 2.5, fillOpacity: 1, fill: "url(#colorResolved)" })] }) }) })] }), _jsxs("div", { className: "lg:col-span-4 bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-white/10 p-5 md:p-6 shadow-sm dark:shadow-none flex flex-col justify-between", children: [_jsxs("div", { children: [_jsxs("div", { className: "flex items-center gap-2 mb-1", children: [_jsx("span", { className: "p-1.5 bg-emerald-50 text-emerald-600 rounded-xl", children: _jsx(CheckCircle2, { className: "w-4 h-4" }) }), _jsx("h3", { className: "text-lg font-bold text-[var(--color-text)] dark:text-white title-serif", children: dt(`Raporti i Zgjidhjes`) })] }), _jsx("p", { className: "text-xs text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)] font-medium mb-6", children: dt(`Raporti i problemeve të zgjidhura ndaj atyre në proces.`) })] }), _jsxs("div", { className: "w-full h-40 md:h-48 relative flex items-center justify-center mx-auto", children: [_jsx(ResponsiveContainer, { width: "100%", height: "100%", children: _jsxs(PieChart, { children: [_jsx(Pie, { data: statusRatioData, cx: "50%", cy: "50%", innerRadius: 50, outerRadius: 70, paddingAngle: 4, dataKey: "value", children: statusRatioData.map((entry, index) => (_jsx(Cell, { fill: entry.color }, `cell-${index}`))) }), _jsx(Tooltip, { contentStyle: { backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }, itemStyle: { fontSize: '12px', padding: '2px 0' } })] }) }), _jsxs("div", { className: "absolute inset-0 flex flex-col items-center justify-center pointer-events-none", children: [_jsxs("span", { className: "text-xl font-black text-slate-950 dark:text-white", children: [resolvedPercent, "%"] }), _jsx("span", { className: "text-[10px] text-[var(--color-text-muted)] font-bold uppercase tracking-wider", children: dt(`Zgjidhur`) })] })] }), _jsxs("div", { className: "mt-4 flex justify-center gap-4 text-xs font-bold", children: [_jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("span", { className: "w-2.5 h-2.5 rounded-full bg-emerald-500" }), _jsxs("span", { className: "text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)]", children: [dt(`Zgjidhur (`), statusRatioData[0].value, ")"] })] }), _jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("span", { className: "w-2.5 h-2.5 rounded-full bg-amber-500" }), _jsxs("span", { className: "text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)]", children: [dt(`Në Proces (`), statusRatioData[1].value, ")"] })] })] })] }), _jsxs("div", { className: "lg:col-span-3 bg-slate-900 text-white rounded-xl p-5 md:p-6 shadow-sm dark:shadow-none flex flex-col justify-between relative overflow-hidden", children: [_jsx("div", { className: "absolute top-0 right-0 -mr-12 -mt-12 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" }), _jsxs("div", { className: "relative z-10", children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "p-1.5 bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)]/10 text-indigo-400 rounded-xl border border-white/10", children: _jsx(Layers, { className: "w-4 h-4 text-indigo-400" }) }), _jsx("h3", { className: "text-lg font-bold title-serif", children: dt(`Sektorët Aktivë`) })] }), _jsx("span", { className: "text-xs font-bold px-2 py-0.5 rounded bg-emerald-500/25 border border-emerald-500/30 uppercase text-emerald-300 tracking-wider", children: dt(`LIVE`) })] }), _jsx("p", { className: "text-xs text-[var(--color-text-muted)] font-medium mb-5 leading-relaxed", children: dt(`Kategoritë me volumin më të madh të raportimeve në databazën cloud:`) }), _jsx("div", { className: "space-y-4", children: topCategories.map((item, idx) => {
                                                            const total = reports.length || 1;
                                                            const percent = Math.round((item.count / total) * 100);
                                                            return (_jsxs("div", { className: "group flex flex-col gap-1", children: [_jsxs("div", { className: "flex justify-between items-center text-xs font-bold", children: [_jsx("span", { className: "text-slate-200 truncate max-w-[140px] group-hover:text-white transition-colors", children: item.category }), _jsxs("span", { className: "text-indigo-400 font-mono", children: [item.count, " ", dt(`raste`), " (", percent, "%)"] })] }), _jsx("div", { className: "w-full bg-slate-800 h-2 rounded-full overflow-hidden border border-slate-700/50", children: _jsx("div", { className: "bg-indigo-500 h-full rounded-full transition-all duration-500", style: { width: `${percent}%` } }) })] }, idx));
                                                        }) })] }), _jsxs("div", { className: "mt-6 pt-4 border-t border-white/15 relative z-10 flex items-center justify-between", children: [_jsx("span", { className: "text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider font-mono", children: dt(`Totali i rasteve`) }), _jsxs("span", { className: "text-sm font-black text-indigo-400 font-mono", children: [reports.length, " ", dt(`raporte`)] })] })] })] }), _jsx(MunicipalityHealthCheck, { selectedMunicipality: selectedMunicipality }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-12 gap-[var(--spacing-6)] mb-8", children: [_jsxs("div", { className: "lg:col-span-4 bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-white/10 p-5 md:p-6 shadow-sm dark:shadow-none flex flex-col justify-between", children: [_jsxs("div", { children: [_jsxs("div", { className: "flex items-center gap-2 mb-1", children: [_jsx("span", { className: "p-1.5 bg-sky-50 text-sky-600 rounded-xl", children: _jsx(CloudSun, { className: "w-4 h-4" }) }), _jsx("h3", { className: "text-lg font-bold text-[var(--color-text)] dark:text-white title-serif", children: dt(`Moti & Cilësia e Ajrit`) })] }), _jsx("p", { className: "text-xs text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)] font-medium mb-5", children: dt(`Gjendja ekologjike në kohë reale për komunën e përzgjedhur.`) }), _jsxs("div", { className: "bg-slate-50 dark:bg-slate-900 rounded-xl p-4 border border-slate-100 dark:border-white/5 mb-4", children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsx("span", { className: "text-xs font-bold text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)] uppercase tracking-wider", children: selectedMunicipality || 'Prishtinë' }), _jsx("span", { className: "text-xs font-black text-slate-700 dark:text-[var(--color-text-muted)]", children: selectedAqi.temp })] }), _jsxs("div", { className: "flex items-end justify-between", children: [_jsxs("div", { children: [_jsxs("div", { className: "text-3xl font-black text-slate-950 dark:text-white flex items-baseline gap-1", children: [selectedAqi.aqi, _jsx("span", { className: "text-xs font-bold text-[var(--color-text-muted)]", children: dt(`AQI`) })] }), _jsxs("span", { className: cn("inline-block px-2 py-0.5 rounded text-xs font-bold mt-1.5 uppercase tracking-wide", selectedAqi.aqi <= 35 ? "bg-teal-50 text-teal-700 border border-teal-100" :
                                                                                    selectedAqi.aqi <= 50 ? "bg-emerald-50 text-emerald-700 border border-emerald-100" :
                                                                                        "bg-yellow-50 text-yellow-700 border border-yellow-100"), children: [dt(`Cilësia:`), " ", selectedAqi.status] })] }), _jsx(Wind, { className: cn("w-10 h-10 stroke-[1.5]", selectedAqi.aqi <= 50 ? "text-emerald-500" : "text-yellow-500") })] })] }), _jsxs("p", { className: "text-xs text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)] font-semibold leading-relaxed", children: [_jsx("span", { className: "font-bold text-[var(--color-text)] dark:text-white", children: dt(`Këshillë:`) }), " ", selectedAqi.aqiDesc] })] }), _jsxs("div", { className: "text-xs font-mono font-bold text-[var(--color-text-muted)] mt-4 pt-3 border-t border-slate-100 dark:border-white/5 uppercase tracking-wider flex items-center justify-between", children: [_jsx("span", { children: dt(`BURIMI: LIVE WEATHER API`) }), _jsx("span", { className: "w-2 h-2 rounded-full bg-emerald-500 animate-pulse" })] })] }), _jsxs("div", { className: "lg:col-span-4 bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-white/10 p-5 md:p-6 shadow-sm dark:shadow-none flex flex-col justify-between", children: [_jsxs("div", { children: [_jsxs("div", { className: "flex items-center justify-between mb-1", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "p-1.5 bg-amber-50 text-amber-600 rounded-xl", children: _jsx(Award, { className: "w-4 h-4" }) }), _jsx("h3", { className: "text-lg font-bold text-[var(--color-text)] dark:text-white title-serif", children: dt(`Tabela e Meritave`) })] }), _jsx("span", { className: "text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full uppercase tracking-wider", children: dt(`Top Aktivët`) })] }), _jsx("p", { className: "text-xs text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)] font-medium mb-4", children: dt(`Qytetarët tanë më kontribues dhe aktivë këtë muaj.`) }), _jsx("div", { className: "space-y-3", children: (() => {
                                                            const allCitizens = [...realUsers.filter(u => u.role !== 'admin' && u.email !== 'admin@kosova.com')];
                                                            // Add current logged in user if not present
                                                            if (currentUser && currentUser.role !== 'admin') {
                                                                const hasUser = allCitizens.some(c => c.id === currentUser.id);
                                                                if (!hasUser) {
                                                                    allCitizens.push({
                                                                        id: currentUser.id,
                                                                        name: currentUser.name || 'Ti',
                                                                        points: currentUser.points || 0,
                                                                        badges: currentUser.badges && currentUser.badges.length > 0
                                                                            ? [currentUser.badges[0]]
                                                                            : ['Qytetar Aktiv 🎖️']
                                                                    });
                                                                }
                                                            }
                                                            // Sort by points descending
                                                            const sorted = allCitizens.sort((a, b) => (b.points || 0) - (a.points || 0));
                                                            return sorted.slice(0, 5).map((citizen, index) => {
                                                                const isSelf = currentUser && (citizen.id === currentUser.id || citizen.name === currentUser.name);
                                                                const badgeText = Array.isArray(citizen.badges) && citizen.badges.length > 0
                                                                    ? citizen.badges[0]
                                                                    : (citizen.points > 300 ? 'Kampion Ekologjik 🌿' : citizen.points > 150 ? 'Raportues Aktiv ⚡' : 'Qytetar Aktiv 🎖️');
                                                                return (_jsxs("div", { className: cn("flex items-center justify-between p-2 rounded-xl transition-all border", isSelf
                                                                        ? "bg-indigo-50/50 border-indigo-150 shadow-sm dark:shadow-none"
                                                                        : "bg-slate-50 dark:bg-slate-800/50 border-transparent hover:bg-slate-50 dark:bg-slate-900"), children: [_jsxs("div", { className: "flex items-center gap-2.5", children: [_jsx("div", { className: cn("w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0", index === 0 ? "bg-amber-100 text-amber-700" :
                                                                                        index === 1 ? "bg-slate-200 dark:bg-slate-700 text-[var(--color-text)] dark:text-slate-200 dark:text-slate-100" :
                                                                                            index === 2 ? "bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-300" :
                                                                                                "bg-slate-100 dark:bg-slate-800 text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)]"), children: index + 1 }), _jsxs("div", { children: [_jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("span", { className: "text-xs font-bold text-[var(--color-text)] dark:text-white", children: citizen.name }), isSelf && _jsx("span", { className: "text-[10px] font-bold bg-indigo-600 text-white px-1.5 py-0.2 rounded-full uppercase scale-90", children: "Ti" })] }), _jsx("span", { className: "text-xs font-medium text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)]", children: badgeText })] })] }), _jsx("div", { className: "text-right", children: _jsxs("span", { className: "text-xs font-black text-[var(--color-text)] dark:text-white", children: [citizen.points || 0, " p"] }) })] }, citizen.id));
                                                            });
                                                        })() })] }), currentUser && currentUser.role !== 'admin' && (_jsxs("div", { className: "mt-4 pt-4 border-t border-slate-100 dark:border-white/5 space-y-2.5 animate-in fade-in duration-300", children: [_jsx("span", { className: "text-xs font-mono font-bold text-[var(--color-text-muted)] uppercase tracking-wider block", children: dt(`Baxhat tuaja automatike këtë muaj:`) }), _jsx("div", { className: "flex flex-wrap gap-1.5", children: (() => {
                                                            const points = currentUser.points || 0;
                                                            const badges = ['Qytetar i Ri 🎖️'];
                                                            if (points >= 100)
                                                                badges.push('Qytetar Aktiv ⚡');
                                                            if (points >= 250)
                                                                badges.push('Mbrojtës i Komunitetit 🛡️');
                                                            if (points >= 500)
                                                                badges.push('Kampion i Gjelbër 🌿');
                                                            if (points >= 1000)
                                                                badges.push('Ambasador i Kosovës 🌟');
                                                            return badges.map((badge, idx) => (_jsx("span", { className: "inline-flex items-center gap-1 text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-1 rounded-xl shadow-sm dark:shadow-none", children: badge }, idx)));
                                                        })() }), (() => {
                                                        const points = currentUser.points || 0;
                                                        let nextBadge = '';
                                                        let nextPoints = 0;
                                                        if (points < 100) {
                                                            nextBadge = 'Qytetar Aktiv ⚡';
                                                            nextPoints = 100;
                                                        }
                                                        else if (points < 250) {
                                                            nextBadge = 'Mbrojtës i Komunitetit 🛡️';
                                                            nextPoints = 250;
                                                        }
                                                        else if (points < 500) {
                                                            nextBadge = 'Kampion i Gjelbër 🌿';
                                                            nextPoints = 500;
                                                        }
                                                        else if (points < 1000) {
                                                            nextBadge = 'Ambasador i Kosovës 🌟';
                                                            nextPoints = 1000;
                                                        }
                                                        if (!nextBadge)
                                                            return null;
                                                        const progressPercent = Math.min((points / nextPoints) * 100, 100);
                                                        return (_jsxs("div", { className: "space-y-1 pt-1", children: [_jsxs("div", { className: "flex justify-between text-[10px] font-bold text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)]", children: [_jsxs("span", { children: [dt(`Deri tek`), " ", nextBadge] }), _jsxs("span", { children: [points, "/", nextPoints, " p"] })] }), _jsx("div", { className: "w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden", children: _jsx("div", { className: "bg-gradient-to-r from-indigo-500 to-rose-500 h-full rounded-full transition-all duration-500", style: { width: `${progressPercent}%` } }) })] }));
                                                    })()] })), _jsx("div", { className: "text-xs font-medium text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)] mt-4 pt-3 border-t border-slate-100 dark:border-white/5 leading-relaxed", children: dt(`Fitoni pikë duke raportuar probleme reale dhe duke marrë upvotes nga komuniteti!`) })] }), _jsxs("div", { className: "lg:col-span-4 bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-white/10 p-5 md:p-6 shadow-sm dark:shadow-none flex flex-col justify-between", children: [_jsxs("div", { children: [_jsx("div", { className: "flex items-center justify-between mb-1", children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "p-1.5 bg-rose-50 text-indigo-600 rounded-xl", children: _jsx(Award, { className: "w-4 h-4" }) }), _jsx("h3", { className: "text-lg font-bold text-[var(--color-text)] dark:text-white title-serif", children: dt(`Dhuratat Ekologjike`) })] }) }), _jsx("p", { className: "text-xs text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)] font-medium mb-4", children: dt(`Shpenzo pikët për bileta ose gjelbërim.`) }), _jsx("div", { className: "space-y-3 max-h-[220px] overflow-y-auto custom-scrollbar pr-1", children: (() => {
                                                            const claimed = currentUser?.claimedRewards || [];
                                                            const availableRewards = REWARDS_LIST.filter(r => !claimed.includes(r.id));
                                                            if (availableRewards.length === 0) {
                                                                return (_jsx("div", { className: "text-center py-8 text-[var(--color-text-muted)] font-bold text-xs", children: dt(`Të gjitha dhuratat ekologjike janë shfrytëzuar për këtë muaj! Kontribuoni më shumë për të zhbllokuar të reja.`) }));
                                                            }
                                                            return availableRewards.map((reward) => (_jsxs("div", { className: "border border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-50 dark:bg-slate-900 rounded-xl p-3 transition-all flex flex-col justify-between gap-2", children: [_jsxs("div", { className: "flex justify-between items-start", children: [_jsxs("div", { children: [_jsx("h4", { className: "font-bold text-[var(--color-text)] dark:text-white text-xs", children: reward.title }), _jsx("p", { className: "text-xs text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)] font-semibold leading-tight mt-0.5", children: reward.desc })] }), _jsxs("span", { className: "text-xs font-black bg-rose-100 text-rose-700 px-2 py-0.5 rounded-xl shrink-0", children: [reward.cost, " p"] })] }), _jsx("button", { onClick: () => handleRedeem(reward), className: "w-full py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all uppercase tracking-wide cursor-pointer", children: dt(`Shkëmbe Pikët`) })] }, reward.id)));
                                                        })() })] }), _jsxs("div", { className: "mt-4 pt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between", children: [_jsx("span", { className: "text-xs font-mono font-bold text-[var(--color-text-muted)] uppercase tracking-wider", children: dt(`Bilanci i pikëve`) }), _jsxs("span", { className: "text-xs font-black text-indigo-600 bg-rose-50 px-2 py-0.5 rounded-xl", children: [currentUser?.points || 0, dt(`pikë aktive`)] })] })] })] })] }, "stats"))] }), _jsx("div", { className: "mb-8", children: _jsx(AdBanner, { position: "inline", municipality: selectedMunicipality || undefined }) }), _jsxs("div", { id: "raportimet-section", className: "flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4 scroll-mt-24", children: [_jsx("h2", { className: "text-xl md:text-2xl font-bold text-[var(--color-text)] dark:text-white title-serif flex items-center gap-2", children: viewMode === 'resolved' ? (_jsxs(_Fragment, { children: [_jsx(TrendingUp, { className: "w-5 h-5 md:w-6 md:h-6 text-emerald-500" }), dt(`Rastet e Zgjidhura`)] })) : viewMode === 'active' ? (_jsxs(_Fragment, { children: [_jsx(Layers, { className: "w-5 h-5 md:w-6 md:h-6 text-blue-600" }), dt(`Raste Aktive`)] })) : (_jsxs(_Fragment, { children: [_jsx(Filter, { className: "w-5 h-5 md:w-6 md:h-6 text-indigo-600" }), dt(`Të Gjitha Rastet`)] })) }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("button", { onClick: () => setShowFilters(!showFilters), className: "flex lg:hidden items-center justify-center gap-2 px-4 py-2.5 bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)]/80 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 text-slate-700 dark:text-[var(--color-text-muted)] rounded-xl font-bold text-sm hover:bg-slate-50 dark:bg-slate-900 transition-all shadow-sm dark:shadow-none", children: [_jsx(Filter, { className: "w-4 h-4" }), dt(`Filtrat`)] }), _jsxs("button", { onClick: () => navigate('/detailed-registry'), className: "flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm tracking-wide hover:bg-indigo-700 transition-all shadow-sm dark:shadow-none group flex-1 sm:flex-none", children: [_jsx(Search, { className: "w-4 h-4" }), _jsx("span", { className: "hidden sm:inline", children: dt('Shiko të Gjitha Raportimet') }), _jsx("span", { className: "sm:hidden", children: dt(`Të Gjitha`) }), _jsx(ArrowRight, { className: "w-4 h-4 group-hover:translate-x-1 transition-transform" })] })] })] }), _jsx(AnimatePresence, { children: (showFilters || window.innerWidth >= 1024) && (_jsxs(_Fragment, { children: [showFilters && (_jsx(motion.div, { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, className: "fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[90] lg:hidden", onClick: () => setShowFilters(false) })), _jsxs(motion.div, { initial: window.innerWidth < 1024 ? { x: '100%' } : { height: 0, opacity: 0 }, animate: window.innerWidth < 1024 ? { x: 0 } : { height: 'auto', opacity: 1 }, exit: window.innerWidth < 1024 ? { x: '100%' } : { height: 0, opacity: 0 }, transition: { type: "spring", bounce: 0, duration: 0.4 }, className: cn("fixed inset-y-0 right-0 z-[100] w-full max-w-sm bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] dark:bg-slate-900 shadow-2xl p-6 lg:p-0 flex flex-col lg:relative lg:block lg:w-auto lg:max-w-none lg:bg-transparent lg:shadow-none lg:z-auto h-full lg:h-auto overflow-y-auto lg:overflow-visible lg:!transform-none", !showFilters && "hidden lg:block"), children: [_jsxs("div", { className: "flex items-center justify-between mb-6 lg:hidden", children: [_jsxs("h3", { className: "text-lg font-bold text-[var(--color-text)] dark:text-white flex items-center gap-2", children: [_jsx(Filter, { className: "w-5 h-5 text-indigo-600" }), dt(`Filtrat`)] }), _jsx("button", { onClick: () => setShowFilters(false), className: "p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)] hover:text-[var(--color-text)] dark:text-white", children: _jsx(X, { className: "w-5 h-5" }) })] }), _jsx("div", { className: "bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-2 mb-6 flex flex-col lg:flex-row lg:items-center gap-4 lg:divide-x divide-slate-200 dark:divide-slate-700", children: _jsxs("div", { className: "flex flex-col sm:flex-row gap-3 flex-1 w-full", children: [_jsxs("div", { className: "relative flex-1 w-full", children: [_jsx(Search, { className: "absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-neutral-500 dark:text-[var(--color-text-muted)]" }), _jsx("input", { type: "text", placeholder: t('dash_search'), value: searchQuery, onChange: (e) => setSearchQuery(e.target.value), className: "w-full pl-10 md:pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-900 lg:bg-transparent border lg:border-none border-slate-200 dark:border-slate-700 rounded-xl lg:rounded-none text-neutral-800 dark:text-slate-200 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent font-medium text-sm transition-all" })] }), _jsxs("div", { className: "flex items-center w-full sm:w-56 md:w-72 relative bg-slate-50 dark:bg-slate-900 lg:bg-neutral-50 dark:bg-slate-900/50 rounded-xl border border-slate-200/60 dark:border-white/10 lg:border-none lg:rounded-xl lg:rounded-r-lg lg:m-1", children: [_jsx(MapPin, { className: "absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-indigo-600" }), _jsxs("select", { value: selectedMunicipality, onChange: (e) => setSelectedMunicipality(e.target.value), className: "w-full pl-10 md:pl-12 pr-4 py-3 lg:py-4 bg-transparent border-none text-[var(--color-text)] dark:text-white font-semibold text-sm outline-none appearance-none cursor-pointer", children: [_jsx("option", { value: "", children: t('dash_all_mun') }), KOSOVO_MUNICIPALITIES.map(m => (_jsx("option", { value: m, children: m }, m)))] })] })] }) }), _jsx("div", { className: "flex flex-wrap lg:flex-nowrap gap-2 lg:overflow-x-auto lg:pb-6 scrollbar-hide w-full sm:mx-0 sm:px-0 lg:border-b lg:border-slate-200/60 dark:border-white/10 lg:mb-8 pt-4 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-white/5 lg:flex-row", children: ['dash_all', 'dash_recent', 'dash_most_voted', 'dash_critical'].map((filter) => (_jsx("button", { onClick: () => {
                                            setActiveTab(filter);
                                            if (window.innerWidth < 1024)
                                                setShowFilters(false);
                                        }, className: cn("px-4 py-2.5 text-xs font-bold transition-all whitespace-nowrap flex-1 lg:flex-none text-center rounded-xl lg:rounded-full border border-slate-200/60 dark:border-white/10 lg:border-transparent", activeTab === filter
                                            ? "bg-indigo-600 text-white shadow-sm border-indigo-600"
                                            : "bg-slate-50 dark:bg-slate-900 lg:bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] dark:bg-slate-900 text-slate-700 dark:text-slate-200 dark:text-[var(--color-text-muted)] lg:border-slate-200/60 dark:border-white/10 hover:bg-neutral-200 lg:hover:bg-neutral-50 dark:bg-slate-900/50 lg:hover:text-[var(--color-text)] dark:text-white"), children: t(filter) }, filter))) })] })] })) }), viewMode !== 'stats' && (_jsxs("div", { className: "mb-8 bg-slate-900 dark:bg-slate-950 border-b-4 border-indigo-500 rounded-2xl p-6 md:p-8 text-white shadow-xl overflow-hidden relative", children: [_jsx("div", { className: "absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" }), _jsx("div", { className: "absolute bottom-0 left-1/3 w-60 h-60 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" }), _jsxs("div", { className: "relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-[var(--spacing-6)]", children: [_jsxs("div", { children: [_jsx("span", { className: "inline-block px-3 py-1 bg-indigo-500/20 text-indigo-300 text-xs font-black uppercase tracking-widest rounded-full mb-3 border border-indigo-500/30", children: dt(`STATISTIKAT & IMPAKTI I KOMUNITETIT`) }), _jsxs("h2", { className: "text-2xl md:text-3xl font-extrabold tracking-tight title-serif leading-none", children: [dt(`Paneli i`), " ", _jsx("span", { className: "text-indigo-400", children: dt(`Qytetarit`) })] }), _jsx("p", { className: "text-xs md:text-sm text-slate-400 mt-2 font-medium max-w-xl", children: dt(`Mirëseerdhët në platformën qendrore të raportimeve në Kosovë. Këtu qytetarët ndihmojnë në rregullimin e komunave tona në kohë reale.`) })] }), _jsxs("button", { onClick: () => setViewMode('stats'), className: "flex items-center gap-2 px-5 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all active:scale-95 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.08)] shadow-indigo-500/30 text-xs tracking-wider uppercase whitespace-nowrap self-stretch lg:self-auto justify-center cursor-pointer", children: [_jsx(TrendingUp, { className: "w-4 h-4" }), dt('Shiko Statistikat'), dt(`e Detajuara`)] })] }), _jsxs("div", { className: "grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 pt-6 border-t border-white/10 relative z-10", children: [_jsxs("div", { className: "bg-slate-800/50 border border-slate-700/50 rounded-xl p-3 md:p-4 hover:bg-slate-800 transition-all", children: [_jsx("span", { className: "text-xs font-bold uppercase tracking-wider text-slate-400", children: dt(`Raporte Totale`) }), _jsx("div", { className: "text-2xl md:text-3xl font-serif font-bold text-white mt-1", children: reports.length }), _jsx("span", { className: "text-[10px] text-slate-400 mt-1 block", children: dt(`Të gjitha ankesat e regjistruara`) })] }), _jsxs("div", { className: "bg-slate-800/50 border border-slate-700/50 rounded-xl p-3 md:p-4 hover:bg-slate-800 transition-all", children: [_jsx(Link, { to: "/regjistri?status=dash_resolved", className: "hover:underline", children: _jsx("span", { className: "text-xs font-bold uppercase tracking-wider text-slate-400", children: dt(`Raste të Zgjidhura`) }) }), _jsx("div", { className: "text-2xl md:text-3xl font-serif font-bold text-emerald-500 mt-1", children: reports.filter(r => r.status === 'Resolved').length }), _jsxs("span", { className: "text-[10px] text-emerald-500/80 mt-1 block", children: ["\u2713 ", Math.round((reports.filter(r => r.status === 'Resolved').length / (reports.length || 1)) * 100), dt(`% Shkalla e zgjidhjes`)] })] }), _jsxs("div", { className: "bg-slate-800/50 border border-slate-700/50 rounded-xl p-3 md:p-4 hover:bg-slate-800 transition-all", children: [_jsx(Link, { to: "/regjistri?status=dash_in_progress", className: "hover:underline", children: _jsx("span", { className: "text-xs font-bold uppercase tracking-wider text-slate-400", children: dt(`Në Progres & Caktuar`) }) }), _jsx("div", { className: "text-2xl md:text-3xl font-serif font-bold text-amber-500 mt-1", children: reports.filter(r => r.status === 'In Progress' || r.status === 'Assigned').length }), _jsx("span", { className: "text-[10px] text-slate-400 mt-1 block", children: dt(`Në ndërhyrje aktive`) })] }), _jsxs("div", { className: "bg-slate-800/50 border border-slate-700/50 rounded-xl p-3 md:p-4 hover:bg-slate-800 transition-all", children: [_jsx("span", { className: "text-xs font-bold uppercase tracking-wider text-slate-400", children: dt(`Koha e Reagimit`) }), _jsx("div", { className: "text-2xl md:text-3xl font-serif font-bold text-indigo-400 mt-1", children: dt(`14 Orë`) }), _jsx("span", { className: "text-[10px] text-indigo-400/80 mt-1 block", children: dt(`⚡ Koha më e shpejtë në rajon`) })] })] })] })), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[var(--spacing-6)] lg:gap-8", children: isLoading ? (Array.from({ length: 6 }).map((_, i) => (_jsxs("div", { className: "bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)]/80 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 rounded-xl flex flex-col overflow-hidden h-[400px]", children: [_jsx("div", { className: "h-48 bg-slate-200 animate-pulse w-full" }), _jsxs("div", { className: "p-5 flex flex-col flex-1 gap-4", children: [_jsxs("div", { className: "flex justify-between items-center", children: [_jsx("div", { className: "w-24 h-5 bg-slate-200 animate-pulse rounded-xl" }), _jsx("div", { className: "w-16 h-5 bg-slate-200 animate-pulse rounded-xl" })] }), _jsx("div", { className: "w-full h-6 bg-slate-200 animate-pulse rounded" }), _jsx("div", { className: "w-4/5 h-6 bg-slate-200 animate-pulse rounded" }), _jsxs("div", { className: "mt-auto pt-4 border-t border-slate-100 dark:border-white/5 flex items-center justify-between", children: [_jsx("div", { className: "w-24 h-5 bg-slate-200 animate-pulse rounded" }), _jsxs("div", { className: "flex gap-2", children: [_jsx("div", { className: "w-8 h-5 bg-slate-200 animate-pulse rounded" }), _jsx("div", { className: "w-8 h-5 bg-slate-200 animate-pulse rounded" })] })] })] })] }, i)))) : filteredReports.length === 0 ? (_jsxs("div", { className: "col-span-full py-24 flex flex-col items-center justify-center text-center bg-transparent", children: [_jsx("div", { className: "w-16 h-16 mb-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center", children: _jsx(Filter, { className: "w-6 h-6 text-[var(--color-text-muted)]" }) }), _jsx("h3", { className: "text-2xl font-medium text-[var(--color-text)] dark:text-white mb-2", children: t('dash_no_data') }), _jsx("p", { className: "text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)] mb-8 max-w-sm", children: t('dash_no_data_desc') }), _jsx("button", { onClick: () => { setSearchQuery(''); setSelectedMunicipality(''); setActiveTab('dash_all'); }, className: "px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium transition-colors rounded-xl", children: t('dash_clear_filters') })] })) : (filteredReports.map((report, index) => (_jsxs(React.Fragment, { children: [_jsxs(motion.div, { layout: true, initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, scale: 0.95 }, transition: { duration: 0.4, delay: (index % 6) * 0.05 }, onClick: () => setSelectedReportId(report.id), className: "bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] border border-slate-200 dark:border-white/10 rounded-xl hover:shadow-md transition-all duration-300 flex flex-col group cursor-pointer overflow-hidden h-full", children: [_jsxs("div", { className: "relative aspect-[16/10] w-full overflow-hidden bg-slate-100 dark:bg-slate-800", children: [report.media && report.media.length > 0 ? (report.media[0].type === 'image' ? (_jsx("img", { src: report.media[0].url, alt: report.title, className: "w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out" })) : (_jsx("video", { src: report.media[0].url, className: "w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out pointer-events-none", muted: true, playsInline: true }))) : report.images && report.images.length > 0 ? (_jsx("img", { src: report.images[0], alt: report.title, className: "w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out" })) : (_jsx("div", { className: "w-full h-full flex items-center justify-center bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-white/5", children: _jsx(Layers, { className: "w-8 h-8 text-[var(--color-text-muted)]" }) })), _jsxs("div", { className: "absolute top-3 left-3 flex gap-2", children: [report.status === 'Pending Review' && (_jsx("div", { className: "bg-blue-500 text-white px-2.5 py-1 text-xs font-bold tracking-widest rounded-full uppercase shadow-sm", children: dt(`Në Pritje`) })), (report.status === 'Resolved') && (_jsx("div", { className: "bg-emerald-500 text-white px-2.5 py-1 text-xs font-bold tracking-widest rounded-xl uppercase shadow-sm dark:shadow-none", children: dt(`Zgjidhur`) }))] })] }), _jsxs("div", { className: "p-5 flex flex-col flex-1", children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsxs("div", { className: "flex gap-2 flex-wrap", children: [_jsx("div", { className: "bg-slate-100 dark:bg-slate-800 text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)] px-2 py-0.5 text-xs font-bold tracking-widest rounded-xl uppercase", children: dt(report.category) }), report.isAd && (_jsx("div", { className: "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 text-xs font-bold tracking-widest rounded-xl uppercase border border-blue-200 dark:border-blue-800/50", children: dt(`Sponsorizuar`) }))] }), _jsxs("span", { className: "text-xs font-mono text-[var(--color-text-muted)] bg-slate-50 dark:bg-slate-900 px-2 py-0.5 rounded-xl border border-slate-100 dark:border-white/5", children: ["#", report.id.substring(0, 6)] })] }), _jsx("h3", { className: "text-lg font-bold text-[var(--color-text)] dark:text-white mb-2 leading-snug line-clamp-2 group-hover:text-indigo-600 transition-colors", children: report.title }), _jsx("p", { className: "text-sm text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)] line-clamp-2 mb-4 flex-1 font-medium", children: report.description }), _jsxs("div", { className: "mt-auto pt-4 border-t border-slate-100 dark:border-white/5 flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-1.5 text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)] max-w-[60%]", children: [_jsx(MapPin, { className: "w-4 h-4 flex-shrink-0 text-rose-500" }), _jsx("span", { className: "text-xs font-bold truncate", children: report.location?.municipality || 'Prishtinë' })] }), _jsxs("div", { className: "flex items-center gap-4 text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)]", children: [_jsxs("button", { type: "button", onClick: (e) => {
                                                                e.stopPropagation();
                                                                upvoteReport(report.id);
                                                                toast.success(dt('Vota juaj u regjistrua!'));
                                                            }, className: "flex items-center gap-1.5 hover:text-indigo-600 transition-colors p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800", title: dt('Voto këtë raportim'), children: [_jsx(ThumbsUp, { className: "w-4 h-4" }), _jsx("span", { className: "text-xs font-bold", children: report.upvotes })] }), _jsxs("div", { className: "flex items-center gap-1.5 hover:text-indigo-600 transition-colors", children: [_jsx(MessageCircle, { className: "w-4 h-4" }), _jsx("span", { className: "text-xs font-bold", children: report.commentsCount })] }), _jsx("button", { onClick: (e) => handleShare(e, report.title, report.id), className: "flex items-center gap-1.5 hover:text-indigo-600 transition-colors ml-1 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800", title: dt(`Shpërndaj`), children: _jsx(Share2, { className: "w-4 h-4" }) })] })] })] })] }), (index + 1) % 10 === 0 && (_jsx("div", { className: "col-span-1 md:col-span-2 lg:col-span-3 py-6", children: _jsx(AdBanner, { position: "inline", municipality: selectedMunicipality || undefined }) }))] }, report.id)))) }), selectedReportId && (_jsx(ReportDetailModal, { report: reports.find(r => r.id === selectedReportId), onClose: () => setSelectedReportId(null) })), redeemedReward && (_jsx("div", { className: "fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4", children: _jsxs("div", { className: "bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-white/10 shadow-2xl p-6 max-w-sm w-full relative", children: [_jsx("button", { onClick: () => setRedeemedReward(null), className: "absolute top-4 right-4 p-1.5 bg-slate-100 dark:bg-slate-800 rounded-full text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)] hover:text-[var(--color-text)] dark:text-white transition-colors", children: _jsx(X, { className: "w-4 h-4" }) }), _jsxs("div", { className: "text-center py-4", children: [_jsx("div", { className: "w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4", children: _jsx(CheckCircle2, { className: "w-8 h-8" }) }), _jsx("h3", { className: "text-xl font-bold text-[var(--color-text)] dark:text-white mb-1", children: dt(`Shpërblimi u Përfitua!`) }), _jsx("p", { className: "text-xs text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)] font-semibold mb-6", children: dt(`Pikët u zbritën me sukses nga llogaria juaj.`) }), _jsxs("div", { className: "bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-xl p-5 mb-6 flex flex-col items-center", children: [_jsx("span", { className: "text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-3", children: redeemedReward.title }), _jsxs("div", { className: "w-40 h-40 bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] dark:bg-slate-900 border-2 border-slate-950 p-2 rounded-xl flex items-center justify-center shadow-inner relative overflow-hidden group", children: [_jsx(QrCode, { className: "w-36 h-36 text-[var(--color-text)] dark:text-white" }), _jsx("div", { className: "absolute inset-0 bg-indigo-500/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity", children: _jsx("span", { className: "bg-slate-900 text-white text-xs font-bold px-2 py-1 rounded", children: dt(`Skano`) }) })] }), _jsx("span", { className: "text-xs font-mono font-black text-[var(--color-text)] dark:text-slate-200 dark:text-slate-200 mt-4 tracking-widest", children: redeemedReward.code })] }), _jsx("p", { className: "text-xs text-[var(--color-text-muted)] font-medium", children: dt(`Prezantojeni këtë kod QR ose kodin numerik tek institucioni përkatës për të shfrytëzuar shpërblimin.`) })] })] }) }))] }));
}
