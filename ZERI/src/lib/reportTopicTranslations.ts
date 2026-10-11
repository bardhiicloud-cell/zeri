import { readStoredLanguage, type SupportedLanguageCode } from './languageConstants';
import { dt } from './dt';

/**
 * Report topic names in the original six languages.
 *
 * The remaining languages are not listed here: there are 40 topics and adding
 * 14 more arrays would be 560 strings to keep in sync by hand. Those languages
 * resolve through dt(), which reads the generated overlay, with the Albanian
 * source as the final fallback. Only the six hand-checked languages keep an
 * explicit array so a reviewer can read them side by side.
 */
type HandTranslatedLanguage = 'en' | 'bs' | 'sr' | 'tr' | 'de';

const topicLabels: Record<HandTranslatedLanguage, string[]> = {
  en: [
    'Politics', 'Municipalities', 'Elections', 'Government', 'Justice', 'Police & Security', 'Emergencies & Disasters',
    'Economy', 'Employment', 'Business', 'Trade & Prices', 'Finance & Budget', 'Taxes & Customs', 'Infrastructure',
    'Roads', 'Transport', 'Parking', 'Construction & Housing', 'Urban Planning & Spatial Planning', 'Water & Sewage',
    'Waste', 'Environment', 'Energy', 'Telecommunications & Internet', 'Education', 'Science & Innovation',
    'Healthcare', 'Social Welfare', 'Children & Family', 'Women', 'Youth', 'Agriculture', 'Livestock',
    'Forests & Nature', 'Industry', 'Culture & Heritage', 'Sports', 'Diaspora', 'European Integration & World',
    'Technology & Digitalization',
  ],
  bs: [
    'Politika', 'Općine', 'Izbori', 'Vlada', 'Pravda', 'Policija i sigurnost', 'Hitni slučajevi i katastrofe',
    'Ekonomija', 'Zapošljavanje', 'Biznis', 'Trgovina i cijene', 'Finansije i budžet', 'Porezi i carina', 'Infrastruktura',
    'Putevi', 'Saobraćaj', 'Parking', 'Gradnja i stanovanje', 'Urbanizam i prostorno planiranje', 'Voda i kanalizacija',
    'Otpad', 'Životna sredina', 'Energija', 'Telekomunikacije i internet', 'Obrazovanje', 'Nauka i inovacije',
    'Zdravstvo', 'Socijalna zaštita', 'Djeca i porodica', 'Žene', 'Mladi', 'Poljoprivreda', 'Stočarstvo',
    'Šume i priroda', 'Industrija', 'Kultura i naslijeđe', 'Sport', 'Dijaspora', 'Evropske integracije i svijet',
    'Tehnologija i digitalizacija',
  ],
  sr: [
    'Политика', 'Општине', 'Избори', 'Влада', 'Правосуђе', 'Полиција и безбедност', 'Ванредне ситуације и катастрофе',
    'Економија', 'Запошљавање', 'Бизнис', 'Трговина и цене', 'Финансије и буџет', 'Порези и царина', 'Инфраструктура',
    'Путеви', 'Саобраћај', 'Паркинг', 'Градња и становање', 'Урбанизам и просторно планирање', 'Вода и канализација',
    'Отпад', 'Животна средина', 'Енергија', 'Телекомуникације и интернет', 'Образовање', 'Наука и иновације',
    'Здравство', 'Социјална заштита', 'Деца и породица', 'Жене', 'Млади', 'Пољопривреда', 'Сточарство',
    'Шуме и природа', 'Индустрија', 'Култура и наслеђе', 'Спорт', 'Дијаспора', 'Европске интеграције и свет',
    'Технологија и дигитализација',
  ],
  tr: [
    'Siyaset', 'Belediyeler', 'Seçimler', 'Hükümet', 'Adalet', 'Polis ve Güvenlik', 'Acil Durumlar ve Afetler',
    'Ekonomi', 'İstihdam', 'İş Dünyası', 'Ticaret ve Fiyatlar', 'Finans ve Bütçe', 'Vergiler ve Gümrük', 'Altyapı',
    'Yollar', 'Ulaşım', 'Otopark', 'İnşaat ve Konut', 'Şehircilik ve Mekânsal Planlama', 'Su ve Kanalizasyon',
    'Atık', 'Çevre', 'Enerji', 'Telekomünikasyon ve İnternet', 'Eğitim', 'Bilim ve Yenilik',
    'Sağlık', 'Sosyal Refah', 'Çocuklar ve Aile', 'Kadın', 'Gençlik', 'Tarım', 'Hayvancılık',
    'Ormanlar ve Doğa', 'Sanayi', 'Kültür ve Miras', 'Spor', 'Diaspora', 'Avrupa Entegrasyonu ve Dünya',
    'Teknoloji ve Dijitalleşme',
  ],
  de: [
    'Politik', 'Gemeinden', 'Wahlen', 'Regierung', 'Justiz', 'Polizei & Sicherheit', 'Notfälle & Katastrophen',
    'Wirtschaft', 'Beschäftigung', 'Unternehmen', 'Handel & Preise', 'Finanzen & Haushalt', 'Steuern & Zoll', 'Infrastruktur',
    'Straßen', 'Verkehr', 'Parken', 'Bau & Wohnen', 'Städtebau & Raumplanung', 'Wasser & Abwasser',
    'Abfall', 'Umwelt', 'Energie', 'Telekommunikation & Internet', 'Bildung', 'Wissenschaft & Innovation',
    'Gesundheitswesen', 'Soziale Wohlfahrt', 'Kinder & Familie', 'Frauen', 'Jugend', 'Landwirtschaft', 'Viehzucht',
    'Wälder & Natur', 'Industrie', 'Kultur & Erbe', 'Sport', 'Diaspora', 'Europäische Integration & Welt',
    'Technologie & Digitalisierung',
  ],
};

const sourceLabels = [
  'Politikë', 'Komuna', 'Zgjedhje', 'Qeveri', 'Drejtësi', 'Polici & Siguri', 'Emergjenca & Fatkeqësi', 'Ekonomi',
  'Punësim', 'Biznes', 'Tregti & Çmime', 'Financa & Buxhet', 'Tatime & Dogana', 'Infrastrukturë', 'Rrugë',
  'Transport', 'Parking', 'Ndërtim & Banim', 'Urbanizëm & Planifikim Hapësinor', 'Ujë & Kanalizim', 'Mbeturina',
  'Mjedis', 'Energji', 'Telekomunikacion & Internet', 'Arsim', 'Shkencë & Inovacion', 'Shëndetësi',
  'Mirëqenie Sociale', 'Fëmijë & Familje', 'Gruaja', 'Rinia', 'Bujqësi', 'Blegtori', 'Pyje & Natyrë',
  'Industri', 'Kulturë & Trashëgimi', 'Sport', 'Diaspora', 'Integrim Evropian & Bota', 'Teknologji & Digjitalizim',
];

const localizedBySource = new Map<string, Partial<Record<SupportedLanguageCode, string>>>(
  sourceLabels.map((source, index) => [
    source,
    {
      sq: source,
      en: topicLabels.en[index],
      bs: topicLabels.bs[index],
      sr: topicLabels.sr[index],
      tr: topicLabels.tr[index],
      de: topicLabels.de[index],
    },
  ])
);

/**
 * Resolve a topic label into the active language.
 *
 * Order: the explicit table, then the generated overlay via dt(), then the
 * Albanian source. The dt() step is what makes the 14 added languages work
 * without a hand-written array per language.
 */
export function getLocalizedReportTopicName(label: string, language: SupportedLanguageCode = readStoredLanguage()): string {
  const fromTable = localizedBySource.get(label)?.[language];
  if (fromTable) return fromTable;
  return dt(label, language);
}
