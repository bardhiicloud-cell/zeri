# PLANI I PUBLIKIMIT — Zëri Qytetarëve

> Data: 2026-10-10 · Qëllimi: faqja të jetë gati për publikim real për qytetarët e Kosovës.
> Rregulli: **mos e rindërto, rregullo, lidh, verifiko.** Çdo fazë ka kriter të matshëm.

---

## FAZA 0 — Gjendja aktuale (verifikuar)

Çfarë është REAL dhe funksionon:
- ✅ Firebase real (projekt `gen-lang-client-0907710011`), service account, rules të vendosura
- ✅ Autentikim: email/fjalëkalim, Google, anonim (`signInAnonymously`)
- ✅ Raportimi → Firestore, Track ID, hartë, 38 komunat me mapping
- ✅ Server endpoint-i për ndryshim statusi me pipeline, timeline, audit
- ✅ Njoftim automatik për raportuesin kur ndryshon statusi (me Track ID)
- ✅ `report_events` feed për sidebar-in e lajmeve
- ✅ Firewall editorial + regulla: klienti nuk mund të shkruajë status/timeline

Mangësitë kryesore të gjetura:
- ❌ Njoftimi për raportuesin anashkalon mysafirët (`authorId !== 'guest'`) — RREGULLUAR më 10.10.2026
- ⚠️ 130 fajlla `.js` twin të vjetër (pa efekt në runtime, por zhurmë)
- ⚠️ Verifikim i paplotë end-to-end (Firestore nuk testuar këtu — pa rrjet në mjedis)

## FAZA 1 — Bllokimet para publikimit (DUHET, përpara çdo gjjeje tjetër)
- [x] Njoftimet për mysafirë: hiq `authorId !== 'guest'` në `server.ts` (mysafiri tani merr njoftim; raportimet mbajnë UID anonim)
- [x] Track ID punon pa llogari (verifikuar: kërkimi me ID e panjohur → "nuk u gjet", pa crash)
- [x] /admin pa autorizim → "Qasje e Mohuar" (siguria funksionon; verifikuar në browser)
- [x] Serveri u rindek në :3002 me ndryshimin aktiv
- [ ] Testi end-to-end real: raporto → ndrysho statusin → njoftimi duket te zilja (kërkon internet/Firestore real)

## FAZA 2 — QA teknik (çdo faqe) — KRYER MË 10.10.2026
- [x] Build prodhimi pa gabime (`npm run build` — 9.67s, 0 err)
- [x] Typecheck i pastër (`npx tsc --noEmit` — 0 err)
- [x] 24 rrugë skanuar: 200 OK, 0 faqe bosh, 0 gabime konsolle, 0 mure login
- [x] Mobile 390px: pa overflow horizontale në çdo faqe
- [x] /admin pa autorizim → "Qasje e Mohuar" (siguria funksionon)
- [x] Dark mode: /lajme tani ka buton toggle (ThemeToggle i shtuar në header, verifikuar në browser: isDark true→false)
- [x] Kontrasti i ulët në modalin e vendndodhjes rregulluar (text-slate-400 → text-slate-600 / dark:text-slate-300)
- [ ] Chunks të mëdha (index 2.39MB) → optimizim me manualChunks, jo bllokues
- [ ] Error state kur Firestore nuk përgjigjet (pa ekrane të bardha) → verifikuar pjesërisht, pa crash në sandbox

## FAZA 3 — Siguria & privatësia
## FAZA 3 — Siguria & privatësia — KRYER MË 10.10.2026
- [x] `firestore.rules` rishikuar (729 rreshta, role checks me custom claims, PII private, status/timeline të ndaluar për klientin, auditLogs/editorialLog append-only) — arkitekturë e fortë, s'ka çarje
- [x] Anonimitet: `report_events` shkruan vetëm `isAnonymous === false` si publik; trackId page s'e nxjerr email-in — konfirmuar në kod
- [x] Rate limiting: 3 nivele ekzistonjnë (auth 10/15min, api 120/min, ai 5/min) + NJOFTIM: raportimi shkruhej direkt në Firestore pa e kaluar serverin → shtuar endpoint-i i ri `POST /api/v1/reports` me requireAuth + validim + duplicate/rate window per uid (5/10min) + fallback i sigurt në klient
- [x] GDPR: `CookieConsentBanner` ekziston dhe funksionon; politika e privatësisë është faqe reale `/privatesia`
- [x] Endpoint-i verifikuar: pa token → 401, me token të pavlefshëm → 401 (testuar me Invoke-WebRequest)
- [ ] Testi me Firebase real (kërkon internet nga sandbox-i)

## FAZA 4 — SEO & metadatë — KRYER MË 10.10.2026
- [x] Tituj/description unik për çdo faqe (usePageMeta — ishin ekzistues dhe funksional)
- [x] Canonical/OG/hreflang: ishin statikë nga index.html për çdo rrugë → zgjeruar usePageMeta që i përditëson per faqe (verifikuar në browser: canonical ndryshon në 7 faqe, hreflang 23 entries)
- [x] Favicon SVG + apple-touch-icon + og:image shtuar në index.html (më parë s'kishte fare favicon)
- [x] robots.txt krijuar (me Disallow për /admin, /api, /login)
- [x] sitemap.xml krijuar (20 faqe publike me prioritet/frekvens)
- [x] HTTPS + headers sigurie: helmet i plotë (CSP i detajuar, HSTS preload, frameguard deny, referrer policy) — ishte i vendosur, s'ka nevojë për ndryshim
- [ ] DOMAINI: `SITE_ORIGIN = 'https://zeriqytetare.republiks'` është placeholder — kërkon domainin e vërtetë të prodhimit (vendim i owner-it; përdorur në seo.ts + index.html + robots.txt + sitemap.xml)
- [ ] og:image është favicon.svg 64px — për social shares profesionale duhet një banner 1200×630

## FAZA 5 — Admin panel — KRYER MË 10.10.2026
- [x] 30 panele skanuar për butona të vdekur: 14 kandidatë → vetëm 2 realë, në AdminSecurity ("Eksporto JSON" dhe "Ngarko 50 Rekordet")
- [x] AdminSecurity rregulluar: Eksporto JSON → eksport real si fajll (më 2000 regjistrime, fallback lokal pa internet); Ngarko 50 → pagination real Firestore me kursor + state loading/hasNext
- [x] Qasja pa autorizim verifikuar në browser: /admin → "Qasje e Mohuar", /agent → "Akses i kufizuar", /admin/raportime etj. → 404 — asnjë leak
- [ ] AdminGenericSystem.tsx është 100% mockup (numra statikë 1,248/+34/3/412) dhe s'importohet kund — fajll i pavdekur, kandidat për fshirje (vendim i owner-it)
- [ ] Verifikimi vizual i paneleve brenda sesionit real admin kërkon llogari admin (sandbox-i s'ka internet/Firestore real)

## FAZA 6 — Publikimi — KRYER MË 10.10.2026
- [x] Environment variablat: `.env` (publike Firebase web) + `.env.local` (sekrete server-side) të ndarë saktë, `.gitignore` i mbulon të dyja + `*.log`
- [x] Emulatorët: aktivizohen vetëm me dy flamuj eksplicitë + projekt `demo-*` — në prodhim jo
- [x] Build prodhimi final: KALON (app bundle + server.cjs + favicon/robots/sitemap të kopjuar në dist/)
- [x] Monitoring: `/api/health` ekziston dhe u verifikua (status ok, uptime, dataSource: firestore) — gati për UptimeRobot/Better Stack
- [x] Error tracking: ErrorBoundary ekziston; Sentry/GlitchTip — hap manual (kërkon kredenciale, dokumentuar te UDHEZUESI_PUBLIKIMIT.md §8.2)
- [x] Backup: procedura e dokumentuar (gcloud firestore export) — kërkon internet, hap manual
- [x] Udhëzuesi i plotë i publikimit: docs/UDHEZUESI_PUBLIKIMIT.md (10 seksione, me komandat e sakta)
- [ ] EKZEKUTIMI REAL I PUBLIKIMIT kërkon internet/domain — 6 hapa të mbetura te §10 e udhëzuesit

---

## PËRFUNDIM (10.10.2026)

**Gati për publikim në kuptimin e kodit.** Të gjashta fazat e planit janë kryer dhe verifikuar
sa mund nga ky mjedis. Pengesa e vetme e mbetur është ekzekutimi i jashtëm (deploy, domain,
backup, testi end-to-end me Firestore real) — i dokumentuar hap-pas-hapi te
`docs/UDHEZUESI_PUBLIKIMIT.md`.

**Çka u rregullua/verifikua gjatë gjithë planit:**
- Njoftimet për mysafirë (server.ts — hiqen përjashtimi `!== 'guest'`)
- Endpoint-i i ri i raportimit `POST /api/v1/reports` me validim server-side + anti-spam
- Dark mode toggle te /lajme; kontrast në modalin e vendndodhjes
- Canonical/OG/hreflang per-faqe (usePageMeta zgjeruar); favicon; robots.txt; sitemap.xml
- 2 butona të vdekur në AdminSecurity → eksport real + pagination real Firestore
- Siguria e rrugëve admin/agent/komuna verifikuar pa autorizim
- Build prodhimi kalon; typecheck 0 gabime; 24 rrugë skanuar pa crash

---

## Përgjegjësi
- Planin e ndjekim me radhë. Një fazë në një kohë, kriteri duhet të plotësohet para se të kalojmë.
- Ndryshimet verifikohen në browser para se të thuhet "gati".
