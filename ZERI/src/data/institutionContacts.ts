/**
 * Official contact points of the 38 municipalities and the central bodies reports
 * are routed to.
 *
 * Every address here was read from the institution's own website on 2026-10-14; none
 * was guessed. `status` says how far an address can be trusted for an automatic send:
 *
 *  - `general`     a general office mailbox on the institution's own domain. Safe to send to.
 *  - `role`        a role mailbox (protocol, publications). Reaches an office but not the
 *                  directorate that handles the topic; a person should confirm.
 *  - `personal`    printed on the site but belongs to a named employee. Not used automatically.
 *  - `external`    a free-mail address (gmail). Not used automatically.
 *  - `placeholder` the site prints a template value (email@email.com); treated as no address.
 *  - `missing`     the site prints no address, or could not be reached.
 *
 * Only `general` and `role` are ever used for an automatic send (see `isSendable`).
 * The admin is expected to correct and verify this table; it is the starting point,
 * not the last word.
 */
export type EmailStatus = 'general' | 'role' | 'personal' | 'external' | 'placeholder' | 'missing';

export interface ContactPoint {
  email: string | null;
  status: EmailStatus;
  phone?: string;
  site?: string;
  note?: string;
}

export const CONTACTS_CHECKED_ON = '2026-10-14';

export const isSendable = (status: EmailStatus): boolean => status === 'general' || status === 'role';

const gov = (slug: string) => `https://${slug}.rks-gov.net`;

export const MUNICIPAL_CONTACTS: Record<string, ContactPoint> = {
  'Deçan': { email: 'Komuna.Decani@rks-gov.net', status: 'general', phone: '038 200 44 317', site: gov('decan') },
  'Dragash': { email: 'komuna.dragash@rks-gov.net', status: 'general', phone: '029 281 543', site: gov('dragash') },
  'Drenas': { email: 'komuna.drenas@rks-gov.net', status: 'general', phone: '038 200 40 800', site: gov('gllogoc') },
  'Ferizaj': { email: 'info.ferizaj@rks-gov.net', status: 'general', phone: '038 200 46 049', site: gov('ferizaj') },
  'Fushë Kosovë': { email: 'Publikimet.FK@rks-gov.net', status: 'role', phone: '038 200 40 600', site: gov('fushekosove'), note: 'Kutia e publikimeve; konfirmoni adresën e drejtorisë.' },
  'Gjakovë': { email: 'gjakova.ic@rks-gov.net', status: 'role', phone: '0390 321 100', site: gov('gjakova'), note: 'Qendra Informative e komunës.' },
  'Gjilan': { email: 'info.gjilani@rks-gov.net', status: 'general', phone: '0280 320 781', site: gov('gjilan') },
  'Graçanicë': { email: 'opstinagracanica@gmail.com', status: 'external', phone: '038 776 561', site: gov('gracanica'), note: 'Adresë gmail; nuk përdoret automatikisht.' },
  'Hani i Elezit': { email: 'komunahaniielezit@gmail.com', status: 'external', phone: '0290 385 100', site: gov('haniielezit'), note: 'Adresë gmail; nuk përdoret automatikisht.' },
  'Istog': { email: null, status: 'missing', phone: '0390 370 114', site: gov('istog'), note: 'Faqja nuk shtyp email.' },
  'Junik': { email: null, status: 'missing', phone: '0390 370 114', site: gov('junik'), note: 'Faqja nuk shtyp email.' },
  'Kaçanik': { email: 'besim.q.ilazi@rks-gov.net', status: 'personal', phone: '0290 380 047', site: gov('kacanik'), note: 'Email i kryetarit; nuk përdoret automatikisht.' },
  'Kamenicë': { email: 'info.kamenica@rks-gov.net', status: 'general', phone: '038 200 47 628', site: gov('kamenice') },
  'Klinë': { email: 'komuna.kline@rks-gov.net', status: 'general', phone: '039 471 306', site: gov('kline') },
  'Kllokot': { email: 'vladan.bogdanovic@rks-gov.net', status: 'personal', phone: '048 548 001', site: gov('kllokot'), note: 'Email i një punonjësi; nuk përdoret automatikisht.' },
  'Leposaviq': { email: null, status: 'placeholder', site: gov('leposaviq'), note: 'Faqja shtyp vlerë shablloni (email@email.com).' },
  'Lipjan': { email: 'infokomuna.lipjan@rks-gov.net', status: 'general', site: gov('lipjan') },
  'Malishevë': { email: 'komuna.malisheve@rks-gov.net', status: 'general', phone: '029 210 148', site: gov('malisheve') },
  'Mamushë': { email: 'muala.morina@rks-gov.net', status: 'personal', phone: '029 210 448', site: gov('mamushe'), note: 'Email i një punonjësi; nuk përdoret automatikisht.' },
  'Mitrovicë': { email: null, status: 'missing', note: 'Faqja zyrtare nuk u gjet në adresën rks-gov.net.' },
  'Mitrovica e Veriut': { email: null, status: 'missing', note: 'Faqja zyrtare nuk u gjet në adresën rks-gov.net.' },
  'Novobërdë': { email: 'info.novoberde@rks-gov.net', status: 'general', phone: '038 576 009', site: gov('novoberde') },
  'Obiliq': { email: 'komuna.obiliq@rks-gov.net', status: 'general', phone: '038 561 536', site: gov('obiliq') },
  'Partesh': { email: null, status: 'placeholder', phone: '038 200 48 009', site: gov('partesh'), note: 'Faqja shtyp vlerë shablloni.' },
  'Pejë': { email: 'info-pe@rks-gov.net', status: 'general', phone: '038 200 43 404', site: gov('peja') },
  'Podujevë': { email: 'infopodujeva@rks-gov.net', status: 'general', phone: '038 200 41 018', site: gov('podujeve') },
  'Prishtinë': { email: 'komunaprishtine@rks-gov.net', status: 'general', phone: '038 230 900', site: gov('prishtina') },
  'Prizren': { email: null, status: 'missing', phone: '038 200 44 722', site: gov('prizren'), note: 'Faqja shtyp vetëm numra telefoni.' },
  'Rahovec': { email: 'komuna.rahovec@rks-gov.net', status: 'general', phone: '038 200 45 340', site: gov('rahovec') },
  'Ranillug': { email: null, status: 'placeholder', phone: '038 000 000', site: gov('ranillug'), note: 'Faqja shtyp vlerë shablloni.' },
  'Shtërpcë': { email: 'protocol.strpce@rks-gov.net', status: 'role', phone: '038 200 46 901', site: gov('shterpce'), note: 'Kutia e protokollit.' },
  'Shtime': { email: 'info.shtime@rks-gov.net', status: 'general', phone: '029 038 9016', site: gov('shtime') },
  'Skenderaj': { email: 'komuna.skenderaj@rks-gov.net', status: 'general', phone: '038 200 42 764', site: gov('skenderaj') },
  'Suharekë': { email: 'komuna.suhareke@rks-gov.net', status: 'general', phone: '029 271 282', site: gov('suhareke') },
  'Viti': { email: null, status: 'missing', phone: '0280 381 647', site: gov('viti'), note: 'Faqja liston vetëm emailet e punonjësve, jo një adresë të përgjithshme.' },
  'Vushtrri': { email: 'info.vushtrri@rks-gov.net', status: 'general', phone: '038 200 42 417', site: gov('vushtrri') },
  'Zubin Potok': { email: null, status: 'placeholder', phone: '038 000 000', site: gov('zubinpotok'), note: 'Faqja shtyp vlerë shablloni.' },
  'Zveçan': { email: null, status: 'placeholder', phone: '038 000 000', site: gov('zvecan'), note: 'Faqja shtyp vlerë shablloni.' },
};

export interface CentralBody {
  id: string;
  name: string;
  contact: ContactPoint;
}

const noEmail = (site?: string, note = 'Adresa e përgjithshme nuk u verifikua; shtojeni nga paneli.'): ContactPoint => ({ email: null, status: 'missing', site, note });
const general = (email: string, phone: string | undefined, site: string, note?: string): ContactPoint => ({ email, status: 'general', phone, site, note });

/**
 * Central institutions and public bodies that answer citizens' problems. Names follow
 * the ones printed on each institution's own site (ministries are renamed by government
 * decision, so check them before relying on a send). Only an address or number actually
 * read from the institution's site is filled in; everything else is left empty on purpose.
 */
export const CENTRAL_BODIES: Record<string, CentralBody> = {
  zkm: { id: 'zkm', name: 'Zyra e Kryeministrit', contact: general('zkp.zkm@rks-gov.net', '038 200 14 803', 'https://kryeministri.rks-gov.net') },
  mmphi: { id: 'mmphi', name: 'Ministria e Mjedisit, Planifikimit Hapësinor dhe Infrastrukturës', contact: noEmail('https://mmphi.rks-gov.net', 'Faqja nuk shtyp email të përgjithshëm; vetëm adresa të punonjësve.') },
  mapl: { id: 'mapl', name: 'Ministria e Administrimit të Pushtetit Lokal', contact: general('info.mapl@rks-gov.net', '038 200 64 209', 'https://mapl.rks-gov.net') },
  msh: { id: 'msh', name: 'Ministria e Shëndetësisë', contact: general('msh.info@rks-gov.net', '038 200 24 131', 'https://msh.rks-gov.net', 'Linja falas e ankesave: 0800 1 7777, linjafalas@rks-gov.net.') },
  mpb: { id: 'mpb', name: 'Ministria e Punëve të Brendshme', contact: noEmail('https://mpb.rks-gov.net', 'Faqja nuk shtyp email ose numër të përgjithshëm; shihni faqen "Numrat kontaktues".') },
  policia: { id: 'policia', name: 'Policia e Kosovës', contact: { email: null, status: 'missing', phone: '192', site: 'https://www.kosovopolice.com', note: 'Urgjenca 192. Raportimi i krimit: 0800 19999 dhe 038 550 999. Email nuk shtypet haptazi.' } },
  ame: { id: 'ame', name: 'Agjencia e Menaxhimit të Emergjencave', contact: general('ame@rks-gov.net', '112', 'https://ame.rks-gov.net', 'Numri i përbashkët i urgjencës 112 është falas.') },
  mdrej: { id: 'mdrej', name: 'Ministria e Drejtësisë', contact: general('zkp.md@rks-gov.net', '038 200 67 035', 'https://md.rks-gov.net', 'Numri pa pagesë: 0800 10010.') },
  mf: { id: 'mf', name: 'Ministria e Financave, Punës dhe Transfereve', contact: noEmail('https://mf.rks-gov.net', 'Faqja nuk shtyp kontakt të përgjithshëm.') },
  atk: { id: 'atk', name: 'Administrata Tatimore e Kosovës', contact: noEmail('https://www.atk-ks.org', 'Faqja nuk u hap në mënyrë të sigurt nga ky sistem; kontrolloni kontaktin direkt.') },
  dogana: { id: 'dogana', name: 'Dogana e Kosovës', contact: general('info@dogana-rks.org', '0800 50095', 'https://dogana.rks-gov.net', 'Linja falas 0800 50095.') },
  mashti: { id: 'mashti', name: 'Ministria e Arsimit, Shkencës, Teknologjisë dhe Inovacionit', contact: general('info.mashti@rks-gov.net', '038 200 65 131', 'https://mash.rks-gov.net') },
  mbpzhr: { id: 'mbpzhr', name: 'Ministria e Bujqësisë, Pylltarisë dhe Zhvillimit Rural', contact: general('mbpzhr@rks-gov.net', '038 200 38 868', 'https://mbpzhr.rks-gov.net') },
  mint: { id: 'mint', name: 'Ministria e Industrisë, Ndërmarrësisë, Tregtisë dhe Inovacionit', contact: general('zkp.minti@rks-gov.net', '038 222 22 222', 'https://minti.rks-gov.net') },
  mek: { id: 'mek', name: 'Ministria e Ekonomisë', contact: noEmail(undefined, 'Faqja zyrtare nuk u gjet; shtojeni kontaktin nga paneli.') },
  keds: { id: 'keds', name: 'KEDS (shpërndarja e energjisë elektrike)', contact: { email: null, status: 'missing', phone: '0800 79100', site: 'https://www.keds-energy.com', note: 'Linja falas 0800 79100. Emailet nuk shtypen haptazi në faqe.' } },
  ero: { id: 'ero', name: 'Zyra e Rregullatorit për Energji', contact: general('info@ero-ks.org', '038 247 615', 'https://ero-ks.org') },
  mkrs: { id: 'mkrs', name: 'Ministria e Kulturës, Rinisë dhe Sportit', contact: noEmail(undefined, 'Faqja zyrtare nuk u gjet; shtojeni kontaktin nga paneli.') },
  mpjd: { id: 'mpjd', name: 'Ministria e Punëve të Jashtme dhe Diasporës', contact: general('dkp.mpj@rks-gov.net', undefined, 'https://mfa-ks.net') },
  kqz: { id: 'kqz', name: 'Komisioni Qendror i Zgjedhjeve', contact: { email: null, status: 'missing', phone: '0800 15555', site: 'https://kqz-ks.org', note: 'Linja falas 0800 15555; qendra: 038 223 782. Email nuk shtypet haptazi.' } },
  arkep: { id: 'arkep', name: 'Autoriteti Rregullativ i Komunikimeve Elektronike dhe Postare', contact: noEmail(undefined, 'Faqja zyrtare nuk u gjet; shtojeni kontaktin nga paneli.') },
};

/** Emergency numbers; free and answered at any hour. */
export const EMERGENCY_NUMBERS = [
  { number: '112', label: 'Urgjenca e përbashkët' },
  { number: '192', label: 'Policia' },
  { number: '193', label: 'Zjarrfikësit dhe shpëtimi' },
  { number: '194', label: 'Ambulanca' },
] as const;
