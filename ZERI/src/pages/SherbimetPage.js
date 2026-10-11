import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FileText, Search, ExternalLink, Clock, DollarSign, CheckCircle2, ArrowRight, Download, Lightbulb, Star, Send } from 'lucide-react';
import { cn } from '../lib/utils';
import toast from 'react-hot-toast';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
const SERVICES_DATA = [
    // Gjendja Civile
    {
        id: 'gc-1',
        category: 'Gjendja Civile',
        title: 'Certifikatë e Lindjes, Martesës dhe Vendbanimit',
        department: 'Drejtoria e Administratës së Përgjithshme',
        description: 'Pajisja me ekstrakte dhe certifikata zyrtare të gjendjes civile për të gjithë qytetarët e regjistruar.',
        requirements: ['Letërnjoftimi valid ose pasaporta', 'Numri personal 10-shifror', 'Autorizimi nëse aplikohet për persona të tretë'],
        fee: '1.00 € (ose falas online)',
        deadline: 'Menjëherë (10 min)',
        isOnline: true,
        onlineUrl: 'https://ekosova.rks-gov.net'
    },
    {
        id: 'gc-2',
        category: 'Gjendja Civile',
        title: 'Ndryshimi i Vendbanimit dhe Regjistrimi i Ri',
        department: 'Drejtoria e Administratës së Përgjithshme',
        description: 'Regjistrimi zyrtar i adresës së re të banimit brenda komunës apo kalimi nga një komunë tjetër.',
        requirements: ['Kontrata e qirasë apo fleta poseduese e pronës', 'Fatura e fundit e shërbimeve publike (rrymë/ujë)', 'Letërnjoftimi'],
        fee: 'Falas',
        deadline: '24 orë',
        isOnline: true,
        onlineUrl: 'https://ekosova.rks-gov.net'
    },
    // Kadastri & Prona
    {
        id: 'kp-1',
        category: 'Kadastër & Pronë',
        title: 'Certifikata e Pronësisë (Fletë Poseduese)',
        department: 'Drejtoria për Kadastër dhe Gjeodezi',
        description: 'Dokumenti themelor që vërteton pronësinë ligjore mbi ngastrën kadastrale apo njësinë ndërtimore.',
        requirements: ['Numri i ngastrës kadastrale', 'Kopja e letërnjoftimit të pronarit', 'Dëshmia mbi pagesën e tarifës'],
        fee: '4.00 € për ngastër',
        deadline: 'Brenda ditës',
        isOnline: true,
        onlineUrl: 'https://ekosova.rks-gov.net'
    },
    {
        id: 'kp-2',
        category: 'Kadastër & Pronë',
        title: 'Kopja e Planit Kadastral dhe Matjet Gjeodezike',
        department: 'Drejtoria për Kadastër dhe Gjeodezi',
        description: 'Lëshimi i planit të situacionit me koordinata gjeodezike zyrtare nga baza e të dhënave të AKK-së.',
        requirements: ['Kërkesa me shkrim e pronarit', 'Fleta poseduese', 'Vërtetimi i tatimit në pronë'],
        fee: '10.00 €',
        deadline: '2-3 ditë pune',
        isOnline: false,
        formName: 'Formulari-KopjePlani.pdf'
    },
    // Urbanizmi & Ndërtimi
    {
        id: 'un-1',
        category: 'Urbanizëm & Leje',
        title: 'Kushtet Ndërtimore dhe Leja e Ndërtimit të Kategorisë I & II',
        department: 'Drejtoria e Planifikimit Urban dhe Ndërtimit',
        description: 'Aplikimi për leje ndërtimi për shtëpi individuale banimi, objekte shumëbanesore apo komplekse afariste.',
        requirements: ['Projekti kryesor arkitektonik i nënshkruar nga inxhinieri i licencuar', 'Dëshmia e pronësisë', 'Pëlqimet mjedisore dhe të infrastrukturës'],
        fee: 'Sipas sipërfaqes (m²)',
        deadline: '15 - 30 ditë kalendarike',
        isOnline: true,
        onlineUrl: 'https://ekosova.rks-gov.net'
    },
    {
        id: 'un-2',
        category: 'Urbanizëm & Leje',
        title: 'Legalizimi i Ndërtimeve pa Leje',
        department: 'Drejtoria e Urbanizmit',
        description: 'Përfshirja në regjistrin e trajtimit të ndërtimeve pa leje sipas ligjit në fuqi për legalizim.',
        requirements: ['Fotografitë e objektit nga të gjitha anët', 'Certifikata e pronësisë së truallit', 'Certifikata gjeodezike me matje'],
        fee: '1.00 € / m² për shtëpi banimi',
        deadline: '30 ditë',
        isOnline: false,
        formName: 'Formulari-Legalizimi.pdf'
    },
    // Shërbime Publike & Mbeturina
    {
        id: 'sp-1',
        category: 'Shërbime Publike',
        title: 'Kërkesë për Vendosjen ose Riparimin e Ndriçimit Publik',
        department: 'Drejtoria e Shërbimeve Publike dhe Emergjencës',
        description: 'Raportimi i prishjeve të shtyllave, llambave LED apo kërkesa për zgjerim të rrjetit në lagje dhe fshatra.',
        requirements: ['Adresa e saktë apo pika në hartë', 'Foto e shtyllës ose lokacionit', 'Përshkrim i shkurtër i problemit'],
        fee: 'Falas',
        deadline: '48 - 72 orë',
        isOnline: true
    },
    {
        id: 'sp-2',
        category: 'Shërbime Publike',
        title: 'Orari i Mbeturinave dhe Pastrimi i Deponive Ilegale',
        department: 'Drejtoria e Shërbimeve Publike & Kompania Regjionale',
        description: 'Informacione mbi oraret ditore të largimit të mbeturinave dhe kërkesa për pastrim të hapësirave të ndotura.',
        requirements: ['Lokacioni i saktë', 'Përshkrimi i vëllimit të mbeturinave'],
        fee: 'Falas',
        deadline: '24 - 48 orë',
        isOnline: true
    },
    // Tatimi në Pronë
    {
        id: 'tp-1',
        category: 'Tatimi në Pronë',
        title: 'Verifikimi i Faturës dhe Pagesa e Tatimit në Pronë',
        department: 'Drejtoria për Financa dhe Tatim në Pronë',
        description: 'Kontrolli i gjendjes financiare tatimore, shkarkimi i faturës vjetore dhe pagesa elektronike e menjëhershme.',
        requirements: ['Numri personal i pronarit', 'Numri i llogarisë së pronës'],
        fee: 'Sipas vlerësimit komunal',
        deadline: 'Menjëherë online',
        isOnline: true,
        onlineUrl: 'https://tatimineprone-rks.org'
    },
    {
        id: 'tp-2',
        category: 'Tatimi në Pronë',
        title: 'Certifikatë mbi Pagimin e Detyrimeve Tatimore Komunale',
        department: 'Drejtoria për Financa',
        description: 'Vërtetim zyrtar se qytetari apo biznesi nuk ka borxhe të papaguara ndaj buxhetit komunal.',
        requirements: ['Letërnjoftimi / Certifikata e biznesit', 'Dëshmia e shlyerjes së borxhit'],
        fee: 'Falas',
        deadline: 'Brenda ditës',
        isOnline: true,
        onlineUrl: 'https://ekosova.rks-gov.net'
    },
    // Shëndetësia & QKMF
    {
        id: 'sh-1',
        category: 'Shëndetësi & QKMF',
        title: 'Terminet për Mjekësi Familjare dhe Pediatri në QKMF',
        department: 'Drejtoria për Shëndetësi dhe Mirëqenie Sociale',
        description: 'Caktimi i vizitave të rregullta mjekësore, kontrolleve sistematike dhe vaksinimit të detyrueshëm për fëmijë.',
        requirements: ['Libreza shëndetësore ose Numri personal', 'Kartela e vaksinimit për fëmijë'],
        fee: 'Falas (ose 1.00 € participim)',
        deadline: 'Sipas orarit të lirë',
        isOnline: true
    },
    {
        id: 'sh-2',
        category: 'Shëndetësi & QKMF',
        title: 'Shërbimi Shëndetësor Shtëpiak për Personat e Palëvizshëm',
        department: 'QKMF dhe Kujdesi Parësor Shëndetësor',
        description: 'Ekipet mobile mjekësore për vizita dhe terapi shtëpiake për pacientët e moshuar ose me aftësi të kufizuara.',
        requirements: ['Raporti mjekësor i specialistit', 'Kërkesa nga anëtari i familjes'],
        fee: 'Falas',
        deadline: '24 orë',
        isOnline: false,
        formName: 'Kerkesa-Shendetsore-Shtepiake.pdf'
    },
    // Arsimi & Çerdhet
    {
        id: 'ar-1',
        category: 'Arsim & Çerdhe',
        title: 'Regjistrimi i Fëmijëve në Çerdhet dhe Kopshtet Publike',
        department: 'Drejtoria Komunale e Arsimit (DKA)',
        description: 'Konkursi vjetor dhe regjistrimi online për pranimin e fëmijëve në institucionet parashkollore komunale.',
        requirements: ['Certifikata e lindjes së fëmijës', 'Dëshmia e punësimit të prindërve', 'Vërtetimi i vendbanimit'],
        fee: 'Sipas të ardhurave familjare',
        deadline: 'Gjatë periudhës së konkursit',
        isOnline: true,
        onlineUrl: 'https://ekosova.rks-gov.net'
    },
    {
        id: 'ar-2',
        category: 'Arsim & Çerdhe',
        title: 'Aplikimi për Bursa Komunale për Studentë dhe Nxënës Elitarë',
        department: 'Drejtoria Komunale e Arsimit',
        description: 'Mbështetje financiare vjetore për studentët me sukses të shkëlqyer akademik dhe në fusha deficitare.',
        requirements: ['Certifikata e notave (mesatarja mbi 8.5/9.0)', 'Vërtetimi i regjistrimit të vitit akademik', 'Letërnjoftimi'],
        fee: 'Falas',
        deadline: 'Sipas shpalljes zyrtare',
        isOnline: true,
        onlineUrl: 'https://ekosova.rks-gov.net'
    }
];
const PLATFORM_SERVICES = [
    {
        id: 'platform-report', category: 'Raportime qytetare', title: 'Raporto një problem publik', department: 'Zëri Qytetarëve',
        description: 'Dërgo një raportim me foto, video, lokacion, kategori dhe nivel urgjence te platforma qytetare.',
        requirements: ['Titulli dhe përshkrimi i problemit', 'Lokacioni i saktë në hartë', 'Foto ose video, nëse ka'], fee: 'Falas', deadline: 'Dërgohet menjëherë', isOnline: false
    },
    {
        id: 'platform-track', category: 'Raportime qytetare', title: 'Përcjell raportimin me Track-ID', department: 'Zëri Qytetarëve',
        description: 'Gjej raportimin tënd, shiko statusin dhe historikun e veprimeve nga agjentët, administratorët dhe institucionet.',
        requirements: ['Track-ID i raportimit', 'Kërkimi në regjistrin publik'], fee: 'Falas', deadline: 'Në kohë reale', isOnline: false
    },
    {
        id: 'platform-map', category: 'Transparencë & Harta', title: 'Shiko hartën e problemeve', department: 'Zëri Qytetarëve',
        description: 'Eksploro raportimet e aprovuara në Kosovë me filtra për komunë, kategori, status dhe urgjencë.',
        requirements: ['Zgjidh komunën ose Kosovën', 'Përdor filtrat e hartës'], fee: 'Falas', deadline: 'Në kohë reale', isOnline: false
    },
    {
        id: 'platform-institutions', category: 'Institucione & Agjentë', title: 'Dërgo rastin te përgjegjësi i duhur', department: 'Zëri Qytetarëve',
        description: 'Platforma e klasifikon dhe e orienton problemin te agjentët, administratorët ose institucioni përgjegjës.',
        requirements: ['Kategori e saktë', 'Përshkrim i qartë', 'Komuna e problemit'], fee: 'Falas', deadline: 'Sipas urgjencës', isOnline: false
    },
    {
        id: 'platform-community', category: 'Pjesëmarrje qytetare', title: 'Debat publik dhe sondazhe', department: 'Zëri Qytetarëve',
        description: 'Merr pjesë në diskutime dhe sondazhe për çështje që ndikojnë në komunitetin tënd.',
        requirements: ['Llogari qytetare ose qasje si mysafir', 'Respektimi i rregullave të komunitetit'], fee: 'Falas', deadline: 'Aktive sipas njoftimit', isOnline: false
    },
    {
        id: 'platform-alerts', category: 'Njoftime lokale', title: 'Njoftime sipas komunës', department: 'Zëri Qytetarëve',
        description: 'Zgjidh komunën tënde për të parë raportimet, njoftimet, reklamat dhe informacionet më relevante për zonën.',
        requirements: ['Zgjidh komunën nga Zona juaj', 'Mund të ndryshosh komunën kurdo'], fee: 'Falas', deadline: 'Përditësohet automatikisht', isOnline: false
    }
];
export default function SherbimetPage() {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [rating, setRating] = useState(0);
    const [feedback, setFeedback] = useState('');
    const [isSendingFeedback, setIsSendingFeedback] = useState(false);
    const categories = [
        'all',
        'Raportime qytetare', 'Transparencë & Harta', 'Institucione & Agjentë', 'Pjesëmarrje qytetare', 'Njoftime lokale'
    ];
    const filteredServices = useMemo(() => {
        return PLATFORM_SERVICES.filter(srv => {
            const matchCat = selectedCategory === 'all' || srv.category === selectedCategory;
            const matchSearch = srv.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                srv.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                srv.department.toLowerCase().includes(searchQuery.toLowerCase());
            return matchCat && matchSearch;
        });
    }, [searchQuery, selectedCategory]);
    const handleDownloadStub = (formName) => {
        toast.success(`Formulari ${formName || 'zyrtar'} u përgatit për shkarkim!`);
    };
    const handleFeedbackSubmit = async (event) => {
        event.preventDefault();
        if (!rating || feedback.trim().length < 10) {
            toast.error('Zgjidhni një vlerësim dhe shkruani një sugjerim me të paktën 10 karaktere.');
            return;
        }
        setIsSendingFeedback(true);
        try {
            await addDoc(collection(db, 'platformFeedback'), {
                rating,
                feedback: feedback.trim(),
                source: 'SherbimetPage',
                createdAt: serverTimestamp()
            });
            toast.success('Faleminderit. Sugjerimi juaj u dërgua për shqyrtim.');
            setRating(0);
            setFeedback('');
        }
        catch (error) {
            console.error('Gabim gjatë dërgimit të sugjerimit:', error);
            toast.error('Sugjerimi nuk u dërgua. Provoni përsëri.');
        }
        finally {
            setIsSendingFeedback(false);
        }
    };
    return (_jsx("div", { className: "page-shell min-h-screen bg-(--color-page) dark:bg-(--color-brand-dark) text-slate-800 dark:text-slate-100 py-8 px-4 sm:px-6 lg:px-8", children: _jsxs("div", { className: "max-w-7xl mx-auto space-y-8", children: [_jsxs("div", { className: "bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200/80 dark:border-white/10 shadow-xs relative overflow-hidden", children: [_jsx("div", { className: "absolute -top-10 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" }), _jsxs("div", { className: "flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10", children: [_jsxs("div", { children: [_jsxs("div", { className: "inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 text-xs font-bold border border-blue-200/60 dark:border-blue-900 mb-3", children: [_jsx(FileText, { className: "w-3.5 h-3.5" }), _jsx("span", { children: "Sh\u00EBrbimet e platform\u00EBs" })] }), _jsx("h1", { className: "text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 dark:text-white tracking-tight", children: "Sh\u00EBrbimet e Z\u00EBrit Qytetar\u00EBve" }), _jsx("p", { className: "text-sm sm:text-base text-slate-600 dark:text-slate-400 mt-2 max-w-2xl", children: "Raporto, p\u00EBrcjell, informohu dhe merr pjes\u00EB n\u00EB jet\u00EBn publike t\u00EB komun\u00EBs t\u00EBnde. P\u00EBr sh\u00EBrbimet administrative shtet\u00EBrore p\u00EBrdor e-Kosova." })] }), _jsxs("div", { className: "max-w-xs rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-white/10 p-4", children: [_jsxs("div", { className: "flex items-center gap-2 text-slate-900 dark:text-white font-black text-sm", children: [_jsx(Lightbulb, { className: "w-4 h-4 text-amber-500" }), _jsx("span", { children: "Mendoni se platforma mund t\u00EB b\u00EBhet m\u00EB e mir\u00EB?" })] }), _jsx("p", { className: "text-[11px] text-slate-500 dark:text-slate-400 mt-1.5", children: "Vler\u00EBsoni p\u00EBrvoj\u00EBn dhe ndani nj\u00EB ide q\u00EB na ndihmon t\u2019u sh\u00EBrbejm\u00EB m\u00EB mir\u00EB qytetar\u00EBve." }), _jsxs(Link, { to: "/Idea", className: "mt-3 w-full py-2 bg-[#0b2b57] hover:bg-blue-800 text-white rounded-lg text-xs font-black flex items-center justify-center gap-2", children: ["Jepni nj\u00EB ide ", _jsx(ArrowRight, { className: "w-3.5 h-3.5" })] })] })] })] }), _jsxs("section", { className: "grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-4", children: [_jsxs("div", { className: "rounded-2xl bg-[#0b2b57] p-6 sm:p-8 text-white shadow-lg border border-blue-900/50", children: [_jsx("div", { className: "text-[10px] uppercase tracking-[0.2em] font-black text-blue-200 mb-3", children: "Ideja jon\u00EB" }), _jsx("h2", { className: "text-2xl sm:text-3xl font-black tracking-tight mb-3", children: "Nj\u00EB z\u00EB i vet\u00EBm p\u00EBr \u00E7do problem publik." }), _jsx("p", { className: "text-sm leading-relaxed text-blue-100 max-w-2xl", children: "Z\u00EBri Qytetar\u00EBve \u00EBsht\u00EB platform\u00EB e pjes\u00EBmarrjes publike q\u00EB e kthen nj\u00EB shqet\u00EBsim t\u00EB qytetarit n\u00EB raportim t\u00EB dokumentuar, me lokacion, Track-ID, p\u00EBrgjegj\u00EBs dhe histori veprimesh." }), _jsxs("div", { className: "mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3", children: [_jsxs("div", { className: "rounded-xl bg-white/10 border border-white/10 p-3", children: [_jsx("strong", { className: "block text-lg", children: "01" }), _jsx("span", { className: "text-xs text-blue-100", children: "Raporto" })] }), _jsxs("div", { className: "rounded-xl bg-white/10 border border-white/10 p-3", children: [_jsx("strong", { className: "block text-lg", children: "02" }), _jsx("span", { className: "text-xs text-blue-100", children: "P\u00EBrcjell" })] }), _jsxs("div", { className: "rounded-xl bg-white/10 border border-white/10 p-3", children: [_jsx("strong", { className: "block text-lg", children: "03" }), _jsx("span", { className: "text-xs text-blue-100", children: "Merr p\u00EBrgjigje" })] })] })] }), _jsxs("div", { className: "rounded-2xl bg-white dark:bg-slate-900 p-6 sm:p-8 border border-slate-200/80 dark:border-white/10 shadow-xs", children: [_jsx("div", { className: "text-[10px] uppercase tracking-[0.2em] font-black text-blue-600 mb-3", children: "\u00C7far\u00EB na duhet" }), _jsx("h2", { className: "text-xl font-black text-slate-900 dark:text-white mb-3", children: "Bashk\u00EBpunim q\u00EB prodhon rezultat." }), _jsxs("ul", { className: "space-y-3 text-sm text-slate-600 dark:text-slate-300", children: [_jsxs("li", { children: [_jsx("strong", { className: "text-slate-900 dark:text-white", children: "Qytetar\u00EB aktiv\u00EB:" }), " raportime t\u00EB sakta dhe me d\u00EBshmi."] }), _jsxs("li", { children: [_jsx("strong", { className: "text-slate-900 dark:text-white", children: "Institucione t\u00EB p\u00EBrgjegjshme:" }), " pranim, caktim dhe p\u00EBrdit\u00EBsim i rasteve."] }), _jsxs("li", { children: [_jsx("strong", { className: "text-slate-900 dark:text-white", children: "T\u00EB dh\u00EBna publike:" }), " transparenc\u00EB pa ekspozuar t\u00EB dh\u00EBnat personale."] })] })] })] }), _jsxs("section", { className: "bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-xs overflow-hidden", children: [_jsxs("div", { className: "p-5 sm:p-6 border-b border-slate-100 dark:border-white/5", children: [_jsx("h2", { className: "text-lg font-black text-slate-900 dark:text-white", children: "Kush e ofron sh\u00EBrbimin?" }), _jsx("p", { className: "text-xs text-slate-500 dark:text-slate-400 mt-1", children: "P\u00EBrdorni platform\u00EBn e duhur p\u00EBr k\u00EBrkes\u00EBn tuaj." })] }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full min-w-[680px] text-left text-xs", children: [_jsx("thead", { className: "bg-slate-50 dark:bg-slate-800/70 text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400", children: _jsxs("tr", { children: [_jsx("th", { className: "px-5 py-3 font-black", children: "Platforma" }), _jsx("th", { className: "px-5 py-3 font-black", children: "Q\u00EBllimi" }), _jsx("th", { className: "px-5 py-3 font-black", children: "Statusi" }), _jsx("th", { className: "px-5 py-3 font-black", children: "Veprimi" })] }) }), _jsxs("tbody", { className: "divide-y divide-slate-100 dark:divide-white/5", children: [_jsxs("tr", { children: [_jsx("td", { className: "px-5 py-4 font-black text-blue-700 dark:text-blue-300", children: "Z\u00EBri Qytetar\u00EBve" }), _jsx("td", { className: "px-5 py-4 text-slate-600 dark:text-slate-300", children: "Raportime, Track-ID, harta, transparenc\u00EB dhe pjes\u00EBmarrje qytetare." }), _jsx("td", { className: "px-5 py-4", children: _jsx("span", { className: "rounded-full bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 font-bold text-emerald-700 dark:text-emerald-300", children: "Aktive" }) }), _jsx("td", { className: "px-5 py-4", children: _jsx(Link, { to: "/raporto", className: "font-black text-blue-600 hover:text-blue-700", children: "Raporto nj\u00EB problem" }) })] }), _jsxs("tr", { children: [_jsx("td", { className: "px-5 py-4 font-black text-slate-900 dark:text-white", children: "e-Kosova" }), _jsx("td", { className: "px-5 py-4 text-slate-600 dark:text-slate-300", children: "Sh\u00EBrbime publike shtet\u00EBrore t\u00EB ofruara n\u00EB m\u00EBnyr\u00EB elektronike." }), _jsx("td", { className: "px-5 py-4", children: _jsx("span", { className: "rounded-full bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 font-bold text-emerald-700 dark:text-emerald-300", children: "Portali zyrtar" }) }), _jsx("td", { className: "px-5 py-4", children: _jsx("a", { href: "https://ekosova.rks-gov.net", target: "_blank", rel: "noreferrer", className: "font-black text-blue-600 hover:text-blue-700", children: "Hap e-Kosova" }) })] }), _jsxs("tr", { children: [_jsx("td", { className: "px-5 py-4 font-black text-slate-900 dark:text-white", children: "e-Komuna" }), _jsx("td", { className: "px-5 py-4 text-slate-600 dark:text-slate-300", children: "Sh\u00EBrbime komunale t\u00EB integruara n\u00EB faz\u00EBn e ardhshme t\u00EB projektit." }), _jsx("td", { className: "px-5 py-4", children: _jsx("span", { className: "rounded-full bg-amber-50 dark:bg-amber-950/50 px-2.5 py-1 font-bold text-amber-700 dark:text-amber-300", children: "S\u00EB shpejti" }) }), _jsx("td", { className: "px-5 py-4 text-slate-500 dark:text-slate-400", children: "Nuk \u00EBsht\u00EB ende aktive" })] })] })] }) })] }), _jsx("section", { id: "platform-feedback", className: "scroll-mt-20 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 shadow-xs p-6 sm:p-8", children: _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-[0.8fr_1.2fr] gap-6 items-start", children: [_jsxs("div", { children: [_jsx("div", { className: "text-[10px] uppercase tracking-[0.2em] font-black text-amber-600 mb-3", children: "Z\u00EBri juaj na orienton" }), _jsx("h2", { className: "text-2xl font-black text-slate-900 dark:text-white tracking-tight", children: "\u00C7far\u00EB duhet t\u00EB shtojm\u00EB n\u00EB platform\u00EB?" }), _jsx("p", { className: "text-sm text-slate-600 dark:text-slate-400 leading-relaxed mt-3", children: "Na tregoni \u00E7far\u00EB do ta b\u00EBnte Z\u00EBrin Qytetar\u00EBve m\u00EB t\u00EB dobish\u00EBm: nj\u00EB sh\u00EBrbim t\u00EB ri, nj\u00EB m\u00EBnyr\u00EB m\u00EB t\u00EB mir\u00EB p\u00EBr t\u00EB ndjekur raportimin ose nj\u00EB ide p\u00EBr komun\u00EBn tuaj." })] }), _jsxs("form", { onSubmit: handleFeedbackSubmit, className: "rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-white/10 p-4 sm:p-5", children: [_jsx("label", { className: "block text-xs font-black text-slate-700 dark:text-slate-200 mb-2", children: "Si e vler\u00EBsoni platform\u00EBn?" }), _jsx("div", { className: "flex items-center gap-1 mb-4", "aria-label": "Vler\u00EBsimi nga 1 deri n\u00EB 5", children: [1, 2, 3, 4, 5].map(value => (_jsx("button", { type: "button", onClick: () => setRating(value), "aria-label": `${value} yje`, className: "p-1", children: _jsx(Star, { className: cn('w-6 h-6 transition-colors', value <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-600') }) }, value))) }), _jsx("label", { htmlFor: "platform-feedback-text", className: "block text-xs font-black text-slate-700 dark:text-slate-200 mb-2", children: "Sugjerimi juaj" }), _jsx("textarea", { id: "platform-feedback-text", value: feedback, onChange: event => setFeedback(event.target.value), rows: 4, maxLength: 1000, placeholder: "Shkruani iden\u00EB, nevoj\u00EBn ose p\u00EBrmir\u00EBsimin q\u00EB d\u00EBshironi t\u00EB shihni...", className: "w-full resize-none rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500" }), _jsxs("div", { className: "mt-3 flex items-center justify-between gap-3", children: [_jsx("span", { className: "text-[10px] text-slate-400", children: "Sugjerimet shqyrtohen nga ekipi i platform\u00EBs." }), _jsxs("button", { type: "submit", disabled: isSendingFeedback, className: "shrink-0 inline-flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 px-4 py-2.5 text-xs font-black text-white", children: [_jsx(Send, { className: "w-3.5 h-3.5" }), " ", isSendingFeedback ? 'Duke dërguar...' : 'Dërgo sugjerimin'] })] })] })] }) }), _jsxs("section", { className: "grid grid-cols-1 lg:grid-cols-[230px_1fr] gap-5 items-start", children: [_jsxs("aside", { className: "lg:sticky lg:top-20 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 p-4 shadow-xs", children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsx("h2", { className: "text-sm font-black text-slate-900 dark:text-white", children: "Filtrimi" }), _jsxs("span", { className: "text-[10px] font-bold text-slate-400", children: [filteredServices.length, " rezultate"] })] }), _jsxs("div", { className: "relative mb-4", children: [_jsx(Search, { className: "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" }), _jsx("input", { type: "text", placeholder: "K\u00EBrko sh\u00EBrbim...", value: searchQuery, onChange: event => setSearchQuery(event.target.value), className: "w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-9 pr-3 py-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500" })] }), _jsx("p", { className: "text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2", children: "Fusha" }), _jsx("div", { className: "space-y-1.5", children: categories.map(category => (_jsx("button", { type: "button", onClick: () => setSelectedCategory(category), className: cn('w-full text-left rounded-lg px-3 py-2.5 text-xs font-bold transition-colors', selectedCategory === category ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'), children: category === 'all' ? 'Të gjitha' : category }, category))) })] }), _jsx("div", { className: "grid grid-cols-1 xl:grid-cols-2 gap-5", children: filteredServices.map((service) => (_jsxs("div", { className: "bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-xs hover:shadow-md transition-all p-5 sm:p-6 flex flex-col justify-between", children: [_jsxs("div", { children: [_jsxs("div", { className: "flex items-start justify-between gap-3 mb-3", children: [_jsx("span", { className: "px-2.5 py-1 rounded-md text-[11px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900", children: service.category }), _jsxs("span", { className: "inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-900", children: [_jsx(CheckCircle2, { className: "w-3 h-3" }), _jsx("span", { children: "Sh\u00EBrbim i Z\u00EBrit Qytetar\u00EBve" })] })] }), _jsx("h3", { className: "text-base sm:text-lg font-black text-slate-900 dark:text-white leading-tight mb-1.5", children: service.title }), _jsx("div", { className: "text-xs font-semibold text-slate-500 dark:text-slate-400 mb-3", children: service.department }), _jsx("p", { className: "text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-4", children: service.description }), _jsxs("div", { className: "bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3.5 border border-slate-100 dark:border-white/5 mb-4", children: [_jsx("span", { className: "text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-2", children: "\u00C7far\u00EB nevojitet:" }), _jsx("ul", { className: "space-y-1.5 text-xs text-slate-600 dark:text-slate-400", children: service.requirements.map((req, i) => (_jsxs("li", { className: "flex items-start gap-2", children: [_jsx("span", { className: "w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" }), _jsx("span", { children: req })] }, i))) })] }), _jsxs("div", { className: "grid grid-cols-2 gap-2 text-xs mb-4", children: [_jsxs("div", { className: "flex items-center gap-2 text-slate-600 dark:text-slate-400", children: [_jsx(DollarSign, { className: "w-4 h-4 text-emerald-600 shrink-0" }), _jsxs("span", { children: ["Tarifa: ", _jsx("strong", { className: "text-slate-900 dark:text-white", children: service.fee })] })] }), _jsxs("div", { className: "flex items-center gap-2 text-slate-600 dark:text-slate-400", children: [_jsx(Clock, { className: "w-4 h-4 text-blue-600 shrink-0" }), _jsxs("span", { children: ["Afati: ", _jsx("strong", { className: "text-slate-900 dark:text-white", children: service.deadline })] })] })] })] }), _jsx("div", { className: "pt-4 border-t border-slate-100 dark:border-white/5 flex items-center justify-between gap-3", children: service.isOnline && service.onlineUrl ? (_jsxs("a", { href: service.onlineUrl, target: "_blank", rel: "noreferrer", className: "w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-2xs", children: [_jsx("span", { children: "Apliko Menj\u00EBher\u00EB" }), _jsx(ExternalLink, { className: "w-3.5 h-3.5" })] })) : service.formName ? (_jsxs("button", { onClick: () => handleDownloadStub(service.formName), className: "w-full py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer", children: [_jsx(Download, { className: "w-3.5 h-3.5" }), _jsx("span", { children: "Shkarko Formularin PDF" })] })) : (_jsxs("button", { onClick: () => navigate('/raporto'), className: "w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer", children: [_jsx("span", { children: "Paraqit K\u00EBrkes\u00EBn n\u00EB Platform\u00EB" }), _jsx(ArrowRight, { className: "w-3.5 h-3.5" })] })) })] }, service.id))) })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsxs("div", { className: "bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-white/10 p-5 shadow-xs", children: [_jsx("h3", { className: "text-base font-black text-slate-900 dark:text-white mb-2", children: "Sh\u00EBrbime administrative: e-Kosova" }), _jsx("p", { className: "text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-4", children: "P\u00EBr certifikata, dokumente personale, tatime dhe aplikime shtet\u00EBrore, p\u00EBrdorni portalin zyrtar e-Kosova. Z\u00EBri Qytetar\u00EBve ju orienton, por nuk e z\u00EBvend\u00EBson portalin shtet\u00EBror." }), _jsxs("a", { href: "https://ekosova.rks-gov.net", target: "_blank", rel: "noreferrer", className: "inline-flex items-center gap-2 text-xs font-black text-blue-600 hover:text-blue-700", children: ["Hap e-Kosova ", _jsx(ExternalLink, { className: "w-3.5 h-3.5" })] })] }), _jsxs("div", { className: "bg-blue-950 rounded-2xl border border-blue-800/60 p-5 shadow-xs text-white", children: [_jsx("h3", { className: "text-base font-black mb-2", children: "e-Komuna: s\u00EB shpejti" }), _jsx("p", { className: "text-xs text-blue-100 leading-relaxed", children: "Pas p\u00EBrfundimit t\u00EB projektit, e-Komuna do t\u00EB sjell\u00EB sh\u00EBrbime komunale t\u00EB integruara. Deri at\u00EBher\u00EB, p\u00EBrdorni Z\u00EBrin Qytetar\u00EBve p\u00EBr raportime, transparenc\u00EB dhe pjes\u00EBmarrje." })] })] }), _jsxs("div", { className: "bg-gradient-to-r from-blue-900 via-blue-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white flex flex-col sm:flex-row items-center justify-between gap-6 border border-blue-800/40 shadow-md", children: [_jsxs("div", { className: "space-y-1 text-center sm:text-left", children: [_jsx("h3", { className: "text-lg font-black", children: "Keni nevoj\u00EB p\u00EBr ndihm\u00EB?" }), _jsx("p", { className: "text-xs sm:text-sm text-blue-200 max-w-xl", children: "P\u00EBr nj\u00EB problem publik, p\u00EBrdorni raportimin n\u00EB Z\u00EBrin Qytetar\u00EBve. P\u00EBr kontakte dhe numra institucional\u00EB, shikoni qendr\u00EBn e kontakteve." })] }), _jsx(Link, { to: "/kontakt", className: "px-5 py-2.5 bg-white text-blue-950 hover:bg-blue-50 rounded-xl text-xs font-black shrink-0 transition-all shadow-sm", children: "Shih Kontaktet" })] })] }) }));
}
