import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Building2, Calendar, Search, ArrowRight, Share2, ExternalLink, ArrowLeft, Tag } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { KOSOVO_MUNICIPALITIES } from '../lib/constants';
import toast from 'react-hot-toast';
import dardaniaImg from '../assets/images/dardania_lighting_1789827134761.jpg';
import gjilanImg from '../assets/images/gjilan_cleaning_1789827148688.jpg';
import maplConferenceImg from '../assets/images/mapl_conference_1789827163506.jpg';
export const INSTITUTIONAL_UPDATES = [
    {
        id: 'upd-1',
        institution: 'Komuna e Prishtinës',
        municipality: 'Prishtinë',
        date: '18.09.2026',
        category: 'Ndriçim publik',
        status: 'Përfunduar',
        image: dardaniaImg,
        title: "Përfundon rregullimi i ndriçimit publik në lagjen 'Dardania'",
        summary: "Komuna e Prishtinës njofton se është përfunduar rregullimi i ndriçimit publik në disa rrugë të lagjes Dardania me ndriçues efiçientë LED.",
        content: `Komuna e Prishtinës, përmes Drejtorisë së Shërbimeve Publike, njofton të gjithë qytetarët se ka përfunduar me sukses faza e parë e modernizimit të rrjetit të ndriçimit publik në lagjen "Dardania".

Projekti përfshiu zëvendësimin e mbi 240 trupave ndriçues me teknologji të avancuar LED me kursim energjie deri në 60%, si dhe rregullimin e kabllove nëntokësore përgjatë rrugëve kryesore dhe hapësirave midis banesave.

Ky investim rrit ndjeshëm sigurinë e këmbësorëve gjatë orëve të natës dhe përmirëson cilësinë e jetesës për mbi 15,000 banorë të zonës. Në ditët në vijim, ekipi do të vazhdojë me lagjen "Ulpiana" dhe "Bregu i Diellit".`,
        officialSource: 'https://prishtinaonline.com'
    },
    {
        id: 'upd-2',
        institution: 'Komuna e Gjilanit',
        municipality: 'Gjilan',
        date: '17.09.2026',
        category: 'Mjedis & Pastrim',
        status: 'Në Zhvillim',
        image: gjilanImg,
        title: 'Fillon pastrimi i deponive të egra',
        summary: 'Në kuadër të planit për një ambient më të pastër, Komuna e Gjilanit ka filluar aksionin e pastrimit të deponive të egra në disa lokalitete.',
        content: `Komuna e Gjilanit ka nisur sot aksionin e gjerë për eliminimin e të gjitha deponive ilegale të mbeturinave në zonat rurale dhe periferike të komunës.

Në terren janë angazhuar makineri të rënda dhe ekipe të kompanisë rajonale të mbeturinave. Deri më tani janë pastruar me sukses 4 pika kritike në dalje të qytetit dhe janë vendosur tabela paralajmëruese me kamera vëzhguese.

Kryetari i komunës u bëri thirrje qytetarëve që të raportojnë çdo hedhje të paligjshme të mbeturinave direkt në platformën "Zëri i Qytetarëve" për reagim të menjëhershëm nga inspektorati komunal.`,
        officialSource: 'https://gjilani-komuna.org'
    },
    {
        id: 'upd-3',
        institution: 'Zëri i Qytetarëve',
        municipality: 'Nacionale',
        date: '16.09.2026',
        category: 'Digjitalizim',
        status: 'Përfunduar',
        image: maplConferenceImg,
        title: 'Takim për digjitalizimin e shërbimeve komunale',
        summary: 'Platforma Zëri i Qytetarëve organizoi takim me përfaqësues të komunave për avancimin e digjitalizimit dhe përmirësimin e shërbimeve për qytetarët.',
        content: `Platforma Zëri i Qytetarëve mbajti sot një tryezë të nivelit të lartë me nënkryetarët dhe drejtorët e administratave nga të gjitha 38 komunat e Republikës së Kosovës.

Fokusi i takimit ishte integrimi i plotë i shërbimeve komunale me platformat digjitale qytetare, reduktimi i burokracisë dhe përgjigjja e shpejtë ndaj kërkesave dhe ankesave të parashtruara nga komuniteti.

U prezantua gjithashtu moduli i ri i transparencës buxhetore komunale, i cili do t'u mundësojë qytetarëve të monitorojnë çdo investim publik në kohë reale.`,
        officialSource: 'https://rks-gov.net'
    },
    {
        id: 'upd-4',
        institution: 'Komuna e Prizrenit',
        municipality: 'Prizren',
        date: '15.09.2026',
        category: 'Ujë & Kanalizim',
        status: 'Në Zhvillim',
        image: '/src/assets/images/hero_city_modern_1789826592815.jpg',
        title: 'Nis faza e dytë e riparimit të rrjetit të ujësjellësit në Qendrën Historike',
        summary: 'Projekti synon minimizimin e humbjeve të ujit dhe sigurimin e furnizimit 24 orë pa ndërprerje për bizneset dhe banorët e Shadërvanit.',
        content: `Komuna e Prizrenit në bashkëpunim me KRU "Hidroregjioni Jugor" ka nisur punimet për rikonstruktimin e tubacioneve kryesore në zonën historike. Punimet do të kryhen në orët e vona të natës për të mos penguar lëvizjen e qytetarëve dhe turistëve.`,
        officialSource: 'https://prizreni.org'
    },
    {
        id: 'upd-5',
        institution: 'Komuna e Pejës',
        municipality: 'Pejë',
        date: '14.09.2026',
        category: 'Infrastrukturë',
        status: 'Përfunduar',
        image: '/src/assets/images/festa_qytetit_ad_1789826607925.jpg',
        title: 'Hapet qendra e re multifunksionale për të rinjtë në Pejë',
        summary: 'Hapësirë moderne për kurse digjitale, punëtori inovative dhe aktivitete sportive për komunitetin lokal.',
        content: `Qendra ofron sallë kompjuterike, hapësira 'co-working' dhe ambiente takimesh për organizatat joqeveritare dhe iniciativat rinore të qytetit të Pejës.`,
        officialSource: 'https://peja.rks-gov.net'
    },
    {
        id: 'upd-6',
        institution: 'Komuna e Ferizajt',
        municipality: 'Ferizaj',
        date: '12.09.2026',
        category: 'Mobilitet Urban',
        status: 'Planifikuar',
        image: '/src/assets/images/dardania_lighting_1789827134761.jpg',
        title: 'Miratohet plani i ri për shtigjet e reja të biçikletave',
        summary: 'Mbi 12 kilometra shtigje të dedikuara do të lidhin qendrën e qytetit me parqet dhe shkollat kryesore.',
        content: `Plani synon lehtësimin e trafikut të automjeteve dhe promovimin e transportit të gjelbër në territorin e Komunës së Ferizajt me standardet më të larta të sigurisë rrugore.`,
        officialSource: 'https://ferizaj-komuna.org'
    }
];
export default function InstitutionalUpdatesPage() {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedMunicipality, setSelectedMunicipality] = useState('Të gjitha');
    const [selectedCategory, setSelectedCategory] = useState('Të gjitha');
    const [selectedArticle, setSelectedArticle] = useState(null);
    const categories = ['Të gjitha', 'Ndriçim publik', 'Mjedis & Pastrim', 'Digjitalizim', 'Ujë & Kanalizim', 'Infrastrukturë', 'Mobilitet Urban'];
    const filteredUpdates = INSTITUTIONAL_UPDATES.filter(item => {
        if (selectedMunicipality !== 'Të gjitha' && item.municipality !== selectedMunicipality && item.municipality !== 'Nacionale') {
            return false;
        }
        if (selectedCategory !== 'Të gjitha' && item.category !== selectedCategory) {
            return false;
        }
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            const matchTitle = item.title.toLowerCase().includes(q);
            const matchSummary = item.summary.toLowerCase().includes(q);
            const matchInst = item.institution.toLowerCase().includes(q);
            if (!matchTitle && !matchSummary && !matchInst)
                return false;
        }
        return true;
    });
    const handleShare = (article) => {
        if (navigator.share) {
            navigator.share({ title: article.title, text: article.summary, url: window.location.href }).catch(() => { });
        }
        else {
            navigator.clipboard.writeText(window.location.href);
            toast.success("Linku u kopjua!");
        }
    };
    return (_jsxs("div", { className: "w-full min-h-screen bg-[#F8FAFC] dark:bg-[#0B1320] text-slate-900 dark:text-white pb-20", children: [_jsx("div", { className: "bg-[#0b1a30] text-white border-b border-slate-800", children: _jsxs("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12", children: [_jsxs("div", { className: "flex items-center gap-3 mb-4", children: [_jsxs("button", { onClick: () => navigate('/'), className: "p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-all text-white flex items-center gap-2 text-xs font-bold", children: [_jsx(ArrowLeft, { className: "w-4 h-4" }), _jsx("span", { children: "Kthehu te Ballina" })] }), _jsxs("div", { className: "inline-flex items-center gap-1.5 px-3 py-1 bg-blue-600/30 border border-blue-500/40 text-blue-300 text-xs font-bold rounded-full", children: [_jsx(Building2, { className: "w-3.5 h-3.5" }), _jsx("span", { children: "Transparenca Institucionale" })] })] }), _jsx("h1", { className: "text-3xl sm:text-4xl lg:text-5xl font-black title-serif text-white tracking-tight", children: "P\u00EBrdit\u00EBsime nga Institucionet" }), _jsx("p", { className: "mt-2 text-sm sm:text-base text-slate-300 max-w-2xl leading-relaxed", children: "Njoftime zyrtare, projekte t\u00EB p\u00EBrfunduara dhe punimet n\u00EB zhvillim nga komunat e Kosov\u00EBs dhe Ministria e Administrimit t\u00EB Pushtetit Lokal." }), _jsxs("div", { className: "mt-8 grid grid-cols-1 sm:grid-cols-12 gap-3", children: [_jsxs("div", { className: "sm:col-span-6 relative", children: [_jsx(Search, { className: "absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" }), _jsx("input", { type: "text", placeholder: "K\u00EBrko njoftime, projekte, komuna...", value: searchQuery, onChange: (e) => setSearchQuery(e.target.value), className: "w-full pl-11 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-400 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 backdrop-blur-md" })] }), _jsx("div", { className: "sm:col-span-3", children: _jsxs("select", { value: selectedMunicipality, onChange: (e) => setSelectedMunicipality(e.target.value), className: "w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer backdrop-blur-md", children: [_jsx("option", { value: "T\u00EB gjitha", className: "text-slate-900", children: "T\u00EB gjitha Komunat" }), KOSOVO_MUNICIPALITIES.map(m => (_jsx("option", { value: m, className: "text-slate-900", children: m }, m)))] }) }), _jsx("div", { className: "sm:col-span-3", children: _jsx("select", { value: selectedCategory, onChange: (e) => setSelectedCategory(e.target.value), className: "w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer backdrop-blur-md", children: categories.map(c => (_jsx("option", { value: c, className: "text-slate-900", children: c }, c))) }) })] })] }) }), _jsxs("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8", children: [_jsxs("div", { className: "flex items-center justify-between mb-6", children: [_jsxs("span", { className: "text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400", children: ["Duke shfaqur ", filteredUpdates.length, " njoftime zyrtare"] }), (selectedMunicipality !== 'Të gjitha' || selectedCategory !== 'Të gjitha' || searchQuery) && (_jsx("button", { onClick: () => { setSelectedMunicipality('Të gjitha'); setSelectedCategory('Të gjitha'); setSearchQuery(''); }, className: "text-xs text-blue-600 hover:text-blue-700 font-bold", children: "Pastro t\u00EB gjitha filtrat" }))] }), filteredUpdates.length === 0 ? (_jsxs("div", { className: "bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/10 p-12 text-center", children: [_jsx(Building2, { className: "w-12 h-12 text-slate-400 mx-auto mb-3" }), _jsx("h3", { className: "text-base font-bold text-slate-900 dark:text-white", children: "Nuk u gjet asnj\u00EB njoftim" }), _jsx("p", { className: "text-xs text-slate-500 dark:text-slate-400 mt-1", children: "Provoni t\u00EB zgjidhni nj\u00EB komun\u00EB tjet\u00EBr ose pastroni k\u00EBrkimin tuaj." })] })) : (_jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6", children: filteredUpdates.map((item) => (_jsxs("article", { onClick: () => setSelectedArticle(item), className: "bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-white/10 overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 flex flex-col group cursor-pointer", children: [_jsxs("div", { className: "relative aspect-[16/10] w-full overflow-hidden bg-slate-100 dark:bg-slate-800", children: [_jsx("img", { src: item.image, alt: item.title, className: "w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" }), _jsx("div", { className: "absolute top-3 left-3 flex gap-2", children: _jsxs("span", { className: "px-2.5 py-1 bg-slate-950/80 backdrop-blur-md text-white text-[10px] font-bold rounded-lg uppercase tracking-wider flex items-center gap-1 shadow-sm", children: [_jsx(Building2, { className: "w-3 h-3 text-blue-400" }), item.institution] }) }), _jsx("div", { className: "absolute top-3 right-3", children: _jsx("span", { className: "px-2 py-0.5 bg-emerald-600 text-white text-[10px] font-bold rounded-full shadow-sm", children: item.status }) })] }), _jsxs("div", { className: "p-5 flex flex-col flex-1", children: [_jsxs("div", { className: "flex items-center justify-between text-slate-400 text-[11px] mb-2 font-medium", children: [_jsxs("span", { className: "flex items-center gap-1 text-blue-600 dark:text-blue-400 font-bold", children: [_jsx(Tag, { className: "w-3 h-3" }), item.category] }), _jsxs("span", { className: "flex items-center gap-1", children: [_jsx(Calendar, { className: "w-3 h-3" }), item.date] })] }), _jsx("h3", { className: "text-base font-bold text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors leading-snug mb-2", children: item.title }), _jsx("p", { className: "text-xs text-slate-600 dark:text-slate-300 line-clamp-3 leading-relaxed mb-4 flex-1", children: item.summary }), _jsxs("div", { className: "pt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-xs mt-auto", children: [_jsxs("span", { className: "text-blue-600 dark:text-blue-400 font-bold flex items-center gap-1 group-hover:gap-1.5 transition-all", children: [_jsx("span", { children: "Lexo m\u00EB shum\u00EB" }), _jsx(ArrowRight, { className: "w-3.5 h-3.5" })] }), _jsx("button", { onClick: (e) => { e.stopPropagation(); handleShare(item); }, className: "p-1.5 text-slate-400 hover:text-blue-600 rounded-lg transition-colors", title: "Shp\u00EBrndaj", children: _jsx(Share2, { className: "w-4 h-4" }) })] })] })] }, item.id))) }))] }), selectedArticle && (_jsx("div", { className: "fixed inset-0 z-[1100] overflow-y-auto bg-[#f5f8fc] dark:bg-slate-950", children: _jsxs("article", { className: "min-h-full", children: [_jsx("header", { className: "sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-white/10 dark:bg-slate-950/95", children: _jsxs("div", { className: "mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6", children: [_jsxs("span", { className: "font-serif text-sm font-black text-slate-900 dark:text-white", children: ["Z\u00EBri i Qytetar\u00EBve ", _jsx("span", { className: "text-blue-600", children: "/ P\u00EBrdit\u00EBsime" })] }), _jsx("button", { onClick: () => setSelectedArticle(null), className: "rounded-lg bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-white", children: "\u2190 Kthehu te p\u00EBrdit\u00EBsimet" })] }) }), _jsx("div", { className: "mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12", children: _jsxs("div", { className: "overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900 sm:rounded-3xl", children: [_jsxs("div", { className: "relative aspect-[16/9] w-full", children: [_jsx("img", { src: selectedArticle.image, alt: selectedArticle.title, className: "w-full h-full object-cover" }), _jsxs("div", { className: "absolute bottom-4 left-4 bg-slate-950/80 backdrop-blur-md px-3 py-1 rounded-xl text-white text-xs font-bold flex items-center gap-2", children: [_jsx(Building2, { className: "w-3.5 h-3.5 text-blue-400" }), _jsx("span", { children: selectedArticle.institution }), _jsx("span", { children: "\u2022" }), _jsx("span", { children: selectedArticle.date })] })] }), _jsxs("div", { className: "p-6 sm:p-10", children: [_jsxs("div", { className: "flex items-center gap-2 mb-3", children: [_jsx("span", { className: "px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-xs font-bold", children: selectedArticle.category }), _jsx("span", { className: "px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold", children: selectedArticle.status })] }), _jsx("h2", { className: "text-xl sm:text-2xl font-black title-serif text-slate-900 dark:text-white leading-tight mb-4", children: selectedArticle.title }), _jsx("p", { className: "mb-8 border-l-4 border-blue-600 pl-4 text-lg leading-relaxed text-slate-600 dark:text-slate-300", children: selectedArticle.summary }), _jsx("div", { className: "prose max-w-none whitespace-pre-line text-base leading-8 text-slate-700 dark:prose-invert dark:text-slate-300 sm:text-lg", children: selectedArticle.content }), _jsxs("div", { className: "mt-8 pt-4 border-t border-slate-200 dark:border-white/10 flex items-center justify-between", children: [_jsxs("button", { onClick: () => handleShare(selectedArticle), className: "px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-colors", children: [_jsx(Share2, { className: "w-3.5 h-3.5" }), _jsx("span", { children: "Shp\u00EBrndaj Njoftimin" })] }), selectedArticle.officialSource && (_jsxs("a", { href: selectedArticle.officialSource, target: "_blank", rel: "noreferrer", className: "text-xs text-blue-600 hover:underline font-bold flex items-center gap-1", children: [_jsx("span", { children: "Burimi Zyrtar" }), _jsx(ExternalLink, { className: "w-3 h-3" })] }))] })] })] }) })] }) }))] }));
}
