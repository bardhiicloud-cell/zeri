import type { IssueStatus, Report, User, HealthCase, AuditLog } from '../src/types';

const now = Date.now();
const daysAgo = (days: number) => new Date(now - days * 86_400_000).toISOString();
const ADMIN_UID = 'prototype-superadmin';

export const PROTOTYPE_ADMIN = {
  uid: ADMIN_UID,
  email: 'admin@kosova.com',
  password: 'admin123',
  name: 'Admin Prototipi',
  role: 'superadmin' as const,
};

const prototypeAdminProfile = {
  id: ADMIN_UID,
  email: PROTOTYPE_ADMIN.email,
  name: PROTOTYPE_ADMIN.name,
  role: PROTOTYPE_ADMIN.role,
  permissions: [],
  points: 0,
  badges: ['Prototip lokal'],
  isVerified: true,
  isBanned: false,
  createdAt: daysAgo(60),
} as User;

const staffSeeds = [
  ['agent-prishtine', 'Arta Berisha', 'arta.berisha@kosova.com', 'agent', 'Prishtinë'],
  ['agent-prizren', 'Ilir Krasniqi', 'ilir.krasniqi@kosova.com', 'agent', 'Prizren'],
  ['agent-gjilan', 'Drita Gashi', 'drita.gashi@kosova.com', 'responder', 'Gjilan'],
  ['agent-peje', 'Luan Hoxha', 'luan.hoxha@kosova.com', 'dispatcher', 'Pejë'],
  ['agent-gjakove', 'Besa Morina', 'besa.morina@kosova.com', 'approver', 'Gjakovë'],
  ['agent-ferizaj', 'Arben Shala', 'arben.shala@kosova.com', 'newsadmin', 'Ferizaj'],
  ['agent-mitrovice', 'Elira Bytyqi', 'elira.bytyqi@kosova.com', 'adsadmin', 'Mitrovicë'],
  ['agent-vushtrri', 'Besnik Rama', 'besnik.rama@kosova.com', 'agent', 'Vushtrri'],
  ['agent-rahovec', 'Vjosa Kelmendi', 'vjosa.kelmendi@kosova.com', 'approver', 'Rahovec'],
  ['agent-prishtine-2', 'Ardian Selimi', 'ardian.selimi@kosova.com', 'agent', 'Prishtinë'],
  ['agent-offline', 'Mira Hoxha', 'mira.hoxha@kosova.com', 'agent', 'Pejë'],
] as const;

export const PROTOTYPE_USERS: User[] = [
  prototypeAdminProfile,
  ...staffSeeds.map(([id, name, email, role, municipality], index) => ({
    id,
    name,
    email,
    role,
    municipality,
    points: 20 + index * 5,
    badges: ['Staf testues'],
    isVerified: index !== 10,
    isBanned: false,
    phone: `+383 44 20${String(index).padStart(2, '0')} ${String(100 + index)}`,
    permissions: [],
    notes: index === 10 ? 'Llogari prove joaktive — të përdoret për testet e kërkimit.' : '',
    createdAt: daysAgo(index + 2),
  })) as User[],
  ...Array.from({ length: 12 }, (_, index) => ({
    id: `citizen-${String(index + 1).padStart(3, '0')}`,
    name: ['Nora Dervishi', 'Faton Krasniqi', 'Rina Shabani', 'Valon Berisha'][index % 4] + (index > 3 ? ` ${index + 1}` : ''),
    email: `qytetar${index + 1}@shembull.test`,
    phone: `+383 49 200 ${String(index + 1).padStart(3, '0')}`,
    role: 'citizen' as const,
    points: 45 + index * 37,
    badges: ['Qytetar Aktiv'],
    isVerified: index % 4 !== 0,
    isBanned: index === 11,
    permissions: [],
    notes: '',
    createdAt: daysAgo(index + 1),
  })),
];

const municipalities = ['Prishtinë', 'Prizren', 'Gjilan', 'Pejë', 'Gjakovë', 'Ferizaj', 'Mitrovicë', 'Vushtrri', 'Rahovec', 'Suharekë'];
const reportRows: Array<{ title: string; category: string; urgency: Report['urgency']; status: IssueStatus }> = [
  { title: 'Gropa në rrugën kryesore pranë shkollës', category: 'Infrastrukturë rrugore', urgency: 'Kritike', status: 'Pending Review' },
  { title: 'Ndriçimi publik nuk punon prej tri ditësh', category: 'Ndriçim publik', urgency: 'E lartë', status: 'In Progress' },
  { title: 'Kanalizim i bllokuar në lagjen e re', category: 'Ujë & Kanalizim', urgency: 'Kritike', status: 'Approved' },
  { title: 'Mbeturina të grumbulluara në park', category: 'Mjedis & Pastrim', urgency: 'Mesatare', status: 'Assigned' },
  { title: 'Trotuari i dëmtuar pranë qendrës', category: 'Trotuarë', urgency: 'E lartë', status: 'Resolved' },
  { title: 'Sinjalistikë e dëmtuar në udhëkryq', category: 'Siguri rrugore', urgency: 'E lartë', status: 'Pending Review' },
  { title: 'Rrjedhje uji në rrugën e banimit', category: 'Ujë & Kanalizim', urgency: 'Mesatare', status: 'In Progress' },
  { title: 'Zhurmë e tepruar pas mesnate', category: 'Inspektim komunal', urgency: 'E ulët', status: 'Rejected' },
  { title: 'Pusetë e hapur krijon rrezik për këmbësorë', category: 'Infrastrukturë publike', urgency: 'Kritike', status: 'Overdue' },
  { title: 'Kontejner i dëmtuar pranë tregut', category: 'Mbeturinat urbane', urgency: 'Mesatare', status: 'Approved' },
  { title: 'Rrugë lokale ka nevojë për riparim', category: 'Infrastrukturë rrugore', urgency: 'E lartë', status: 'In Progress' },
  { title: 'Pema e rrëzuar bllokon shtegun', category: 'Parqe dhe hapësira të gjelbra', urgency: 'E lartë', status: 'Assigned' },
  { title: 'Shenjë e paqartë e kalimit për këmbësorë', category: 'Siguri rrugore', urgency: 'Mesatare', status: 'Pending Review' },
  { title: 'Uji qëndron në hyrje pas reshjeve', category: 'Ujë & Kanalizim', urgency: 'Mesatare', status: 'Resolved' },
  { title: 'Ndriçim i dobët në stacionin e autobusit', category: 'Ndriçim publik', urgency: 'E lartë', status: 'In Progress' },
  { title: 'Grumbullim mbeturinash në zonë banimi', category: 'Mjedis & Pastrim', urgency: 'E ulët', status: 'Approved' },
  { title: 'Rampë e dëmtuar për qasje me karrocë', category: 'Qasje dhe përfshirje', urgency: 'E lartë', status: 'Pending Review' },
  { title: 'Rrezik nga kabllot pranë hapësirës publike', category: 'Siguri publike', urgency: 'Kritike', status: 'Overdue' },
  { title: 'Stoli të dëmtuara në parkun e qytetit', category: 'Parqe dhe hapësira të gjelbra', urgency: 'E ulët', status: 'Resolved' },
  { title: 'Trotuar i bllokuar nga automjetet', category: 'Trotuarë', urgency: 'Mesatare', status: 'Assigned' },
  { title: 'Rrjedhje nga gypi pranë ndërtesës publike', category: 'Ujë & Kanalizim', urgency: 'Kritike', status: 'In Progress' },
  { title: 'Gropë e vogël në rrugën dytësore', category: 'Infrastrukturë rrugore', urgency: 'E ulët', status: 'Draft' },
  { title: 'Sinjalizim i dëmtuar pranë çerdhes', category: 'Siguri rrugore', urgency: 'Kritike', status: 'Pending Review' },
  { title: 'Mbeturina pas tregut javor', category: 'Mjedis & Pastrim', urgency: 'Mesatare', status: 'Resolved' },
  { title: 'Ndriçimi i sheshit fiket herë pas here', category: 'Ndriçim publik', urgency: 'E ulët', status: 'Approved' },
  { title: 'Pusetë e bllokuar në zonën industriale', category: 'Ujë & Kanalizim', urgency: 'E lartë', status: 'In Progress' },
  { title: 'Hyrja në park ka nevojë për rregullim', category: 'Infrastrukturë publike', urgency: 'Mesatare', status: 'Rejected' },
  { title: 'Rrugë e dëmtuar afër ambulancës', category: 'Infrastrukturë rrugore', urgency: 'Kritike', status: 'Pending Review' },
];

const agentNames = staffSeeds.map(([, name]) => name);
export const PROTOTYPE_REPORTS: Report[] = reportRows.map((row, index) => {
  const municipality = municipalities[index % municipalities.length];
  const authorId = `citizen-${String((index % 12) + 1).padStart(3, '0')}`;
  const agentName = agentNames[index % agentNames.length];
  const createdAt = daysAgo(index === 8 || index === 17 ? 6 : index % 3 === 0 ? 1 : index + 1);
  return {
    id: `proto-report-${String(index + 1).padStart(3, '0')}`,
    trackingId: `ZQ-P${String(index + 1).padStart(4, '0')}`,
    title: row.title,
    description: `Raport demonstrues për testimin e panelit administrativ në ${municipality}. Ka fotografi dhe dëshmi për verifikim nga agjenti përgjegjës.`,
    category: row.category,
    urgency: row.urgency,
    status: row.status,
    location: {
      municipality,
      address: `${['Rruga e Shkollës', 'Qendra', 'Lagjja e Re', 'Sheshi i Qytetit'][index % 4]}, ${municipality}`,
      lat: 42.4 + (index % 11) * 0.035,
      lng: 20.7 + (index % 9) * 0.042,
    },
    images: [],
    upvotes: 8 + index * 3,
    commentsCount: index % 9,
    authorId,
    authorName: PROTOTYPE_USERS.find((user) => user.id === authorId)?.name || 'Qytetar testues',
    isAnonymous: index % 8 === 0,
    assignedTo: index % 4 === 1 ? agentName : undefined,
    createdAt,
    updatedAt: createdAt,
    responseDueAt: index % 7 === 0 ? daysAgo(1) : new Date(now + 24 * 60 * 60 * 1000).toISOString(),
    responsibleLevel: 'Komunale',
    responsibleInstitution: `Drejtoria e ${['Shërbimeve Publike', 'Infrastrukturës', 'Mjedisit'][index % 3]}`,
    timeline: [
      { id: `timeline-${index + 1}-1`, status: 'Pending Review', date: createdAt, updatedBy: 'Sistemi', comment: 'Raportimi u pranua.' },
      ...(row.status !== 'Pending Review' ? [{ id: `timeline-${index + 1}-2`, status: row.status, date: daysAgo(Math.max(0, Math.floor(index / 3))), updatedBy: agentName, comment: 'Përditësim nga stafi testues.' }] : []),
    ],
  } as Report;
});

export const PROTOTYPE_HEALTH_CASES: HealthCase[] = [
  {
    id: 'proto-health-001', trackingId: 'SH-P001', fullName: 'A. Qytetar (test)', age: 54, gender: 'Femër', municipality: 'Prishtinë', neighborhood: 'Qendra',
    category: 'Sëmundje të Zemrës', diagnosis: 'Nevojë për konsultë kardiologjike', diagnosedYear: 2024, urgency: 'Urgjente', needs: ['Konsultë mjekësore', 'Transport'],
    description: 'Rast demonstrues për filtrat, statusin dhe privatësinë e regjistrit shëndetësor.', contactPhone: '+383 44 000 111', contactName: 'Familjari testues',
    isAnonymous: false, status: 'pending', hospitalNotified: false, createdAt: daysAgo(1), consentToProcessing: true,
  },
  {
    id: 'proto-health-002', trackingId: 'SH-P002', fullName: 'B. Qytetar (test)', age: 38, gender: 'Mashkull', municipality: 'Prizren', neighborhood: 'Bazhderhane',
    category: 'Diabet me Komplikime', diagnosis: 'Kontroll dhe këshillim i rregullt', diagnosedYear: 2023, urgency: 'Mesatare', needs: ['Barna'],
    description: 'Të dhëna fiktive për prototip lokal; nuk identifikojnë pacient real.', isAnonymous: true, status: 'verified', hospitalNotified: true, createdAt: daysAgo(8), consentToProcessing: true,
  },
  {
    id: 'proto-health-003', trackingId: 'SH-P003', fullName: 'C. Qytetar (test)', age: 67, gender: 'Tjetër', municipality: 'Gjilan', neighborhood: 'Dheu i Bardhë',
    category: 'Sëmundje të Mushkërive', diagnosis: 'Vlerësim periodik i nevojshëm', diagnosedYear: 2022, urgency: 'Kronike e Stabilizuar', needs: ['Kontroll'],
    description: 'Rast i simuluar për të testuar historikun dhe eksportet.', isAnonymous: false, status: 'resolved', hospitalNotified: true, createdAt: daysAgo(22), consentToProcessing: true,
  },
];

const actionNames = ['Report Approved', 'Report Status Updated', 'Agent Edited', 'WorkFact Verified', 'Notification Sent', 'Report Assigned', 'Failed Login', 'Health Case Reviewed'];
const logStatuses: AuditLog['status'][] = ['success', 'success', 'warning', 'danger'];
export const PROTOTYPE_AUDIT_LOGS: AuditLog[] = Array.from({ length: 36 }, (_, index) => {
  const staffIndex = index % staffSeeds.length;
  const [userId, userName, userEmail, , municipality] = staffSeeds[staffIndex];
  return {
    id: `proto-log-${String(index + 1).padStart(3, '0')}`,
    action: actionNames[index % actionNames.length],
    userId,
    userName,
    userEmail,
    municipality,
    status: logStatuses[index % logStatuses.length],
    details: `Veprim demonstrues #${index + 1} në mjedisin lokal të testimit.`,
    ip: '127.0.0.1',
    createdAt: new Date(now - (index % 19) * 7 * 60 * 60 * 1000).toISOString(),
  } as AuditLog;
});

export const PROTOTYPE_WORK_FACTS = [
  { id: 'proto-fact-001', reportId: PROTOTYPE_REPORTS[4].id, description: 'Është riparuar sipërfaqja e trotuarit; pretendim demonstrues në pritje të verifikimit.', completedAt: daysAgo(2), performedBy: 'Ekipi komunal testues', cost: '1,250 €', attachments: [], municipality: 'Ferizaj', authorEmail: 'komuna.test@kosova.test', review: 'pending', createdAt: daysAgo(1) },
  { id: 'proto-fact-002', reportId: PROTOTYPE_REPORTS[13].id, description: 'U pastrua hyrja e kanalizimit. Evidencë testuese e ngarkuar për provë.', completedAt: daysAgo(6), performedBy: 'Shërbimet testuese', cost: '350 €', attachments: [], municipality: 'Ferizaj', authorEmail: 'komuna.test@kosova.test', review: 'confirmed', createdAt: daysAgo(5) },
  { id: 'proto-fact-003', reportId: PROTOTYPE_REPORTS[18].id, description: 'U vendosën stola të rinj në park. Regjistrim fiktiv.', completedAt: daysAgo(10), performedBy: 'Ekipi testues', cost: '800 €', attachments: [], municipality: 'Mitrovicë', authorEmail: 'komuna.mitrovice@kosova.test', review: 'rejected', createdAt: daysAgo(9) },
];

export const PROTOTYPE_COLLECTIONS: Record<string, Array<Record<string, unknown>>> = {
  reports: PROTOTYPE_REPORTS as unknown as Array<Record<string, unknown>>,
  users: PROTOTYPE_USERS as unknown as Array<Record<string, unknown>>,
  auditLogs: PROTOTYPE_AUDIT_LOGS as unknown as Array<Record<string, unknown>>,
  workFacts: PROTOTYPE_WORK_FACTS,
  healthRegistry: PROTOTYPE_HEALTH_CASES as unknown as Array<Record<string, unknown>>,
  polls: [
    { id: 'proto-poll-001', question: 'Cili investim duhet të ketë përparësi në komunën tuaj?', description: 'Sondazh demonstrues për testimin e filtrave dhe rezultateve.', options: [{ id: 'p1', text: 'Rrugë dhe trotuare', votes: 42 }, { id: 'p2', text: 'Ndriçim publik', votes: 31 }, { id: 'p3', text: 'Parqe dhe gjelbërim', votes: 18 }], totalVotes: 91, createdAt: daysAgo(3), expiresAt: new Date(now + 20 * 86_400_000).toISOString(), createdBy: 'Admin Prototipi', category: 'Investime' },
    { id: 'proto-poll-002', question: 'Sa i kënaqur jeni me shërbimet publike?', description: 'Pyetje testuese.', options: [{ id: 'p1', text: 'I kënaqur', votes: 20 }, { id: 'p2', text: 'Mesatarisht', votes: 35 }, { id: 'p3', text: 'I pakënaqur', votes: 12 }], totalVotes: 67, createdAt: daysAgo(20), expiresAt: daysAgo(1), createdBy: 'Admin Prototipi', category: 'Shërbime' },
  ],
  donationCauses: [
    { id: 'proto-donation-001', title: 'Pajisje shkollore për nxënës', description: 'Fushatë testuese, pa donacione reale.', mediaType: 'image', mediaUrl: '', donationUrl: 'https://example.test/donation', category: 'tjera', status: 'pending', createdAt: daysAgo(1) },
    { id: 'proto-donation-002', title: 'Hapësirë e gjelbër për lagjen', description: 'Shembull i aprovuar.', mediaType: 'image', mediaUrl: '', donationUrl: 'https://example.test/park', category: 'shtepi', status: 'approved', createdAt: daysAgo(10) },
  ],
  ads: [
    { id: 'proto-ad-001', title: 'Fushatë demonstrative e shërbimeve qytetare', section: 'ballina', target: 'Nacionale', position: 'top', mediaUrl: '', mediaType: 'image', targetUrl: 'https://example.test', views: 340, clicks: 24, status: 'active', budget: 'Prototip' },
    { id: 'proto-ad-002', title: 'Kujdesi për hapësirat publike', section: 'raporto', target: 'Prishtinë', position: 'feed', mediaUrl: '', mediaType: 'image', targetUrl: 'https://example.test', views: 150, clicks: 8, status: 'paused', budget: 'Prototip' },
  ],
  adRequests: [{ id: 'proto-ad-request-001', name: 'Biznes testues', email: 'biznes@shembull.test', title: 'Kërkesë demonstrative për reklamë', municipality: 'Prizren', status: 'pending', createdAt: daysAgo(1) }],
  notifications: [
    { id: 'proto-notice-001', title: 'Mirëmbajtje demonstrative', message: 'Njoftim testues; nuk dërgohet jashtë emulators.', audience: 'all', sender: 'Admin Prototipi', type: 'info', isRead: false, createdAt: daysAgo(0) },
    { id: 'proto-notice-002', title: 'Kujdes: prova e alarmit', message: 'Mesazh demonstrues për të kontrolluar njoftimet.', audience: 'all', sender: 'Admin Prototipi', type: 'alert', isRead: false, createdAt: daysAgo(2) },
  ],
  forumPosts: [
    { id: 'proto-forum-001', authorId: 'citizen-001', authorName: 'Nora Dervishi', authorRole: 'citizen', content: 'A mund të rregullohet ndriçimi pranë parkut? Postim demonstrues për moderatorin.', category: 'infrastrukture', neighborhood: 'Prishtinë', likes: [], comments: [], createdAt: daysAgo(1), isApproved: false, isHidden: false },
    { id: 'proto-forum-002', authorId: 'citizen-002', authorName: 'Faton Krasniqi', authorRole: 'citizen', content: 'Propozim: më shumë pemë në lagje. Postim demonstrues.', category: 'mjedis', neighborhood: 'Prizren', likes: ['citizen-001'], comments: [], createdAt: daysAgo(5), isApproved: true, isHidden: false },
  ],
  newsArticles: [
    { id: 'proto-news-001', title: 'Njoftim testues për shërbimet komunale', municipality: 'Prishtinë', category: 'Njoftim Zyrtar', summary: 'Artikull lokal demonstrues për testimin e publikimit.', content: 'Ky tekst është vetëm për testim në emulator dhe nuk është njoftim zyrtar.', author: 'Redaksia testuese', readTime: '2 min lexim', date: new Date().toLocaleDateString('sq-AL'), createdAt: daysAgo(2), published: true, isTicker: true, isDemo: false, position: 'featured', relatedReportIds: [PROTOTYPE_REPORTS[0].id] },
    { id: 'proto-news-002', title: 'Draft testues: ide për hapësira të gjelbra', municipality: 'Pejë', category: 'Mjedis & Energji', summary: 'Draft për redaktim.', content: 'Artikull demonstrues i paruajtur në publikim.', author: 'Redaksia testuese', readTime: '3 min lexim', date: new Date().toLocaleDateString('sq-AL'), createdAt: daysAgo(3), published: false, isTicker: false, isDemo: false, position: 'feed', relatedReportIds: [] },
  ],
  supportChats: [
    { id: 'proto-chat-001', userId: 'citizen-001', userName: 'Nora Dervishi', userEmail: 'qytetar1@shembull.test', status: 'waiting_agent', department: 'infrastructure', agentTrackId: 'AG-PROT-001', createdAt: daysAgo(0), updatedAt: daysAgo(0), messages: [{ id: 'proto-msg-001', role: 'user', content: 'Si mund ta ndjek raportimin tim?', createdAt: daysAgo(0) }, { id: 'proto-msg-002', role: 'bot', content: 'Po ju lidhim me një agjent testues.', createdAt: daysAgo(0) }] },
    { id: 'proto-chat-002', userId: 'citizen-002', userName: 'Faton Krasniqi', userEmail: 'qytetar2@shembull.test', status: 'active_agent', department: 'help', agentTrackId: 'AG-PROT-002', assignedAgentName: 'Arta Berisha', createdAt: daysAgo(1), updatedAt: daysAgo(0), messages: [{ id: 'proto-msg-003', role: 'user', content: 'Ku e gjej kodin përcjellës?', createdAt: daysAgo(1) }, { id: 'proto-msg-004', role: 'agent', content: 'Kodin e shihni te Regjistri i Raporteve.', createdAt: daysAgo(0) }] },
    { id: 'proto-chat-003', userId: 'citizen-003', userName: 'Rina Shabani', userEmail: 'qytetar3@shembull.test', status: 'resolved', department: 'other', agentTrackId: 'AG-PROT-003', resolvedAt: daysAgo(2), createdAt: daysAgo(4), updatedAt: daysAgo(2), messages: [{ id: 'proto-msg-005', role: 'user', content: 'Kërkoj udhëzim për një shërbim.', createdAt: daysAgo(4) }, { id: 'proto-msg-006', role: 'agent', content: 'Kërkesa u trajtua me sukses.', createdAt: daysAgo(2) }] },
  ],
  reportRoutingContacts: [
    { id: 'prishtine-infrastructure', name: 'Zyrtari Testues', role: 'Drejtoria e Infrastrukturës', email: 'infrastruktura@kosova.test', municipality: 'Prishtinë', institution: 'Drejtoria e Infrastrukturës', sourceUrl: 'https://example.test/prishtine' },
    { id: 'prizren-services', name: 'Zyrtarja Testuese', role: 'Shërbimet Publike', email: 'sherbimet@kosova.test', municipality: 'Prizren', institution: 'Drejtoria e Shërbimeve Publike', sourceUrl: 'https://example.test/prizren' },
  ],
  officialProfiles: [{ id: 'proto-official-001', name: 'Përfaqësues testues', municipality: 'Prishtinë', role: 'Zyrtar komunal', email: 'zyrtar@kosova.test', phone: '+383 44 000 222', isVerified: true }],
  editorialLog: PROTOTYPE_AUDIT_LOGS.slice(0, 6).map((log, index) => ({ id: `proto-editorial-${index + 1}`, kind: 'work_facts_added', subjectId: PROTOTYPE_REPORTS[index].id, subjectType: 'report', actorMunicipality: log.municipality, actorUserId: log.userId, actorEmail: log.userEmail, attemptedAction: 'add_work_facts', at: new Date(log.createdAt) })),
};

export const PROTOTYPE_SETTINGS = {
  showReels: true,
  adContactPhone: '+383 44 000 333',
  adContactEmail: 'reklama@kosova.test',
  adContactCompanyName: 'Agjencia Testuese',
  adSlogan: 'Përmbajtje demonstrative në sandbox lokal.',
  adWhatsApp: '+38344000333',
  adSenseEnabled: false,
  adFrequencyPosts: 4,
  adFeedAlgorithm: 'smart' as const,
};
