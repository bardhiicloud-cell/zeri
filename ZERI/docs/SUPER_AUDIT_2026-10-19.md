# Super audit — mobile + desktop, kodi, dizajni, lëvizja (19.10.2026)

Metoda: `tsc`, 1244 teste, `vite build` para/pas, shfletues i vërtetë (Chromium, 1440 px dhe 390 px) mbi build-in e prodhimit, plus kërkim në kod. Çdo numër më poshtë është matur, jo i vlerësuar.

## 1. Çfarë u ndreq në këtë kalim

| # | Problemi | Ndreqja | Efekti i matur |
|---|----------|---------|----------------|
| 1 | **4,5 MB JavaScript në çdo vizitë të parë.** Katër tabelat e përkthimeve (~4 MB tekst i gjeneruar) ishin në `index.js`, edhe pse shqipja (gjuha burimore) nuk i përdor fare. | `src/lib/translationTables.ts` + `ensureTranslationTables()` në `dt.ts`. Tabelat ngarkohen vetëm kur gjuha nuk është shqip; `main.tsx` i pret para pikturës së parë, `LanguageContext` i ngarkon edhe kur gjuha ndërrohet gjatë punës. | `index.js` **4 538 kB → 646 kB** (gzip 1 667 → 197 kB). Tabelat jetojnë në chunk të veçantë (3 895 kB, vetëm për gjuhët jo-shqipe). Verifikuar: `/` nuk e kërkon chunk-un, `/en/` dhe `/de/` e kërkojnë dhe shfaqin tekst të përkthyer, 0 gabime. |
| 2 | **Leaflet + Recharts në çdo faqe të parë.** Ishin futur në chunk-un manual `ui`, që është static-import i hyrjes. | Hequr nga `manualChunks`; ngarkohen vetëm me faqet që i përdorin (Harta, Statistika, Dashboard). | `ui.js` **819 kB → 231 kB**. |
| | **Gjithsej JS para pikturës së parë** | | **≈ 6,1 MB → ≈ 1,7 MB (gzip ≈ 2,1 MB → ≈ 0,45 MB)** |
| 3 | **Fontet bllokoheshin pas CSS-it.** `@import url(fonts.googleapis…)` në dy skedarë CSS zbulohet vetëm pasi të shkarkohet CSS-i 430 kB. | Hequr të dy `@import`; një `<link>` + `preconnect` në `index.html` (një familje Inter e bashkuar). | Kërkesa për fonte niset paralelisht me paketën, jo pas saj. |
| 4 | **Tranzicion ngjyrash i përhershëm në çdo `div`, `a`, `button`, `input`…** (`index.css`). Çdo hover/ndërrim rruge ia ngarkonte shfletuesit ndjekjen e tranzicioneve në mijëra nyje. | Rregulli është tani vetëm gjatë ndërrimit dritë↔natë (klasa `theme-fade` në `<html>` për 260 ms, e vendosur nga `themePreference.ts`). | Fade-i i temës mbetet; kosto e përhershme zhduket. |
| 5 | **Asnjë tranzicion mes faqesh; shell-i zëvendësohej nga spinner ekrani i plotë** kur ngarkohej chunk i lazy. | `AppLayout`: faqja futet me fade 200 ms (vetëm opacity, që modalet `fixed` të mos ndikohen) dhe një `Suspense` lokal e mban navigimin/sidebar-in në ekran ndërsa faqja ngarkohet. Importet e papërdorura `AnimatePresence/motion` u hoqën. | Hapja e faqeve ndihet e butë, pa "blic" të gjithë ekranit. Respekton `prefers-reduced-motion`. |
| 6 | **50 `<img>` në feed-e/lista pa `loading`/`decoding`** (Forum, Stories, Lajme, Mesazhe, Profil…). | `loading="lazy" decoding="async"` në 16 skedarë me lista; hero/logo/auth/reels të pandryshuara qëllimisht. | Më pak shkarkime dhe dekodim jashtë ekranit; scroll më i qetë. |
| 7 | **Dy biblioteka animacioni** (`framer-motion` dhe `motion/react`) në 2 skedarë. | Të dy skedarët kalojnë në `framer-motion` (e përdorur nga 40 skedarë të tjerë). Paketa `motion` mund të hiqet nga `package.json` (shih §3). | Një motor animacioni, jo dy. |
| 8 | **Mbeturina në repo:** 115 skriptë një-përdorimësh dhe skedarë skrap në rrënjë (`patch*.js`, `fix_*`, `tmp-*`, `*.err`, `qa*.png`, `__pycache__`, `*.patch`…), 5 binjakë `.js` të vjetër të burimeve `.ts` (përfshirë dy tabela të përkthimeve 11k + 38k rreshta) dhe `vite.config.js.stale-twin`. Asnjë nuk referohej nga `package.json`, workflow-t apo kodi. | `git rm` (të rikuperueshme nga historiku) + rregulla në `.gitignore` që të mos kthehen. | Rrënja nga 184 → ~70 skedarë; asnjë rrezik më që importi të marrë binjakun e vjetër në vend të `.ts`. |
| 9 | `<meta http-equiv="Cache-Control: no-cache…">` në `index.html`. | Hequr. Shfletuesit modernë i injorojnë; cache-i i vërtetë vendoset nga `firebase.json` (që është i saktë: `index.html` no-cache, `/assets/**` immutable). | Pastrim, pa rrezik. |

**Verifikimi pas ndryshimeve:** `tsc --noEmit` pastër · 104 skedarë / **1244 teste kalojnë** · `vite build` ok · asnjë gabim JS në Chromium (desktop 1440, mobile 390) · asnjë scroll horizontal në `/`, `/raporto`, `/harta`, `/forum`, `/lajme`, `/statistika` në të dyja madhësitë.

## 2. Gjetje të hapura (të renditura sipas ndikimit) — nuk i preka pa rishikim vizual

### Shpejtësia / lëvizja
1. **`firebase` chunk 735 kB** ngarkohet në çdo hyrje, edhe për vizitorin anonim. `App.tsx` importon `firebase/firestore`, `auth` direkt. Ulje e mundshme: ngarkim i vonuar i Firestore pas pikturës së parë.
2. **CSS 423 kB (54 kB gzip)** në një skedar. Pjesa më e madhe vjen nga "guard"-et globale për natën me selektorë `[class*="hover:bg-…"]` (~100 rreshta) që kompensojnë çiftet `dark:` të harruara. Zgjidhja reale: një token surface/hover i vetëm në komponentë, pastaj fshirja e guard-eve.
3. **296 `transition-all`** dhe **172 `backdrop-blur`**. `transition-all` animon edhe `width/height/margin` (layout); `backdrop-blur` në elemente të mëdhenj sticky/fixed është kostoja kryesore e scroll-it në telefona të dobët. Rekomandim: `transition-all` → `transition-colors|transform|opacity`, dhe blur vetëm te bottom-dock, header dhe modal.
4. **Imazhe të pa-optimizuara**: `src/assets` = 38 MB, disa JPG 0,9–1,1 MB (`hero_city_modern`, `gjilan_cleaning`, `festa_qytetit_ad`, `dardania_lighting`, `malisheve-day`, `istog-day`). Konvertim në WebP/AVIF + `srcset` do t'i çonte në 80–150 kB.
5. **`<main key={language}>`** ri-montohet gjithë faqen kur ndërrohet gjuha — i qëllimshëm (rifreskon tekstet), por humb gjendjen e formularëve. Pas ngarkimit të tabelave dalja është e shpejtë, ndaj mund të zëvendësohet me rindërtim vetëm të pemës së tekstit.
6. **Pa parangarkim rrugësh.** Faqet lazy shkarkohen vetëm në klik. `onPointerEnter`/idle prefetch për 4–5 faqet kryesore (Raporto, Harta, Forum, Lajme) heq pritjen e fundit.
7. **ForumPage nuk virtualizon** listën; `content-visibility: auto` në kartat e feed-it është ndreqje me një rresht për scroll më të qetë.

### UX mobile + desktop
8. **Vizita e parë grumbullon dy bllokues radhazi**: porta e moshës (16+) dhe pastaj banneri i cookies (sheet që zë ~75 % të ekranit në 390 px). Para se të shohë një faqe, qytetari kalon dy mure. Propozim: porta e moshës brenda së njëjtës kartë me cookies, ose cookie-t si shirit i ulët jo-bllokues.
9. **Përkthime të munguara në portën e moshës** (e dukshme në `/en/` dhe `/de/`): "PARA VAZHDIMIT", "Mosha juaj", "p.sh. 17" dhe shënimi i poshtëm mbeten shqip. Hyjnë te `dt()` — mjafton t'i shtosh te tabela; `npm run i18n:check` duhet të përfshijë këtë komponent.
10. **Tekst gri i hapur** (`text-slate-400/500` mbi sipërfaqe të lehta) ka korrigjim global me kontrast, por vetëm për dritën; në komponentë duhet përdorur token-i (`--color-text-muted`).

### Kodi / arkitektura
11. **Skedarë shumë të mëdhenj**: `ForumPage.tsx` 2 668 rreshta, `AdminAgents.tsx` 1 974, `store.ts` 1 889, `AdminHealthRegistry.tsx` 1 536, `ReportIssue.tsx` 1 531, `AdminAds.tsx` 1 617, `LajmePage.tsx` 1 328. Ndarja në nën-komponentë të lazy ul si pjesën e ngarkuar ashtu edhe rrezikun e ndryshimeve.
12. **Emërtim i gabuar**: `DashboardOriginalBackup.tsx` (1 287 rreshta) është në fakt pjesa e gjallë e Ballinës (importohet nga `Dashboard.tsx:24`). Duhet riemërtuar në diçka si `DashboardFeed.tsx`, përndryshe dikush do ta fshijë "backup"-in.
13. **240 përdorime `any`**, 5 `console.log` në kodin e prodhimit; ESLint ka konfigurim por `npm run lint` bën vetëm `tsc` — lidh `eslint` në CI.
14. **Kandidatë për kod të vdekur** (nuk gjeta import statik; verifiko para fshirjes): `AIAssistantWidget`, `NotificationsMenu`, `TopBar` (zëvendësuar nga `TopNavbar`), `AdminChat`, `AdminOfficialProfiles`, `AIAssistantPage`, `workFactQueue`, `firestoreUtils`, `newsTranslation`.
15. **Varësi e dyfishtë**: hiq `motion` nga `package.json` (`npm uninstall motion`) — nuk importohet më askund.
16. **Në repo ende ndiqen** `.idea/`, `.kilo/skills/*` (dhjetëra skedarë dokumentimi të palës së tretë), 30 raporte në `docs/`; kandidatë për `.gitignore` ose arkivim.
17. `ZERI/_shards`, `_translation_cache.json`, `translations/to-translate.json` (33k rreshta) janë artefakte të gjeneratorit të përkthimeve; mund të jetojnë jashtë repos kryesor ose në Git LFS.

## 3. Hapat e radhës (rekomandim)
1. `npm uninstall motion` (një komandë; ndryshon lockfile).
2. WebP/AVIF për 10-12 imazhet më të rënda.
3. Ndaj `transition-all` dhe kufizo `backdrop-blur`.
4. Bashko portën e moshës + cookies.
5. Lazy-load Firestore pas pikturës së parë.
