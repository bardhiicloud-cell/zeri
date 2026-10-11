import { Phone, Search, Building, ShieldAlert, HeartPulse, Shield, TreePine, GraduationCap, Gavel, FileText, Globe, Landmark, Factory, Briefcase, Car, Users, HandCoins, Sprout, Zap, Droplet, Scale, LifeBuoy } from 'lucide-react';
import React from 'react';

export const Trunk = (props: any) => (
  <svg
    {...props}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
    <line x1="9" x2="15" y1="9" y2="9" />
    <line x1="9" x2="15" y1="13" y2="13" />
  </svg>
);

export const EMERGENCY_NUMBERS = [
  { name: 'Policia e Kosovës', phone: '192', email: 'info@kosovopolice.com', description: 'Për emergjenca, krime, aksidente dhe raportime imediate.', icon: ShieldAlert },
  { name: 'Ndihma e Shpejtë', phone: '194', email: 'emergjenca@shskuk.org', description: 'Për emergjenca mjekësore dhe autoambulancën.', icon: HeartPulse },
  { name: 'Zjarrfikësit', phone: '193', email: 'zjarrfikesit@rks-gov.net', description: 'Për zjarre, shpëtim dhe intervenime teknike.', icon: LifeBuoy },
  { name: 'Qendra e Thirrjeve', phone: '112', email: '112@rks-gov.net', description: 'Numri universal i emergjencave (Emergjencat Civile).', icon: Shield },
];

export const MINISTRY_CONTACTS = [
  { name: 'Presidenca e Republikës së Kosovës', department: 'Shteti', phone: '038 200 16 000', email: 'info@president-ksgov.net', description: 'Zyra e Presidentit të Republikës së Kosovës.', icon: Globe },
  { name: 'Kuvendi i Republikës së Kosovës', department: 'Shteti', phone: '038 200 10 100', email: 'kinfo@kuvendikosoves.org', description: 'Organi më i lartë legjislativ i Republikës.', icon: Landmark },
  { name: 'Zyra e Kryeministrit (ZKM)', department: 'Shteti', phone: '038 200 14 000', email: 'zkm.info@rks-gov.net', description: 'Ekzekutivi dhe Kryeministria e Republikës së Kosovës.', icon: Landmark },
  { name: 'Ministria e Punëve të Brendshme (MPB)', department: 'Siguria', phone: '038 200 19000', email: 'mpb.info@rks-gov.net', description: 'Për sigurinë publike dhe dokumente personale.', icon: Shield },
  { name: 'Ministria e Punëve të Jashtme dhe Diasporës (MPJD)', department: 'Diplomacia', phone: '038 200 11000', email: 'info.mpjd@rks-gov.net', description: 'Marrëdhëniet diplomatike dhe diaspora shqiptare.', icon: Globe },
  { name: 'Ministria e Shëndetësisë (MSH)', department: 'Shëndetësia', phone: '038 200 24000', email: 'msh.info@rks-gov.net', description: 'Për politikat shëndetësore.', icon: HeartPulse },
  { name: 'Ministria e Arsimit (MASHTI)', department: 'Arsimi', phone: '038 200 20000', email: 'mashti.info@rks-gov.net', description: 'Për arsim dhe shkencë.', icon: GraduationCap },
  { name: 'Ministria e Drejtësisë (MD)', department: 'Sistemi Ligjor', phone: '038 200 18000', email: 'md.info@rks-gov.net', description: 'Për legjislacion, burgjet dhe sistemin noterial.', icon: Gavel },
  { name: 'Ministria e Mjedisit (MMPHI)', department: 'Mjedisi / Infrastruktura', phone: '038 200 28000', email: 'mmphi.info@rks-gov.net', description: 'Mjedisi, planifikimi hapësinor dhe infrastruktura.', icon: TreePine },
  { name: 'Ministria e Financave (MFPT)', department: 'Financat', phone: '038 200 34000', email: 'mf.info@rks-gov.net', description: 'Për thesar, tatime, buxhet dhe transfere.', icon: HandCoins },
  { name: 'Ministria e Ekonomisë (ME)', department: 'Energjia', phone: '038 200 21505', email: 'me.info@rks-gov.net', description: 'Për ndërmarrjet publike, energjinë dhe shërbimet teknologjike.', icon: Factory },
  { name: 'Ministria e Bujqësisë (MBPZHR)', department: 'Bujqësia', phone: '038 200 38411', email: 'mbpzhr.info@rks-gov.net', description: 'Për subvencione dhe zhvillim rural.', icon: Sprout },
  { name: 'Ministria e Industrisë dhe Tregtisë (MINT)', department: 'Industria', phone: '038 200 36 000', email: 'mint@rks-gov.net', description: 'Biznesi, industria dhe tregtia.', icon: Factory },
  { name: 'Ministria e Kulturës, Rinisë dhe Sportit (MKRS)', department: 'Kultura', phone: '038 200 22 000', email: 'mkrs@rks-gov.net', description: 'Për artin, rininë dhe sportin.', icon: Users },
  { name: 'Ministria për Komunitete dhe Kthim (MKK)', department: 'Komunitetet', phone: '038 200 32 000', email: 'mkk@rks-gov.net', description: 'Për të drejtat e komuniteteve dhe minoriteteve.', icon: Globe },
  { name: 'Zëri i Qytetarëve (Koordinimi i Komunave)', department: 'Administrata & Komuniteti', phone: '038 200 35 555', email: 'info@zeriqytetareve.rks-gov.net', description: 'Platforma qendrore për qytetarët dhe 38 komunat e Kosovës.', icon: Building },
  { name: 'Ministria e Zhvillimit Rajonal (MZHR)', department: 'Administrata', phone: '038 200 13 000', email: 'mzhr@rks-gov.net', description: 'Për zhvillimin e balancuar rajonal.', icon: Building },
  { name: 'Ministria e Mbrojtjes', department: 'Siguria', phone: '038 200 32204', email: 'mm.info@rks-gov.net', description: 'Për forcën e sigurisë së Kosovës.', icon: ShieldAlert },
  { name: 'Gjykata Kushtetuese e Kosovës', department: 'Drejtësia', phone: '038 606 019', email: 'gjk-info@rks-gov.net', description: 'Mbrojtja e kushtetutshmërisë.', icon: Scale },
  { name: 'Gjykata Supreme e Kosovës', department: 'Drejtësia', phone: '038 200 18780', email: 'supremja@rks-gov.net', description: 'Instanca më e lartë gjyqësore në Kosovë.', icon: Scale },
  { name: 'Prokuroria e Shtetit', department: 'Sistemi Ligjor', phone: '038 200 18 100', email: 'zyra.psh@rks-gov.net', description: 'Institucioni për ndjekjen penale.', icon: Shield },
  { name: 'Gjykata Themelore Prishtinë', department: 'Drejtësia', phone: '038 200 18900', email: 'themelorja.pri@rks-gov.net', description: 'Shërbimet gjyqësore për Prishtinë.', icon: Scale },
  { name: 'Gjykata Themelore Prizren', department: 'Drejtësia', phone: '029 244 044', email: 'themelorja.prizren@rks-gov.net', description: 'Shërbimet gjyqësore për Prizren.', icon: Scale },
  { name: 'Drejtoria Rajonale e Policisë - Prishtinë', department: 'Siguria', phone: '038 504 504', email: 'info@kosovopolice.com', description: 'Policia për rajonin e Prishtinës.', icon: Shield },
  { name: 'Drejtoria Rajonale e Policisë - Prizren', department: 'Siguria', phone: '029 244 344', email: 'info@kosovopolice.com', description: 'Policia për rajonin e Prizrenit.', icon: Shield },
  { name: 'Drejtoria Rajonale e Policisë - Pejë', department: 'Siguria', phone: '039 432 327', email: 'info@kosovopolice.com', description: 'Policia për rajonin e Pejës.', icon: Shield },
  { name: 'Drejtoria Rajonale e Policisë - Mitrovicë', department: 'Siguria', phone: '028 532 999', email: 'info@kosovopolice.com', description: 'Policia për rajonin e Mitrovicës.', icon: Shield },
  { name: 'Drejtoria Rajonale e Policisë - Gjilan', department: 'Siguria', phone: '0280 326 222', email: 'info@kosovopolice.com', description: 'Policia për rajonin e Gjilanit.', icon: Shield },
  { name: 'Inspektorati i Punës', department: 'Inspektoratet', phone: '0800 77577', email: 'ip.info@rks-gov.net', description: 'Raportimet për shkelje të të drejtave të punës.', icon: ShieldAlert },
  { name: 'Inspektorati i Tregut', department: 'Inspektoratet', phone: '0800 11000', email: 'konsumatori@rks-gov.net', description: 'Mbrojtja e konsumatorit dhe ankesat.', icon: Briefcase },
  { name: 'Agjencia Kundër Korrupsionit', department: 'Sistemi Ligjor', phone: '0800 10 800', email: 'info@akk-ks.org', description: 'Denoncimi i korrupsionit në institucione.', icon: ShieldAlert },
  { name: 'Avokati i Popullit', department: 'Sistemi Ligjor', phone: '0800 11111', email: 'info@oik-rks.org', description: 'Për mbrojtjen dhe promovimin e të drejtave të njeriut.', icon: Scale },
  { name: 'Agjencia Kosovare e Inteligjencës (AKI)', department: 'Siguria', phone: '038 200 62 000', email: 'info@aki-rks.org', description: 'Për mbrojtjen e sigurisë kombëtare të Kosovës.', icon: Shield },
];

export const UTILITY_CONTACTS = [
  { name: 'KEDS (Rrjeti Elektrik)', department: 'Energjia', phone: '0800 791 00', email: 'contact@keds-energy.com', description: 'Për defekte, prishje të rrjetit dhe kyçje.', icon: Zap },
  { name: 'KEK (Korporata Energjetike)', department: 'Energjia', phone: '038 501 701', email: 'info@kek-energy.com', description: 'Gjenerimi i energjisë.', icon: Factory },
  { name: 'KRU Prishtina', department: 'Ujësjellësi', phone: '0800 900 00', email: 'info@kru-prishtina.com', description: 'Furnizimi me ujë në Prishtinë dhe rrethinë.', icon: Droplet },
  { name: 'KRU Prizreni', department: 'Ujësjellësi', phone: '0800 444 44', email: 'info@kru-prizreni.com', description: 'Furnizimi me ujë në Prizren.', icon: Droplet },
  { name: 'KRU Peja (Hidrodrini)', department: 'Ujësjellësi', phone: '0800 440 00', email: 'info@hidrodrini.com', description: 'Furnizimi me ujë në Pejë dhe rrethinë.', icon: Droplet },
  { name: 'KRU Gjakova', department: 'Ujësjellësi', phone: '0800 111 12', email: 'info@kru-gjakova.com', description: 'Furnizimi me ujë në Gjakovë.', icon: Droplet },
  { name: 'KRU Mitrovica', department: 'Ujësjellësi', phone: '028 532 201', email: 'info@kru-mitrovica.com', description: 'Furnizimi me ujë në Mitrovicë.', icon: Droplet },
  { name: 'KRU Gjilani (Hidromorava)', department: 'Ujësjellësi', phone: '0280 326 711', email: 'info@hidromorava.com', description: 'Furnizimi me ujë në Gjilan.', icon: Droplet },
  { name: 'KRM Pastrimi', department: 'Mjedisi', phone: '038 543 210', email: 'info@pastrimi.org', description: 'Grumbullimi i mbeturinave në rajonin e Prishtinës.', icon: Sprout },
  { name: 'Termokos', department: 'Energjia', phone: '0800 444 45', email: 'info@termokos.org', description: 'Ngrohja qendrore në Prishtinë.', icon: Factory },
  { name: 'Administrata Tatimore (ATK)', department: 'Financat', phone: '0800 80 800', email: 'info@atk-ks.org', description: 'Denoncimi i evazionit fiskal.', icon: HandCoins },
  { name: 'Dogana e Kosovës', department: 'Mjedisi', phone: '0800 50 095', email: 'info@dogana-ks.org', description: 'Denoncimi i kontrabandës.', icon: Trunk },
];

export const MUNICIPALITY_CONTACTS = [
  { name: 'Komuna e Prishtinës', department: 'Komunale', phone: '0800 122 33', email: 'prishtina@rks-gov.net', description: 'Shërbimet administrative komunale në Prishtinë.', icon: Building },
  { name: 'Komuna e Prizrenit', department: 'Komunale', phone: '0800 192 00', email: 'prizreni@rks-gov.net', description: 'Shërbimet administrative komunale në Prizren.', icon: Landmark },
  { name: 'Komuna e Pejës', department: 'Komunale', phone: '0800 433 33', email: 'peja@rks-gov.net', description: 'Shërbimet administrative komunale në Pejë.', icon: Building },
  { name: 'Komuna e Gjakovës', department: 'Komunale', phone: '0800 110 11', email: 'gjakova@rks-gov.net', description: 'Shërbimet administrative komunale në Gjakovë.', icon: Landmark },
  { name: 'Komuna e Ferizajt', department: 'Komunale', phone: '0800 290 00', email: 'ferizaj@rks-gov.net', description: 'Shërbimet administrative komunale në Ferizaj.', icon: Building },
  { name: 'Komuna e Gjilanit', department: 'Komunale', phone: '0800 280 00', email: 'gjilani@rks-gov.net', description: 'Shërbimet administrative komunale në Gjilan.', icon: Building },
  { name: 'Komuna e Mitrovicës së Jugut', department: 'Komunale', phone: '0800 282 22', email: 'mitrovica@rks-gov.net', description: 'Shërbimet administrative komunale në Mitrovicën e Jugut.', icon: Landmark },
  { name: 'Komuna e Podujevës', department: 'Komunale', phone: '038 200 41 000', email: 'podujeva@rks-gov.net', description: 'Shërbimet administrative komunale në Podujevë.', icon: Building },
  { name: 'Komuna e Vushtrrisë', department: 'Komunale', phone: '028 571 000', email: 'vushtrria@rks-gov.net', description: 'Shërbimet administrative komunale në Vushtrri.', icon: Landmark },
  { name: 'Komuna e Suharekës', department: 'Komunale', phone: '029 271 000', email: 'suhareka@rks-gov.net', description: 'Shërbimet administrative komunale në Suharekë.', icon: Building },
  { name: 'Komuna e Rahovecit', department: 'Komunale', phone: '029 277 000', email: 'rahoveci@rks-gov.net', description: 'Shërbimet administrative komunale në Rahovec.', icon: Building },
  { name: 'Komuna e Drenasit', department: 'Komunale', phone: '038 200 45001', email: 'drenasi@rks-gov.net', description: 'Shërbimet administrative komunale në Drenas (Gllogoc).', icon: Building },
  { name: 'Komuna e Lipjanit', department: 'Komunale', phone: '038 200 41501', email: 'lipjani@rks-gov.net', description: 'Shërbimet administrative komunale në Lipjan.', icon: Landmark },
  { name: 'Komuna e Malishevës', department: 'Komunale', phone: '029 261 001', email: 'malisheva@rks-gov.net', description: 'Shërbimet administrative komunale në Malishevë.', icon: Building },
  { name: 'Komuna e Kamenicës', department: 'Komunale', phone: '0280 371 001', email: 'kamenica@rks-gov.net', description: 'Shërbimet administrative komunale në Kamenicë.', icon: Building },
  { name: 'Komuna e Vitisë', department: 'Komunale', phone: '0280 381 000', email: 'vitia@rks-gov.net', description: 'Shërbimet administrative komunale në Viti.', icon: Landmark },
  { name: 'Komuna e Deçanit', department: 'Komunale', phone: '0390 361 000', email: 'decani@rks-gov.net', description: 'Shërbimet administrative komunale në Deçan.', icon: Building },
  { name: 'Komuna e Istogut', department: 'Komunale', phone: '039 451 001', email: 'istogu@rks-gov.net', description: 'Shërbimet administrative komunale në Istog.', icon: Landmark },
  { name: 'Komuna e Klinës', department: 'Komunale', phone: '039 471 001', email: 'klina@rks-gov.net', description: 'Shërbimet administrative komunale në Klinë.', icon: Building },
  { name: 'Komuna e Skenderajt', department: 'Komunale', phone: '028 582 001', email: 'skenderaj@rks-gov.net', description: 'Shërbimet administrative komunale në Skenderaj.', icon: Landmark },
  { name: 'Komuna e Dragashit', department: 'Komunale', phone: '029 281 001', email: 'dragashi@rks-gov.net', description: 'Shërbimet administrative komunale në Dragash.', icon: Landmark },
  { name: 'Komuna e Obiliqit', department: 'Komunale', phone: '038 200 41221', email: 'obiliqi@rks-gov.net', description: 'Shërbimet administrative komunale në Obiliq.', icon: Landmark },
  { name: 'Komuna e Fushë Kosovës', department: 'Komunale', phone: '038 200 41601', email: 'fushekosova@rks-gov.net', description: 'Shërbimet administrative komunale në Fushë Kosovë.', icon: Building },
  { name: 'Komuna e Shtimes', department: 'Komunale', phone: '0290 389 001', email: 'shtime@rks-gov.net', description: 'Shërbimet administrative komunale në Shtime.', icon: Building },
  { name: 'Komuna e Kaçanikut', department: 'Komunale', phone: '0290 384 100', email: 'kacaniku@rks-gov.net', description: 'Shërbimet administrative komunale në Kaçanik.', icon: Landmark },
  { name: 'Komuna e Novobërdës', department: 'Komunale', phone: '038 200 47000', email: 'novoberda@rks-gov.net', description: 'Shërbimet administrative komunale në Novobërdë.', icon: Building },
  { name: 'Komuna e Shtërpcës', department: 'Komunale', phone: '0290 395 000', email: 'shterpca@rks-gov.net', description: 'Shërbimet administrative komunale në Shtërpcë.', icon: Building },
  { name: 'Komuna e Zubin Potokut', department: 'Komunale', phone: '028 460 000', email: 'zubinpotok@rks-gov.net', description: 'Shërbimet administrative komunale në Zubin Potok.', icon: Landmark },
  { name: 'Komuna e Zveçanit', department: 'Komunale', phone: '028 461 000', email: 'zvecan@rks-gov.net', description: 'Shërbimet administrative komunale në Zveçan.', icon: Landmark },
  { name: 'Komuna e Leposaviqit', department: 'Komunale', phone: '028 462 000', email: 'leposaviq@rks-gov.net', description: 'Shërbimet administrative komunale në Leposaviq.', icon: Building },
  { name: 'Komuna e Parteshit', department: 'Komunale', phone: '0280 320 001', email: 'parteshi@rks-gov.net', description: 'Shërbimet administrative komunale në Partesh.', icon: Building },
  { name: 'Komuna e Kllokotit', department: 'Komunale', phone: '0280 382 000', email: 'kllokoti@rks-gov.net', description: 'Shërbimet administrative komunale në Kllokot.', icon: Landmark },
  { name: 'Komuna e Ranillugut', department: 'Komunale', phone: '0280 371 002', email: 'ranillugu@rks-gov.net', description: 'Shërbimet administrative komunale në Ranillug.', icon: Building },
  { name: 'Komuna e Graçanicës', department: 'Komunale', phone: '038 564 300', email: 'gracanica@rks-gov.net', description: 'Shërbimet administrative komunale në Graçanicë.', icon: Building },
  { name: 'Komuna e Junikut', department: 'Komunale', phone: '039 432 002', email: 'juniku@rks-gov.net', description: 'Shërbimet administrative komunale në Junik.', icon: Landmark },
  { name: 'Komuna e Mamushës', department: 'Komunale', phone: '029 200 000', email: 'mamusha@rks-gov.net', description: 'Shërbimet administrative komunale në Mamushë.', icon: Building },
  { name: 'Komuna e Mitrovicës së Veriut', department: 'Komunale', phone: '028 463 000', email: 'mitrovica.veriut@rks-gov.net', description: 'Shërbimet administrative komunale në Mitrovicë të Veriut.', icon: Landmark },
  { name: 'Komuna e Hanit të Elezit', department: 'Komunale', phone: '0290 385 000', email: 'hanielezi@rks-gov.net', description: 'Shërbimet administrative komunale në Hani i Elezit.', icon: Building },
];
