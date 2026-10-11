import { create } from 'zustand';
import { persist } from 'zustand/middleware';
// Referenced through the bundler rather than as a literal path, so Vite copies
// the file into dist/assets with a content hash. A '/src/...' string resolves in
// the dev server and 404s in production.
import festaAdImage from '../assets/images/festa_qytetit_ad_1789826607925.jpg';
export const DEMO_CITIZEN_USER = {
    id: 'demo-bardh',
    name: 'Bardh Qytetar',
    email: 'bardh@kosova.com',
    phone: '049 111 111',
    role: 'citizen',
    points: 4820,
    badges: ['Qytetar Aktiv ⚡', 'Mbrojtës i Komunitetit 🛡️', 'Ambasador i Kosovës 🌟'],
    avatar: 'https://ui-avatars.com/api/?name=Bardh+Qytetar&background=0D8ABC&color=fff',
    isVerified: true,
    trustScore: 96,
};
export const DEMO_REPORTS = [
    {
        id: 'demo-report-101',
        trackingId: 'ZQ-101',
        title: 'Gropa të mëdha në rrugën e kryeqytetit',
        description: 'Përkeqësim i rëndë i shtratit rrugor dhe rrezik për automjetet dhe këmbësorët pranë qendrës.',
        category: 'Infrastrukturë rrugore',
        urgency: 'Kritike',
        location: { lat: 42.6629, lng: 21.1655, address: 'Qendra, Prishtinë', municipality: 'Prishtinë' },
        images: [],
        status: 'In Progress',
        createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
        upvotes: 136,
        commentsCount: 12,
        authorId: 'demo-bardh',
        authorName: 'Bardh Qytetar',
        isAnonymous: false,
        timeline: [{ id: 't1', status: 'In Progress', date: new Date(Date.now() - 1000 * 60 * 45).toISOString(), updatedBy: 'Sistemi' }],
    },
    {
        id: 'demo-report-102',
        trackingId: 'ZQ-102',
        title: 'Ndriçim publik i dëmtuar në lagje',
        description: 'Një shtyllë ndriçimi me defekt ka mbetur pa energji dhe e bën zonën të rrezikshme për pastruesit dhe qytetarët.',
        category: 'Ndriçim publik',
        urgency: 'E lartë',
        location: { lat: 42.4647, lng: 21.4681, address: 'Lagja e Re, Gjilan', municipality: 'Gjilan' },
        images: [],
        status: 'Approved',
        createdAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
        upvotes: 98,
        commentsCount: 9,
        authorId: 'demo-bardh',
        authorName: 'Bardh Qytetar',
        isAnonymous: false,
        timeline: [{ id: 't2', status: 'Approved', date: new Date(Date.now() - 1000 * 60 * 90).toISOString(), updatedBy: 'Sistemi' }],
    },
    {
        id: 'demo-report-103',
        trackingId: 'ZQ-103',
        title: 'Kanalizim i bllokuar drejtuar qendrës',
        description: 'Kanalizimi është i bllokuar nga mbeturina e përmbytur; ka risk për rrjedhje dhe mbrojtje të dobët të infrastruktures.',
        category: 'Ujë & Kanalizim',
        urgency: 'Mesatare',
        location: { lat: 42.2139, lng: 20.7397, address: 'Qendra, Prizren', municipality: 'Prizren' },
        images: [],
        status: 'Pending Review',
        createdAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
        upvotes: 71,
        commentsCount: 5,
        authorId: 'demo-bardh',
        authorName: 'Bardh Qytetar',
        isAnonymous: false,
        timeline: [{ id: 't3', status: 'Pending Review', date: new Date(Date.now() - 1000 * 60 * 120).toISOString(), updatedBy: 'Sistemi' }],
    },
    {
        id: 'demo-report-104',
        trackingId: 'ZQ-104',
        title: 'Trotuare të dëmtuara pranë shkolles',
        description: 'Mungesë e trotuarëve të sigurta në zonën e shkollës, me rrezik për fëmijë dhe këmbësorë.',
        category: 'Trotuarë',
        urgency: 'E lartë',
        location: { lat: 42.8857, lng: 20.8676, address: 'Shkolla e Mesme, Mitrovicë', municipality: 'Mitrovicë' },
        images: [],
        status: 'Assigned',
        createdAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
        upvotes: 83,
        commentsCount: 7,
        authorId: 'demo-bardh',
        authorName: 'Bardh Qytetar',
        isAnonymous: false,
        timeline: [{ id: 't4', status: 'Assigned', date: new Date(Date.now() - 1000 * 60 * 180).toISOString(), updatedBy: 'Sistemi' }],
    },
    {
        id: 'demo-report-105',
        trackingId: 'ZQ-105',
        title: 'Pastrimi i parkut në qendër mbetet i braktisur',
        description: 'Parku qendror ka mbetur me mbeturina, shishe dhe materiale të hedhura duke kërcënuar higjienën publike.',
        category: 'Mjedis & Pastrim',
        urgency: 'Mesatare',
        location: { lat: 42.6698, lng: 21.1595, address: 'Parku Qendror, Prishtinë', municipality: 'Prishtinë' },
        images: [],
        status: 'Resolved',
        createdAt: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
        upvotes: 110,
        commentsCount: 14,
        authorId: 'demo-bardh',
        authorName: 'Bardh Qytetar',
        isAnonymous: false,
        timeline: [{ id: 't5', status: 'Resolved', date: new Date(Date.now() - 1000 * 60 * 240).toISOString(), updatedBy: 'Sistemi' }],
    },
    {
        id: 'demo-report-106',
        trackingId: 'ZQ-106',
        title: 'Rrezik në tabelat e trafikut',
        description: 'Tabela e trafikut dhe sinjalizimi janë të dëmtuar dhe e bëjnë rrugën të pasigurt për qarkullim.',
        category: 'Siguri rrugore',
        urgency: 'E lartë',
        location: { lat: 42.6593, lng: 20.2887, address: 'Rruga e Lidhjes, Pejë', municipality: 'Pejë' },
        images: [],
        status: 'In Progress',
        createdAt: new Date(Date.now() - 1000 * 60 * 300).toISOString(),
        upvotes: 64,
        commentsCount: 6,
        authorId: 'demo-bardh',
        authorName: 'Bardh Qytetar',
        isAnonymous: false,
        timeline: [{ id: 't6', status: 'In Progress', date: new Date(Date.now() - 1000 * 60 * 300).toISOString(), updatedBy: 'Sistemi' }],
    },
    {
        id: 'demo-report-107',
        trackingId: 'ZQ-107',
        title: 'Pikë e përzierjes së mbeturinave në zonë banimi',
        description: 'Aksesi i banorëve po ndikohet nga depozitimi i mbeturinave në një zonë të përditshme, gati pranë banesave.',
        category: 'Mbeturinat urbane',
        urgency: 'Mesatare',
        location: { lat: 42.3820, lng: 20.8269, address: 'Lagja B, Gjakovë', municipality: 'Gjakovë' },
        images: [],
        status: 'Approved',
        createdAt: new Date(Date.now() - 1000 * 60 * 360).toISOString(),
        upvotes: 57,
        commentsCount: 4,
        authorId: 'demo-bardh',
        authorName: 'Bardh Qytetar',
        isAnonymous: false,
        timeline: [{ id: 't7', status: 'Approved', date: new Date(Date.now() - 1000 * 60 * 360).toISOString(), updatedBy: 'Sistemi' }],
    },
    {
        id: 'demo-report-108',
        trackingId: 'ZQ-108',
        title: 'Përkeqësim i rrënjëve dhe trotuarit',
        description: 'Zona në oborrin e lagjes ka çarje dhe nivelim të dobët, duke ndërprerë qasjen e këmbësorëve.',
        category: 'Infrastrukturë publike',
        urgency: 'E ulët',
        location: { lat: 42.3801, lng: 21.1480, address: 'Oborri, Ferizaj', municipality: 'Ferizaj' },
        images: [],
        status: 'Resolved',
        createdAt: new Date(Date.now() - 1000 * 60 * 420).toISOString(),
        upvotes: 39,
        commentsCount: 3,
        authorId: 'demo-bardh',
        authorName: 'Bardh Qytetar',
        isAnonymous: false,
        timeline: [{ id: 't8', status: 'Resolved', date: new Date(Date.now() - 1000 * 60 * 420).toISOString(), updatedBy: 'Sistemi' }],
    },
    {
        id: 'demo-report-109',
        trackingId: 'ZQ-109',
        title: 'Pastrimi i rrugës pranë shkollës në Vushtrri',
        description: 'Përkeqësim i mbeturinave dhe mbulim i dobët i terrenit pranë shkollës, me rrezik për nxënësit dhe kalimtarët.',
        category: 'Mbeturinat urbane',
        urgency: 'Mesatare',
        location: { lat: 42.8230, lng: 20.9672, address: 'Rruga e Shkollës, Vushtrri', municipality: 'Vushtrri' },
        images: [],
        status: 'Approved',
        createdAt: new Date(Date.now() - 1000 * 60 * 480).toISOString(),
        upvotes: 58,
        commentsCount: 6,
        authorId: 'demo-bardh',
        authorName: 'Bardh Qytetar',
        isAnonymous: false,
        timeline: [{ id: 't9', status: 'Approved', date: new Date(Date.now() - 1000 * 60 * 480).toISOString(), updatedBy: 'Sistemi' }],
    },
    {
        id: 'demo-report-110',
        trackingId: 'ZQ-110',
        title: 'Ndotja e ajrit për shkak të djegies së mbeturinave',
        description: 'Djegia e mbeturinave në zonën e periferiës çon në erë të keqe dhe rrezik të konsiderueshëm për banorët e afërt.',
        category: 'Mjedis & Pastrim',
        urgency: 'E lartë',
        location: { lat: 42.4617, lng: 21.4691, address: 'Periferia, Gjilan', municipality: 'Gjilan' },
        images: [],
        status: 'In Progress',
        createdAt: new Date(Date.now() - 1000 * 60 * 540).toISOString(),
        upvotes: 92,
        commentsCount: 11,
        authorId: 'demo-bardh',
        authorName: 'Bardh Qytetar',
        isAnonymous: false,
        timeline: [{ id: 't10', status: 'In Progress', date: new Date(Date.now() - 1000 * 60 * 540).toISOString(), updatedBy: 'Sistemi' }],
    },
    {
        id: 'demo-report-111',
        trackingId: 'ZQ-111',
        title: 'Rrjedhje e ujit në një lagje të kufirit',
        description: 'Rrjedhja e ujit nga tubacioni ka krijuar një zonë të rrezikshme dhe po ndikon në qasjen në banesa.',
        category: 'Ujë & Kanalizim',
        urgency: 'Kritike',
        location: { lat: 42.3804, lng: 20.4308, address: 'Lagja e Qendrës, Gjakovë', municipality: 'Gjakovë' },
        images: [],
        status: 'Approved',
        createdAt: new Date(Date.now() - 1000 * 60 * 600).toISOString(),
        upvotes: 108,
        commentsCount: 13,
        authorId: 'demo-bardh',
        authorName: 'Bardh Qytetar',
        isAnonymous: false,
        timeline: [{ id: 't11', status: 'Approved', date: new Date(Date.now() - 1000 * 60 * 600).toISOString(), updatedBy: 'Sistemi' }],
    },
    {
        id: 'demo-report-112',
        trackingId: 'ZQ-112',
        title: 'Ndriçim publik i prishur tek kopshti i qytetit',
        description: 'Lule të dëmtuara dhe shtylla pa ndriçim të duhur, me rrezik për kalimtarët dhe fëmijët në orët e mbrëmjes.',
        category: 'Ndriçim publik',
        urgency: 'E lartë',
        location: { lat: 42.8922, lng: 20.8666, address: 'Parku Qendror, Mitrovicë', municipality: 'Mitrovicë' },
        images: [],
        status: 'Resolved',
        createdAt: new Date(Date.now() - 1000 * 60 * 660).toISOString(),
        upvotes: 76,
        commentsCount: 8,
        authorId: 'demo-bardh',
        authorName: 'Bardh Qytetar',
        isAnonymous: false,
        timeline: [{ id: 't12', status: 'Resolved', date: new Date(Date.now() - 1000 * 60 * 660).toISOString(), updatedBy: 'Sistemi' }],
    },
    {
        id: 'demo-report-113',
        trackingId: 'ZQ-113',
        title: 'Shteg i dëmtuar pranë parkut familjar',
        description: 'Pjesa e shtegujve në park ka çarje dhe kontejnerë të pjekur, duke krijuar rrezik për fëmijët dhe qytetarët e moshuar.',
        category: 'Trotuarë',
        urgency: 'Mesatare',
        location: { lat: 42.6590, lng: 21.1538, address: 'Parku Familjar, Prishtinë', municipality: 'Prishtinë' },
        images: [],
        status: 'Approved',
        createdAt: new Date(Date.now() - 1000 * 60 * 720).toISOString(),
        upvotes: 71,
        commentsCount: 5,
        authorId: 'demo-bardh',
        authorName: 'Bardh Qytetar',
        isAnonymous: false,
        timeline: [{ id: 't13', status: 'Approved', date: new Date(Date.now() - 1000 * 60 * 720).toISOString(), updatedBy: 'Sistemi' }],
    },
    {
        id: 'demo-report-114',
        trackingId: 'ZQ-114',
        title: 'Të bardha e rrugës në zonën industriale',
        description: 'Shenja e trafikut është e shkatërruar dhe ka një lëkundje të madhe të ngjyrës, me rrezik për kalimtarët gjatë natës.',
        category: 'Siguri rrugore',
        urgency: 'Kritike',
        location: { lat: 42.6737, lng: 21.1779, address: 'Zona Industriale, Prishtinë', municipality: 'Prishtinë' },
        images: [],
        status: 'In Progress',
        createdAt: new Date(Date.now() - 1000 * 60 * 780).toISOString(),
        upvotes: 119,
        commentsCount: 13,
        authorId: 'demo-bardh',
        authorName: 'Bardh Qytetar',
        isAnonymous: false,
        timeline: [{ id: 't14', status: 'In Progress', date: new Date(Date.now() - 1000 * 60 * 780).toISOString(), updatedBy: 'Sistemi' }],
    },
    {
        id: 'demo-report-115',
        trackingId: 'ZQ-115',
        title: 'Mbushje e ujit në rrjetin e lagjes',
        description: 'Nxehtësia e ujit dhe rrjedhjet e vazhdueshme kanë kërcënuar banesat në zonën me lartësi të ndryshme.',
        category: 'Ujë & Kanalizim',
        urgency: 'E lartë',
        location: { lat: 42.2165, lng: 20.7484, address: 'Lagja e Shadërvanit, Prizren', municipality: 'Prizren' },
        images: [],
        status: 'Assigned',
        createdAt: new Date(Date.now() - 1000 * 60 * 840).toISOString(),
        upvotes: 88,
        commentsCount: 7,
        authorId: 'demo-bardh',
        authorName: 'Bardh Qytetar',
        isAnonymous: false,
        timeline: [{ id: 't15', status: 'Assigned', date: new Date(Date.now() - 1000 * 60 * 840).toISOString(), updatedBy: 'Sistemi' }],
    },
    {
        id: 'demo-report-116',
        trackingId: 'ZQ-116',
        title: 'Deponi i mbeturinave pranë rrugës rurale',
        description: 'Mbeturinat e hedhura në zonën rurale po shkaktojnë erë të keqe dhe po dëmtojnë sipërfaqen e tokës.',
        category: 'Mjedis & Pastrim',
        urgency: 'Mesatare',
        location: { lat: 42.4610, lng: 21.4710, address: 'Rruga e Deponisë, Gjilan', municipality: 'Gjilan' },
        images: [],
        status: 'Approved',
        createdAt: new Date(Date.now() - 1000 * 60 * 900).toISOString(),
        upvotes: 63,
        commentsCount: 4,
        authorId: 'demo-bardh',
        authorName: 'Bardh Qytetar',
        isAnonymous: false,
        timeline: [{ id: 't16', status: 'Approved', date: new Date(Date.now() - 1000 * 60 * 900).toISOString(), updatedBy: 'Sistemi' }],
    },
    {
        id: 'demo-report-117',
        trackingId: 'ZQ-117',
        title: 'Dyqan i shkatërruar në qendër',
        description: 'Aksesimi dhe arkitekturë e zyrtarisë janë të dëmtuara, duke detyruar qytetarët të përdorin një rrugë alternative.',
        category: 'Infrastrukturë publike',
        urgency: 'E ulët',
        location: { lat: 42.6596, lng: 20.2883, address: 'Qendra, Pejë', municipality: 'Pejë' },
        images: [],
        status: 'Resolved',
        createdAt: new Date(Date.now() - 1000 * 60 * 960).toISOString(),
        upvotes: 46,
        commentsCount: 3,
        authorId: 'demo-bardh',
        authorName: 'Bardh Qytetar',
        isAnonymous: false,
        timeline: [{ id: 't17', status: 'Resolved', date: new Date(Date.now() - 1000 * 60 * 960).toISOString(), updatedBy: 'Sistemi' }],
    },
    {
        id: 'demo-report-118',
        trackingId: 'ZQ-118',
        title: 'Rrjedhje e ujit pranë shkollës',
        description: 'Uji po rrjedh nga pusi i ujit dhe ndikon në qasjen e nxënësve dhe mjedisin e shkollës.',
        category: 'Ujë & Kanalizim',
        urgency: 'E lartë',
        location: { lat: 42.3805, lng: 20.4280, address: 'Shkolla e Mesme, Gjakovë', municipality: 'Gjakovë' },
        images: [],
        status: 'In Progress',
        createdAt: new Date(Date.now() - 1000 * 60 * 1020).toISOString(),
        upvotes: 82,
        commentsCount: 8,
        authorId: 'demo-bardh',
        authorName: 'Bardh Qytetar',
        isAnonymous: false,
        timeline: [{ id: 't18', status: 'In Progress', date: new Date(Date.now() - 1000 * 60 * 1020).toISOString(), updatedBy: 'Sistemi' }],
    },
    {
        id: 'demo-report-119',
        trackingId: 'ZQ-119',
        title: 'Korrupsioni i kabllove elektrike',
        description: 'Kabllot elektrike të paqarta dhe të mbuluara me mbeturina po krijojnë rrezik të madh në zonë publike.',
        category: 'Ndriçim publik',
        urgency: 'Kritike',
        location: { lat: 42.8885, lng: 20.8710, address: 'Rruga e Qendrës, Mitrovicë', municipality: 'Mitrovicë' },
        images: [],
        status: 'Pending Review',
        createdAt: new Date(Date.now() - 1000 * 60 * 1080).toISOString(),
        upvotes: 104,
        commentsCount: 9,
        authorId: 'demo-bardh',
        authorName: 'Bardh Qytetar',
        isAnonymous: false,
        timeline: [{ id: 't19', status: 'Pending Review', date: new Date(Date.now() - 1000 * 60 * 1080).toISOString(), updatedBy: 'Sistemi' }],
    },
    {
        id: 'demo-report-120',
        trackingId: 'ZQ-120',
        title: 'Vëzhgim i dobët i shesheve në periferi',
        description: 'Fshati po përballet me problemin e parakohshëm të mbetjeve dhe ngarkesave të çrregullta.',
        category: 'Mbeturinat urbane',
        urgency: 'Mesatare',
        location: { lat: 42.3704, lng: 21.1540, address: 'Periferia, Ferizaj', municipality: 'Ferizaj' },
        images: [],
        status: 'Resolved',
        createdAt: new Date(Date.now() - 1000 * 60 * 1140).toISOString(),
        upvotes: 54,
        commentsCount: 4,
        authorId: 'demo-bardh',
        authorName: 'Bardh Qytetar',
        isAnonymous: false,
        timeline: [{ id: 't20', status: 'Resolved', date: new Date(Date.now() - 1000 * 60 * 1140).toISOString(), updatedBy: 'Sistemi' }],
    },
    {
        id: 'demo-report-121',
        trackingId: 'ZQ-121',
        title: 'Rruga e vështirë për kalim në lagjen e vjetër',
        description: 'Përkeqësimi i rrugës në lagjen e vjetër bën që kalimi të jetë i rrezikshëm për qytetarët dhe fëmijët.',
        category: 'Infrastrukturë rrugore',
        urgency: 'E lartë',
        location: { lat: 42.8235, lng: 20.9688, address: 'Lagja e Vjetër, Vushtrri', municipality: 'Vushtrri' },
        images: [],
        status: 'In Progress',
        createdAt: new Date(Date.now() - 1000 * 60 * 1200).toISOString(),
        upvotes: 77,
        commentsCount: 6,
        authorId: 'demo-bardh',
        authorName: 'Bardh Qytetar',
        isAnonymous: false,
        timeline: [{ id: 't21', status: 'In Progress', date: new Date(Date.now() - 1000 * 60 * 1200).toISOString(), updatedBy: 'Sistemi' }],
    },
];
export const DEMO_PUBLIC_POSTS = [
    {
        id: 'demo-public-post-1',
        authorId: 'demo-bardh',
        authorName: 'Bardh Qytetar',
        authorRole: 'citizen',
        authorBadge: 'Qytetar Aktiv',
        authorAvatar: 'https://ui-avatars.com/api/?name=Bardh+Qytetar&background=0D8ABC&color=fff',
        content: 'Raportim publik: Gropa në rrugën kryesore të qendrës po rrisin rrezikun për automjete dhe këmbësorë. Kërkohet ndërhyrje e menjëhershme nga komuna.',
        category: 'infrastrukture',
        neighborhood: 'Prishtinë',
        likes: ['u1', 'u2', 'u3', 'u4', 'u5', 'u6'],
        comments: [
            {
                id: 'demo-post-c1',
                authorId: 'u7',
                authorName: 'Naim Gashi',
                authorAvatar: 'https://ui-avatars.com/api/?name=Naim+Gashi',
                content: 'Kjo zonë ka pësuar të njëjtat probleme edhe për disa javë.',
                createdAt: new Date().toISOString(),
                replies: []
            }
        ],
        aiSentiment: {
            positivePct: 62,
            negativePct: 26,
            neutralPct: 12,
            summaryText: 'Qytetarët e mbështesin ndërhyrjen e menjëhershme, me fokus në sigurinë e rrugës dhe përmirësimin e infrastrukturës.'
        },
        createdAt: new Date(Date.now() - 1000 * 60 * 45)
    },
    {
        id: 'demo-public-post-2',
        authorId: 'komuna-admin',
        authorName: 'Komuna e Prishtinës',
        authorRole: 'admin',
        authorBadge: 'Zyrtar Komunal',
        authorAvatar: 'https://ui-avatars.com/api/?name=Komuna+Prishtines&background=0D8ABC&color=fff',
        content: 'DEBAT PUBLIK: A mbështetni krijimin e një zone të re këmbore në qendër për të reduktuar trafikun dhe përmirësuar ajrin?',
        category: 'transport',
        neighborhood: 'Qendra',
        likes: ['u8', 'u9', 'u10', 'u11'],
        comments: [
            {
                id: 'demo-post-c2',
                authorId: 'u12',
                authorName: 'Arta Berisha',
                authorAvatar: 'https://ui-avatars.com/api/?name=Arta+Berisha',
                content: 'Propozimi është i mirë, por duhet të ketë edhe parkingje të përshtatshme në hyrje.',
                createdAt: new Date().toISOString(),
                replies: []
            }
        ],
        poll: {
            question: 'A duhet të zgjerohet zona këmbore në qendër?',
            totalVotes: 342,
            options: [
                { id: 'opt-1', text: 'Po, plotësisht', votes: Array(192).fill('voter') },
                { id: 'opt-2', text: 'Po, me kusht', votes: Array(98).fill('voter') },
                { id: 'opt-3', text: 'Jo, do të ngrejë trafik', votes: Array(52).fill('voter') }
            ]
        },
        aiSentiment: {
            positivePct: 71,
            negativePct: 18,
            neutralPct: 11,
            summaryText: 'Shumica e pjesëmarrësve mbështesin rritjen e hapësirës këmbore, me rezervë për qarkullimin dhe parkimin e automjeteve.'
        },
        createdAt: new Date(Date.now() - 1000 * 60 * 120)
    },
    {
        id: 'demo-public-post-3',
        authorId: 'demo-bardh',
        authorName: 'Bardh Qytetar',
        authorRole: 'citizen',
        authorBadge: 'Qytetar Aktiv',
        authorAvatar: 'https://ui-avatars.com/api/?name=Bardh+Qytetar&background=0D8ABC&color=fff',
        content: 'Raportim publik: Ndriçimi në lagjen e re ka qenë i dobët për më shumë se një javë. Kërkohet zgjidhje urgjente për sigurinë e banorëve.',
        category: 'shendetesi',
        neighborhood: 'Gjilan',
        likes: ['u1', 'u2', 'u3', 'u4'],
        comments: [],
        aiSentiment: {
            positivePct: 58,
            negativePct: 29,
            neutralPct: 13,
            summaryText: 'Gjetja tregon një shqetësim të fortë për sigurinë publike dhe pamundësinë e banorëve të lundrojnë në zonë pa ndriçim adekuat.'
        },
        createdAt: new Date(Date.now() - 1000 * 60 * 180)
    },
    {
        id: 'demo-public-post-4',
        authorId: 'demo-bardh',
        authorName: 'Bardh Qytetar',
        authorRole: 'citizen',
        authorBadge: 'Qytetar Aktiv',
        authorAvatar: 'https://ui-avatars.com/api/?name=Bardh+Qytetar&background=0D8ABC&color=fff',
        content: 'Raportim publik: Mbeturinat në parkun qendror po grumbullohen dhe po ndikojnë negativisht në higjienën publike dhe cilësinë e ajrit.',
        category: 'mjedis',
        neighborhood: 'Pejë',
        likes: ['u5', 'u6', 'u7', 'u8', 'u9'],
        comments: [
            {
                id: 'demo-post-c3',
                authorId: 'u10',
                authorName: 'Drenit Kelmendi',
                authorAvatar: 'https://ui-avatars.com/api/?name=Drenit+Kelmendi',
                content: 'Kjo duhet të zgjidhet menjëherë, veçanërisht në zonat ku fëmijët e luajnë.',
                createdAt: new Date().toISOString(),
                replies: []
            }
        ],
        aiSentiment: {
            positivePct: 66,
            negativePct: 22,
            neutralPct: 12,
            summaryText: 'Përqendrimi i përgjigjeve tregon një nevojë të qartë për pastrim dhe kontroll më të rregullt të depozitimit të mbeturinave publike.'
        },
        createdAt: new Date(Date.now() - 1000 * 60 * 240)
    },
    {
        id: 'demo-public-post-5',
        authorId: 'komuna-admin',
        authorName: 'Komuna e Prizrenit',
        authorRole: 'admin',
        authorBadge: 'Zyrtar Komunal',
        authorAvatar: 'https://ui-avatars.com/api/?name=Komuna+Prizrenit&background=0D8ABC&color=fff',
        content: 'Përditësim institucional: Filloi programi i inspektimit të trotuarëve dhe rrugëve në zonat me shkallë më të lartë rreziku.',
        category: 'infrastrukture',
        neighborhood: 'Prizren',
        likes: ['u1', 'u2', 'u3', 'u4', 'u5'],
        comments: [],
        aiSentiment: {
            positivePct: 74,
            negativePct: 14,
            neutralPct: 12,
            summaryText: 'Qytetarët i mirëpresin përditësimet institucionale për bashkëpunim, transparencë dhe koordinim me zonat e prekura.'
        },
        createdAt: new Date(Date.now() - 1000 * 60 * 300)
    }
];
export const useStore = create()(persist((set, get) => ({
    currentUser: null,
    userMunicipality: null,
    setUserMunicipality: (city) => set({ userMunicipality: city }),
    isBotOpen: false,
    botInitialQuery: null,
    openBot: (query) => set({ isBotOpen: true, botInitialQuery: query || null }),
    closeBot: () => set({ isBotOpen: false, botInitialQuery: null }),
    users: [],
    reports: [],
    reportsStatus: 'loading',
    reportsError: null,
    polls: [
        {
            id: 'poll-001',
            question: 'Ku mendoni se duhet të investohet më shumë nga buxheti i komunës këtë vit?',
            description: 'Zgjidhni një prioritet që ndikon më shumë në cilësinë e jetës së qytetarëve.',
            options: [
                { id: 'opt-1', text: 'Ndriçim publik dhe siguri', votes: 84 },
                { id: 'opt-2', text: 'Rrugë dhe trotuare', votes: 142 },
                { id: 'opt-3', text: 'Parqe dhe gjelbërim', votes: 97 },
                { id: 'opt-4', text: 'Shkolla dhe çerdhe', votes: 115 }
            ],
            totalVotes: 438,
            createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
            expiresAt: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString(),
            createdBy: 'admin',
            category: 'Investime'
        },
        {
            id: 'poll-002',
            question: 'A jeni të kënaqur me menaxhimin e mbeturinave në lagjen tuaj?',
            description: 'Ndihmoni ekipin e pastrimit dhe inspektimit të identifikojë sfidat më të rëndësishme.',
            options: [
                { id: 'opt-a', text: 'Po, shumë të kënaqur', votes: 45 },
                { id: 'opt-b', text: 'Mesatarisht, ka vend për përmirësim', votes: 122 },
                { id: 'opt-c', text: 'Jo, jemi shumë të pakënaqur', votes: 94 }
            ],
            totalVotes: 261,
            createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
            expiresAt: new Date(Date.now() + 27 * 24 * 60 * 60 * 1000).toISOString(),
            createdBy: 'admin',
            category: 'Mjedis'
        },
        {
            id: 'poll-003',
            question: 'Cili është modelin më efektiv për rritjen e pjesëmarrjes qytetare në vendimmarrje?',
            description: 'Ndërsa qyteti zhvillon mekanizma më të hapura, zbulo preferencën e komunitetit.',
            options: [
                { id: 'opt-1', text: 'Sondazhe online dhe konsultime të shkurtra', votes: 188 },
                { id: 'opt-2', text: 'Takime lokale me qytetarët', votes: 132 },
                { id: 'opt-3', text: 'Forum i hapur për ide dhe propozime', votes: 154 },
                { id: 'opt-4', text: 'Pjesëmarrje direkte në buxhet', votes: 210 }
            ],
            totalVotes: 684,
            createdAt: new Date(Date.now() - 11 * 24 * 60 * 60 * 1000).toISOString(),
            expiresAt: new Date(Date.now() + 34 * 24 * 60 * 60 * 1000).toISOString(),
            createdBy: 'admin',
            category: 'Pjesëmarrje'
        },
        {
            id: 'poll-004',
            question: 'Cili shërbim publik duhet të përmirësohet më shpejt për qytetarët?',
            description: 'Përqendrimi i prioritetit ndihmon komuna të alokojë burimet në mënyrë më inteligjente.',
            options: [
                { id: 'opt-a', text: 'Shërbimet shëndetësore', votes: 267 },
                { id: 'opt-b', text: 'Transporti publik', votes: 143 },
                { id: 'opt-c', text: 'Pastrimi dhe mjedisi', votes: 175 },
                { id: 'opt-d', text: 'Edukimi dhe fëmijët', votes: 201 }
            ],
            totalVotes: 786,
            createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
            expiresAt: new Date(Date.now() + 18 * 24 * 60 * 60 * 1000).toISOString(),
            createdBy: 'admin',
            category: 'Shërbime'
        },
        {
            id: 'poll-005',
            question: 'A duhet të jetë platforma e raportimeve më e hapur për qytetarët në çdo komuna?',
            description: 'Nëse platforma është e ndjeshme, të dhënat, përgjigjet dhe afatet duhet të jenë të qarta dhe të verifikueshme.',
            options: [
                { id: 'opt-1', text: 'Po, duhet të jetë e hapur dhe transparente', votes: 318 },
                { id: 'opt-2', text: 'Po, por me kontroll më të fortë të privatësisë', votes: 224 },
                { id: 'opt-3', text: 'Jo, mjafton një model standard', votes: 91 },
                { id: 'opt-4', text: 'E paditur, duhet të riformulohet plotësisht', votes: 67 }
            ],
            totalVotes: 700,
            createdAt: new Date(Date.now() - 22 * 24 * 60 * 60 * 1000).toISOString(),
            expiresAt: new Date(Date.now() + 41 * 24 * 60 * 60 * 1000).toISOString(),
            createdBy: 'admin',
            category: 'Transparencë'
        },
        {
            id: 'poll-006',
            question: 'Cila formë e bashkëpunimit qytetar do të përmirësonte më shumë reagimin ndaj problemeve?',
            description: 'Përgjigjet ndihmojnë për prioritizimin e proceseve, reagimit dhe koordinimit me institucionet.',
            options: [
                { id: 'opt-a', text: 'Raportim me foto dhe video të verifikuara', votes: 287 },
                { id: 'opt-b', text: 'Debate publike në kohë reale me institucionet', votes: 231 },
                { id: 'opt-c', text: 'Notifikime automatike me statusin e raportit', votes: 194 },
                { id: 'opt-d', text: 'Buxhetim qytetar dhe donorë lokalë', votes: 176 }
            ],
            totalVotes: 888,
            createdAt: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString(),
            expiresAt: new Date(Date.now() + 47 * 24 * 60 * 60 * 1000).toISOString(),
            createdBy: 'admin',
            category: 'Dizajn i platformës'
        }
    ],
    chats: [],
    liveMessages: [],
    categories: [
        { id: '1', name: 'Infrastrukturë rrugore & Gropa', icon: 'building', description: 'Rrugë, Asfalt, Udhëkryqe', color: '#ff0000', isActive: true, group: 'Drejtoritë Komunale' },
        { id: '2', name: 'Ambient, Parqe, Ndotje', icon: 'leaf', description: 'Zhurmë, Mbeturina, Parqe', color: '#00ff00', isActive: true, group: 'Drejtoritë Komunale' },
        { id: '3', name: 'Ndriçim publik', icon: 'zap', description: 'Ndriçimi, Rrjeti Elektrik Lokal', color: '#facc15', isActive: true, group: 'Drejtoritë Komunale' },
        { id: '4', name: 'Kanalizime & Përmbytje', icon: 'car', description: 'Ujëra të zeza, Përmbytje, Gypa', color: '#f97316', isActive: true, group: 'Drejtoritë Komunale' },
        { id: '5', name: 'Urbanizëm / Ndërtime pa leje', icon: 'map', description: 'Ndërtime ilegale, Planifikimi', color: '#6366f1', isActive: true, group: 'Drejtoritë Komunale' },
        { id: '6', name: 'Inspekcioni (Tregjet, Çmimet, Zhurmat)', icon: 'shopping-cart', description: 'Çmime, Zhurmë biznesesh, Tregje', color: '#14b8a6', isActive: true, group: 'Drejtoritë Komunale' },
        { id: '7', name: 'Policia e Kosovës / Siguria Publike', icon: 'shield', description: 'Kriminalitet, Rrezik', color: '#ef4444', isActive: true, group: 'Siguria dhe Emergjencat' },
        { id: '8', name: 'Zjarrfikësit', icon: 'flame', description: 'Zjarre, Shpëtim', color: '#ef4444', isActive: true, group: 'Siguria dhe Emergjencat' },
        { id: '9', name: 'Emergjencat Mjekësore', icon: 'heart', description: 'Ambulanca', color: '#ec4899', isActive: true, group: 'Siguria dhe Emergjencat' },
        { id: '10', name: 'RRjeti Elektrik (KEDS / KESCO)', icon: 'zap', description: 'Probleme me rrymë', color: '#facc15', isActive: true, group: 'Agjencitë & Kompanitë Publike' },
        { id: '11', name: 'Ngrohtorja e Qytetit (Termokos)', icon: 'flame', description: 'Ngrohja qendrore', color: '#f97316', isActive: true, group: 'Agjencitë & Kompanitë Publike' },
        { id: '12', name: 'Ujësjellësi Rajonal (KRU)', icon: 'droplet', description: 'Uji i pijshëm', color: '#3b82f6', isActive: true, group: 'Agjencitë & Kompanitë Publike' },
        { id: '13', name: 'Menaxhimi i Mbeturinave (Pastrimi)', icon: 'trash', description: 'Heqja e mbeturinave', color: '#22c55e', isActive: true, group: 'Agjencitë & Kompanitë Publike' },
        { id: '20', name: 'Ministria e Mjedisit, Planifikimit Hapësinor dhe Infrastrukturës', icon: 'building', description: 'Infrastruktura Nacionale', color: '#64748b', isActive: true, group: 'Niveli Qendror (Ministritë)' },
        { id: '21', name: 'Ministria e Shëndetësisë', icon: 'heart', description: 'Shëndetësia Nacionale', color: '#64748b', isActive: true, group: 'Niveli Qendror (Ministritë)' },
        { id: '22', name: 'Ministria e Arsimit, Shkencës dhe Teknologjisë', icon: 'book', description: 'Arsimi', color: '#64748b', isActive: true, group: 'Niveli Qendror (Ministritë)' },
        { id: '23', name: 'Ministria e Punëve të Brendshme', icon: 'shield', description: 'Siguria Qendrore', color: '#64748b', isActive: true, group: 'Niveli Qendror (Ministritë)' },
        { id: '24', name: 'Ministria e Drejtësisë', icon: 'gavel', description: 'Drejtësia', color: '#64748b', isActive: true, group: 'Niveli Qendror (Ministritë)' },
        { id: '25', name: 'Ministria e Ekonomisë', icon: 'briefcase', description: 'Ekonomia', color: '#64748b', isActive: true, group: 'Niveli Qendror (Ministritë)' },
        { id: '26', name: 'Ministria e Industrisë, Ndërmarrësisë dhe Tregtisë', icon: 'briefcase', description: 'Tregtia', color: '#64748b', isActive: true, group: 'Niveli Qendror (Ministritë)' },
        { id: '27', name: 'Ministria e Bujqësisë, Pylltarisë dhe Zhvillimit Rural', icon: 'tree-pine', description: 'Bujqësia', color: '#64748b', isActive: true, group: 'Niveli Qendror (Ministritë)' },
        { id: '28', name: 'Ministria e Financave, Punës dhe Transfereve', icon: 'landmark', description: 'Financat', color: '#64748b', isActive: true, group: 'Niveli Qendror (Ministritë)' },
        { id: '29', name: 'Ministria e Administrimit të Pushtetit Lokal', icon: 'building', description: 'Pushteti Lokal', color: '#64748b', isActive: true, group: 'Niveli Qendror (Ministritë)' },
        { id: '30', name: 'Ministria e Kulturës, Rinisë dhe Sportit', icon: 'users', description: 'Rinia dhe Sporti', color: '#64748b', isActive: true, group: 'Niveli Qendror (Ministritë)' },
    ],
    bannedIPs: [],
    notifications: [],
    systemSettings: {
        showReels: true,
        adContactPhone: '+383 44 123 456',
        adContactEmail: 'reklama@qytetari.ks',
        adContactCompanyName: 'Platforma Qytetare Reklama',
        adSlogan: 'Maksimalizoni shikueshmërinë e biznesit tuaj me promovim të synuar në komunën tuaj',
        adWhatsApp: '+38344123456'
    },
    ads: [
        {
            id: 'AD-BALLINA-TOP',
            title: 'Komuna Digjitale - Shkarko certifikatat shpejt dhe lehtë në e-Kosova',
            section: 'ballina',
            target: 'Nacionale',
            position: 'top',
            mediaUrl: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&q=80&w=1200',
            mediaType: 'image',
            views: 650,
            clicks: 42,
            status: 'active',
            budget: 'Nacionale'
        },
        {
            id: 'AD-BALLINA-SIDEBAR',
            title: 'Festa e Qytetit – Bashkohu në festime këtë fundjavë në Prishtinë!',
            section: 'ballina',
            target: 'Nacionale',
            position: 'sidebar',
            // Imported so Vite fingerprints and copies the file. A literal
            // '/src/assets/...' string works in the dev server and 404s in a
            // production build, where the bundle lives under /assets/.
            mediaUrl: festaAdImage,
            mediaType: 'image',
            views: 310,
            clicks: 22,
            status: 'active',
            budget: 'Nacionale'
        },
        {
            id: 'AD-RAPORTO-TOP',
            title: 'Siguria në Rrugë - Raporto çdo parregullsi në infrastrukturë sekondare',
            section: 'raporto',
            target: 'Nacionale',
            position: 'top',
            mediaUrl: 'https://images.unsplash.com/photo-1590674899484-d5640e854abe?auto=format&fit=crop&q=80&w=1200',
            mediaType: 'image',
            views: 412,
            clicks: 18,
            status: 'active',
            budget: 'Nacionale'
        },
        {
            id: 'AD-RAPORTO-SIDEBAR',
            title: 'Sigurimi i Jetës dhe Pronës - Oferta e re nga Siguria Sh.a.',
            section: 'raporto',
            target: 'Nacionale',
            position: 'sidebar',
            mediaUrl: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&q=80&w=800',
            mediaType: 'image',
            views: 230,
            clicks: 15,
            status: 'active',
            budget: 'Nacionale'
        },
        {
            id: 'AD-HARTA-TOP',
            title: 'Zbuloni Kosovën - Vizitoni pikat turistike dhe trashëgiminë kulturore',
            section: 'harta',
            target: 'Nacionale',
            position: 'top',
            mediaUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=1200',
            mediaType: 'image',
            views: 520,
            clicks: 39,
            status: 'active',
            budget: 'Nacionale'
        },
        {
            id: 'AD-HARTA-SIDEBAR',
            title: 'Taxi Lokale 24/7 - Gjej lokacionin dhe udhëto më shpejt',
            section: 'harta',
            target: 'Nacionale',
            position: 'sidebar',
            mediaUrl: 'https://images.unsplash.com/photo-1494783367193-149034c05e8f?auto=format&fit=crop&q=80&w=800',
            mediaType: 'image',
            views: 198,
            clicks: 29,
            status: 'active',
            budget: 'Nacionale'
        },
        {
            id: 'AD-SONDAZHET-TOP',
            title: 'Voto dhe Vendos - Zëri yt formëson vendimet e asamblesë komunale',
            section: 'sondazhet',
            target: 'Nacionale',
            position: 'top',
            mediaUrl: 'https://images.unsplash.com/photo-1540910419892-4a36d2c3266c?auto=format&fit=crop&q=80&w=1200',
            mediaType: 'image',
            views: 380,
            clicks: 12,
            status: 'active',
            budget: 'Nacionale'
        },
        {
            id: 'AD-SONDAZHET-SIDEBAR',
            title: 'Sondazhi për Gjelbërim - Ndihmo me idetë e tua për parqe të reja',
            section: 'sondazhet',
            target: 'Nacionale',
            position: 'sidebar',
            mediaUrl: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&q=80&w=800',
            mediaType: 'image',
            views: 290,
            clicks: 31,
            status: 'active',
            budget: 'Nacionale'
        },
        {
            id: 'AD-AI-TOP',
            title: 'Akademia e Teknologjisë - Mëso programim dhe Inteligjencë Artificiale',
            section: 'asistenti-ai',
            target: 'Nacionale',
            position: 'top',
            mediaUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&q=80&w=1200',
            mediaType: 'image',
            views: 450,
            clicks: 44,
            status: 'active',
            budget: 'Nacionale'
        },
        {
            id: 'AD-AI-SIDEBAR',
            title: 'AI Smart Kosova - Zgjidhjet inteligjente për ndërmarrje',
            section: 'asistenti-ai',
            target: 'Nacionale',
            position: 'sidebar',
            mediaUrl: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&q=80&w=800',
            mediaType: 'image',
            views: 215,
            clicks: 19,
            status: 'active',
            budget: 'Nacionale'
        },
        {
            id: 'AD-BISEDO-TOP',
            title: 'Komuniko me Shpejtësi - Pakot më të reja të Internetit nga IPKO',
            section: 'bisedo',
            target: 'Nacionale',
            position: 'top',
            mediaUrl: 'https://images.unsplash.com/photo-1562408590-e32931084e23?auto=format&fit=crop&q=80&w=1200',
            mediaType: 'image',
            views: 670,
            clicks: 58,
            status: 'active',
            budget: 'Nacionale'
        },
        {
            id: 'AD-BISEDO-SIDEBAR',
            title: 'Debato dhe Shpërndaj - Platforma e re e diskutimit komunitar',
            section: 'bisedo',
            target: 'Nacionale',
            position: 'sidebar',
            mediaUrl: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=80&w=800',
            mediaType: 'image',
            views: 330,
            clicks: 25,
            status: 'active',
            budget: 'Nacionale'
        },
        {
            id: 'AD-NUMRAT-TOP',
            title: 'Kujdesi Shëndetësor Parësor - Mbro shëndetin tënd, kontrollohu rregullisht',
            section: 'numrat',
            target: 'Nacionale',
            position: 'top',
            mediaUrl: 'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?auto=format&fit=crop&q=80&w=1200',
            mediaType: 'image',
            views: 480,
            clicks: 14,
            status: 'active',
            budget: 'Nacionale'
        },
        {
            id: 'AD-NUMRAT-SIDEBAR',
            title: 'Numrat e Urgjencës - Ruaj në telefonin tënd listën e plotë të ndihmës së shpejtë',
            section: 'numrat',
            target: 'Nacionale',
            position: 'sidebar',
            mediaUrl: 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&q=80&w=800',
            mediaType: 'image',
            views: 290,
            clicks: 17,
            status: 'active',
            budget: 'Nacionale'
        },
        {
            id: 'AD-DONACIONE-TOP',
            title: 'Kryqi i Kuq Kosovë - Dhuro gjak, shpëto një jetë në rrezik',
            section: 'donacione',
            target: 'Nacionale',
            position: 'top',
            mediaUrl: 'https://images.unsplash.com/photo-1615461066841-6116ecdccd04?auto=format&fit=crop&q=80&w=1200',
            mediaType: 'image',
            views: 590,
            clicks: 48,
            status: 'active',
            budget: 'Nacionale'
        },
        {
            id: 'AD-DONACIONE-SIDEBAR',
            title: 'Fondacioni Humanitar - Bëhu bamirës dhe ndihmo familjet në nevojë ekstrem',
            section: 'donacione',
            target: 'Nacionale',
            position: 'sidebar',
            mediaUrl: 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&q=80&w=800',
            mediaType: 'image',
            views: 310,
            clicks: 34,
            status: 'active',
            budget: 'Nacionale'
        }
    ],
    auditLogs: [],
    donationUrls: {
        charity: 'https://example.com/donate-charity',
        maintenance: 'https://example.com/donate-maintenance'
    },
    donationCauses: [
        {
            id: 'DC-001',
            title: 'Kalime të sigurta pranë shkollave',
            description: 'Propozim për vendkalime të dukshme, ndriçim dhe sinjalistikë pranë shkollave, që nxënësit të lëvizin më sigurt çdo ditë.',
            mediaType: 'image',
            mediaUrl: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&q=80&w=800',
            donationUrl: 'https://gofund.me/example-aliu',
            category: 'shtepi',
            status: 'approved',
            createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
            id: 'DC-002',
            title: 'Hapësira të gjelbra në lagje',
            description: 'Shtëpia e vjetër e axhës Ramadan rrezikon të përmbytet me shiun e parë për shkak të dëmtimit të plotë të kulmit. Ju ftojmë të ndihmoni për blerjen e materialit ndërtimor.',
            mediaType: 'image',
            mediaUrl: 'https://images.unsplash.com/photo-1590381105924-c72589b9ef3f?auto=format&fit=crop&q=80&w=800',
            donationUrl: 'https://gofund.me/example-kulmi',
            category: 'shtepi',
            status: 'approved',
            createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
            id: 'DC-003',
            title: 'Pakot Ushqimore për familjet me asistencë sociale',
            description: 'Synojmë të sigurojmë pako me ushqime bazike dhe higjienike për mbi 50 familje në nevojë ekstreme në lagjet tona këtë muaj. Çdo pako kushton rreth 35 euro dhe bën ndryshim në tryezën e tyre.',
            mediaType: 'image',
            mediaUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=800',
            donationUrl: 'https://gofund.me/example-ushqim',
            category: 'ushqim',
            status: 'approved',
            createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
            id: 'DC-004',
            title: 'Mbulesat dhe veshmbathjet dimërore për fëmijët',
            description: 'Me ftohjen e motit, shumë fëmijë të familjeve në nevojë nuk kanë xhaketa, këpucë të ngrohta apo mbulesa për netët e ftohta. Na ndihmoni t\'i dhurojmë ngrohtësi fëmijëve këtë dimër.',
            mediaType: 'image',
            mediaUrl: 'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?auto=format&fit=crop&q=80&w=800',
            donationUrl: 'https://gofund.me/example-veshje',
            category: 'veshmbathje',
            status: 'approved',
            createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
            id: 'DC-005',
            title: 'Furnizim me drunj zjarri dhe ngrohje për familjet me fëmijë',
            description: 'Disa familje në periferi nuk kanë mundësi financiare të sigurojnë lëndë djegëse për dimrin e ftohtë. Me këtë fushatë synojmë të blejmë dru zjarri për 20 shtëpi.',
            mediaType: 'image',
            mediaUrl: 'https://images.unsplash.com/photo-1543083477-4f785aeafaa9?auto=format&fit=crop&q=80&w=800',
            donationUrl: 'https://gofund.me/example-ngrohje',
            category: 'tjera',
            status: 'approved',
            createdAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
            id: 'DC-006',
            title: 'Shtëpi e re për nënën Sofie dhe dy jetimët',
            description: 'Nëna Sofie rrit e vetme dy jetimë në një barakë të vjetër që rrezikon të shembet nga lagështia dhe dëmtimet strukturore. Po mbledhim mjete për t\'u blerë një banesë të vogël sociale.',
            mediaType: 'image',
            mediaUrl: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&q=80&w=800',
            donationUrl: 'https://gofund.me/example-sofie',
            category: 'shtepi',
            status: 'approved',
            createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
            id: 'DC-007',
            title: 'Blerja e pajisjeve shkollore për nxënësit jetimë',
            description: 'Para fillimit të vitit të ri shkollor, dëshirojmë të pajisim 100 nxënës që kanë humbur prindërit me çanta, fletore, stilolapsa dhe mjete tjera të domosdoshme për mësim nxënie.',
            mediaType: 'image',
            mediaUrl: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&q=80&w=800',
            donationUrl: 'https://gofund.me/example-shkolla',
            category: 'tjera',
            status: 'approved',
            createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
            id: 'DC-008',
            title: 'Terapia fizike për veteranin bacën Selim',
            description: 'Baca Selim ka nevojë për terapi fizike intensive dhe barna pas një sulmi në tru. Ndihma juaj do të lehtësojë dhimbjet e tij ditore dhe do t\'i mundësojë të ecë sërish.',
            mediaType: 'image',
            mediaUrl: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&q=80&w=800',
            donationUrl: 'https://gofund.me/example-selim',
            category: 'semundje',
            status: 'approved',
            createdAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString()
        }
    ],
    updateDonationUrls: (urls) => set({ donationUrls: urls }),
    addDonationCause: async (cause) => {
        const id = Math.random().toString(36).substring(2, 9);
        const newCause = { id, ...cause, createdAt: new Date().toISOString() };
        try {
            const { db } = await import('./firebase');
            const { doc, setDoc } = await import('firebase/firestore');
            await setDoc(doc(db, 'donationCauses', id), {
                ...cause,
                id,
                createdAt: new Date().toISOString()
            });
        }
        catch (e) {
            console.error("Firebase error adding donation cause:", e);
        }
        set(s => ({
            donationCauses: [newCause, ...s.donationCauses]
        }));
    },
    updateDonationCause: async (id, updates) => {
        try {
            const { db } = await import('./firebase');
            const { doc, updateDoc } = await import('firebase/firestore');
            await updateDoc(doc(db, 'donationCauses', id), updates);
        }
        catch (e) {
            console.error("Firebase error updating donation cause:", e);
        }
        set(s => ({
            donationCauses: s.donationCauses.map(d => d.id === id ? { ...d, ...updates } : d)
        }));
    },
    deleteDonationCause: async (id) => {
        try {
            const { db } = await import('./firebase');
            const { doc, deleteDoc } = await import('firebase/firestore');
            await deleteDoc(doc(db, 'donationCauses', id));
        }
        catch (e) {
            console.error("Firebase error deleting donation cause:", e);
        }
        set(s => ({
            donationCauses: s.donationCauses.filter(d => d.id !== id)
        }));
    },
    setReports: (reports) => set({ reports }),
    setReportsStatus: (reportsStatus, reportsError = null) => set({ reportsStatus, reportsError }),
    appendReports: (newReports) => set(s => {
        // Prevent duplicates
        const existingIds = new Set(s.reports.map(r => r.id));
        const uniqueNew = newReports.filter(r => !existingIds.has(r.id));
        return { reports: [...s.reports, ...uniqueNew] };
    }),
    lastVisibleReport: null,
    setLastVisibleReport: (doc) => set({ lastVisibleReport: doc }),
    hasMoreReports: true,
    setHasMoreReports: (hasMore) => set({ hasMoreReports: hasMore }),
    loadMoreReports: async () => {
        const state = get();
        if (!state.hasMoreReports || !state.lastVisibleReport)
            return;
        try {
            const { db } = await import('./firebase');
            const { collection, query, orderBy, limit, startAfter, getDocs } = await import('firebase/firestore');
            const q = query(collection(db, "reports"), orderBy("createdAt", "desc"), startAfter(state.lastVisibleReport), limit(100));
            const snapshot = await getDocs(q);
            if (snapshot.empty) {
                set({ hasMoreReports: false });
                return;
            }
            set({ lastVisibleReport: snapshot.docs[snapshot.docs.length - 1] });
            const nextReports = snapshot.docs.map(doc => {
                const data = doc.data();
                let createdAt = data.createdAt;
                if (createdAt && typeof createdAt.toDate === 'function') {
                    createdAt = createdAt.toDate().toISOString();
                }
                else if (createdAt && typeof createdAt === 'object' && createdAt.seconds) {
                    createdAt = new Date(createdAt.seconds * 1000).toISOString();
                }
                return {
                    ...data,
                    id: doc.id,
                    createdAt: createdAt || new Date().toISOString()
                };
            });
            state.appendReports(nextReports);
            if (snapshot.docs.length < 100) {
                set({ hasMoreReports: false });
            }
        }
        catch (err) {
            console.error("Error loading more reports", err);
        }
    },
    setDonationCauses: (donationCauses) => set({ donationCauses }),
    setPolls: (polls) => set({ polls }),
    setAds: (ads) => set({ ads }),
    setNotifications: (notifications) => set({ notifications }),
    setAuditLogs: (auditLogs) => set({ auditLogs }),
    setSystemSettings: (settings) => set({ systemSettings: settings }),
    updateSystemSettings: async (settings) => {
        set(s => ({ systemSettings: { ...s.systemSettings, ...settings } }));
        try {
            const { db } = await import('./firebase');
            const { doc, setDoc } = await import('firebase/firestore');
            await setDoc(doc(db, 'settings', 'general'), { ...get().systemSettings }, { merge: true });
        }
        catch (e) {
            console.error("Firebase error updating settings:", e);
        }
    },
    setCurrentUser: (user) => set({ currentUser: user }),
    login: (user) => {
        set({ currentUser: user });
        get().addAuditLog('User Login', 'success', `User logged in: ${user.email} Role: ${user.role}`);
    },
    register: (userData) => {
        const newUser = {
            ...userData,
            id: Math.random().toString(36).substr(2, 9),
            role: 'citizen',
            points: 50,
            badges: ['Qytetar i Ri'],
            isVerified: true
        };
        set((state) => ({
            users: [...state.users, newUser],
            currentUser: newUser
        }));
        get().addAuditLog('User Registration', 'success', `New user registered: ${newUser.email}`);
    },
    logout: () => {
        const email = get().currentUser?.email || 'Unknown';
        set({ currentUser: null });
        get().addAuditLog('User Logout', 'success', `User logged out: ${email}`);
    },
    initialize: () => {
        const s = get();
        if (s.reports.length === 0) {
            set({ reports: DEMO_REPORTS });
        }
        if (s.users.length === 0) {
            set({ users: [DEMO_CITIZEN_USER] });
        }
        if (!s.currentUser && typeof window !== 'undefined') {
            const saved = localStorage.getItem('zq-demo-user');
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    set({ currentUser: parsed });
                }
                catch (e) {
                    console.warn('Demo user restore failed', e);
                }
            }
        }
    },
    checkSLAs: () => {
        const s = get();
        const now = new Date().getTime();
        let changed = false;
        const updatedReports = s.reports.map(r => {
            if (r.urgency === 'Kritike' && (r.status === 'Pending Review' || r.status === 'Draft')) {
                const created = new Date(r.createdAt).getTime();
                const hoursDiff = (now - created) / (1000 * 60 * 60);
                if (hoursDiff > 48) {
                    changed = true;
                    return { ...r, status: 'Overdue' };
                }
            }
            return r;
        });
        if (changed) {
            const overdueCount = updatedReports.filter(r => r.status === 'Overdue').length;
            const currentOverdueCount = s.reports.filter(r => r.status === 'Overdue').length;
            if (overdueCount > currentOverdueCount) {
                set(state => ({
                    reports: updatedReports,
                    notifications: [{
                            id: Math.random().toString(36).substr(2, 9),
                            title: 'Alarm SLA: Ankesa të Tejzgjatura',
                            message: `Keni ankesa 'Kritike' që kanë kaluar afatin 48 orësh për shqyrtim!`,
                            createdAt: new Date().toISOString(),
                            isRead: false,
                            type: 'alert'
                        }, ...state.notifications]
                }));
                return;
            }
            set({ reports: updatedReports });
        }
    },
    addReport: (reportParams) => {
        const reportData = {
            ...reportParams,
            id: reportParams.id || Math.random().toString(36).substr(2, 9),
            createdAt: new Date().toISOString(),
            upvotes: 0,
            commentsCount: 0,
            status: reportParams.status || 'Pending Review',
            timeline: [{
                    id: Math.random().toString(36).substr(2, 9),
                    status: reportParams.status || 'Pending Review',
                    date: new Date().toISOString(),
                    updatedBy: 'Sistemi'
                }],
        };
        set(s => ({ reports: [reportData, ...s.reports] }));
    },
    upvoteReport: async (id) => {
        set(state => ({
            reports: state.reports.map(r => r.id === id ? { ...r, upvotes: (r.upvotes || 0) + 1 } : r)
        }));
        try {
            const { db } = await import('./firebase');
            const { doc, updateDoc, increment } = await import('firebase/firestore');
            await updateDoc(doc(db, 'reports', id), { upvotes: increment(1) });
        }
        catch (e) {
            console.warn("Firestore upvote sync", e);
        }
    },
    addPoints: (points) => {
        const currentUser = get().currentUser;
        if (currentUser) {
            set(state => {
                const updatedUsers = state.users.map(u => {
                    if (u.id === currentUser.id) {
                        const newPoints = (u.points || 0) + points;
                        // Auto-calculate badges based on points
                        const badges = ['Qytetar i Ri 🎖️'];
                        if (newPoints >= 100)
                            badges.push('Qytetar Aktiv ⚡');
                        if (newPoints >= 250)
                            badges.push('Mbrojtës i Komunitetit 🛡️');
                        if (newPoints >= 500)
                            badges.push('Kampion i Gjelbër 🌿');
                        if (newPoints >= 1000)
                            badges.push('Ambasador i Kosovës 🌟');
                        return { ...u, points: newPoints, badges };
                    }
                    return u;
                });
                const user = updatedUsers.find(u => u.id === currentUser.id);
                return { users: updatedUsers, currentUser: user || null };
            });
        }
    },
    updateReportStatus: async (id, status, comment, resolvedImage) => {
        const currentUser = get().currentUser;
        const state = get();
        const report = state.reports.find(r => r.id === id);
        const newTimelineEvent = {
            id: Math.random().toString(36).substr(2, 9),
            status,
            date: new Date().toISOString(),
            updatedBy: currentUser?.name || 'Zyrtar',
            comment: comment || ''
        };
        const resolvedAt = status === 'Resolved' ? new Date().toISOString() : report?.resolvedAt;
        if (status === 'Approved' || status === 'Resolved') {
            console.log(`Raporti ${id} statusi i ri eshte: ${status}. Njoftimi derguar te approval@ks.com`);
        }
        // Firebase Sync Context
        try {
            const { db } = await import('./firebase');
            const { doc, updateDoc, arrayUnion } = await import('firebase/firestore');
            const reportRef = doc(db, 'reports', id);
            const updates = { status };
            if (resolvedImage)
                updates.resolvedImage = resolvedImage;
            if (resolvedAt)
                updates.resolvedAt = resolvedAt;
            updates.timeline = arrayUnion(newTimelineEvent);
            await updateDoc(reportRef, updates);
        }
        catch (e) {
            console.error("Firebase updateReportStatus error bypass", e);
        }
        set(state => {
            let updatedNotifications = state.notifications;
            if (status === 'Resolved' && report) {
                updatedNotifications = [{
                        id: Math.random().toString(36).substr(2, 9),
                        title: 'Rasti juaj është Zgjidhur!',
                        message: `Ankesa juaj "${report.title}" ka marrë statusin "E Zgjidhur"! Shikoni fotot e dëshmisë Para dhe Pas.`,
                        createdAt: new Date().toISOString(),
                        isRead: false,
                        type: 'success'
                    }, ...state.notifications];
            }
            return {
                notifications: updatedNotifications,
                reports: state.reports.map(r => r.id === id ? {
                    ...r,
                    status,
                    resolvedImage: resolvedImage || r.resolvedImage,
                    resolvedAt,
                    timeline: [...(r.timeline || []), newTimelineEvent]
                } : r)
            };
        });
    },
    assignReport: async (id, assignedTo) => {
        const currentUser = get().currentUser;
        const newTimelineEvent = {
            id: Math.random().toString(36).substr(2, 9),
            status: 'Assigned',
            date: new Date().toISOString(),
            updatedBy: currentUser?.name || 'Zyrtar',
            comment: `Caktuar te ${assignedTo}`
        };
        // Firebase Sync Context
        try {
            const { db } = await import('./firebase');
            const { doc, updateDoc, arrayUnion } = await import('firebase/firestore');
            const reportRef = doc(db, 'reports', id);
            await updateDoc(reportRef, {
                assignedTo,
                status: 'Assigned',
                timeline: arrayUnion(newTimelineEvent)
            });
        }
        catch (e) {
            console.error("Firebase assignReport error bypass", e);
        }
        set(state => {
            return {
                reports: state.reports.map(r => r.id === id ? { ...r, assignedTo, status: 'Assigned', timeline: [...(r.timeline || []), newTimelineEvent] } : r)
            };
        });
    },
    deleteReport: async (id) => {
        try {
            const { db } = await import('./firebase');
            const { doc, deleteDoc } = await import('firebase/firestore');
            await deleteDoc(doc(db, 'reports', id));
            console.log(`Raporti ${id} u fshi. Njoftimi derguar te approval@ks.com`);
        }
        catch (e) {
            console.error("Gabim gjate fshirjes:", e);
            alert("Nuk mund të fshihet dosja. Ju lutem provoni përsëri.");
        }
        set(s => ({ reports: s.reports.filter(r => r.id !== id) }));
    },
    banUser: async (userId) => {
        try {
            const { db } = await import('./firebase');
            const { doc, updateDoc } = await import('firebase/firestore');
            await updateDoc(doc(db, 'users', userId), { isBanned: true });
        }
        catch (e) {
            console.error(e);
        }
    },
    votePoll: async (pollId, optionId) => {
        try {
            const { db } = await import('./firebase');
            const { doc, getDoc, updateDoc } = await import('firebase/firestore');
            const pollRef = doc(db, 'polls', pollId);
            const { runTransaction } = await import('firebase/firestore');
            await runTransaction(db, async (transaction) => {
                const sfDoc = await transaction.get(pollRef);
                if (!sfDoc.exists()) {
                    throw "Sondazhi nuk ekziston!";
                }
                const data = sfDoc.data();
                const updatedOptions = data.options.map((opt) => opt.id === optionId ? { ...opt, votes: opt.votes + 1 } : opt);
                transaction.update(pollRef, {
                    totalVotes: (data.totalVotes || 0) + 1,
                    options: updatedOptions
                });
            });
        }
        catch (e) {
            console.error("Firebase votePoll sync error", e);
        }
        set(s => ({
            polls: s.polls.map(p => {
                if (p.id === pollId) {
                    return {
                        ...p,
                        totalVotes: p.totalVotes + 1,
                        options: p.options.map(opt => opt.id === optionId ? { ...opt, votes: opt.votes + 1 } : opt)
                    };
                }
                return p;
            })
        }));
    },
    createPoll: async (pollParams) => {
        try {
            const { db } = await import('./firebase');
            const { doc, setDoc } = await import('firebase/firestore');
            const id = Math.random().toString(36).substr(2, 9);
            const newPoll = {
                ...pollParams,
                id,
                totalVotes: 0,
                createdBy: get().currentUser?.name || 'Administrator',
                createdAt: new Date().toISOString()
            };
            await setDoc(doc(db, 'polls', id), newPoll);
        }
        catch (e) {
            console.error(e);
        }
    },
    deletePoll: async (id) => {
        try {
            const { db } = await import('./firebase');
            const { doc, deleteDoc } = await import('firebase/firestore');
            await deleteDoc(doc(db, 'polls', id));
        }
        catch (e) {
            console.error(e);
        }
    },
    updatePoll: async (id, updatedPoll) => {
        try {
            const { db } = await import('./firebase');
            const { doc, updateDoc } = await import('firebase/firestore');
            await updateDoc(doc(db, 'polls', id), updatedPoll);
        }
        catch (e) {
            console.error(e);
        }
    },
    updateUser: async (id, updatedUser) => {
        try {
            const { db } = await import('./firebase');
            const { doc, updateDoc } = await import('firebase/firestore');
            // Security: strip password before writing to Firestore
            const { password: _pw, ...safeUpdates } = updatedUser;
            await updateDoc(doc(db, 'users', id), safeUpdates);
        }
        catch (e) {
            console.error("Error syncing updateUser to Firestore:", e);
        }
        set(s => {
            const newUsers = s.users.map(u => u.id === id ? { ...u, ...updatedUser } : u);
            return {
                users: newUsers,
                currentUser: s.currentUser?.id === id ? newUsers.find(u => u.id === id) || s.currentUser : s.currentUser
            };
        });
    },
    adminCreateUser: async (user) => {
        try {
            const { db } = await import('./firebase');
            const { doc, setDoc } = await import('firebase/firestore');
            const id = user.email.split('@')[0] + Math.random().toString(36).substr(2, 5);
            // Security: strip password before writing to Firestore
            const { password: _pw, ...safeUser } = user;
            await setDoc(doc(db, 'users', id), { ...safeUser, id, points: 0, badges: [] });
        }
        catch (e) {
            console.error(e);
        }
    },
    updateReport: async (id, updatedReport) => {
        try {
            const { db } = await import('./firebase');
            const { doc, updateDoc } = await import('firebase/firestore');
            const reportRef = doc(db, 'reports', id);
            const safeUpdates = {};
            if (updatedReport.title !== undefined)
                safeUpdates.title = updatedReport.title;
            if (updatedReport.description !== undefined)
                safeUpdates.description = updatedReport.description;
            if (updatedReport.category !== undefined)
                safeUpdates.category = updatedReport.category;
            if (updatedReport.urgency !== undefined)
                safeUpdates.urgency = updatedReport.urgency;
            if (updatedReport.images !== undefined)
                safeUpdates.images = updatedReport.images;
            if (updatedReport.location !== undefined)
                safeUpdates.location = updatedReport.location;
            if (updatedReport.status !== undefined)
                safeUpdates.status = updatedReport.status;
            if (updatedReport.resolvedImage !== undefined)
                safeUpdates.resolvedImage = updatedReport.resolvedImage;
            if (updatedReport.resolvedAt !== undefined)
                safeUpdates.resolvedAt = updatedReport.resolvedAt;
            await updateDoc(reportRef, safeUpdates);
        }
        catch (e) {
            console.error("Firebase updateReport error", e);
        }
        set(s => ({ reports: s.reports.map(r => r.id === id ? { ...r, ...updatedReport } : r) }));
    },
    addCategory: async (category) => {
        try {
            const { db } = await import('./firebase');
            const { doc, setDoc } = await import('firebase/firestore');
            const id = Math.random().toString(36).substr(2, 9);
            await setDoc(doc(db, 'categories', id), { ...category, id });
        }
        catch (e) {
            console.error(e);
        }
    },
    deleteCategory: async (id) => {
        try {
            const { db } = await import('./firebase');
            const { doc, deleteDoc } = await import('firebase/firestore');
            await deleteDoc(doc(db, 'categories', id));
        }
        catch (e) {
            console.error(e);
        }
    },
    createAd: async (ad) => {
        try {
            const { db } = await import('./firebase');
            const { doc, setDoc } = await import('firebase/firestore');
            const id = `AD-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
            await setDoc(doc(db, 'ads', id), { ...ad, id, views: 0, clicks: 0 });
        }
        catch (e) {
            console.error(e);
        }
    },
    updateAd: async (id, updates) => {
        set(s => ({
            ads: s.ads.map(a => a.id === id ? { ...a, ...updates } : a)
        }));
        try {
            const { db } = await import('./firebase');
            const { doc, updateDoc } = await import('firebase/firestore');
            await updateDoc(doc(db, 'ads', id), updates);
        }
        catch (e) {
            console.error("Firebase error updating ad:", e);
        }
    },
    deleteAd: async (id) => {
        try {
            const { db } = await import('./firebase');
            const { doc, deleteDoc } = await import('firebase/firestore');
            await deleteDoc(doc(db, 'ads', id));
        }
        catch (e) {
            console.error(e);
        }
    },
    updateAdStatus: async (id, status) => {
        try {
            const { db } = await import('./firebase');
            const { doc, updateDoc } = await import('firebase/firestore');
            await updateDoc(doc(db, 'ads', id), { status });
        }
        catch (e) {
            console.error(e);
        }
    },
    incrementAdView: async (id) => {
        try {
            const { db } = await import('./firebase');
            const { doc, increment, updateDoc } = await import('firebase/firestore');
            await updateDoc(doc(db, 'ads', id), { views: increment(1) });
        }
        catch (e) {
            console.error(e);
        }
    },
    incrementAdClick: async (id) => {
        try {
            const { db } = await import('./firebase');
            const { doc, increment, updateDoc } = await import('firebase/firestore');
            await updateDoc(doc(db, 'ads', id), { clicks: increment(1) });
        }
        catch (e) {
            console.error(e);
        }
    },
    deleteUser: async (id) => {
        try {
            const { db } = await import('./firebase');
            const { doc, deleteDoc } = await import('firebase/firestore');
            await deleteDoc(doc(db, 'users', id));
        }
        catch (e) {
            console.error(e);
        }
    },
    addComment: (reportId, content, user) => {
        const newComment = {
            id: Math.random().toString(36).substr(2, 9),
            content,
            authorId: user.id,
            authorName: user.name,
            createdAt: new Date().toISOString()
        };
        set(s => ({
            reports: s.reports.map(r => r.id === reportId ? { ...r, comments: [...(r.comments || []), newComment], commentsCount: (r.commentsCount || 0) + 1 } : r)
        }));
    },
    startChat: (userId, userName) => {
        set(s => {
            if (s.chats.some(c => c.userId === userId && c.status === 'active'))
                return s;
            const newChat = {
                id: Math.random().toString(36).substr(2, 9),
                userId,
                userName,
                status: 'active',
                messages: [],
                updatedAt: new Date().toISOString()
            };
            return { chats: [...s.chats, newChat] };
        });
    },
    sendMessage: (chatId, text, sender) => {
        const newMessage = {
            id: Math.random().toString(36).substr(2, 9),
            sender,
            text,
            time: new Date().toISOString()
        };
        set(s => ({
            chats: s.chats.map(c => c.id === chatId ? { ...c, messages: [...c.messages, newMessage], updatedAt: new Date().toISOString() } : c)
        }));
    },
    closeChat: (chatId) => set(s => ({ chats: s.chats.map(c => c.id === chatId ? { ...c, status: 'closed', updatedAt: new Date().toISOString() } : c) })),
    clearChat: (chatId) => set(s => ({ chats: s.chats.filter(c => c.id !== chatId) })),
    rateChat: (chatId, rating) => set(s => ({ chats: s.chats.map(c => c.id === chatId ? { ...c, rating, updatedAt: new Date().toISOString() } : c) })),
    addLiveMessage: (text, user, guestName, simulatedIP) => {
        // AI Guard / Auto-Moderation (Profanity Filter)
        const badWords = ["budall", "kreten", "idiot", "kopil", "mut", "pshtjell", "m.u.t", "trap", "qen", "pisllek", "ndyresire", "hajdut", "kriminel", "robt"];
        let moderatedText = text;
        const lowercaseText = text.toLowerCase();
        let isSpam = false;
        badWords.forEach(word => {
            if (lowercaseText.includes(word)) {
                const regex = new RegExp(`\\b${word}\\b`, 'gi');
                moderatedText = moderatedText.replace(regex, '***');
                if (moderatedText === text) {
                    const substringRegex = new RegExp(word, 'gi');
                    moderatedText = moderatedText.replace(substringRegex, '***');
                }
            }
        });
        // Block entire message if too many bad words
        if ((moderatedText.match(/\*\*\*/g) || []).length >= 2) {
            isSpam = true;
        }
        if (isSpam) {
            alert("Mesazhi u bllokua nga AI Guard për shkak të gjuhës së papërshtatshme!");
            return;
        }
        const newMessage = {
            id: Math.random().toString(36).substr(2, 9),
            userId: user ? user.id : 'guest',
            userName: user ? user.name : (guestName || 'Anonim'),
            text: moderatedText,
            createdAt: new Date().toISOString(),
            ip: simulatedIP
        };
        set(s => ({ liveMessages: [...s.liveMessages, newMessage].slice(-100) })); // Keep last 100
    },
    addNotification: (notification) => {
        const newNotification = {
            ...notification,
            id: Math.random().toString(36).substr(2, 9),
            createdAt: new Date().toISOString(),
            isRead: false
        };
        set(s => ({ notifications: [newNotification, ...s.notifications] }));
    },
    markNotificationAsRead: (id) => {
        set(s => ({
            notifications: s.notifications.map(n => n.id === id ? { ...n, isRead: true } : n)
        }));
    },
    deleteNotification: (id) => {
        set(s => ({
            notifications: s.notifications.filter(n => n.id !== id)
        }));
    },
    banIP: (ip) => set(s => ({
        bannedIPs: [...s.bannedIPs, ip].filter((v, i, a) => a.indexOf(v) === i)
    })),
    addAuditLog: async (action, status, details) => {
        const state = get();
        const user = state.currentUser;
        const newLog = {
            id: Math.random().toString(36).substr(2, 9),
            action,
            status,
            details,
            userId: user?.id || 'system',
            userEmail: user?.email || 'System',
            ip: '127.0.0.1', // Mock IP
            createdAt: new Date().toISOString()
        };
        // Firebase Sync Context
        try {
            const { db } = await import('./firebase');
            const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
            addDoc(collection(db, 'auditLogs'), {
                ...newLog,
                createdAt: serverTimestamp()
            }).catch(err => {
                // Silently bypass permission issues to keep guest/offline sessions clean and error-free
                if (err && (err.code === 'permission-denied' || String(err).includes('permissions') || String(err).includes('permission'))) {
                    console.log("Audit log saved locally (guest/offline limit)");
                }
                else {
                    console.warn("Firebase log sync bypass", err);
                }
            });
        }
        catch (e) {
            console.error("Firebase module missing or err", e);
        }
        set(state => {
            return { auditLogs: [newLog, ...(state.auditLogs || [])].slice(0, 500) }; // Keep last 500 logs
        });
    }
}), {
    name: 'civic-platform-storage-v3',
    // Firestore snapshots are runtime cursors and must not be serialized by persist.
    partialize: (state) => {
        const { lastVisibleReport, reportsStatus, reportsError, ...persistedState } = state;
        void lastVisibleReport;
        void reportsStatus;
        void reportsError;
        return persistedState;
    },
}));
