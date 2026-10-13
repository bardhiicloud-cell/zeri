# Ekrani i historikut të caktimeve

**Statusi: Implementuar dhe i verifikuar me teste të komponentit dhe të serverit. Nuk është parë në shfletues** (as përmasat e telefonit/tabletit, as lexuesi i ekranit).

## 1. Ku është dhe çfarë tregon

Paneli `HandoverHistoryPanel` është në hapësirën e shqyrtimit (`ReviewMode`), poshtë bisedës së raportit, për çdo raport. Hapet me klikim (`aria-expanded`) dhe ngarkon vetëm atëherë.

Çdo regjistrim tregon vetëm atë që serveri ka regjistruar: veprimin (caktim ose lëshim), nga kush te kush (emrat), kush e bëri (emri), kur (`<time>`), dhe arsyen. Një emër që mungon shfaqet "nuk është regjistruar", asnjëherë një id ose hamendje; një arsye bosh shfaqet "Pa arsye të shënuar". Regjistrimet e vjetra pa `byName` (para kësaj pune) shfaqen pa emër të veprimtarit, sepse ai nuk u ruajt kurrë.

## 2. Sjellja

- Gjendjet: duke u ngarkuar, bosh ("nuk ka ndryshim mbajtësi të regjistruar"), gabim me `role="alert"` dhe "Provo përsëri", gati.
- Faqosja: 20 për faqe (max 50), më të rejat së pari; "Ngarko më të vjetrat" përdor kursorin që dha serveri (`nextBefore`); një regjistrim i përsëritur në kufirin e faqes nuk dyfishohet.
- Filtri: Të gjitha / Caktime / Lëshime mbi faqet e ngarkuara (nuk pretendon të kërkojë në ato që s'janë ngarkuar; shfaq njoftim kur filtri nuk ka asnjë në faqet e ngarkuara).
- Rifresko: butoni, dhe automatikisht kur ndryshon mbajtësi i raportit.
- Raport tjetër: paneli mbetet i hapur dhe ngarkon të tjetrin; një përgjigje e vonuar për raportin e mëparshëm injorohet.
- Qasja: serveri kthen 403 për këdo që nuk është staf, agjent ose monitor; paneli shfaq mesazhin e serverit. Qasja nuk varet nga fshehja e panelit.

## 3. Serveri

`GET /api/v1/reports/:id/assignments?limit=&before=` (`server/reportAssignment.ts`): `limit` 1–50 (parazgjedhje 20), `before` është `at` i regjistrimit më të vjetër të parë; përgjigje `{ items, nextBefore }`; `Cache-Control: private, no-store`; kërkesa e gabuar → 400. Regjistrimet shkruhen brenda transaksionit të caktimit (kush, nga kush, te kush, kush e bëri dhe emri i tij, arsyeja, koha) dhe nga `releaseHeldReports` pas heqjes së llogarisë (pa emër veprimtari). Nënkolekcioni është i mbyllur për klientët.

## 4. Skedarët

`server/reportAssignment.ts`, `src/lib/reportAssignmentApi.ts`, `src/lib/handoverHistory.ts` (i ri), `src/components/admin/HandoverHistoryPanel.tsx` (i ri), `src/components/admin/ReviewMode.tsx` (2 rreshta), `tests/lib/handoverHistoryPanel.test.tsx` (i ri), `tests/server/reportAssignment.test.ts`, `tests/emulator/reportAssignment.routes.test.ts`.

## 5. Testet (rezultate reale)

| Test | Rezultat |
|---|---|
| `handoverHistoryPanel.test.tsx` (9): nuk ngarkon para hapjes; ngarkim pastaj fushat; bosh; emra që mungojnë; gabimi i serverit dhe ripërpjekja; faqosja pa dyfishim; filtri; përgjigje e vonuar e raportit të mëparshëm; ndihmësit | 9/9 kaluan |
| `reportAssignment.test.ts` (16 gjithsej, përfshirë `parseHistoryQuery`) | 16/16 kaluan |
| emulator `reportAssignment.routes.test.ts` (11): historiku dhe njoftimi shkruhen bashkë; faqosja me kursor; emri i veprimtarit; 403 për komunën; një nga dy caktimet e njëkohshme fiton | 11/11 kaluan |

## 6. Kufizime dhe e pashtuar

- Nuk u bë provë në shfletues: përmasa telefoni/tableti, kontrast, tastierë, lexues ekrani, të gjitha gjuhët. Komponenti përdor etiketa `aria`, `role="alert"`, `aria-live`, objektiva të prekshëm të paktën 36 px dhe `flex-wrap`, por kjo nuk zëvendëson provën.
- Çelësat e rinj shqip (`dt(...)`) nuk kanë përkthim në gjuhët e tjera derisa të ekzekutohet tubacioni i i18n; deri atëherë shfaqen shqip.
- Paneli është vetëm te `ReviewMode`; dosja e plotë e raportit (`ReportDetailModal`) nuk e ka.
- Filtrimi sipas personit ose datës nuk ekziston (nuk e mbështet API).
- Nuk ka kërkim në historikun e të gjithë raporteve; është historik për një raport.
