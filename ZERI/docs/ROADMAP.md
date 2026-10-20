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
- [x] 1057 tekste `dt()` pa asnjë përkthim → 0 (baseline te `scripts/i18n-baseline.json`)
- [x] Mbulim i plotë i teksteve të kodit për `sq`, `en`, `de`, `sr`, `bs`, `tr`
- [ ] Mbulim i plotë për 14 gjuhët e tjera (secila i mungon ~1100 nga 3625 tekste): ar, bg, fr, gsw, hr, it, ja, ko, mk, nb, nl, pl, pt, sl, sv. Rrjedha: `npm run i18n:missing`, plotëso, `npm run i18n:import`
- [ ] 453 përkthime me placeholder të dëmtuar ose me shkrim të gabuar → 0
- [ ] ⚠️ Rishikim nga folës amtarë për 6 gjuhët kryesore (sq, en, de, tr, sr, bs)

## WS2: Struktura e kodit (frontend 5.5 → 10, mirëmbajtshmëri 5.5 → 10)
Kriter: `max-lines` 400 pa përjashtime; `server.ts` vetëm bootstrap; `src/lib` në nënfolderë.
- [ ] `ForumPage`, `AdminAgents`, `AdminAds`, `store.ts`, `ReportIssue`, `AdminHealthRegistry`, `HealthRegistryPage`, `LajmePage`, `DashboardFeed`
- [ ] `server.ts` → `server/routes/*`
- [ ] `src/lib` sipas domenit me alias

## WS3: Performanca (6.5 → 10)
Kriter: hyrja nën 200 KB gzip; Lighthouse mobile ≥ 95; asnjë chunk mbi 500 KB pa arsye.
- [x] `manualChunks` për vendor/firebase/ui; hartë, grafikë dhe player janë tashmë lazy
- [x] Modalët e hapur me veprim (profil, raportim i shpejtë, renditje, vendndodhje) dhe asistenti janë chunk-e lazy: `index` 652 → 601 KB (199 → 184 KB gzip)
- [ ] Firestore (59 skedarë) importohet statikisht nga `App.tsx`; firebase chunk 170 KB gzip është pjesa më e madhe e ngarkesës fillestare
- [ ] framer-motion (37 skedarë) → `LazyMotion` për të ulur chunk-un `ui` (63 KB gzip)
- [ ] Imazhe WebP/AVIF, `loading="lazy"`
- [x] Buxhet bundle-i në CI (`npm run check:bundle`: JS fillestar 427 KB gzip, buxheti 440)

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
Kriter: axe-core pa gabime në CI; WCAG 2.2 AA; ⚠️ testim me lexues ekrani dhe përdorues real.
- [x] axe-core në Playwright (`e2e/a11y.spec.ts`): 8 faqe × light/dark × desktop/celular = 32 kombinime, 0 shkelje
- [x] Rregulluar: select/input/buton pa emër, kontrast në 15+ vende, targete të vogla, shënjuesit e hartës
- [ ] Faqet pas hyrjes (forum, paneli, raportimi i plotë me llogari) nuk janë skanuar ende; kërkojnë llogari testimi
- [ ] ⚠️ Testim me VoiceOver/TalkBack dhe me përdorues me aftësi të kufizuara

## WS7: UX i stafit (6.5 → 10)
Kriter: një panel me pamje sipas rolit; një inbox, një sistem rastesh.
- [ ] Vendimi mbaj / bashko / fshi për çdo veçori (bazuar në analitikë)
- [ ] Bashkimi `AgentPanel`, `MunicipalityPanel`, `ModerationCenter`, `Admin`

## WS8: Testimi (6 → 10)
Kriter: mbulim ≥ 70% në `server/` dhe `src/lib`; E2E për rrjedhat kritike; `any` = 0.
- [x] Playwright në CI (`npm run test:e2e`): 9 faqe pa gabime skripti, ngarkimi i vetëm një gjuhe, porta e moshës + a11y
- [ ] E2E për rrjedhat kritike me llogari: regjistrim, raportim, gjurmim, moderim, pagesë, fshirje GDPR (kërkon emulator Firebase)
- [x] Prag mbulimi në CI (`npm run test:coverage`: rreshta 45%, funksione 65%, degë 85%; vetëm testet pa emulator, ndaj `server/` del 34% sepse rrugët mbulohen nga testet me emulator). Duhet të rritet drejt 70%
- [ ] Heqja e `any` (98 skedarë)
- [x] Ratchet ESLint për gjithë `src` dhe `server` (`npm run check:lint`): asnjë rregull nuk mund të rritet; 826 → 616 gabime (160 `no-unused-vars`, 358 `no-explicit-any`, 73 rregulla hooks, 25 të tjera)

## WS9: Siguria dhe operimi (8.5 → 10)
Kriter: `npm audit` bllokues; monitorim me alarme; backup i testuar.
- [x] `npm audit --audit-level=high` bllokues në CI (18 → 11 dobësi, 0 kritike, 0 të larta; kritike ishte `proxy-addr`); Dependabot javor; skanimi i sekreteve (gitleaks) ekzistonte
- [ ] Firebase 12.19+ shton ~62 KB gzip në ngarkesën fillestare; hyrja te `firebase` mbahet te 12.13 deri sa ta zgjidhim
- [ ] Sentry, status page, staging, rollback
- [ ] ⚠️ Penetration test i jashtëm
- [ ] ⚠️ Rishikim ligjor GDPR, kushte, privatësi

## WS10: Matja me përdorues (kushti për të thënë "10")
- [ ] ⚠️ 8–10 testime përdorimi me qytetarë realë
- [ ] Metrika të vazhdueshme: koha e raportimit, përfundimi, NPS, gabime për përdorues
