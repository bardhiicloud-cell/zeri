import { getLocalizedReportTopicName } from './reportTopicTranslations';

export const REPORT_TOPICS = [
  { id: 'politike', label: 'Politikë', icon: '🏛️', keywords: ['politikë', 'politike', 'korrupsion', 'ryshfet', 'keqpërdorim', 'parti', 'deputet'] },
  { id: 'komuna', label: 'Komuna', icon: '🏘️', keywords: ['komunë', 'komuna', 'kryetar', 'drejtori komunale'] },
  { id: 'zgjedhje', label: 'Zgjedhje', icon: '🗳️', keywords: ['zgjedhje', 'votim', 'votë', 'vota', 'komision zgjedhor'] },
  { id: 'qeveri', label: 'Qeveri', icon: '🏛️', keywords: ['qeveri', 'qeveria', 'ministri', 'ministër'] },
  { id: 'drejtesi', label: 'Drejtësi', icon: '⚖️', keywords: ['drejtësi', 'gjykatë', 'prokurori', 'avokat', 'korrupsion'] },
  { id: 'polici-siguri', label: 'Polici & Siguri', icon: '👮', keywords: ['polici', 'siguri', 'vjedhje', 'dhunë', 'aksident', 'krim'] },
  { id: 'emergjenca', label: 'Emergjenca & Fatkeqësi', icon: '🚨', keywords: ['emergjencë', 'zjarr', 'tërmet', 'përmbytje', 'fatkeqësi', 'shpëtim'] },
  { id: 'ekonomi', label: 'Ekonomi', icon: '💰', keywords: ['ekonomi', 'ekonomike', 'buxhet', 'tregues'] },
  { id: 'punesim', label: 'Punësim', icon: '💼', keywords: ['punësim', 'punë', 'pagë', 'papunësi', 'vende pune'] },
  { id: 'biznes', label: 'Biznes', icon: '🏢', keywords: ['biznes', 'kompani', 'subjekt', 'investim'] },
  { id: 'tregti-cmime', label: 'Tregti & Çmime', icon: '🛒', keywords: ['tregti', 'çmim', 'market', 'konsumator', 'faturë'] },
  { id: 'financa-buxhet', label: 'Financa & Buxhet', icon: '💶', keywords: ['financa', 'buxhet', 'shpenzim publik', 'borxh', 'grant'] },
  { id: 'tatime-dogana', label: 'Tatime & Dogana', icon: '🧾', keywords: ['tatim', 'doganë', 'dogana', 'kupon fiskal', 'evazion'] },
  { id: 'infrastrukture', label: 'Infrastrukturë', icon: '🏗️', keywords: ['infrastrukturë', 'ndërtim publik', 'projekt publik'] },
  { id: 'rruge', label: 'Rrugë', icon: '🛣️', keywords: ['rrugë', 'gropë', 'asfalt', 'trotuar', 'urë'] },
  { id: 'transport', label: 'Transport', icon: '🚌', keywords: ['transport', 'autobus', 'stacion', 'trafik publik'] },
  { id: 'parking', label: 'Parking', icon: '🅿️', keywords: ['parking', 'parkim', 'parkingje'] },
  { id: 'ndertim-banim', label: 'Ndërtim & Banim', icon: '🏠', keywords: ['ndërtim', 'banim', 'ndërtesë', 'banesë', 'leje ndërtimi'] },
  { id: 'urbanizem', label: 'Urbanizëm & Planifikim Hapësinor', icon: '🗺️', keywords: ['urbanizëm', 'planifikim hapësinor', 'zonim', 'plan rregullues'] },
  { id: 'uje-kanalizim', label: 'Ujë & Kanalizim', icon: '💧', keywords: ['ujë', 'ujësjellës', 'kanalizim', 'gyp', 'ujëra të zeza'] },
  { id: 'mbeturina', label: 'Mbeturina', icon: '🗑️', keywords: ['mbeturina', 'bërllok', 'deponi', 'pastrim'] },
  { id: 'mjedis', label: 'Mjedis', icon: '🌳', keywords: ['mjedis', 'ndotje', 'ajër', 'lumë', 'park'] },
  { id: 'energji', label: 'Energji', icon: '⚡', keywords: ['energji', 'rrymë', 'energji elektrike', 'keds', 'kesco'] },
  { id: 'telekomunikacion', label: 'Telekomunikacion & Internet', icon: '📡', keywords: ['telekomunikacion', 'internet', 'rrjet', 'telefon', 'operator'] },
  { id: 'arsim', label: 'Arsim', icon: '🎓', keywords: ['arsim', 'shkollë', 'universitet', 'çerdhe', 'nxënës'] },
  { id: 'shkence-inovacion', label: 'Shkencë & Inovacion', icon: '🔬', keywords: ['shkencë', 'inovacion', 'hulumtim', 'laborator'] },
  { id: 'shendetesi', label: 'Shëndetësi', icon: '🏥', keywords: ['shëndetësi', 'shëndet', 'spital', 'mjek', 'qkmf', 'qkuk'] },
  { id: 'mireqenie-sociale', label: 'Mirëqenie Sociale', icon: '👨‍👩‍👧', keywords: ['mirëqenie sociale', 'ndihmë sociale', 'pension', 'asistencë sociale'] },
  { id: 'femije-familje', label: 'Fëmijë & Familje', icon: '👶', keywords: ['fëmijë', 'familje', 'çerdhe', 'kujdestari'] },
  { id: 'gruaja', label: 'Gruaja', icon: '👩', keywords: ['grua', 'gruaja', 'barazi gjinore', 'dhunë në familje'] },
  { id: 'rinia', label: 'Rinia', icon: '🧑‍🎓', keywords: ['rini', 'të rinj', 'rinia', 'të reja'] },
  { id: 'bujqesi', label: 'Bujqësi', icon: '🌾', keywords: ['bujqësi', 'bujk', 'kulturë bujqësore', 'subvencion'] },
  { id: 'blegtori', label: 'Blegtori', icon: '🐄', keywords: ['blegtori', 'bagëti', 'fermë', 'veterinar'] },
  { id: 'pyje-natyre', label: 'Pyje & Natyrë', icon: '🌲', keywords: ['pyje', 'natyrë', 'prerje pylli', 'gjueti'] },
  { id: 'industri', label: 'Industri', icon: '🏭', keywords: ['industri', 'fabrikë', 'prodhim', 'uzinë'] },
  { id: 'kulture-trashegimi', label: 'Kulturë & Trashëgimi', icon: '🏛️', keywords: ['kulturë', 'trashëgimi', 'monument', 'muze', 'arkeologji'] },
  { id: 'sport', label: 'Sport', icon: '⚽', keywords: ['sport', 'stadium', 'fushë sportive', 'klub'] },
  { id: 'diaspora', label: 'Diaspora', icon: '🌍', keywords: ['diasporë', 'mërgatë', 'konsullatë'] },
  { id: 'integrim-bota', label: 'Integrim Evropian & Bota', icon: '🇪🇺', keywords: ['integrim evropian', 'bashkim evropian', 'marrëdhënie ndërkombëtare', 'bota'] },
  { id: 'teknologji-digjitalizim', label: 'Teknologji & Digjitalizim', icon: '📱', keywords: ['teknologji', 'digjitalizim', 'shërbim digjital', 'sistem online'] },
] as const;

export type ReportTopicId = typeof REPORT_TOPICS[number]['id'];

const TOPIC_BY_ID = new Map<string, typeof REPORT_TOPICS[number]>(
  REPORT_TOPICS.map(topic => [topic.id, topic])
);

export function getReportTopic(report: { topicCategory?: string; category?: string; title?: string; description?: string }) {
  if (report.topicCategory) {
    const selected = TOPIC_BY_ID.get(report.topicCategory);
    if (selected) return selected;
  }

  const legacy = `${report.category ?? ''} ${report.title ?? ''} ${report.description ?? ''}`.toLocaleLowerCase('sq-AL');
  return REPORT_TOPICS.find(topic => topic.keywords.some(keyword => legacy.includes(keyword))) ?? null;
}

export function getReportTopicLabel(report: { topicCategory?: string; category?: string; title?: string; description?: string }) {
  const topic = getReportTopic(report);
  return topic ? `${topic.icon} ${getLocalizedReportTopicName(topic.label)}` : report.category ?? 'Pa kategori';
}

export function getReportTopicValue(report: { topicCategory?: string; category?: string; title?: string; description?: string }) {
  return getReportTopic(report)?.id ?? `legacy:${report.category || 'Pa kategori'}`;
}

export function getReportTopicValueLabel(value: string) {
  const topic = TOPIC_BY_ID.get(value);
  if (topic) return `${topic.icon} ${getLocalizedReportTopicName(topic.label)}`;
  return value.startsWith('legacy:') ? value.slice('legacy:'.length) : value;
}
