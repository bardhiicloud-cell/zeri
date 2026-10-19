import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Report, User, Poll, IssueStatus, ChatSession, ChatMessage, LiveMessage, Comment, Category, ReportTimelineEvent, AppNotification, AuditLog } from '../types';
// Referenced through the bundler rather than as a literal path, so Vite copies
// the file into dist/assets with a content hash. A '/src/...' string resolves in
// the dev server and 404s in production.
import { MUNICIPALITY_STORAGE_KEY, hasPersistedScope, normalizeScope, readPersistedScope } from './municipalityScope';
import { applyTransition } from './adminApi';
import { canAccessAdmin } from './adminPermissions';
import { stageOf, type Transition } from './approvalPipeline';

/**
 * A write that fails must say so. These actions used to log to the console and
 * nothing else, so a poll, category, ad or account that could not be saved or
 * deleted (a permission, an offline browser) looked as if it had worked.
 * The toast library is loaded on demand to keep it out of the first bundle.
 */
async function reportStoreFailure(message: string, error: unknown): Promise<void> {
  console.error(error);
  try {
    const { default: toast } = await import('react-hot-toast');
    toast.error(message);
  } catch {
    // The console line above is all that is left if the toast cannot load.
  }
}

/** A donation change the database refused: say so, and leave the list as the database has it. */
function notifyDonationWriteFailed(error: unknown): void {
  const denied = (error as { code?: string })?.code === 'permission-denied';
  void reportStoreFailure(denied
    ? 'Ndryshimi i donacionit nuk u ruajt: llogaria juaj nuk ka të drejtën e administratorit në bazën e të dhënave (claim "admin"). Kërkojeni te superadministratori.'
    : 'Ndryshimi i donacionit nuk u ruajt. Kontrolloni lidhjen dhe provoni përsëri.', error);
}

export const DEMO_CITIZEN_USER: User = {
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

export const DEMO_REPORTS: Report[] = [
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

export type ReportsLoadStatus = 'loading' | 'ready' | 'error';

export interface SystemSettings {
  showReels: boolean;
  adContactPhone?: string;
  adContactEmail?: string;
  adContactCompanyName?: string;
  adSlogan?: string;
  adWhatsApp?: string;
  // AdSense credentials are NOT part of this public document. They live in
  // `settings/ads-private`, which only staff can read, because a publisher id
  // and ad slot are enough to serve or spoof the platform's ads. The fields
  // stay on this interface so components keep a single settings object; the
  // store routes them to the private document on write.
  adSenseEnabled?: boolean;
  adSenseClientId?: string;
  adSenseSlot?: string;
  adSenseCode?: string;
  adFrequencyPosts?: number;
  adFeedAlgorithm?: 'all' | 'municipality' | 'engagement' | 'smart';
}

export interface AdCampaign {
  id: string;
  title: string;
  section?: string;
  target: 'Nacionale' | string; // 'Nacionale' or municipality name
  position: 'top' | 'sidebar' | 'feed' | 'map' | 'bottom' | 'auth' | 'modal' | 'floating' | 'poll' | 'discussion' | string;
  mediaUrl: string;
  mediaType: 'image' | 'video' | 'html' | 'gif' | string;
  targetUrl?: string;
  intervalMinutes?: number; // Added for discussion ad intervals
  views: number;
  clicks: number;
  status: 'active' | 'completed' | 'paused';
  budget: string;
  /** Shown on the public Partners page as a sponsor card. */
  isPartner?: boolean;
  /** Short professional description of the partner, shown on its card. */
  partnerDescription?: string;
  /** Advertiser request this campaign was published from, if any. */
  requestId?: string;
}

export interface DonationCause {
  id: string;
  title: string;
  description: string;
  mediaType: 'image' | 'video';
  mediaUrl: string; // We can store base64 string or URL
  donationUrl: string;
  category: 'semundje' | 'shtepi' | 'ushqim' | 'veshmbathje' | 'tjera';
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

/** Outcome of a poll vote, as decided by the server. */
export type VotePollResult =
  | { status: 'voted' }
  | { status: 'already_voted'; votedOptionId?: string }
  | { status: 'expired' | 'unauthorized' | 'error'; message?: string };

interface AppState {
  isBotOpen: boolean;
  botInitialQuery: string | null;
  openBot: (query?: string) => void;
  closeBot: () => void;
  currentUser: User | null;
  users: User[];
  reports: Report[];
  reportsStatus: ReportsLoadStatus;
  reportsError: string | null;
  polls: Poll[];
  chats: ChatSession[];
  liveMessages: LiveMessage[];
  categories: Category[];
  bannedIPs: string[];
  ads: AdCampaign[];
  notifications: AppNotification[];
  systemSettings: SystemSettings;
  donationUrls: { charity: string; maintenance: string };
  donationCauses: DonationCause[];
  auditLogs: AuditLog[];

  // Actions
  setReports: (reports: Report[]) => void;
  setReportsStatus: (status: ReportsLoadStatus, error?: string | null) => void;
  appendReports: (reports: Report[]) => void;
  lastVisibleReport: any;
  setLastVisibleReport: (doc: any) => void;
  hasMoreReports: boolean;
  setHasMoreReports: (hasMore: boolean) => void;
  loadMoreReports: () => Promise<void>;
  setDonationCauses: (causes: DonationCause[]) => void;
  setPolls: (polls: Poll[]) => void;
  setAds: (ads: AdCampaign[]) => void;
  setNotifications: (notifications: AppNotification[]) => void;
  setAuditLogs: (logs: AuditLog[]) => void;
  setSystemSettings: (settings: SystemSettings) => void;
  updateSystemSettings: (settings: Partial<SystemSettings>) => Promise<void>;
  setCurrentUser: (user: User | null) => void;
  login: (user: User) => void;
  register: (user: Omit<User, 'id' | 'points' | 'badges' | 'role'>) => void;
  logout: () => void;
  addReport: (report: Omit<Report, 'id' | 'createdAt' | 'upvotes' | 'commentsCount' | 'status' | 'timeline'> & { status?: IssueStatus }) => void;
  upvoteReport: (id: string) => void;
  addPoints: (points: number) => void;
  updateDonationUrls: (urls: { charity: string; maintenance: string }) => void;
  addDonationCause: (cause: Omit<DonationCause, 'id' | 'createdAt'>) => void;
  updateDonationCause: (id: string, updates: Partial<DonationCause>) => void;
  deleteDonationCause: (id: string) => void;

  addAuditLog: (action: string, status: 'success'|'warning'|'danger', details?: string) => void;

  // Admin Actions
  updateReportStatus: (id: string, status: IssueStatus, comment?: string, resolvedImage?: string) => Promise<void>;
  assignReport: (id: string, assignedTo: string) => Promise<void>;
  deleteReport: (id: string) => void;
  banUser: (userId: string, reason?: string) => Promise<void>;
  moderateUser: (userId: string, action: 'ban' | 'unban' | 'verify' | 'unverify', reason?: string) => Promise<void>;
  banIP: (ip: string) => void;
  votePoll: (pollId: string, optionId: string) => Promise<VotePollResult>;
  createPoll: (poll: Omit<Poll, 'id' | 'totalVotes' | 'createdBy'>) => void;
  deletePoll: (id: string) => void;
  addNotification: (notification: Omit<AppNotification, 'id' | 'createdAt' | 'isRead'>) => void;
  markNotificationAsRead: (id: string) => void;
  deleteNotification: (id: string) => void;

  updatePoll: (id: string, poll: Partial<Poll>) => void;
  updateUser: (id: string, user: Partial<User>) => void;
  updateReport: (id: string, report: Partial<Report>) => void;

  addCategory: (category: Omit<Category, 'id'>) => void;
  deleteCategory: (id: string) => void;

  // Ads
  createAd: (ad: Omit<AdCampaign, 'id' | 'views' | 'clicks'>) => Promise<string | null>;
  updateAd: (id: string, updates: Partial<AdCampaign>) => Promise<void>;
  deleteAd: (id: string) => void;
  updateAdStatus: (id: string, status: AdCampaign['status']) => void;
  incrementAdView: (id: string) => void;
  incrementAdClick: (id: string) => void;

  deleteUser: (id: string) => void;

  // Chat / Comments
  addComment: (reportId: string, content: string, user: User) => void;

  startChat: (userId: string, userName: string) => void;
  sendMessage: (chatId: string, text: string, sender: 'user' | 'agent' | 'ai') => void;
  closeChat: (chatId: string) => void;
  clearChat: (chatId: string) => void;
  rateChat: (chatId: string, rating: number) => void;

  /**
   * The municipality the whole platform is currently scoped to.
   *
   * `null` is no longer a legal value: it meant "not chosen yet" to some readers
   * and "all" to others, and the location detector relied on that ambiguity to
   * decide whether to open. The store now always holds either a canonical
   * municipality name or {@link ALL_SCOPE}, and the detector keys off the
   * absence of a persisted choice instead.
   */
  userMunicipality: string;
  setUserMunicipality: (city: string | null) => void;
  /** True once a municipality has ever been chosen in this browser. */
  hasChosenMunicipality: boolean;

  addLiveMessage: (text: string, user: User | null, guestName: string, simulatedIP: string) => void;
  initialize: () => void;
  checkSLAs: () => void;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      currentUser: null,
      userMunicipality: readPersistedScope(),
      hasChosenMunicipality: hasPersistedScope(),
      /**
       * The single writer. Every surface that changes the scope — the sidebar
       * switcher, the top bar, the map, the dashboard hero, the geolocator —
       * goes through here, so the persisted value and the reactive value can
       * never disagree. The four call sites that used to call `setUserMunicipality`
       * *and* write `localStorage` separately are the reason a page reload used
       * to restore a stale municipality.
       */
      setUserMunicipality: (city) => {
        const scope = normalizeScope(city);
        try {
          localStorage.setItem(MUNICIPALITY_STORAGE_KEY, scope);
        } catch {
          // Storage can be unavailable; the in-memory scope still works.
        }
        set({ userMunicipality: scope, hasChosenMunicipality: true });
      },
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
        adContactPhone: '',
        adContactEmail: '',
        adContactCompanyName: 'Platforma Qytetare Reklama',
        adSlogan: 'Maksimalizoni shikueshmërinë e biznesit tuaj me promovim të synuar në komunën tuaj',
        adWhatsApp: ''
      },
      // No built-in demo campaigns: only ads from Firestore are ever shown, with their real counters.
      ads: [] as AdCampaign[],
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
        } catch (e) {
          // Showing it in the list anyway made a refused save look done until the next reload.
          notifyDonationWriteFailed(e);
          return;
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
        } catch (e) {
          notifyDonationWriteFailed(e);
          return;
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
        } catch (e) {
          notifyDonationWriteFailed(e);
          return;
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
        if (!state.hasMoreReports || !state.lastVisibleReport) return;

        // The public feed pages by date through the server, not by Firestore document.
        const publicCursor = (state.lastVisibleReport as { publicFeedCursor?: string }).publicFeedCursor;
        if (publicCursor) {
          try {
            const { fetchPublicReports } = await import('./publicReportsApi');
            const page = await fetchPublicReports({ cursor: publicCursor });
            state.appendReports(page.items);
            set({ lastVisibleReport: page.nextCursor ? { publicFeedCursor: page.nextCursor } : null, hasMoreReports: Boolean(page.nextCursor) });
          } catch (err) {
            console.error('Error loading more reports', err);
          }
          return;
        }
        
        try {
          const { db } = await import('./firebase');
          const { collection, query, orderBy, limit, startAfter, getDocs } = await import('firebase/firestore');
          
          const q = query(
            collection(db, "reports"), 
            orderBy("createdAt", "desc"), 
            startAfter(state.lastVisibleReport),
            limit(100)
          );
          
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
            } else if (createdAt && typeof createdAt === 'object' && createdAt.seconds) {
              createdAt = new Date(createdAt.seconds * 1000).toISOString();
            }
            return {
              ...data,
              id: doc.id,
              createdAt: createdAt || new Date().toISOString()
            } as Report;
          });
          
          state.appendReports(nextReports);
          
          if (snapshot.docs.length < 100) {
            set({ hasMoreReports: false });
          }
        } catch (err) {
          console.error("Error loading more reports", err);
        }
      },
      setDonationCauses: (donationCauses) => set({ donationCauses }),
      setPolls: (polls) => set({ polls }),
      setAds: (ads) => set({ ads }),
      setNotifications: (notifications) => set({ notifications }),
      setAuditLogs: (auditLogs) => set({ auditLogs }),
      setSystemSettings: (settings) => set({ systemSettings: settings }),
      /**
       * Persist system settings, splitting public from private fields.
       *
       * The settings document is world-readable because the public site needs
       * `showReels` and the ad contact details to render. It also held the
       * AdSense credentials, which meant the publisher id, slot and ad code were
       * readable by anyone — enough to spoof or siphon the ad account.
       *
       * Credentials now go to `settings/ads-private`, which is staff-only in
       * Firestore rules. The object handed to callers is unchanged, so no
       * component had to learn about the split.
       */
      updateSystemSettings: async (settings) => {
        set(s => ({ systemSettings: { ...s.systemSettings, ...settings } }));
        try {
          const { db } = await import('./firebase');
          const { doc, setDoc } = await import('firebase/firestore');

          const PRIVATE_KEYS = [
            'adSenseEnabled', 'adSenseClientId', 'adSenseSlot', 'adSenseCode',
          ] as const;

          const merged = { ...get().systemSettings } as Record<string, unknown>;

          const privateFields: Record<string, unknown> = {};
          const publicFields: Record<string, unknown> = { ...merged };
          for (const key of PRIVATE_KEYS) {
            if (key in merged) {
              privateFields[key] = merged[key];
              delete publicFields[key];
            }
          }

          await setDoc(doc(db, 'settings', 'general'), publicFields, { merge: true });

          // Written separately so a failure to store the credentials cannot stop
          // the public settings from saving; an ad-slot edit and a site-wide
          // feature flag should not share a failure mode.
          if (Object.keys(privateFields).length > 0) {
            try {
              await setDoc(doc(db, 'settings', 'ads-private'), privateFields, { merge: true });
            } catch (e) {
              console.error('Firebase error updating private ad settings:', e);
            }
          }
        } catch (e) { console.error("Firebase error updating settings:", e); }
      },
      setCurrentUser: (user) => set({ currentUser: user }),
      login: (user) => {
        set({ currentUser: user });
        get().addAuditLog('User Login', 'success', `User logged in: ${user.email} Role: ${user.role}`);
      },
      
      register: (userData) => {
        const newUser: User = {
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
        // Every logout button ends the Firebase session too; otherwise a refresh
        // restores the account from the persisted token.
        void Promise.all([import('./firebase'), import('firebase/auth')])
          .then(([{ auth }, { signOut }]) => signOut(auth))
          .catch(() => undefined);
        try { localStorage.removeItem('zq-demo-user'); } catch { /* storage unavailable */ }
        get().addAuditLog('User Logout', 'success', `User logged out: ${email}`);
      },

      initialize: () => {
        const s = get();

        // Demo seed data is a development convenience only. In a production
        // build an empty Firestore must render as empty (real empty states),
        // never as 21 fake reports that look like live civic data.
        if (import.meta.env.DEV) {
          if (s.reports.length === 0) {
            set({ reports: DEMO_REPORTS });
          }

          if (s.users.length === 0) {
            set({ users: [DEMO_CITIZEN_USER] });
          }
        }

        // Development convenience only: restoring a user object from localStorage in
        // a production build would let anyone type a role into storage and see the
        // admin UI (the server and rules still refused them, but the UI shouldn't open).
        if (import.meta.env.DEV && !s.currentUser && typeof window !== 'undefined') {
          const saved = localStorage.getItem('zq-demo-user');
          if (saved) {
            try {
              const parsed = JSON.parse(saved);
              set({ currentUser: parsed });
            } catch (e) {
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
              return { ...r, status: 'Overdue' as IssueStatus };
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
        const reportData: Report = {
          ...reportParams,
          id: (reportParams as any).id || Math.random().toString(36).substr(2, 9),
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
        /**
         * The server owns the counter. The previous version bumped the number
         * locally and then tried to write it to Firestore, where the rules refuse
         * anyone but the author - so the +1 shown to the citizen was never saved.
         * The count shown now is the one the server returns.
         */
        try {
          const { authHeaders } = await import('./apiAuth');
          const response = await fetch(`/api/v1/reports/${encodeURIComponent(id)}/upvote`, {
            method: 'POST',
            headers: await authHeaders(),
          });
          if (response.ok) {
            const body = await response.json().catch(() => null) as { upvotes?: number } | null;
            if (typeof body?.upvotes === 'number') {
              const upvotes = body.upvotes;
              set(state => ({
                reports: state.reports.map(r => r.id === id ? { ...r, upvotes } : r),
              }));
            }
          } else if (response.status !== 409) {
            console.warn('Upvote was not saved', response.status);
          }
        } catch (e) {
          console.warn('Upvote was not saved', e);
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
                const badges: string[] = ['Qytetar i Ri 🎖️'];
                if (newPoints >= 100) badges.push('Qytetar Aktiv ⚡');
                if (newPoints >= 250) badges.push('Mbrojtës i Komunitetit 🛡️');
                if (newPoints >= 500) badges.push('Kampion i Gjelbër 🌿');
                if (newPoints >= 1000) badges.push('Ambasador i Kosovës 🌟');
                return { ...u, points: newPoints, badges };
              }
              return u;
            });
            const user = updatedUsers.find(u => u.id === currentUser.id);
            return { users: updatedUsers, currentUser: user || null };
          });
        }
      },

      /**
       * Move a report along the pipeline, through the server.
       *
       * ─── Why this is no longer an `updateDoc` ──────────────────────────────
       *
       * Writing `status` straight to Firestore is now refused by the rules, and
       * rightly so: the approval pipeline is a set of gates (agent → municipality
       * → staff) and a gate a client can step around is not a gate. The state
       * machine lives on the server, so this maps the status it used to write onto
       * the transition that produces it and lets the server decide.
       *
       * The optimistic local update is kept: the panel the operator is looking at
       * should not wait for a round trip to redraw. If the server refuses, the
       * refusal is surfaced and the next Firestore snapshot restores the true
       * state — a brief optimistic paint, never a durable lie.
       */
      updateReportStatus: async (id, status, comment, resolvedImage?: string) => {
        const currentUser = get().currentUser;
        const state = get();
        const report = state.reports.find(r => r.id === id);

        /** The transition that writes this status, given where the report is now. */
        const transitionFor = (target: IssueStatus): Transition | null => {
          const stage = report ? stageOf(report) : 'submitted';
          switch (target) {
            case 'Pending Review':
              return 'claim';
            case 'Approved':
              return 'pass_to_municipality';
            case 'In Progress':
              return 'municipality_accept';
            case 'Resolved':
              return stage === 'published' || stage === 'responded'
                ? 'staff_verify'
                : 'municipality_done';
            case 'Rejected':
              return 'reject';
            default:
              return null;
          }
        };

        const transition = transitionFor(status);
        if (transition) {
          try {
            await applyTransition({
              reportId: id,
              transition,
              note: comment,
              resolvedImage,
            });
          } catch (e) {
            console.error('Pipeline transition refused:', (e as Error)?.message);
            // The server's own wording already explains the refusal in the
            // operator's language, so it is shown rather than swallowed.
            throw e;
          }
        }

        const newTimelineEvent: ReportTimelineEvent = {
          id: Math.random().toString(36).substr(2, 9),
          status,
          date: new Date().toISOString(),
          updatedBy: currentUser?.name || 'Zyrtar',
          comment: comment || ''
        };

        const resolvedAt = status === 'Resolved' ? new Date().toISOString() : report?.resolvedAt;

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
        const report = get().reports.find(r => r.id === id);

        // Claiming is a pipeline transition ('claim'), so it goes through the
        // same server gate as every other move — the agent that may take a report
        // is decided by the server, not by the button that was clicked.
        try {
          await applyTransition({
            reportId: id,
            transition: 'claim',
            assignedTo,
            note: `Caktuar te ${assignedTo}`,
          });
        } catch (e) {
          console.error('Claim refused:', (e as Error)?.message);
          throw e;
        }

        const newTimelineEvent: ReportTimelineEvent = {
          id: Math.random().toString(36).substr(2, 9),
          status: 'Assigned',
          date: new Date().toISOString(),
          updatedBy: currentUser?.name || 'Zyrtar',
          comment: `Caktuar te ${assignedTo}`
        };

        set(state => ({
          reports: state.reports.map(r => r.id === id
            ? { ...r, assignedTo, assignedToUid: currentUser?.id ?? r.assignedToUid, status: report?.status ?? r.status, timeline: [...(r.timeline || []), newTimelineEvent] }
            : r)
        }));
      },

      deleteReport: async (id) => {
        try {
          const { db } = await import('./firebase');
          const { doc, deleteDoc } = await import('firebase/firestore');
          await deleteDoc(doc(db, 'reports', id));
        } catch(e) {
          console.error("Gabim gjate fshirjes:", e);
          alert("Nuk mund të fshihet dosja. Ju lutem provoni përsëri.");
        }
        set(s => ({ reports: s.reports.filter(r => r.id !== id) }));
      },

      banUser: async (userId, reason) => {
        // Server-side: the ban also disables the sign-in and ends the person's
        // sessions. A browser write only set a flag, and swallowed its own errors.
        await get().moderateUser(userId, 'ban', reason);
      },

      moderateUser: async (userId, action, reason) => {
        const { authHeaders } = await import('./apiAuth');
        const response = await fetch(`/api/v1/admin/users/${encodeURIComponent(userId)}/moderate`, {
          method: 'POST',
          headers: await authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ action, reason }),
        });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body?.error || 'Veprimi nuk u krye.');
        }
        // Reflect it locally so the list updates without waiting for the listener.
        set(s => ({
          users: s.users.map(u => u.id === userId
            ? { ...u, ...(action === 'ban' ? { isBanned: true } : action === 'unban' ? { isBanned: false } : { isVerified: action === 'verify' }) }
            : u),
        }));
      },

      votePoll: async (pollId, optionId) => {
        /**
         * The server owns poll counters: it records one vote per account in a
         * document the browser cannot write, and returns the new totals. The old
         * code updated `options` straight from the client, which both let anyone
         * set any result and trusted `localStorage` to stop double voting.
         */
        try {
          const { authHeaders } = await import('./apiAuth');
          const response = await fetch(`/api/v1/polls/${encodeURIComponent(pollId)}/vote`, {
            method: 'POST',
            headers: await authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ optionId }),
          });
          const body = await response.json().catch(() => null) as
            | { options?: Poll['options']; totalVotes?: number; votedOptionId?: string; error?: string }
            | null;

          if (response.status === 409) {
            return { status: 'already_voted', votedOptionId: body?.votedOptionId };
          }
          if (response.status === 410) return { status: 'expired' };
          if (response.status === 401) return { status: 'unauthorized' };
          if (!response.ok || !body?.options) return { status: 'error', message: body?.error };

          set(s => ({
            polls: s.polls.map(p =>
              p.id === pollId ? { ...p, options: body.options!, totalVotes: body.totalVotes ?? p.totalVotes } : p
            ),
          }));
          return { status: 'voted' };
        } catch (e) {
          console.error('Poll vote failed', e);
          return { status: 'error' };
        }
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
        } catch(e) { void reportStoreFailure('Sondazhi nuk u krijua. Kontrolloni lejet dhe provoni përsëri.', e); }
      },

      deletePoll: async (id) => {
        try {
          const { db } = await import('./firebase');
          const { doc, deleteDoc } = await import('firebase/firestore');
          await deleteDoc(doc(db, 'polls', id));
        } catch(e) { void reportStoreFailure('Sondazhi nuk u fshi. Kontrolloni lejet dhe provoni përsëri.', e); }
      },

      updatePoll: async (id, updatedPoll) => {
        try {
          const { db } = await import('./firebase');
          const { doc, updateDoc } = await import('firebase/firestore');
          await updateDoc(doc(db, 'polls', id), updatedPoll);
        } catch(e) { void reportStoreFailure('Sondazhi nuk u ndryshua. Kontrolloni lejet dhe provoni përsëri.', e); }
      },
      
      updateUser: async (id, updatedUser) => {
        // Privileged fields are never written from the browser: the Firestore
        // rules refuse them and the server owns them (role, ban, verification,
        // points, permissions, municipality, email). They are dropped here too so
        // a caller cannot even try. Errors are rethrown so the screen can say the
        // save failed instead of announcing a success that did not happen.
        const PRIVILEGED = ['role', 'isBanned', 'isVerified', 'points', 'permissions', 'municipality', 'municipalityPlan', 'badges', 'email', 'password', 'internalNote'];
        const safeUpdates = Object.fromEntries(
          Object.entries(updatedUser as Record<string, unknown>).filter(([key]) => !PRIVILEGED.includes(key))
        );
        if (Object.keys(safeUpdates).length > 0) {
          const { db } = await import('./firebase');
          const { doc, updateDoc } = await import('firebase/firestore');
          await updateDoc(doc(db, 'users', id), safeUpdates);
        }
        set(s => {
          const newUsers = s.users.map(u => u.id === id ? { ...u, ...safeUpdates } : u);
          return {
            users: newUsers,
            currentUser: s.currentUser?.id === id ? newUsers.find(u => u.id === id) || s.currentUser : s.currentUser
          };
        });
      },

      updateReport: async (id, updatedReport) => {
        try {
          const { db } = await import('./firebase');
          const { doc, updateDoc } = await import('firebase/firestore');
          const reportRef = doc(db, 'reports', id);
          
          const safeUpdates: any = {};
          if (updatedReport.title !== undefined) safeUpdates.title = updatedReport.title;
          if (updatedReport.description !== undefined) safeUpdates.description = updatedReport.description;
          if (updatedReport.category !== undefined) safeUpdates.category = updatedReport.category;
          if (updatedReport.urgency !== undefined) safeUpdates.urgency = updatedReport.urgency;
          if (updatedReport.images !== undefined) safeUpdates.images = updatedReport.images;
          if (updatedReport.location !== undefined) safeUpdates.location = updatedReport.location;
          if (updatedReport.status !== undefined) safeUpdates.status = updatedReport.status;
          if (updatedReport.resolvedImage !== undefined) safeUpdates.resolvedImage = updatedReport.resolvedImage;
          if (updatedReport.resolvedAt !== undefined) safeUpdates.resolvedAt = updatedReport.resolvedAt;

          await updateDoc(reportRef, safeUpdates);
        } catch (e) {
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
        } catch(e) { void reportStoreFailure('Kategoria nuk u shtua. Kontrolloni lejet dhe provoni përsëri.', e); }
      },

      deleteCategory: async (id) => {
        try {
          const { db } = await import('./firebase');
          const { doc, deleteDoc } = await import('firebase/firestore');
          await deleteDoc(doc(db, 'categories', id));
        } catch(e) { void reportStoreFailure('Kategoria nuk u fshi. Kontrolloni lejet dhe provoni përsëri.', e); }
      },
      
      createAd: async (ad) => {
        try {
          const { db } = await import('./firebase');
          const { doc, setDoc } = await import('firebase/firestore');
          const id = `AD-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
          await setDoc(doc(db, 'ads', id), { ...ad, id, views: 0, clicks: 0 });
          return id;
        } catch(e) {
          console.error('Gabim gjatë publikimit të reklamës:', e);
          return null;
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
        } catch(e) { console.error("Firebase error updating ad:", e); }
      },
      deleteAd: async (id) => {
        try {
          const { db } = await import('./firebase');
          const { doc, deleteDoc } = await import('firebase/firestore');
          await deleteDoc(doc(db, 'ads', id));
        } catch(e) { void reportStoreFailure('Reklama nuk u fshi. Kontrolloni lejet dhe provoni përsëri.', e); }
      },
      updateAdStatus: async (id, status) => {
        try {
          const { db } = await import('./firebase');
          const { doc, updateDoc } = await import('firebase/firestore');
          await updateDoc(doc(db, 'ads', id), { status });
        } catch(e) { void reportStoreFailure('Statusi i reklamës nuk u ndryshua. Kontrolloni lejet dhe provoni përsëri.', e); }
      },
      incrementAdView: async (id) => {
        try {
          const { db } = await import('./firebase');
          const { doc, increment, updateDoc } = await import('firebase/firestore');
          await updateDoc(doc(db, 'ads', id), { views: increment(1) });
        } catch(e) { console.error(e); }
      },
      incrementAdClick: async (id) => {
        try {
          const { db } = await import('./firebase');
          const { doc, increment, updateDoc } = await import('firebase/firestore');
          await updateDoc(doc(db, 'ads', id), { clicks: increment(1) });
        } catch(e) { console.error(e); }
      },
      
      deleteUser: async (id) => {
        try {
          const { db } = await import('./firebase');
          const { doc, deleteDoc } = await import('firebase/firestore');
          await deleteDoc(doc(db, 'users', id));
        } catch(e) { void reportStoreFailure('Llogaria nuk u fshi. Kontrolloni lejet dhe provoni përsëri.', e); }
      },

      addComment: (reportId, content, user) => {
        const newComment: Comment = {
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
          if (s.chats.some(c => c.userId === userId && c.status === 'active')) return s;
          const newChat: ChatSession = {
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

        const newMessage: LiveMessage = {
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
        const newNotification: AppNotification = {
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
        const newLog: AuditLog = {
          id: Math.random().toString(36).substr(2, 9),
          action,
          status,
          details,
          userId: user?.id || 'system',
          userEmail: user?.email || 'System',
          // Captured here, from the live session, rather than reconstructed by
          // the monitoring view. Both fields are what let an administrator ask
          // "what did this agent do in Prizren last week" and get an answer.
          userName: user?.name || 'System',
          municipality: normalizeScope(state.userMunicipality),
          ip: '127.0.0.1', // Mock IP
          createdAt: new Date().toISOString()
        };

        // Staff actions are recorded by the server, which stamps the real identity
        // from the verified token. Other visitors keep a local-only log, exactly as
        // before (the Firestore rule never let them write one).
        if (user && canAccessAdmin(user)) {
          void (async () => {
            try {
              const { authHeaders } = await import('./apiAuth');
              await fetch('/api/v1/audit', {
                method: 'POST',
                headers: await authHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ action, status, details, municipality: newLog.municipality }),
              });
            } catch (e) {
              console.warn('Audit log sync bypass', e);
            }
          })();
        }

        set(state => {
          return { auditLogs: [newLog, ...(state.auditLogs || [])].slice(0, 500) }; // Keep last 500 logs
        });
      }
    }),
    {
      name: 'civic-platform-storage-v3',
      // Firestore snapshots are runtime cursors and must not be serialized by persist.
      partialize: (state) => {
        const { lastVisibleReport, reportsStatus, reportsError, ...persistedState } = state;
        void lastVisibleReport;
        void reportsStatus;
        void reportsError;
        return persistedState;
      },
    }
  )
);
