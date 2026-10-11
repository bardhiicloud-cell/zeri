/**
 * Hand-translated fill for the short-label residue the models cannot handle.
 *
 * After the bulk runs, ~430 entries remained across the 19 languages. Inspecting
 * them (qa/why_missing.js) showed they are nearly all the same small set of
 * string shapes that machine translation reliably fails on:
 *
 *   - one- and two-word labels        ("Ballina", "Tema", "Kamera", "Video")
 *   - placeholder fragments           ("ID:", "Kat:", "ID: #", "(Ti)")
 *   - internal admin option names     ("Top Banner", "Inline Banner", "Sidebar Banner")
 *   - loanwords that stay identical   ("CSV", "Bot")
 *
 * These are the highest-visibility strings in the product — they are the button
 * and tab labels a citizen reads on every screen — so they are translated by
 * hand here rather than left to a model that renders "Tema" as "Theme" in
 * Slovenian and "Ballina" as "Balline" in French.
 *
 * Each language block is a complete, reviewed mapping. Running this is
 * idempotent: existing entries are never overwritten.
 *
 * Usage:  node fill_by_hand.js          # apply
 *         node fill_by_hand.js --dry    # report only
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_FILE = path.join(__dirname, '_translation_cache.json');

/**
 * Reviewed translations for the residue.
 *
 * Keyed by the Albanian source, then by language. Only the entries that were
 * actually outstanding are listed — adding a term that a model already handled
 * would be redundant work and could differ from the model's phrasing elsewhere.
 */
const TERMS = {
  // ── Navigation and page names ──────────────────────────────────────
  'Ballina': { en: 'Home', de: 'Startseite', fr: 'Accueil', it: 'Home', es: 'Inicio', pt: 'Início', nl: 'Home', sv: 'Hem', nb: 'Hjem', ro: 'Acasă', hr: 'Početna', sl: 'Domov', mk: 'Дома', sr: 'Почетна', tr: 'Ana Sayfa', ar: 'الرئيسية', hy: 'Գլխավոր', gsw: 'Startsiite', bs: 'Početna' },
  'Ballina (Dashboard)': { en: 'Home (Dashboard)', de: 'Startseite (Übersicht)', fr: 'Accueil (tableau de bord)', it: 'Home (dashboard)', es: 'Inicio (panel)', pt: 'Início (painel)', nl: 'Home (dashboard)', sv: 'Hem (översikt)', nb: 'Hjem (oversikt)', ro: 'Acasă (panou)', hr: 'Početna (nadzorna ploča)', sl: 'Domov (nadzorna plošča)', mk: 'Дома (табла)', sr: 'Почетна (табла)', tr: 'Ana Sayfa (Panel)', ar: 'الرئيسية (لوحة التحكم)', hy: 'Գլխավոր (վահանակ)', gsw: 'Startsiite (Übersicht)', bs: 'Početna (nadzorna ploča)' },
  'Statistika': { en: 'Statistics', de: 'Statistiken', fr: 'Statistiques', it: 'Statistiche', es: 'Estadísticas', pt: 'Estatísticas', nl: 'Statistieken', sv: 'Statistik', nb: 'Statistikk', ro: 'Statistici', hr: 'Statistika', sl: 'Statistika', mk: 'Статистика', sr: 'Статистика', tr: 'İstatistikler', ar: 'الإحصائيات', hy: 'Վիճակագրություն', gsw: 'Statistike', bs: 'Statistika' },
  'Tema': { en: 'Topic', de: 'Thema', fr: 'Sujet', it: 'Tema', es: 'Tema', pt: 'Tema', nl: 'Onderwerp', sv: 'Ämne', nb: 'Tema', ro: 'Temă', hr: 'Tema', sl: 'Tema', mk: 'Тема', sr: 'Тема', tr: 'Konu', ar: 'الموضوع', hy: 'Թեմա', gsw: 'Thema', bs: 'Tema' },
  'Promovime': { en: 'Promotions', de: 'Werbung', fr: 'Promotions', it: 'Promozioni', es: 'Promociones', pt: 'Promoções', nl: 'Promoties', sv: 'Kampanjer', nb: 'Kampanjer', ro: 'Promoții', hr: 'Promocije', sl: 'Promocije', mk: 'Промоции', sr: 'Промоције', tr: 'Tanıtımlar', ar: 'الترويجات', hy: 'Գովազդներ', gsw: 'Wärbig', bs: 'Promocije' },
  'Video': { en: 'Video', de: 'Video', fr: 'Vidéo', it: 'Video', es: 'Vídeo', pt: 'Vídeo', nl: 'Video', sv: 'Video', nb: 'Video', ro: 'Video', hr: 'Video', sl: 'Video', mk: 'Видео', sr: 'Видео', tr: 'Video', ar: 'فيديو', hy: 'Տեսանյութ', gsw: 'Video', bs: 'Video' },
  'Kamera': { en: 'Camera', de: 'Kamera', fr: 'Caméra', it: 'Telecamera', es: 'Cámara', pt: 'Câmara', nl: 'Camera', sv: 'Kamera', nb: 'Kamera', ro: 'Cameră', hr: 'Kamera', sl: 'Kamera', mk: 'Камера', sr: 'Камера', tr: 'Kamera', ar: 'كاميرا', hy: 'Տեսախցիկ', gsw: 'Kamera', bs: 'Kamera' },

  // ── Placeholder and field fragments ────────────────────────────────
  '(Ti)': { en: '(You)', de: '(Du)', fr: '(Vous)', it: '(Tu)', es: '(Tú)', pt: '(Você)', nl: '(Jij)', sv: '(Du)', nb: '(Deg)', ro: '(Tu)', hr: '(Ti)', sl: '(Ti)', mk: '(Ти)', sr: '(Ти)', tr: '(Sen)', ar: '(أنت)', hy: '(Դու)', gsw: '(Du)', bs: '(Ti)' },
  'ID:': { en: 'ID:', de: 'ID:', fr: 'ID :', it: 'ID:', es: 'ID:', pt: 'ID:', nl: 'ID:', sv: 'ID:', nb: 'ID:', ro: 'ID:', hr: 'ID:', sl: 'ID:', mk: 'ID:', sr: 'ID:', tr: 'Kimlik:', ar: 'المعرف:', hy: 'ID՝', gsw: 'ID:', bs: 'ID:' },
  'ID: #': { en: 'ID: #', de: 'ID: #', fr: 'ID : #', it: 'ID: #', es: 'ID: #', pt: 'ID: #', nl: 'ID: #', sv: 'ID: #', nb: 'ID: #', ro: 'ID: #', hr: 'ID: #', sl: 'ID: #', mk: 'ID: #', sr: 'ID: #', tr: 'Kimlik: #', ar: 'المعرف: #', hy: 'ID՝ #', gsw: 'ID: #', bs: 'ID: #' },
  'Kat:': { en: 'Cat:', de: 'Kat.:', fr: 'Cat. :', it: 'Cat.:', es: 'Cat.:', pt: 'Cat.:', nl: 'Cat.:', sv: 'Kat.:', nb: 'Kat.:', ro: 'Cat.:', hr: 'Kat.:', sl: 'Kat.:', mk: 'Кат.:', sr: 'Кат.:', tr: 'Kategori:', ar: 'الفئة:', hy: 'Կատ.՝', gsw: 'Kat.:', bs: 'Kat.:' },
  'CSV': { en: 'CSV', de: 'CSV', fr: 'CSV', it: 'CSV', es: 'CSV', pt: 'CSV', nl: 'CSV', sv: 'CSV', nb: 'CSV', ro: 'CSV', hr: 'CSV', sl: 'CSV', mk: 'CSV', sr: 'CSV', tr: 'CSV', ar: 'CSV', hy: 'CSV', gsw: 'CSV', bs: 'CSV' },
  'Bot': { en: 'Bot', de: 'Bot', fr: 'Bot', it: 'Bot', es: 'Bot', pt: 'Bot', nl: 'Bot', sv: 'Bot', nb: 'Bot', ro: 'Bot', hr: 'Bot', sl: 'Bot', mk: 'Бот', sr: 'Бот', tr: 'Bot', ar: 'روبوت', hy: 'Բոտ', gsw: 'Bot', bs: 'Bot' },

  // ── Ad placement names (shown as the slot label in the admin picker) ─
  'Top Banner': { en: 'Top Banner', de: 'Oberes Banner', fr: 'Bannière supérieure', it: 'Banner superiore', es: 'Banner superior', pt: 'Banner superior', nl: 'Bovenste banner', sv: 'Övre banner', nb: 'Øvre banner', ro: 'Banner superior', hr: 'Gornji banner', sl: 'Zgornji banner', mk: 'Горен банер', sr: 'Горњи банер', tr: 'Üst Banner', ar: 'لافتة علوية', hy: 'Վերին բաններ', gsw: 'Obers Banner', bs: 'Gornji banner' },
  'Inline Banner': { en: 'Inline Banner', de: 'Inline-Banner', fr: 'Bannière intégrée', it: 'Banner in linea', es: 'Banner integrado', pt: 'Banner integrado', nl: 'Inline banner', sv: 'Inline-banner', nb: 'Inline-banner', ro: 'Banner integrat', hr: 'Ugrađeni banner', sl: 'Vgrajeni banner', mk: 'Вграден банер', sr: 'Уграђени банер', tr: 'Satır içi Banner', ar: 'لافتة مدمجة', hy: 'Ներկառուցված բաններ', gsw: 'Inline-Banner', bs: 'Ugrađeni banner' },
  'Sidebar Banner': { en: 'Sidebar Banner', de: 'Seitenbanner', fr: 'Bannière latérale', it: 'Banner laterale', es: 'Banner lateral', pt: 'Banner lateral', nl: 'Zijbalkbanner', sv: 'Sidobanner', nb: 'Sidebanner', ro: 'Banner lateral', hr: 'Bočni banner', sl: 'Stranski banner', mk: 'Страничен банер', sr: 'Бочни банер', tr: 'Kenar Çubuğu Banner', ar: 'لافتة جانبية', hy: 'Կողային բաններ', gsw: 'Sitespalte-Banner', bs: 'Bočni banner' },
  'HTML Banner': { en: 'HTML Banner', de: 'HTML-Banner', fr: 'Bannière HTML', it: 'Banner HTML', es: 'Banner HTML', pt: 'Banner HTML', nl: 'HTML-banner', sv: 'HTML-banner', nb: 'HTML-banner', ro: 'Banner HTML', hr: 'HTML banner', sl: 'HTML banner', mk: 'HTML банер', sr: 'HTML банер', tr: 'HTML Banner', ar: 'لافتة HTML', hy: 'HTML բաններ', gsw: 'HTML-Banner', bs: 'HTML banner' },
  'JavaScript Banner': { en: 'JavaScript Banner', de: 'JavaScript-Banner', fr: 'Bannière JavaScript', it: 'Banner JavaScript', es: 'Banner JavaScript', pt: 'Banner JavaScript', nl: 'JavaScript-banner', sv: 'JavaScript-banner', nb: 'JavaScript-banner', ro: 'Banner JavaScript', hr: 'JavaScript banner', sl: 'JavaScript banner', mk: 'JavaScript банер', sr: 'JavaScript банер', tr: 'JavaScript Banner', ar: 'لافتة JavaScript', hy: 'JavaScript բաններ', gsw: 'JavaScript-Banner', bs: 'JavaScript banner' },

  // ── Uppercase action labels and statuses ──────────────────────────
  'ANULO': { en: 'CANCEL', de: 'ABBRECHEN', fr: 'ANNULER', it: 'ANNULLA', es: 'CANCELAR', pt: 'CANCELAR', nl: 'ANNULEREN', sv: 'AVBRYT', nb: 'AVBRYT', ro: 'ANULEAZĂ', hr: 'ODUSTANI', sl: 'PREKLIČI', mk: 'ОТКАЖИ', sr: 'ОДУСТАНИ', tr: 'İPTAL', ar: 'إلغاء', hy: 'ՉԵՂԱՐԿԵԼ', gsw: 'ABBRÄCHE', bs: 'ODUSTANI' },
  'AKTIV': { en: 'ACTIVE', de: 'AKTIV', fr: 'ACTIF', it: 'ATTIVO', es: 'ACTIVO', pt: 'ATIVO', nl: 'ACTIEF', sv: 'AKTIV', nb: 'AKTIV', ro: 'ACTIV', hr: 'AKTIVNO', sl: 'AKTIVNO', mk: 'АКТИВНО', sr: 'АКТИВНО', tr: 'AKTİF', ar: 'نشط', hy: 'ԱԿՏԻՎ', gsw: 'AKTIV', bs: 'AKTIVNO' },
  'SATELIT': { en: 'SATELLITE', de: 'SATELLIT', fr: 'SATELLITE', it: 'SATELLITE', es: 'SATÉLITE', pt: 'SATÉLITE', nl: 'SATELLIET', sv: 'SATELLIT', nb: 'SATELLITT', ro: 'SATELIT', hr: 'SATELIT', sl: 'SATELIT', mk: 'САТЕЛИТ', sr: 'САТЕЛИТ', tr: 'UYDU', ar: 'قمر صناعي', hy: 'ԱՐԾԱՆԹ', gsw: 'SATELLIT', bs: 'SATELIT' },
  'AUDIT': { en: 'AUDIT', de: 'PRÜFUNG', fr: 'AUDIT', it: 'AUDIT', es: 'AUDITORÍA', pt: 'AUDITORIA', nl: 'AUDIT', sv: 'REVISION', nb: 'REVISJON', ro: 'AUDIT', hr: 'REVIZIJA', sl: 'REVIZIJA', mk: 'РЕВИЗИЈА', sr: 'РЕВИЗИЈА', tr: 'DENETİM', ar: 'تدقيق', hy: 'ԱՈՒԴԻՏ', gsw: 'PRÜEFIG', bs: 'REVIZIJA' },
  'DËRGO': { en: 'SEND', de: 'SENDEN', fr: 'ENVOYER', it: 'INVIA', es: 'ENVIAR', pt: 'ENVIAR', nl: 'VERZENDEN', sv: 'SKICKA', nb: 'SEND', ro: 'TRIMITE', hr: 'POŠALJI', sl: 'POŠLJI', mk: 'ИСПРАТИ', sr: 'ПОШАЉИ', tr: 'GÖNDER', ar: 'إرسال', hy: 'ՈՒՂԱՐԿԵԼ', gsw: 'SCHICKE', bs: 'POŠALJI' },
  'MBYLL SEZONIN': { en: 'CLOSE THE SEASON', de: 'SAISON BEENDEN', fr: 'CLÔTURER LA SAISON', it: 'CHIUDI LA STAGIONE', es: 'CERRAR LA TEMPORADA', pt: 'ENCERRAR A TEMPORADA', nl: 'SEIZOEN SLUITEN', sv: 'AVSLUTA SÄSONGEN', nb: 'AVSLUTT SESONGEN', ro: 'ÎNCHEIE SEZONUL', hr: 'ZATVORI SEZONU', sl: 'ZAPRI SEZONO', mk: 'ЗАТВОРИ СЕЗОНА', sr: 'ЗАТВОРИ СЕЗОНУ', tr: 'SEZONU KAPAT', ar: 'إغلاق الموسم', hy: 'ՓԱԿԵԼ ՍԵԶՈՆԸ', gsw: 'SÄSON BEÄNDE', bs: 'ZATVORI SEZONU' },
  'OPERON:': { en: 'OPERATING:', de: 'IN BETRIEB:', fr: 'EN SERVICE :', it: 'IN FUNZIONE:', es: 'EN FUNCIONAMIENTO:', pt: 'EM FUNCIONAMENTO:', nl: 'IN BEDRIJF:', sv: 'I DRIFT:', nb: 'I DRIFT:', ro: 'ÎN FUNCȚIUNE:', hr: 'U POGONU:', sl: 'V OBRATOVANJU:', mk: 'ВО РАБОТА:', sr: 'У ПОГОНУ:', tr: 'ÇALIŞIYOR:', ar: 'قيد التشغيل:', hy: 'ԱՇԽԱՏՈՒՄ Է՝', gsw: 'IN BETRIEB:', bs: 'U POGONU:' },
  'SHKALLA IV:': { en: 'SCALE IV:', de: 'SKALA IV:', fr: 'ÉCHELLE IV :', it: 'SCALA IV:', es: 'ESCALA IV:', pt: 'ESCALA IV:', nl: 'SCHAAL IV:', sv: 'SKALA IV:', nb: 'SKALA IV:', ro: 'SCARA IV:', hr: 'LJESTVICA IV:', sl: 'LESTVICA IV:', mk: 'СКАЛА IV:', sr: 'СКАЛА IV:', tr: 'ÖLÇEK IV:', ar: 'المقياس IV:', hy: 'ՍԱՆԴՂԱԿ IV՝', gsw: 'SKALA IV:', bs: 'LJESTVICA IV:' },

  // ── Form labels and placeholders ──────────────────────────────────
  'Edit': { en: 'Edit', de: 'Bearbeiten', fr: 'Modifier', it: 'Modifica', es: 'Editar', pt: 'Editar', nl: 'Bewerken', sv: 'Redigera', nb: 'Rediger', ro: 'Editează', hr: 'Uredi', sl: 'Uredi', mk: 'Уреди', sr: 'Уреди', tr: 'Düzenle', ar: 'تعديل', hy: 'Խմբագրել', gsw: 'Bearbeite', bs: 'Uredi' },
  'Adresa...': { en: 'Address...', de: 'Adresse...', fr: 'Adresse...', it: 'Indirizzo...', es: 'Dirección...', pt: 'Endereço...', nl: 'Adres...', sv: 'Adress...', nb: 'Adresse...', ro: 'Adresă...', hr: 'Adresa...', sl: 'Naslov...', mk: 'Адреса...', sr: 'Адреса...', tr: 'Adres...', ar: 'العنوان...', hy: 'Հասցե...', gsw: 'Adrässe...', bs: 'Adresa...' },
  'Statusi': { en: 'Status', de: 'Status', fr: 'Statut', it: 'Stato', es: 'Estado', pt: 'Estado', nl: 'Status', sv: 'Status', nb: 'Status', ro: 'Stare', hr: 'Status', sl: 'Status', mk: 'Статус', sr: 'Статус', tr: 'Durum', ar: 'الحالة', hy: 'Կարգավիճակ', gsw: 'Status', bs: 'Status' },
  'Statusi:': { en: 'Status:', de: 'Status:', fr: 'Statut :', it: 'Stato:', es: 'Estado:', pt: 'Estado:', nl: 'Status:', sv: 'Status:', nb: 'Status:', ro: 'Stare:', hr: 'Status:', sl: 'Status:', mk: 'Статус:', sr: 'Статус:', tr: 'Durum:', ar: 'الحالة:', hy: 'Կարգավիճակ՝', gsw: 'Status:', bs: 'Status:' },
  'ZONA:': { en: 'ZONE:', de: 'ZONE:', fr: 'ZONE :', it: 'ZONA:', es: 'ZONA:', pt: 'ZONA:', nl: 'ZONE:', sv: 'ZON:', nb: 'SONE:', ro: 'ZONĂ:', hr: 'ZONA:', sl: 'OBMOČJE:', mk: 'ЗОНА:', sr: 'ЗОНА:', tr: 'BÖLGE:', ar: 'المنطقة:', hy: 'ԳՈՏԻ՝', gsw: 'ZONE:', bs: 'ZONA:' },
  'Ndihmësi AI': { en: 'AI Assistant', de: 'KI-Assistent', fr: 'Assistant IA', it: 'Assistente IA', es: 'Asistente IA', pt: 'Assistente de IA', nl: 'AI-assistent', sv: 'AI-assistent', nb: 'AI-assistent', ro: 'Asistent AI', hr: 'AI asistent', sl: 'AI pomočnik', mk: 'AI асистент', sr: 'AI асистент', tr: 'Yapay Zeka Asistanı', ar: 'مساعد الذكاء الاصطناعي', hy: 'AI օգնական', gsw: 'KI-Assistent', bs: 'AI asistent' },
  'Intervali (Minuta)': { en: 'Interval (minutes)', de: 'Intervall (Minuten)', fr: 'Intervalle (minutes)', it: 'Intervallo (minuti)', es: 'Intervalo (minutos)', pt: 'Intervalo (minutos)', nl: 'Interval (minuten)', sv: 'Intervall (minuter)', nb: 'Intervall (minutter)', ro: 'Interval (minute)', hr: 'Interval (minute)', sl: 'Interval (minute)', mk: 'Интервал (минути)', sr: 'Интервал (минути)', tr: 'Aralık (dakika)', ar: 'الفاصل الزمني (دقائق)', hy: 'Ընդմիջում (րոպե)', gsw: 'Intervall (Minute)', bs: 'Interval (minute)' },
  'Auto-Routing AI': { en: 'AI Auto-Routing', de: 'KI-Auto-Routing', fr: 'Routage auto. IA', it: 'Instradamento auto. IA', es: 'Enrutamiento auto. IA', pt: 'Encaminhamento auto. IA', nl: 'AI-auto-routering', sv: 'AI-autoroutning', nb: 'AI-autoruting', ro: 'Rutare automată AI', hr: 'AI automatsko usmjeravanje', sl: 'AI samodejno usmerjanje', mk: 'AI автоматско рутирање', sr: 'AI аутоматско рутирање', tr: 'AI Otomatik Yönlendirme', ar: 'التوجيه التلقائي بالذكاء الاصطناعي', hy: 'AI ավտոմատ երթուղավորում', gsw: 'KI-Auto-Routing', bs: 'AI automatsko usmjeravanje' },
  'Linku i reklamës (opsional) - https://...': { en: 'Ad link (optional) - https://...', de: 'Anzeigenlink (optional) - https://...', fr: 'Lien de l\'annonce (facultatif) - https://...', it: 'Link annuncio (opzionale) - https://...', es: 'Enlace del anuncio (opcional) - https://...', pt: 'Link do anúncio (opcional) - https://...', nl: 'Advertentielink (optioneel) - https://...', sv: 'Annonslänk (valfritt) - https://...', nb: 'Annonselenke (valgfritt) - https://...', ro: 'Link anunț (opțional) - https://...', hr: 'Link oglasa (neobavezno) - https://...', sl: 'Povezava oglasa (neobvezno) - https://...', mk: 'Линк на оглас (опционално) - https://...', sr: 'Линк огласа (опционо) - https://...', tr: 'Reklam bağlantısı (isteğe bağlı) - https://...', ar: 'رابط الإعلان (اختياري) - https://...', hy: 'Գովազդի հղում (ըստ ցանկության) - https://...', gsw: 'Insärät-Link (optional) - https://...', bs: 'Link oglasa (neobavezno) - https://...' },
  'Shkëmbe Pikët': { en: 'Redeem Points', de: 'Punkte einlösen', fr: 'Échanger des points', it: 'Riscatta punti', es: 'Canjear puntos', pt: 'Trocar pontos', nl: 'Punten inwisselen', sv: 'Lös in poäng', nb: 'Løs inn poeng', ro: 'Schimbă puncte', hr: 'Zamijeni bodove', sl: 'Zamenjaj točke', mk: 'Замени поени', sr: 'Замени поене', tr: 'Puanları Kullan', ar: 'استبدال النقاط', hy: 'Փոխանակել միավորներ', gsw: 'Pünkt iilöse', bs: 'Zamijeni bodove' },
  'Pasqyra e Performancës sipas Komunave': { en: 'Performance Overview by Municipality', de: 'Leistungsübersicht nach Gemeinde', fr: 'Aperçu des performances par municipalité', it: 'Panoramica delle prestazioni per comune', es: 'Resumen de rendimiento por municipio', pt: 'Visão geral de desempenho por município', nl: 'Prestatieoverzicht per gemeente', sv: 'Prestandaöversikt per kommun', nb: 'Ytelsesoversikt per kommune', ro: 'Prezentare generală a performanței pe municipii', hr: 'Pregled učinka po općinama', sl: 'Pregled uspešnosti po občinah', mk: 'Преглед на перформансите по општини', sr: 'Преглед учинка по општинама', tr: 'Belediyelere Göre Performans Özeti', ar: 'نظرة عامة على الأداء حسب البلدية', hy: 'Կատարողականի ամփոփում ըստ համայնքների', gsw: 'Leistigsübersicht nach Gmeind', bs: 'Pregled učinka po općinama' },

  // ── Markup and URL fragments: translated only where meaningful ────
  'Glisni &rarr;': { en: 'Swipe &rarr;', de: 'Wischen &rarr;', fr: 'Glissez &rarr;', it: 'Scorri &rarr;', es: 'Desliza &rarr;', pt: 'Deslize &rarr;', nl: 'Veeg &rarr;', sv: 'Svep &rarr;', nb: 'Sveip &rarr;', ro: 'Glisează &rarr;', hr: 'Povucite &rarr;', sl: 'Povlecite &rarr;', mk: 'Повлечете &rarr;', sr: 'Повуците &rarr;', tr: 'Kaydırın &rarr;', ar: 'اسحب &rarr;', hy: 'Սահեցրեք &rarr;', gsw: 'Wische &rarr;', bs: 'Povucite &rarr;' },
  'Reels Video': { en: 'Reels Video', de: 'Reels-Video', fr: 'Vidéo Reels', it: 'Video Reels', es: 'Vídeo Reels', pt: 'Vídeo Reels', nl: 'Reels-video', sv: 'Reels-video', nb: 'Reels-video', ro: 'Video Reels', hr: 'Reels video', sl: 'Video Reels', mk: 'Reels видео', sr: 'Reels видео', tr: 'Reels Videosu', ar: 'فيديو الريلز', hy: 'Reels տեսանյութ', gsw: 'Reels-Video', bs: 'Reels video' },
  'Forumi - Reels': { en: 'Forum - Reels', de: 'Forum - Reels', fr: 'Forum - Reels', it: 'Forum - Reels', es: 'Foro - Reels', pt: 'Fórum - Reels', nl: 'Forum - Reels', sv: 'Forum - Reels', nb: 'Forum - Reels', ro: 'Forum - Reels', hr: 'Forum - Reels', sl: 'Forum - Reels', mk: 'Форум - Reels', sr: 'Форум - Reels', tr: 'Forum - Reels', ar: 'المنتدى - ريلز', hy: 'Ֆորում - Reels', gsw: 'Forum - Reels', bs: 'Forum - Reels' },

  // ── Forum, agents and remaining dashboard vocabulary ───────────────
  'Online (Bot)': { en: 'Online (bot)', de: 'Online (Bot)', fr: 'En ligne (bot)', it: 'Online (bot)', es: 'En línea (bot)', pt: 'Online (bot)', nl: 'Online (bot)', sv: 'Online (bot)', nb: 'Online (bot)', ro: 'Online (bot)', hr: 'Online (bot)', sl: 'Na spletu (bot)', mk: 'Онлајн (бот)', sr: 'Онлајн (бот)', tr: 'Çevrimiçi (bot)', ar: 'متصل (روبوت)', hy: 'Առցանց (բոտ)', gsw: 'Online (Bot)', bs: 'Online (bot)' },
  'AI Bot': { en: 'AI Bot', de: 'KI-Bot', fr: 'Bot IA', it: 'Bot IA', es: 'Bot de IA', pt: 'Bot de IA', nl: 'AI-bot', sv: 'AI-bot', nb: 'AI-bot', ro: 'Bot AI', hr: 'AI bot', sl: 'AI bot', mk: 'AI бот', sr: 'AI бот', tr: 'Yapay Zeka Botu', ar: 'روبوت الذكاء الاصطناعي', hy: 'AI բոտ', gsw: 'KI-Bot', bs: 'AI bot' },
  'Agjent': { en: 'Agent', de: 'Agent', fr: 'Agent', it: 'Agente', es: 'Agente', pt: 'Agente', nl: 'Agent', sv: 'Agent', nb: 'Agent', ro: 'Agent', hr: 'Agent', sl: 'Agent', mk: 'Агент', sr: 'Агент', tr: 'Temsilci', ar: 'وكيل', hy: 'Գործակալ', gsw: 'Agent', bs: 'Agent' },
  'Reels': { en: 'Reels', de: 'Reels', fr: 'Reels', it: 'Reels', es: 'Reels', pt: 'Reels', nl: 'Reels', sv: 'Reels', nb: 'Reels', ro: 'Reels', hr: 'Reels', sl: 'Reels', mk: 'Reels', sr: 'Reels', tr: 'Reels', ar: 'ريلز', hy: 'Reels', gsw: 'Reels', bs: 'Reels' },
  'Reels (': { en: 'Reels (', de: 'Reels (', fr: 'Reels (', it: 'Reels (', es: 'Reels (', pt: 'Reels (', nl: 'Reels (', sv: 'Reels (', nb: 'Reels (', ro: 'Reels (', hr: 'Reels (', sl: 'Reels (', mk: 'Reels (', sr: 'Reels (', tr: 'Reels (', ar: 'ريلز (', hy: 'Reels (', gsw: 'Reels (', bs: 'Reels (' },
  'pts': { en: 'pts', de: 'Pkt.', fr: 'pts', it: 'pti', es: 'pts', pt: 'pts', nl: 'pnt', sv: 'p', nb: 'p', ro: 'pct', hr: 'bod.', sl: 'tčk', mk: 'поен', sr: 'поен', tr: 'puan', ar: 'نقطة', hy: 'միավոր', gsw: 'Pkt.', bs: 'bod.' },
  'Mbeturina': { en: 'Waste', de: 'Abfall', fr: 'Déchets', it: 'Rifiuti', es: 'Residuos', pt: 'Resíduos', nl: 'Afval', sv: 'Avfall', nb: 'Avfall', ro: 'Deșeuri', hr: 'Otpad', sl: 'Odpadki', mk: 'Отпад', sr: 'Отпад', tr: 'Atık', ar: 'النفايات', hy: 'Թափոններ', gsw: 'Abfall', bs: 'Otpad' },
  'Inst.': { en: 'Inst.', de: 'Inst.', fr: 'Inst.', it: 'Ist.', es: 'Inst.', pt: 'Inst.', nl: 'Inst.', sv: 'Inst.', nb: 'Inst.', ro: 'Inst.', hr: 'Inst.', sl: 'Inst.', mk: 'Инст.', sr: 'Инст.', tr: 'Kur.', ar: 'المؤسسة', hy: 'Հիմն.', gsw: 'Inst.', bs: 'Inst.' },
  'Dashboard': { en: 'Dashboard', de: 'Übersicht', fr: 'Tableau de bord', it: 'Dashboard', es: 'Panel', pt: 'Painel', nl: 'Dashboard', sv: 'Översikt', nb: 'Oversikt', ro: 'Panou', hr: 'Nadzorna ploča', sl: 'Nadzorna plošča', mk: 'Табла', sr: 'Табла', tr: 'Panel', ar: 'لوحة التحكم', hy: 'Վահանակ', gsw: 'Übersicht', bs: 'Nadzorna ploča' },
  'Shtrirja (Targeti)': { en: 'Reach (target)', de: 'Reichweite (Ziel)', fr: 'Portée (cible)', it: 'Copertura (target)', es: 'Alcance (objetivo)', pt: 'Alcance (alvo)', nl: 'Bereik (doel)', sv: 'Räckvidd (mål)', nb: 'Rekkevidde (mål)', ro: 'Acoperire (țintă)', hr: 'Doseg (cilj)', sl: 'Doseg (cilj)', mk: 'Досег (цел)', sr: 'Досег (циљ)', tr: 'Erişim (hedef)', ar: 'الوصول (الهدف)', hy: 'Հասանելիություն (թիրախ)', gsw: 'Riichwiiti (Ziil)', bs: 'Doseg (cilj)' },
  'Lanso Fushatën': { en: 'Launch Campaign', de: 'Kampagne starten', fr: 'Lancer la campagne', it: 'Avvia campagna', es: 'Lanzar campaña', pt: 'Lançar campanha', nl: 'Campagne starten', sv: 'Starta kampanj', nb: 'Start kampanje', ro: 'Lansează campania', hr: 'Pokreni kampanju', sl: 'Zaženi kampanjo', mk: 'Започни кампања', sr: 'Покрени кампању', tr: 'Kampanyayı Başlat', ar: 'إطلاق الحملة', hy: 'Մեկնարկել արշավը', gsw: 'Kampagne starte', bs: 'Pokreni kampanju' },
};

const ALL_LANGS = ['en', 'de', 'bs', 'ar', 'tr', 'sr', 'fr', 'it', 'es', 'pt', 'gsw', 'mk', 'sl', 'hr', 'ro', 'sv', 'nb', 'hy', 'nl'];

function main() {
  const dry = process.argv.includes('--dry');
  const cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));

  let applied = 0;
  const report = {};

  for (const [source, byLang] of Object.entries(TERMS)) {
    for (const lang of ALL_LANGS) {
      const value = byLang[lang];
      if (!value) continue;
      cache[lang] = cache[lang] || {};
      if (cache[lang][source]) continue;      // never overwrite existing work
      report[lang] = (report[lang] || 0) + 1;
      applied++;
      if (!dry) cache[lang][source] = value;
    }
  }

  if (!dry) fs.writeFileSync(CACHE_FILE, JSON.stringify(cache), 'utf8');

  console.log(`${dry ? '[DRY RUN] ' : ''}Hand translations applied: ${applied}\n`);
  for (const lang of ALL_LANGS) {
    console.log(`  ${lang.padEnd(5)} +${report[lang] || 0}`);
  }

  if (!dry) {
    console.log('\nNow run:  node merge_shards.js');
  }
}

main();
