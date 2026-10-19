# Plani 10/10

Çdo workstream ka **kriter dalje të matshëm**. Një fushë është 10/10 vetëm kur kriteri kalon në CI ose
verifikohet me përdorues real. Workstream-et janë të pavarura dhe mund të ecin paralelisht.
Hapat që kërkojnë njerëz jashtë kodit janë shënuar ⚠️.

## Baza (matur para fillimit)

| Matje | Vlera |
| --- | --- |
| `tsc --noEmit` | pastër |
| `npm test` | 105 skedarë, 1247 teste kalojnë |
| Chunk `translationTables` | 3.9 MB (1.47 MB gzip) |
| Chunk `index` (hyrja) | 651 KB (199 KB gzip) |
| Skedarë mbi 1000 rreshta (pa përkthimet) | 14 |
| Skedarë me `any` | 98 |

## WS1: Përkthimet (i18n 6 → 10)
Kriter: asnjë përkthim në bundle-in e hyrjes; ngarkohet vetëm gjuha aktive; një sistem i vetëm; asnjë tekst pa përkthim.
- [x] Ngarkim lazy sipas gjuhës (anglisht 95 KB gzip, kishte 1.47 MB)
- [x] Një sistem: `src/lib/i18n/locales/<gjuha>.json` + `scripts/i18n.ts` (check / missing / import); u hoqën 5 tabelat TS dhe 10 skriptat e vjetra
- [x] `npm run i18n:check` në CI: tekst i ri pa përkthim ose me placeholder të dëmtuar e prish build-in
- [x] `_translation_cache.json` dhe artefaktet e gjeneratorit nga repo
- [ ] 1057 tekste `dt()` pa asnjë përkthim (shfaqen shqip në çdo gjuhë) → baseline te `scripts/i18n-baseline.json` duhet të bëhet 0
- [ ] Mbulim i plotë për `sr` (82%), `bs` (~80%), `tr` (88%), `en`/`de`
- [ ] 453 përkthime me placeholder të dëmtuar ose me shkrim të gabuar → 0
- [ ] ⚠️ Rishikim nga folës amtarë për 6 gjuhët kryesore (sq, en, de, tr, sr, bs)

## WS2: Struktura e kodit (frontend 5.5 → 10, mirëmbajtshmëri 5.5 → 10)
Kriter: `max-lines` 400 pa përjashtime; `server.ts` vetëm bootstrap; `src/lib` në nënfolderë.
- [ ] `ForumPage`, `AdminAgents`, `AdminAds`, `store.ts`, `ReportIssue`, `AdminHealthRegistry`, `HealthRegistryPage`, `LajmePage`, `DashboardFeed`
- [ ] `server.ts` → `server/routes/*`
- [ ] `src/lib` sipas domenit me alias

## WS3: Performanca (6.5 → 10)
Kriter: hyrja nën 200 KB gzip; Lighthouse mobile ≥ 95; asnjë chunk mbi 500 KB pa arsye.
- [ ] `manualChunks` për firebase, leaflet, recharts, framer-motion
- [ ] Dynamic import për hartë, grafikë, player
- [ ] Imazhe WebP/AVIF, `loading="lazy"`
- [ ] Buxhet bundle-i në CI

## WS4: UX i qytetarit (6 → 10)
Kriter: raportim ≤ 3 hapa; përdorues i ri e dërgon raportin nën 60 s; ⚠️ vërtetuar me testim real.
- [ ] Faqja kryesore me 3 veprime: Raporto, Gjurmo, Lajme
- [ ] Menu "Më shumë" e grupuar në 4–5 kategori
- [ ] Gjendje loading / bosh / gabim / offline në çdo faqe
- [ ] Draft offline për raportimin

## WS5: Dizajni (7 → 10)
Kriter: tokens + 10–15 komponentë bazë; asnjë ngjyrë ose hapësirë e shkruar direkt në faqe.
- [ ] Tokens (ngjyra, hapësira, tipografi, hije)
- [ ] Button, Card, Input, Modal, Badge, Tabs, EmptyState, Skeleton…
- [ ] Zëvendësimi gradual i stileve të shpërndara

## WS6: Aksesueshmëria (6 → 10)
Kriter: axe-core pa gabime serioze në CI; WCAG 2.2 AA; ⚠️ testim me lexues ekrani dhe përdorues real.
- [ ] `alt` për çdo imazh, kontrast, fokus i dukshëm, navigim me tastierë
- [ ] axe-core në Playwright

## WS7: UX i stafit (6.5 → 10)
Kriter: një panel me pamje sipas rolit; një inbox, një sistem rastesh.
- [ ] Vendimi mbaj / bashko / fshi për çdo veçori (bazuar në analitikë)
- [ ] Bashkimi `AgentPanel`, `MunicipalityPanel`, `ModerationCenter`, `Admin`

## WS8: Testimi (6 → 10)
Kriter: mbulim ≥ 70% në `server/` dhe `src/lib`; E2E për rrjedhat kritike; `any` = 0.
- [ ] Playwright: regjistrim, raportim, gjurmim, moderim, pagesë, fshirje GDPR
- [ ] Prag mbulimi në CI
- [ ] Heqja e `any` (98 skedarë)
- [ ] ESLint në gjithë `src` dhe `server`

## WS9: Siguria dhe operimi (8.5 → 10)
Kriter: `npm audit` bllokues; monitorim me alarme; backup i testuar.
- [ ] `npm audit` bllokues, Dependabot, skanim sekretesh
- [ ] Sentry, status page, staging, rollback
- [ ] ⚠️ Penetration test i jashtëm
- [ ] ⚠️ Rishikim ligjor GDPR, kushte, privatësi

## WS10: Matja me përdorues (kushti për të thënë "10")
- [ ] ⚠️ 8–10 testime përdorimi me qytetarë realë
- [ ] Metrika të vazhdueshme: koha e raportimit, përfundimi, NPS, gabime për përdorues
