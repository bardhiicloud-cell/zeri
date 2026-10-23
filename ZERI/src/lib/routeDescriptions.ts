/**
 * One meta description per public page (about 70-160 characters), so search results and shared
 * links describe the page that was opened instead of repeating the home page's text.
 * Keyed by the unprefixed path, like ROUTE_TITLES in App.tsx. Passed through dt() by the caller.
 */
export const DEFAULT_DESCRIPTION =
  'Platforma Zëri Qytetarëve i mundëson qytetarëve të raportojnë çështje, të ndiqin zgjidhjen e tyre, të votojnë në sondazhe dhe të kontribuojnë në vendimmarrjen komunale të Kosovës.';

export const ROUTE_DESCRIPTIONS: Record<string, string> = {
  '/': DEFAULT_DESCRIPTION,
  '/raporto': 'Raportoni një problem në komunën tuaj me foto dhe vendndodhje. Merrni një Track ID dhe ndiqni se si trajtohet nga institucioni përgjegjës.',
  '/harta': 'Harta e raportimeve qytetare në Kosovë: shihni çfarë po ndodh rreth jush, filtroni sipas komunës, temës dhe urgjencës.',
  '/detailed-registry': 'Regjistri publik i raportimeve të aprovuara: kërkoni dhe filtroni sipas komunës, kategorisë dhe statusit.',
  '/regjistri': 'Regjistri publik i raportimeve të aprovuara: kërkoni dhe filtroni sipas komunës, kategorisë dhe statusit.',
  '/registry': 'Regjistri publik i raportimeve të aprovuara: kërkoni dhe filtroni sipas komunës, kategorisë dhe statusit.',
  '/trackid': 'Shkruani Track ID-në e raportit tuaj dhe shihni ku ndodhet: marrë, shqyrtuar, në trajtim apo zgjidhur. Nuk kërkohet llogari.',
  '/trackid/detaje': 'Historiku i plotë i një raporti me Track ID: çdo hap, çdo përgjigje zyrtare dhe afatet e trajtimit.',
  '/raportet-e-mia': 'Raportet që keni dërguar nga kjo pajisje dhe llogaria juaj, me statusin e secilit dhe hapin e radhës.',
  '/statistikat': 'Statistika të hapura për raportimet qytetare në Kosovë: sipas komunës, kategorisë dhe periudhës kohore.',
  '/transparenca': 'Qendra e Transparencës: sa raportime janë marrë, sa janë zgjidhur dhe sa shpejt, me çdo shifër të shpjeguar.',
  '/shendetesia': 'Regjistri shëndetësor publik: raportoni mungesa të barnave dhe probleme në institucionet shëndetësore.',
  '/semundjet': 'Regjistri shëndetësor publik: raportoni mungesa të barnave dhe probleme në institucionet shëndetësore.',
  '/sondazhet': 'Sondazhe publike për çështje që ju prekin: votoni dhe shihni rezultatet.',
  '/sondazhe': 'Sondazhe publike për çështje që ju prekin: votoni dhe shihni rezultatet.',
  '/komunat': 'Të 38 komunat e Kosovës: kontaktet, shërbimet dhe raportimet e secilës komunë në një vend.',
  '/sherbimet': 'Shërbimet publike në Kosovë: dokumente, afate dhe institucionet ku t’i kërkoni, të shpjeguara thjesht.',
  '/Idea': 'Bankë idesh qytetare: propozoni një ide për komunën tuaj dhe mbështetni idetë e të tjerëve.',
  '/projektet': 'Projektet qytetare dhe komunale: ndiqni çfarë po ndërtohet, nga kush dhe me çfarë afati.',
  '/lajme': 'Lajme dhe njoftime zyrtare nga komunat dhe institucionet e Kosovës, të verifikuara nga redaksia.',
  '/lajmet': 'Lajme dhe njoftime zyrtare nga komunat dhe institucionet e Kosovës, të verifikuara nga redaksia.',
  '/lajmero': 'Dërgoni një lajm ose njoftim për redaksinë. Çdo dërgesë kontrollohet para publikimit.',
  '/kontakt': 'Na kontaktoni për pyetje, sugjerime ose bashkëpunim. Mesazhi juaj shkon te ekipi i platformës.',
  '/kontakte': 'Na kontaktoni për pyetje, sugjerime ose bashkëpunim. Mesazhi juaj shkon te ekipi i platformës.',
  '/kontakt-numrat': 'Numrat e urgjencës dhe kontaktet e institucioneve dhe komunave të Kosovës, në një listë të kërkueshme.',
  '/rreth-projektit': 'Çfarë është Zëri Qytetarëve, kush qëndron pas tij dhe si funksionon nga raportimi te zgjidhja.',
  '/rreth-nesh': 'Çfarë është Zëri Qytetarëve, kush qëndron pas tij dhe si funksionon nga raportimi te zgjidhja.',
  '/kushtet-e-perdorimit': 'Kushtet e përdorimit të platformës Zëri Qytetarëve: të drejtat dhe përgjegjësitë tuaja dhe tonat.',
  '/terms': 'Kushtet e përdorimit të platformës Zëri Qytetarëve: të drejtat dhe përgjegjësitë tuaja dhe tonat.',
  '/privatesia': 'Si i mbrojmë të dhënat tuaja: çfarë mbledhim, pse, sa kohë e ruajmë dhe si ushtroni të drejtat tuaja.',
  '/politika-e-priveritetit': 'Si i mbrojmë të dhënat tuaja: çfarë mbledhim, pse, sa kohë e ruajmë dhe si ushtroni të drejtat tuaja.',
  '/politika-e-cookies': 'Cilat cookie përdorim, për çfarë shërbejnë dhe si mund t’i pranoni ose refuzoni.',
  '/donacion': 'Mbështetni platformën Zëri Qytetarëve me një donacion.',
  '/partneret': 'Partnerët e platformës dhe mënyra si mund të reklamoni ose bashkëpunoni me ne.',
  '/zeri-qytetar': 'Çka bën Zëri Qytetarëve për qytetarët: raportim, ndjekje, transparencë dhe pjesëmarrje.',
  '/kosova': 'Kosova: histori, kulturë dhe trashëgimi, e treguar në kapituj të organizuar.',
  '/historia-e-uck': 'Arkivi i Historisë së UÇK-së: kapituj, dëshmi dhe kujtim për luftën çlirimtare.',
  '/login': 'Hyni në llogarinë tuaj në Zëri Qytetarëve për të ndjekur raportimet dhe për të marrë njoftime.',
  '/register': 'Krijoni llogari në Zëri Qytetarëve për të raportuar, ndjekur dhe votuar.',
  '/ndihma': 'Qendra e Ndihmës: përgjigje për pyetjet e shpeshta mbi raportimin, Track ID dhe llogarinë.',
  '/verifikimi': 'Kërkoni verifikimin e llogarisë suaj për të marrë një shenjë besueshmërie.',
  '/moderimi-im': 'Shihni statusin e llogarisë tuaj dhe kundërshtoni një vendim moderimi.',
};
