# Super check i panelit të adminit — 20.10.2026

Notat janë 1–10. Çdo numër vjen nga një matje ose nga kodi i lexuar; ku nuk e kam provuar, e them.

**Ekzekutuar vërtet:** `tsc --noEmit` (0 gabime) · `vitest` tests/server + tests/lib (**110 skedarë, 1267 teste kalojnë**) · `vite build` (ok, 21 s).
**Nuk e ekzekutova:** klikimin e panelit të ndezur me llogari stafi, testet e rregullave Firestore (duan emulator + Java), E2E. Notat për pamjen/UX vijnë nga kodi, jo nga ekrani.

## Notat

| # | Fusha | Nota | Pse |
|---|---|:---:|---|
| 1 | Arkitektura dhe navigimi | **9** | Menuja është e dhënë (`navConfig`), e grupuar sipas shpeshtësisë, me kërkim "shko te…", lidhje të thella (`adminDeepLink`) dhe module të bashkuara pa humbur rrugë/leje. Çdo seksion është chunk i vetë. |
| 2 | Lejet dhe rolet (RBAC) | **9** | 9 role, matricë e gjeneruar nga kodi i serverit dhe e mbrojtur me test (`permissionsMatrix.test`). Rrugët e adminit kalojnë `requireAuth` + `requireAdmin`/`requireSection`; refuzimet regjistrohen. |
| 3 | Workflow i raportimeve | **9** | Fazat, claim, aprovim/refuzim me arsye, eskalim, caktim, afate (SLA), historik dorëzimi, ngarkesa e ekipit, shkurtore tastiere. ~20 teste të punës (`workflow*`, `reportQueue`, `reviewQueue`…). |
| 4 | Workflow i kërkesave të tjera (donacione, shëndetësi, lajme, reklama) | **8** | Qendër e përbashkët aprovimi me veprime masive. Mungon një pamje e vetme "çka ngec më gjatë" ndër të gjitha llojet. |
| 5 | Përshkrimet dhe udhëzuesit | **9** | "Si punon" për çdo seksion (qëllimi, hapat, rregullat që zbaton serveri, ku vazhdon puna), me test që e ndalon shtimin e seksionit pa udhëzues. Shënime sipas rolit. |
| 6 | Dizajni vizual dhe UX | **7** | Konsistent (token-a, modalitet dritë/natë: 3112 variante `dark:`). Dobët: **313 tekste 8–10 px**, 36 `window.confirm/prompt/alert` jashtë stilit të panelit. |
| 7 | Aksesueshmëria | **7** | 141 `aria-label`, 20 dialogë `role/aria-modal`, 110 vende me fokus të dukshëm, 117 objektiva prekjeje ≥ 40 px. Teksti 8–10 px dhe dialogët native janë pika e dobët. |
| 8 | Gjendjet (ngarkim, bosh, gabim) | **8** | 85 ngarkime, 80 gjendje boshe, 150 `catch`, 214 toast-e. Provo me lidhje të dobët që të konfirmohet. |
| 9 | Performanca | **8** | Gjithë paneli është lazy (AdminPanel 71 kB; më i madhi AdminReports 106 kB). Firebase mbetet static në hyrje (njohur nga auditi i 19.10). |
| 10 | Siguria e serverit | **8** | Helmet, hpp, CORS, kufij trupi, rate-limit, `requireAuth` mbi AI. Pika e hapur te §Gjetje 1. |
| 11 | Privatësia e të dhënave | **6** | Shih Gjetje 1. |
| 12 | Cilësia e kodit | **7** | `tsc` pastër, por 82 `any`, 47 `console.*`, skedarë 1974 / 1617 / 1536 / 1201 rreshta (`AdminAgents`, `AdminAds`, `AdminHealthRegistry`, `AdminReports`). |
| 13 | Testimi | **8** | 1267 teste që kalojnë, përfshirë UI të punës dhe lejet. Pa E2E dhe testet e rregullave nuk ekzekutohen në CI lokal. |
| 14 | Auditimi dhe gjurmueshmëria | **8** | Auditim i veprimeve (`/api/v1/audit`, log editorial, historik dorëzimi). |
| 15 | Përkthimi (i18n) | **7** | 1947 përdorime `dt()`, por ~64 tekste JSX dhe disa `confirm()` shqip pa `dt()` (p.sh. `AdminVideos`, `AdminHeritage`, `AdminMedicineShortages`). |
| 16 | Dokumentimi dhe operacionet | **6** | Matrica e lejeve dhe auditi i fundit janë të mira. `PRODUCTION_CHECKLIST.md` është i vjetruar (thotë "telemetri e simuluar", "Reels hequr"), dhe kopjet rezervë Firestore janë ende të hapura (P1). |

**Nota e përgjithshme: 7,8 / 10.** Struktura, lejet dhe workflow-i janë shumë të forta; ulja vjen nga privatësia e raporteve, dizajni i detajeve dhe dokumentimi i operacioneve.

## Gjetje (sipas rëndësisë)

1. **Raportet lexohen nga kushdo (`firestore.rules`, `match /reports`: `allow read: if true`).** Dokumenti ruan `authorName` (te mysafirët: emri dhe mbiemri i shkruar) dhe `authorId`. Komenti në rregull thotë që email-i nuk shfaqet te faqja e ndjekjes, por rregulli vetë lejon çdo lexim direkt. Rekomandim: faqja publike të lexojë nga përgjigjet e serverit (`/api/…/track`) ose emri të ruhet në një dokument privat. Lexuar nga rregullat, jo provuar me emulator.
2. **Telefoni i mysafirit kërkohet, por nuk ruhet.** `ReportIssue.tsx` e kërkon dhe e validon (`guestPhone`) por asgjëkundi nuk e shton te raporti; stafi nuk ka si ta thërrasë. Ose ruhet privatisht, ose hiqet nga forma.
3. **36 dialogë native** (`confirm`, `prompt`) për fshirje të përhershme: mos i stilizon paneli, nuk përkthehen kur janë shqip të ngurtë, dhe `prompt` për arsyen e fshirjes është i dobët në telefon. Zëvendësim me një dialog të përbashkët.
4. **313 tekste 8–10 px** në panel: kontrast dhe lexueshmëri e dobët në telefon. Minimum 11–12 px për tekst që duhet lexuar.
5. **Skedarë gjigantë** (shih nota 12): ndarje në nën-komponentë ul rrezikun e ndryshimeve.
6. **`PRODUCTION_CHECKLIST.md` i vjetruar** dhe kopjet rezervë të Firestore të pakonfirmuara.
7. **47 `console.*`, 82 `any`** në panel.

## Çfarë është në rregull (për të mos u prekur)
- Matrica e lejeve e gjeneruar dhe e testuar; refuzime të zbatuara nga serveri, jo vetëm buton i fshehur.
- Udhëzuesit "Si punon" me test mbrojtës.
- Ndarja në chunk-e dhe menuja e orientuar sipas përdorimit.
