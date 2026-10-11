import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Newspaper, Search, Calendar, Share2, ArrowRight, Check } from 'lucide-react';
import { MunicipalityShield } from '../components/MunicipalityShield';
import { cn } from '../lib/utils';
import toast from 'react-hot-toast';
import { collection, onSnapshot, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import AdBanner from '../components/AdBanner';
const NEWS_DATA = [
    {
        id: 'lajm-1',
        title: 'Fillon faza e tretë e gjelbërimit: Mbi 5,000 drunj të rinj në parqet dhe rrugët e Prishtinës',
        municipality: 'Prishtinë',
        category: 'Mjedis & Parqe',
        date: '18 Shtator 2026',
        author: 'Zyra për Marrëdhënie me Publikun',
        readTime: '3 min lexim',
        summary: 'Komuna e Prishtinës ka nisur sot aksionin masiv të pyllëzimit urban në Parkun e Gërmisë, Taukbahqe dhe përgjatë unazës qendrore.',
        content: `Kryeqyteti ka ndërmarrë hapin më të madh mjedisor të këtij viti me mbjelljen e 5,000 fidanëve të rritur autoktonë (panjë, bli dhe bung) me qëllim përmirësimin e cilësisë së ajrit dhe shtimin e kurorave të gjelbra në zonat me dendësi të lartë ndërtimesh. 
    
    Aksioni po realizohet nga Ndërmarrja Publike "Hortikultura" në bashkëpunim me vullnetarë dhe nxënës shkollash. Sipas Drejtorisë së Parqeve, ky plan parasheh edhe instalimin e sistemeve të ujitjes pikë-pikë për të garantuar rritjen e sigurt të fidanëve të mbjellë.`
    },
    {
        id: 'lajm-2',
        title: 'Nënshkruhet marrëveshja për digjitalizimin e plotë të arkivës dhe shërbimeve kadastrale',
        municipality: 'Prizren',
        category: 'Shërbime Digjitale',
        date: '16 Shtator 2026',
        author: 'Drejtoria për Kadastër',
        readTime: '4 min lexim',
        summary: 'Qytetarët e Prizrenit së shpejti do të kenë qasje të menjëhershme digjitale në të gjitha dosjet e pronësisë dhe planet rregulluese.',
        content: `Komuna e Prizrenit ka nënshkruar sot marrëveshjen me Agjencinë Kadastrale të Kosovës për digjitalizimin e mbi 180,000 faqeve të dokumenteve historike dhe arkivore kadastrale. 
    
    Ky projekt do të reduktojë kohën e pritjes për fletë poseduese dhe kopje plani nga ditë të tëra në vetëm disa sekonda online, duke parandaluar plotësisht gabimet njerëzore dhe duke rritur sigurinë juridike të patundshmërive.`
    },
    {
        id: 'lajm-3',
        title: 'Hapen aplikimet për 200 bursa studentore për vitin akademik 2026-2027',
        municipality: 'Pejë',
        category: 'Arsim & Rini',
        date: '14 Shtator 2026',
        author: 'Drejtoria Komunale e Arsimit',
        readTime: '2 min lexim',
        summary: 'Komuna e Pejës ndan fondin vjetor prej 160,000 € për mbështetjen e studentëve elitarë në fushat e mjekësisë, inxhinierisë dhe bujqësisë.',
        content: `Të gjithë studentët e rregullt me vendbanim në Komunën e Pejës që ndjekin studimet në universitetet publike të Kosovës dhe kanë notë mesatare mbi 8.5 mund të aplikojnë online përmes platformës komunale.
    
    Përparësi këtë vit do t'u jepet drejtimeve deficitare si teknologjia e informacionit, veterinaria dhe agro-biznesi, si dhe studentëve nga familjet me kushte të rënduara ekonomike.`
    },
    {
        id: 'lajm-4',
        title: 'Përfundon projekti: 24 fshatra të Ferizajt pajisen me ndriçim modern LED efiçient',
        municipality: 'Ferizaj',
        category: 'Infrastrukturë',
        date: '12 Shtator 2026',
        author: 'Drejtoria e Shërbimeve Publike',
        readTime: '3 min lexim',
        summary: 'Mbi 6,800 poça të vjetër u zëvendësuan me teknologji inteligjente, duke rritur sigurinë e qarkullimit të këmbësorëve gjatë natës.',
        content: `Me përfundimin e këtij investimi madhor, Komuna e Ferizajt arrin mbulueshmëri prej 98% të territorit rural me ndriçim publik të standardeve bashkëkohore. 
    
    Përveç sigurisë së lartë në rrugët lokale, projekti kursen buxhetit komunal mbi 140,000 euro në vit nga reduktimi i konsumit të energjisë elektrike dhe mirëmbajtjes.`
    },
    {
        id: 'lajm-5',
        title: 'Buxhetimi me Pjesëmarrje Qytetare: Mbi 1,400 kërkesa nga dëgjimet publike në lagje',
        municipality: 'Gjilan',
        category: 'Financa & Buxhet',
        date: '10 Shtator 2026',
        author: 'Zyra e Kryetarit',
        readTime: '4 min lexim',
        summary: 'Qytetarët e Gjilanit vendosën drejtpërdrejt për prioritetet e investimeve në infrastrukturë, kanalizim dhe parqe për vitin e ardhshëm.',
        content: `Gjatë ciklit dy-javor të dëgjimeve buxhetore në 18 bashkësi lokale, qytetarët patën mundësi të debatonin drejtpërdrejt me drejtorët komunalë dhe të votonin për projektet prioritare të lagjeve të tyre.
    
    Kërkesat me numrin më të madh të votave janë integruar tashmë në draft-buxhetin komunal të vitit 2027, i cili do t'i dërgohet Kuvendit Komunal për miratim.`
    },
    {
        id: 'lajm-6',
        title: 'Inaugurohet Qendra e Re Rinore dhe Hub-i i Teknologjisë dhe Inovacionit',
        municipality: 'Mitrovicë',
        category: 'Arsim & Rini',
        date: '08 Shtator 2026',
        author: 'Drejtoria për Rini dhe Sport',
        readTime: '3 min lexim',
        summary: 'Një hapësirë prej 800 m² me pajisje moderne kompjuterike, trajnime falas për programim dhe mbështetje për start-up të të rinjve.',
        content: `Qendra do të shërbejë si vatër e krijimtarisë dhe edukimit digjital për nxënësit dhe studentët e rajonit të Mitrovicës. 
    
    Gjatë vitit të parë të funksionimit janë planifikuar mbi 30 kurse falas në kodim, dizajn grafik, robotikë dhe menaxhim projektesh me certifikim ndërkombëtar.`
    }
];
export default function LajmePage() {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [activeArticle, setActiveArticle] = useState(null);
    const [copiedId, setCopiedId] = useState(null);
    const [adminNews, setAdminNews] = useState([]);
    /**
     * Only published articles are read, and only the newest batch.
     *
     * `onSnapshot(collection(db, 'newsArticles'))` delivered every article ever
     * written — including drafts meant for editorial review — to every reader who
     * opened the page, and kept a live listener on all of them. The filter was
     * applied in the browser after the fact, so the drafts were already on the
     * wire by then. Filtering in the query means unpublished work is never sent.
     */
    useEffect(() => onSnapshot(query(collection(db, 'newsArticles'), where('published', '!=', false), orderBy('createdAt', 'desc'), limit(60)), snapshot => {
        setAdminNews(snapshot.docs
            .map(item => ({ id: item.id, ...item.data() }))
            .filter(item => item.published !== false));
    }, () => setAdminNews([])), []);
    const categories = [
        'all',
        'Infrastrukturë',
        'Mjedis & Parqe',
        'Shërbime Digjitale',
        'Arsim & Rini',
        'Financa & Buxhet'
    ];
    const filteredNews = useMemo(() => {
        const allNews = [...adminNews, ...NEWS_DATA.filter(item => !adminNews.some(adminItem => adminItem.id === item.id))];
        return allNews.filter(item => {
            const matchCat = selectedCategory === 'all' || item.category === selectedCategory;
            const matchSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.municipality.toLowerCase().includes(searchQuery.toLowerCase());
            return matchCat && matchSearch;
        });
    }, [adminNews, searchQuery, selectedCategory]);
    const handleShare = (item) => {
        navigator.clipboard?.writeText(window.location.href);
        setCopiedId(item.id);
        toast.success('Linku i lajmit u kopjua në clipboard!');
        setTimeout(() => setCopiedId(null), 2000);
    };
    return (_jsx("div", { className: "page-shell min-h-screen bg-(--color-page) dark:bg-(--color-brand-dark) text-slate-800 dark:text-slate-100 py-8 px-4 sm:px-6 lg:px-8", children: _jsxs("div", { className: "max-w-7xl mx-auto space-y-8", children: [_jsxs("div", { className: "bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200/80 dark:border-white/10 shadow-xs relative overflow-hidden", children: [_jsx("div", { className: "absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" }), _jsxs("div", { className: "flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10", children: [_jsxs("div", { children: [_jsxs("div", { className: "inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 text-xs font-bold border border-blue-200/60 dark:border-blue-900 mb-3", children: [_jsx(Newspaper, { className: "w-3.5 h-3.5" }), _jsx("span", { children: "Informimi Zyrtar Komunal" })] }), _jsx("h1", { className: "text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 dark:text-white tracking-tight", children: "Lajme & Njoftime Komunale" }), _jsx("p", { className: "text-sm sm:text-base text-slate-600 dark:text-slate-400 mt-2 max-w-2xl", children: "Njoftimet m\u00EB t\u00EB fundit, vendimet e kuvendeve komunale, projektet kapitale dhe informacionet zyrtare nga 38 komunat e Republik\u00EBs s\u00EB Kosov\u00EBs." })] }), _jsx("div", { className: "flex items-center gap-3", children: _jsx("button", { onClick: () => navigate('/perditesimet'), className: "px-4 py-2.5 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-900 rounded-xl text-xs font-bold hover:bg-blue-100 transition-all cursor-pointer", children: "P\u00EBrdit\u00EBsimet Institucionale" }) })] }), _jsxs("div", { className: "mt-8 pt-6 border-t border-slate-100 dark:border-white/5 flex flex-col sm:flex-row gap-4", children: [_jsxs("div", { className: "relative flex-1", children: [_jsx("input", { type: "text", placeholder: "K\u00EBrkoni lajme sipas titullit, komun\u00EBs apo tematik\u00EBs...", value: searchQuery, onChange: (e) => setSearchQuery(e.target.value), className: "w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" }), _jsx(Search, { className: "w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" })] }), _jsx("div", { className: "flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0", children: categories.map((cat) => (_jsx("button", { onClick: () => setSelectedCategory(cat), className: cn("px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer", selectedCategory === cat
                                            ? "bg-blue-600 text-white shadow-xs"
                                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"), children: cat === 'all' ? 'Të gjitha Lajmet' : cat }, cat))) })] })] }), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6", children: filteredNews.map((news) => (_jsxs("article", { className: "bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-xs hover:shadow-md transition-all flex flex-col justify-between p-5 group", children: [_jsxs("div", { children: [_jsxs("div", { className: "flex items-center justify-between gap-3 mb-3", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(MunicipalityShield, { name: news.municipality, size: "sm" }), _jsxs("span", { className: "text-xs font-bold text-slate-800 dark:text-slate-200", children: ["Komuna e ", news.municipality] })] }), _jsx("span", { className: "px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900", children: news.category })] }), _jsx("h3", { onClick: () => setActiveArticle(news), className: "text-base font-black text-slate-900 dark:text-white leading-snug mb-2 group-hover:text-blue-600 transition-colors cursor-pointer", children: news.title }), _jsx("p", { className: "text-xs text-slate-600 dark:text-slate-400 line-clamp-3 leading-relaxed mb-4", children: news.summary })] }), _jsxs("div", { className: "pt-4 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-xs text-slate-500", children: [_jsxs("div", { className: "flex items-center gap-2 text-[11px]", children: [_jsx(Calendar, { className: "w-3.5 h-3.5 text-slate-400" }), _jsx("span", { children: news.date })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("button", { onClick: () => handleShare(news), title: "Shp\u00EBrndaj", className: "p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer", children: copiedId === news.id ? _jsx(Check, { className: "w-3.5 h-3.5 text-emerald-600" }) : _jsx(Share2, { className: "w-3.5 h-3.5" }) }), _jsxs("button", { onClick: () => setActiveArticle(news), className: "font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1 cursor-pointer ml-1", children: [_jsx("span", { children: "Lexo" }), _jsx(ArrowRight, { className: "w-3 h-3" })] })] })] })] }, news.id))) }), activeArticle && (_jsx("div", { className: "fixed inset-0 z-[100] overflow-y-auto bg-[#f5f8fc] dark:bg-slate-950", children: _jsxs("article", { className: "min-h-full", children: [_jsx("header", { className: "sticky top-0 z-10 bg-white/95 dark:bg-slate-950/95 backdrop-blur border-b border-slate-200 dark:border-white/10", children: _jsxs("div", { className: "max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4", children: [_jsxs("span", { className: "font-serif font-black text-slate-900 dark:text-white", children: ["Z\u00EBri i Qytetar\u00EBve ", _jsx("span", { className: "text-blue-600", children: "/ Lajme" })] }), _jsx("button", { onClick: () => setActiveArticle(null), className: "px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-black hover:bg-slate-200", children: "\u2190 Kthehu te lajmet" })] }) }), _jsx("div", { className: "max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12", children: _jsxs("div", { className: "bg-white dark:bg-slate-900 shadow-sm border border-slate-200/80 dark:border-white/10 rounded-2xl sm:rounded-3xl p-6 sm:p-10", children: [_jsx("div", { className: "flex items-center justify-between gap-4 mb-7 pb-5 border-b border-slate-100 dark:border-white/10", children: _jsxs("div", { className: "flex items-center gap-2.5", children: [_jsx(MunicipalityShield, { name: activeArticle.municipality, size: "md" }), _jsxs("div", { children: [_jsxs("span", { className: "text-xs font-bold text-slate-900 dark:text-white block", children: ["Komuna e ", activeArticle.municipality] }), _jsxs("span", { className: "text-[11px] text-slate-500", children: [activeArticle.date, " \u2022 ", activeArticle.author] })] })] }) }), _jsx("div", { className: "inline-block px-2.5 py-1 rounded-md text-[11px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900 mb-4", children: activeArticle.category }), _jsx("h1", { className: "font-serif text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white leading-[1.1] mb-5", children: activeArticle.title }), _jsx("p", { className: "text-lg leading-relaxed text-slate-600 dark:text-slate-300 border-l-4 border-blue-600 pl-4 mb-8", children: activeArticle.summary }), _jsx(AdBanner, { position: "article", className: "mb-8", municipality: activeArticle.municipality }), _jsx("div", { className: "prose prose-slate dark:prose-invert max-w-none text-base sm:text-lg text-slate-700 dark:text-slate-300 space-y-5 leading-8 whitespace-pre-line", children: activeArticle.content }), _jsxs("div", { className: "mt-10 pt-6 border-t border-slate-100 dark:border-white/10 flex items-center justify-between", children: [_jsx("span", { className: "text-xs text-slate-400 italic", children: "Z\u00EBri i Qytetar\u00EBve \u2022 Portali i Hapur Komunal" }), _jsx("button", { onClick: () => setActiveArticle(null), className: "px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold cursor-pointer", children: "Mbyll Leximin" })] })] }) })] }) }))] }) }));
}
