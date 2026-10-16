/**
 * "Si punon" - the explanation of every admin section, as data.
 *
 * A panel this large cannot be learned by guessing. Each section has a short
 * guide: what it is for, how the work goes step by step, the rules that apply, and
 * where the person goes next. The guide opens from the "Si punon" button in the
 * header of every section, and a test makes sure no section is added without one.
 *
 * Written for someone on their first day, in plain Albanian. Rules named here are
 * the ones the server enforces; a guide never promises something the system does
 * not do.
 */

export interface SectionGuide {
  /** One sentence: what this section is for. */
  purpose: string;
  /** The work, in order. */
  steps: string[];
  /** What the system enforces, so nobody is surprised by a refusal. */
  rules: string[];
  /** Sections this one hands work to or receives it from, by id. */
  next?: Array<{ id: string; why: string }>;
}

export const SECTION_GUIDES: Record<string, SectionGuide> = {
  inbox: {
    purpose: 'Gjithçka që pret vendimin tënd, nga të gjitha fushat, në një listë të vetme.',
    steps: [
      'Filtro sipas llojit (raportime, donacione, shëndetësi…) ose sipas urgjencës.',
      'Hap një rresht: të çon te rekordi i saktë, jo vetëm te seksioni.',
      'Vepro dhe kthehu: lista rifreskohet dhe rreshti zhduket kur kryhet.',
    ],
    rules: [
      'Sheh vetëm çfarë i takon fushave që të janë dhënë.',
      'Numrat e afateve janë të njëjtët me ata te Raportimet dhe te Paneli.',
    ],
    next: [{ id: 'reports', why: 'për të punuar me raportimet një nga një' }],
  },
  dashboard: {
    purpose: 'Pamja e përgjithshme: sa po vjen, ku ngec puna dhe ku duhet vëmendje tani.',
    steps: [
      'Lexo rreshtin "Kërkon vëmendje tani": çdo numër hapet te pjesa përkatëse.',
      'Shiko tabelën e komunave për të gjetur ku ka vonesa ose raste kritike.',
      'Te "Gjendja e sistemit" kontrollo që serveri dhe baza janë në rregull.',
    ],
    rules: ['Numrat bazohen te raportet e ngarkuara; për totalin e saktë përdor Raportimet.'],
    next: [{ id: 'inbox', why: 'për të nisur punën e ditës' }],
  },
  reports: {
    purpose: 'Radha e raportimeve të qytetarëve: kontrolli, aprovimi, refuzimi dhe ndjekja deri te komuna.',
    steps: [
      'Zgjidh fushën e kohës ose statusin (Në pritje, Në trajtim, Të vonuara…).',
      'Shtyp "Fillo rishikimin" ose hap një rresht: sheh foton, përshkrimin dhe vendndodhjen.',
      'Kontrollo foton: prite (Prit), hiqe me arsye (Hiq foton), ose rikthe origjinalin.',
      'Merr përsipër raportin ("Merr përsipër") që të dinë të tjerët se po e kontrollon.',
      'Aprovo për ta dërguar te komuna, ose refuzo me arsye që e lexon qytetari.',
      'Shtyp A për aprovim, R për refuzim, ← → për të lëvizur, Esc për të dalë.',
    ],
    rules: [
      'Vetëm agjenti (ose pronari) aprovon; komuna merr përsipër dhe kryen punën.',
      'Refuzimi kërkon gjithmonë arsye. Fotoja e hequr ruhet privatisht dhe zhbëhet.',
      'Një agjent nuk e merr raportin që e mban tjetri; pronari mund ta caktojë ose ta lëshojë.',
      '"Të miat" tregon vetëm çka ke marrë përsipër.',
    ],
    next: [{ id: 'workfacts', why: 'faktet dhe kërkesat që dërgon komuna' }],
  },
  work: {
    purpose: 'Detyrat dhe ngarkesa: çfarë ke në dorë, çfarë pret të caktohet dhe sa është e ngarkuar secila nga ekipi.',
    steps: [
      'Te "Puna ime" hap një detyrë dhe zgjidh veprimin e radhës (prano, fillo, dërgo për shqyrtim, mbyll).',
      'Menaxherët shohin te "Përmbledhje" pengesat, te "Radha" detyrat pa caktuar ose me vonesë, dhe te "Ekipi" ngarkesën e secilit.',
      'Çdo veprim kërkon shënimin ose arsyen që ka treguar sistemi; kjo mbetet në historikun e detyrës.',
    ],
    rules: [
      'Statusi ndryshon vetëm përmes veprimeve që serveri lejon për rolin dhe gjendjen tënde; një ndryshim i dikujt tjetër pas hapjes të kthen një njoftim.',
      'Marrja e punës nga dikush tjetër kërkon arsye dhe regjistrohet si ndërhyrje.',
      'Roli i monitorimit lexon çdo gjë dhe nuk ndryshon asgjë.',
    ],
    next: [{ id: 'reports', why: 'për raportimet që lidhen me detyrën' }],
  },
  workflow: {
    purpose: 'Rrjedha e punës e raportimeve: faza në të cilën gjendet secila dhe kush është radha.',
    steps: [
      'Shiko në cilën fazë ndodhen raportimet (kontroll, komunë, verifikim).',
      'Hap një fazë për të parë çfarë i mban të bllokuara.',
      'Kalo te Raportimet për të vepruar.',
    ],
    rules: ['Fazat ndryshojnë vetëm përmes veprimeve të rrjedhës (aprovo, merr përsipër, kryer, verifiko), jo me ndryshim të lirë statusi.'],
    next: [{ id: 'reports', why: 'për të vepruar mbi një raportim' }],
  },
  support: {
    purpose: 'Bisedat e qytetarëve që kërkojnë një njeri, pas asistentit automatik.',
    steps: [
      'Hap bisedën që pret më gjatë; përgjigju qartë dhe me emër.',
      'Nëse problemi është raportim, drejtoje qytetarin te "Raporto"; mos e zgjidh me fjalë.',
      'Mbyll bisedën kur zgjidhet, që të mos mbetet në radhë.',
    ],
    rules: ['Mos kërko fjalëkalime ose të dhëna bankare në bisedë, kurrë.'],
  },
  health: {
    purpose: 'Regjistri shëndetësor: raste që kërkojnë ndihmë, verifikimi dhe njoftimi i spitaleve.',
    steps: [
      'Hap një rast dhe kontrollo dokumentin dhe të dhënat.',
      'Verifiko rastin, ose refuzoje me arsye (e shihet te Historia).',
      'Njofto spitalin e komunës; njoftimi e shënon rastin si verifikuar.',
      'Kur rasti trajtohet, shëno "Trajtuar".',
      'Për ta bërë anonim: hap rastin dhe përdor veprimin përkatës, pasi e ke verifikuar identitetin.',
    ],
    rules: [
      'Të dhënat e pacientit shihen vetëm nga stafi shëndetësor; komuna sheh rastin pa emër e pa kontakt.',
      'Çdo ndryshim gjendjeje regjistrohet me autor dhe kohë.',
      'Dokumentet hapen vetëm për ata që kanë qasje në shëndetësi.',
    ],
  },
  donations: {
    purpose: 'Aplikimet për ndihmë dhe fushatat e donacioneve që shfaqen publikisht.',
    steps: [
      'Hap tabin "Në pritje", lexo rastin dhe kontrollo foton dhe lidhjen e donacionit.',
      'Aprovo për ta publikuar, ose refuzo me arsye.',
      '"Kthe në shqyrtim" e tërheq një kauzë të aprovuar nga publiku pa e fshirë.',
      'Shtyp "Historia" për të parë kush vendosi çfarë.',
    ],
    rules: [
      'Refuzimi nuk e fshin kauzën; fshirja e përhershme është veprim i veçantë i superadminit.',
      'Çdo vendim ruhet me autor, kohë dhe arsye, jo në dokumentin publik.',
    ],
  },
  users: {
    purpose: 'Regjistri i qytetarëve: kërkim, verifikim dhe moderim i llogarive.',
    steps: [
      'Kërko me emër ose email, hap llogarinë.',
      'Verifiko një llogari kur e di që është e vërtetë.',
      'Ndalo (ban) me arsye të qartë; ndalimi mbyll hyrjen dhe sesionet menjëherë.',
    ],
    rules: [
      'Stafi dhe komunat nuk moderohen këtu, por te Stafi & Agjentët.',
      'Nuk moderon llogarinë tënde. Çdo ndalim kërkon arsye dhe regjistrohet.',
    ],
    next: [{ id: 'agents', why: 'për llogaritë e stafit' }],
  },
  forum: {
    purpose: 'Moderimi i debatit publik: postime, histori dhe komente.',
    steps: [
      'Hap tabin "Në pritje" dhe aprovo ose fshih postimet.',
      '"Fshih nga publiku" kërkon arsye dhe mund të rikthehet duke aprovuar.',
      'Shtyp "Historia" për të parë moderimet e mëparshme.',
    ],
    rules: [
      'Autori nuk e aprovon postimin e vet; moderimi bëhet vetëm nga stafi.',
      'Fshirja e përhershme është vetëm e superadminit.',
    ],
  },
  debate: {
    purpose: 'Hapësira e debatit: tema dhe diskutime të ndërtuara nga redaksia.',
    steps: ['Hap një temë, lexo kontributet dhe moderoji sipas rregullave të forumit.'],
    rules: ['Rregullat e moderimit janë të njëjta me forumin: arsye për çdo heqje.'],
    next: [{ id: 'forum', why: 'për moderimin e postimeve' }],
  },
  polls: {
    purpose: 'Sondazhet publike: krijim, mbyllje dhe rezultate.',
    steps: [
      'Krijo sondazhin me pyetje të qarta dhe opsione të ndara.',
      'Cakto afatin e mbylljes.',
      'Pas mbylljes lexo rezultatet; një votë për llogari numërohet nga serveri.',
    ],
    rules: ['Votat nuk ndryshohen nga admini; numërohen vetëm nga serveri.'],
  },
  news: {
    purpose: 'Redaksia e lajmeve: nga drafti deri te publikimi, me histori të plotë.',
    steps: [
      'Shtyp "Lajm i ri"; shkruaj titullin dhe tekstin (përmbledhja nxirret vetë nëse e lini bosh).',
      'Zgjidh kategorinë dhe vendin (Kryesor, Normal, Anësor); parapamja djathtas tregon saktë ku del.',
      'Lidh raportimet që lajmi u përgjigjet (statusi llogaritet vetë).',
      '"Publiko tani" e dërgon live; "Publiko dhe shkruaj tjetrin" të hap menjëherë formularin e ri; "Ruaj vetëm si draft" nuk e publikon.',
      'Për ta tërhequr nga publiku: "Tërhiq nga publikimi" me arsye.',
    ],
    rules: [
      'Ruajtja e tekstit dhe publikimi janë dy gjëra të ndara; publikimi regjistrohet gjithmonë.',
      'Një lajm i ri krijohet vetëm si draft nga shfletuesi.',
      'Shiriti i njoftimeve mundësohet vetëm për kategorinë "Njoftim Zyrtar".',
    ],
  },
  heritage: {
    purpose: 'Arkivi i Kosovës dhe Historia e UÇK-së: artikuj, ngjarje, biografi, dokumente, burime dhe historiku i korrigjimeve.',
    steps: [
      'Hap "Shënimet" dhe shtyp "Shënim i ri", ose "Importo përmbajtjen fillestare" për të marrë tekstet e gatshme si drafte.',
      'Plotëso shqip dhe anglisht, zgjidh seksionin, statusin e provës dhe lidh burimet nga "Burimet".',
      'Çdo shifër shtohet te "Pohimet" me burim dhe datën për të cilën vlen.',
      'Dërgoje në rishikim; një person tjetër e aprovon dhe e verifikon duke kontrolluar burimet.',
      'Vetëm administratori e publikon. Për një gabim në një shënim të publikuar përdor "Korrigjim" (shfaqet publikisht).',
    ],
    rules: [
      'Asnjë shënim nuk publikohet pa burim, pa verifikim nga një person i dytë dhe pa titull e përmbledhje në anglisht.',
      'Pretendimet e pavërtetuara gjyqësisht shënohen "Pretendim" dhe e thonë këtë në tekst; vlen prezumimi i pafajësisë.',
      'Dhuna seksuale: pa emra, foto ose detaje grafike; dëshmi vetëm me pëlqim të shkruar.',
      'Fotot kërkojnë kredi, licencë dhe konfirmim privatësie; "e panjohur" bllokon publikimin.',
      'Çdo ndryshim ruan një version dhe një rresht në regjistrin e auditimit.',
    ],
    next: [{ id: 'news', why: 'për lajmet e përditshme' }],
  },
  notifications: {
    purpose: 'Njoftimet dhe thirrjet emergjente drejt qytetarëve të një komune ose të gjithë vendit.',
    steps: [
      'Shkruaj mesazhin e shkurtër dhe të qartë; zgjidh audiencën.',
      'Ruaje si draft ose publiko.',
      'Çaktivizo ose arkivo kur nuk është më i vlefshëm.',
    ],
    rules: ['Njoftimet emergjente përdoren vetëm për rrezik real; dërgimi është i regjistruar.'],
  },
  videos: {
    purpose: 'Videot që shfaqen në kolonën anësore dhe te lajmet.',
    steps: [
      'Ngarko skedarin ose vendos lidhjen; shto kopertinën.',
      'Ruaj; videoja krijohet si draft.',
      'Publikoje nga butoni i vendimit, si çdo lajm.',
    ],
    rules: ['Videot ndjekin të njëjtat rregulla publikimi si lajmet.'],
    next: [{ id: 'news', why: 'rregullat e publikimit' }],
  },
  ads: {
    purpose: 'Reklamat: kërkesat e biznesit, krijimi i fushatave dhe pozicionet.',
    steps: [
      'Te "Kërkesat" lexo kërkesën e biznesit dhe konfirmo pagesën.',
      'Shtyp "Aprovo dhe ngarko kreativin": krijon fushatën dhe e shënon kërkesën të aprovuar.',
      'Kontrollo që skedari plotëson masat e pozicionit.',
      'Mbylle fushatën kur mbaron; refuzo me arsye nëse nuk pranohet.',
    ],
    rules: [
      'Çdo vendim për kërkesën ruhet me autor; arsyeja e refuzimit është e detyrueshme.',
      'Një agjent aprovon reklama vetëm nëse i është dhënë fusha "Reklama".',
    ],
  },
  agents: {
    purpose: 'Stafi: krijimi i llogarive, caktimi i qasjes dhe heqja e tyre.',
    steps: [
      'Shtyp "Shto" dhe zgjidh rolin: agjent (aksesi i zgjedhur nga ti), menaxher, komunë.',
      'Zgjidh fushat që i jep agjentit: aprovime raportesh, donacione, shëndetësi, lajme, reklama.',
      'Hap një person për të parë çfarë ka bërë (çdo veprim, raportet e prekura).',
      'Heqja e llogarisë: arsye dhe email i shkruar; hyrja mbyllet menjëherë.',
    ],
    rules: [
      'Vetëm superadmini ndryshon ose heq një administrator; superadmini nuk hiqet nga paneli.',
      'Puna e personit mbetet e regjistruar me emër edhe pas heqjes.',
    ],
    next: [{ id: 'monitorim', why: 'për të monitoruar punën e secilit' }],
  },
  roles: {
    purpose: 'Katalogu i roleve: çfarë mund dhe çfarë nuk mund të bëjë secili rol.',
    steps: ['Lexo rolin përpara se t\'ia japësh dikujt.', 'Përdore si referencë; qasja jepet te Stafi & Agjentët.'],
    rules: ['Është vetëm lexim: nuk ndryshon asgjë.'],
    next: [{ id: 'agents', why: 'për ta caktuar rolin' }],
  },
  municipalities: {
    purpose: 'Llogaritë e komunave dhe zonat e tyre.',
    steps: ['Krijo llogari për komunën dhe cakto komunën.', 'Kontrollo punën e komunës te Paneli i komunës.'],
    rules: ['Komuna sheh vetëm raportimet e veta të aprovuara dhe nuk fshin asgjë.'],
    next: [{ id: 'komunapanel', why: 'për të parë punën e një komune' }],
  },
  workfacts: {
    purpose: 'Çfarë dërgon komuna: kërkesa për korrigjim, kundërshtime dhe faktet e punimeve.',
    steps: [
      'Te "Kërkesat e komunave" lexo kërkesën dhe hap raportin lidhur.',
      'Pranoje, ose refuzoje me arsye; komuna e lexon arsyen.',
      'Te "Faktet e punimeve" konfirmo faktet vetëm kur dëshmia është e qartë.',
    ],
    rules: [
      'Komuna shton kontekst; nuk heq dhe nuk ndryshon raportimin e qytetarit.',
      'Përgjigjet zyrtare të komunës publikohen menjëherë; kjo radhë është për kërkesat e tjera.',
    ],
  },
  monitoring: {
    purpose: 'Monitorimi i përgjithshëm i veprimeve të stafit dhe i sistemit.',
    steps: ['Zgjidh periudhën dhe personin.', 'Lexo veprimet dhe flamurimet; hap ato që duken të pazakonta.'],
    rules: ['Vëzhgim vetëm. Vendimet i merr pronari.'],
    next: [{ id: 'monitorim', why: 'konsola e menaxherit' }],
  },
  monitorim: {
    purpose: 'Konsola e menaxherit të agjentëve: çfarë bën secili agjent dhe secila komunë.',
    steps: [
      'Zgjidh një person nga lista: sheh çdo veprim të tij, raportet që preku dhe qasjen.',
      'Përdor "Pulsi" për punën e 24 orëve, "Agjentët" për të heshturit dhe "Anomalitë" për të pazakontat.',
      'Zgjidh periudhën (7 ditë, 30 ditë…) për krahasim.',
    ],
    rules: [
      'Menaxheri vëzhgon; nuk aprovon, nuk fshin, nuk moderon dhe nuk ndryshon qasje.',
      'Pronari mund ta ndryshojë qasjen e personit nga e njëjta kartë.',
    ],
  },
  agentpanel: {
    purpose: 'Paneli i agjentit: radha e punës, "Të miat", performanca dhe historia ime.',
    steps: [
      'Hap radhën dhe merr përsipër një raport.',
      'Kontrollo, aprovo ose refuzo; kalo te tjetri.',
      'Te "Historia ime" shiko çfarë ke bërë.',
    ],
    rules: ['Sheh vetëm fushat që të janë dhënë.'],
    next: [{ id: 'reports', why: 'rishikimi një nga një' }],
  },
  komunapanel: {
    purpose: 'Paneli i komunës: raportimet e saj, kërkesat, shëndetësia dhe punimet.',
    steps: [
      'Hap një raport të ri: "Merr përsipër" me plan që e lexon qytetari.',
      'Regjistro faktet e punimeve dhe shëno "Punimet u kryen".',
      'Për çdo gjë tjetër shkruaj te redaksia: përgjigje, korrigjim, kundërshtim ose kërkesë për heqje.',
      'Te "Kërkesat e mia" sheh përgjigjen dhe arsyen.',
    ],
    rules: [
      'Komuna sheh vetëm raportimet e veta të aprovuara, pa emrin e raportuesit.',
      'Nuk fshin, nuk fsheh dhe nuk ndryshon raportime; çdo përpjekje regjistrohet.',
    ],
  },
  moderim: {
    purpose: 'Qendra e moderimit: përmbajtje me rrezik, anomali dhe auditim.',
    steps: ['Shiko listën me rrezik më të lartë.', 'Hap, vendos dhe regjistro arsyen.'],
    rules: ['Çdo vendim moderimi regjistrohet me autor.'],
  },
  updates: {
    purpose: 'Regjistri i ndryshimeve: kush ka bërë çfarë dhe kur.',
    steps: ['Filtro sipas personit ose llojit.', 'Hap një rresht për detajet.'],
    rules: ['I pandryshueshëm: askush, as superadmini, nuk e redakton ose fshin.'],
  },
  categories: {
    purpose: 'Kategoritë e raportimeve dhe afatet e përgjigjes për secilën.',
    steps: ['Shto ose ndrysho një kategori.', 'Cakto afatin e përgjigjes: ai llogaritet te vonesat.'],
    rules: ['Ndryshimi i afatit prek të gjitha raportimet e reja të asaj kategorie.'],
  },
  security: {
    purpose: 'Siguria: hyrjet, bllokimet dhe auditimi i veprimeve të ndjeshme.',
    steps: ['Lexo hyrjet e dështuara dhe bllokimet.', 'Hap një ngjarje për detaje; reago te Stafi nëse duhet.'],
    rules: ['Vetëm lexim për menaxherin; veprimet i bën pronari.'],
  },
  settings: {
    purpose: 'Cilësimet e platformës: faqja, njoftimet dhe integrimet.',
    steps: ['Ndrysho një cilësim dhe shtyp "Ruaj".', 'Nëse ruajtja dështon, shfaqet gabim; asgjë nuk ruhet "në heshtje".'],
    rules: ['Vetëm pronari. Çdo ndryshim regjistrohet.'],
  },
};

/** What the person can do here, as a short sentence for their role. */
export function roleNote(section: string, role: string): string | null {
  if (role === 'superadmin' || role === 'admin') return 'Si pronar mund të bësh gjithçka këtu, përveç asaj që serveri e ndalon për të gjithë.';
  if (role === 'monitor') return 'Si menaxher i agjentëve vëzhgon. Nuk ndryshon, nuk aprovon dhe nuk fshin asgjë.';
  if (role === 'municipality') return 'Si komunë shton kontekst; nuk heq asgjë dhe sheh vetëm raportet e komunës suaj.';
  if (['agent', 'responder', 'dispatcher', 'moderator', 'approver'].includes(role)) {
    return section === 'agents' || section === 'roles' ? null : 'Si agjent vepron vetëm në fushat që të i ka dhënë administratori.';
  }
  return null;
}

/** Shortcuts that work everywhere in the panel. */
export const GLOBAL_TIPS: string[] = [
  'Ctrl K (ose ⌘K) hap "Shko te…": shkruaj një fjalë dhe shkon direkt te seksioni.',
  'Çdo numër te Paneli hapet te rekordet përkatëse.',
  'Çdo vendim ka butonin "Historia": kush, kur dhe pse.',
  'Nëse një buton nuk shfaqet, serveri nuk të lejon atë veprim në këtë gjendje.',
];
