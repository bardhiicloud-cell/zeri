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

const noEmail = (site?: string): ContactPoint => ({ email: null, status: 'missing', site, note: 'Adresa e përgjithshme nuk u verifikua; shtojeni nga paneli.' });

/**
 * Central institutions. Names follow the ones the platform already uses
 * (lib/accountability.ts); ministries are renamed by government decision, so
 * check them before relying on a send. Only the address actually read from a
 * ministry's site is filled in.
 */
export const CENTRAL_BODIES: Record<string, CentralBody> = {
  mmphi: { id: 'mmphi', name: 'Ministria e Mjedisit, Planifikimit Hapësinor dhe Infrastrukturës', contact: noEmail('https://mmphi.rks-gov.net') },
  mapl: { id: 'mapl', name: 'Ministria e Administrimit të Pushtetit Lokal', contact: { email: 'info.mapl@rks-gov.net', status: 'general', phone: '038 200 64 209', site: 'https://mapl.rks-gov.net' } },
  msh: { id: 'msh', name: 'Ministria e Shëndetësisë', contact: noEmail() },
  mpb: { id: 'mpb', name: 'Ministria e Punëve të Brendshme', contact: noEmail() },
  policia: { id: 'policia', name: 'Policia e Kosovës', contact: noEmail() },
  ame: { id: 'ame', name: 'Agjencia e Menaxhimit të Emergjencave', contact: noEmail() },
  mdrej: { id: 'mdrej', name: 'Ministria e Drejtësisë', contact: noEmail() },
  mf: { id: 'mf', name: 'Ministria e Financave, Punës dhe Transfereve', contact: noEmail() },
  atk: { id: 'atk', name: 'Administrata Tatimore e Kosovës / Dogana e Kosovës', contact: noEmail() },
  mashti: { id: 'mashti', name: 'Ministria e Arsimit, Shkencës, Teknologjisë dhe Inovacionit', contact: noEmail() },
  mbpzhr: { id: 'mbpzhr', name: 'Ministria e Bujqësisë, Pylltarisë dhe Zhvillimit Rural', contact: noEmail() },
  mint: { id: 'mint', name: 'Ministria e Industrisë, Ndërmarrjes dhe Tregtisë', contact: noEmail('https://minti.rks-gov.net') },
  mek: { id: 'mek', name: 'Ministria e Ekonomisë', contact: noEmail() },
  mkrs: { id: 'mkrs', name: 'Ministria e Kulturës, Rinisë dhe Sportit', contact: noEmail() },
  mpjd: { id: 'mpjd', name: 'Ministria e Punëve të Jashtme dhe Diasporës', contact: noEmail() },
  zkm: { id: 'zkm', name: 'Zyra e Kryeministrit', contact: noEmail('https://kryeministri.rks-gov.net') },
  kqz: { id: 'kqz', name: 'Komisioni Qendror i Zgjedhjeve', contact: noEmail('https://kqz-ks.org') },
  arkep: { id: 'arkep', name: 'Autoriteti Rregullativ i Komunikimeve Elektronike dhe Postare', contact: noEmail() },
};
