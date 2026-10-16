# Raport gatishmërie për publikim — zeriqytetarve.com (2026-10-16)

Kontrolli u bë në kod dhe në mjedis lokal me emulatorë (Auth, Firestore, Storage) dhe Chromium me pamje telefoni (Pixel 7). **Faqja e prodhimit zeriqytetarve.com nuk u arrit nga ky sandbox (proxy 403), prandaj asgjë nuk u testua drejtpërdrejt në prodhim.**

## Rezultate të verifikuara
| Kontrolli | Rezultati |
|---|---|
| `tsc --noEmit` | kalon |
| Teste njësi (`tests/server`, `tests/lib`) | 1219/1219 |
| Teste rregullash + emulator (`test:rules`) | 462 kaluan, 6 të kapërcyera; suita `staffAccounts` kërkon `test:workflow` |
| `test:workflow` (raport → caktim → staf) | 16/16 |
| Build prodhimi (vite + server) | kalon |
| 20 faqe publike në telefon (Ballina, Raporto, Track ID, Lajme, Shëndeti, Regjistri, Donacione, Harta, Statistika, Sondazhe…) | asnjë faqe me scroll horizontal; secila ngarkon titullin dhe përmbajtjen |
| Raport i ri (qytetar anonim i autentikuar) → Track ID | u krijua `ZQ-20261016-…`; `/api/v1/public/track/:id` e kthen; adresa e rrugës NUK del publikisht; ID e rreme jep 404; krijimi pa token jep 401 |
| Raport në pritje | nuk del në feed-in publik (vetëm pas shqyrtimit) |
| Ide e re (API publike) | 201 me referencë |
| Aplikim donacioni bosh | 400 me mesazhe fushash |

## Gjetje dhe ndreqje në këtë ndryshim
1. **Domeni i gabuar (kritik për SEO):** canonical, hreflang, og:image, sitemap, robots dhe `SITE_ORIGIN` në server tregonin `zeriqytetare.republiks` (TLD që nuk ekziston). U ndryshuan në `zeriqytetarve.com`. Adresat e emailit (`privatisi@`, `abuzim@`, `privacy@`) u ndryshuan gjithashtu; **duhet krijuar këto kuti postare në domenin e ri**.
2. **Nuk kishte PWA fare:** shtuar `manifest.webmanifest`, ikona (192/512/maskable/apple-touch), `sw.js` (konservator: kurrë `/api`, kurrë kërkesa të huaja; navigim rrjet-së-pari me faqe `offline.html`) dhe titull/ikonë për iOS.
3. **Kërkesa “Shto në ekranin kryesor”** (`InstallPrompt.tsx`), vetëm telefon, pas vizitës së 2-të dhe 20 s qëndrimi, kurrë mbi moshën/cookies/vendndodhjen, 14 ditë pauzë pas “Jo tani”, fshihet kur aplikacioni është i instaluar. Android: butoni nxit dialogun origjinal; iOS: 3 hapa me ikonën Share që pulson. Animacion: ikona e aplikacionit bie mbi një ekran kryesor mini me unazë dhe “+”. Respekton `prefers-reduced-motion`. Provuar në shfletues (dialogu u shfaq, pa scroll horizontal).
4. `sw.js`, manifesti dhe `offline.html` shërbehen me `no-cache` nga serveri.

## Çka NUK është verifikuar (mos e merrni si “100% gati”)
- **Prodhimi real**: DNS/HTTPS, Firebase Auth “Authorized domains”, `ALLOWED_ORIGINS`, rregullat e reja të Firestore (`ADMIN_SECURITY_REMEDIATION.md` §5 — nuk janë vendosur sipas `REMAINING_BLOCKERS.md`).
- Instalimi real në telefon (Android Chrome / iOS Safari) dhe SW në HTTPS prodhimi; provuar vetëm logjika e kërkesës me ngjarje sintetike në dev (SW regjistrohet vetëm në prodhim).
- Rrjedha UI e plotë e raportit me foto/hartë, lajmet e publikuara nga paneli, regjistri shëndetësor me të dhëna të vërteta, pagesa/donacione (Paysera/IBAN: kërkon konfigurim dhe çelësa).
- Donacionet: faqja publike liston kauza të miratuara; aplikimet kalojnë nga API publike; pagesat në server janë për verifikim/reklama, jo donacione online.
- Hap i hapur nga raportet e mëparshme: kapaciteti nën ngarkesë (pa staging), rihapja e raporteve, përkthimet e çelësave të rinj, `PERMISSION_DENIED` për `users` te vizitori anonim, hook-et pas `return` te `Dashboard.tsx`/`ReportIssue.tsx`.
- `NetworkStatus` premton “raportet sinkronizohen automatikisht kur kthehet lidhja”; nuk u gjet radhë offline — tekst i pavërtetuar, rekomandohet ta rregulloni.
- Gabim i vogël në konsolë: atribut `src=""` (kërkon hetim); ngarkime të jashtme dështuan vetëm për shkak të sandbox-it.
- Pas deploy: Search Console, `curl -I https://zeriqytetarve.com/manifest.webmanifest`, Lighthouse PWA.

## Verdikt
Kodi është në gjendje të mirë (tsc, 1.7k+ teste, build), por **nuk mund të deklarohet 100% gati**: mungon verifikimi në prodhim, vendosja e rregullave të sigurisë dhe provat e kapacitetit. Rekomandim: deploy në staging, ekzekutoni listën më lart, pastaj publikoni.

---

## Përditësim (raundi i dytë) — çka u mbyll në kod
| Çështja | Statusi |
|---|---|
| Rihapja e raporteve | **U shtua** veprimi `reopen_report` (vetëm superadmin, me arsye ≥5 shenja): nga *U zgjidh* ose *U refuzua* kthehet te *Në pritje*, krijon sërish detyrën e shqyrtimit, pastron fushat e mbylljes/refuzimit dhe shfaqet në timeline-n publik të Track ID. *U mbyll* mbetet përfundimtare (rregulli ekzistues). 2 teste njësi + 1 emulator + provë API (refuzim → rihapje → timeline publik) |
| Aprovimi pa foto | provuar: serveri e bllokon (`INCOMPLETE`) |
| `NetworkStatus` | teksti i pavërtetë “sinkronizohet automatikisht” u zëvendësua me tekst të vërtetë (sq/en/sr): dërgimi dhe Track ID kërkojnë lidhje, asgjë nuk dërgohet offline |
| `src=""` | **gjetur dhe riparuar** te `AdBanner.tsx` (reklamë pa media); paralajmërimi u zhduk |
| Lajmet dhe Shëndeti në telefon | u provuan me të dhëna testuese: lajmet (13 publikime, filtra, kërkim) dhe regjistri shëndetësor ngarkojnë pa gabime |

## Çka NUK mund të bëhet nga ky sandbox (hapa për ju, në rend)
1. **DNS/HTTPS:** `zeriqytetarve.com` drejt Firebase App Hosting; kontrolloni `curl -I https://zeriqytetarve.com/manifest.webmanifest` (200, `application/manifest+json`) dhe `/sw.js` (`Cache-Control: no-cache`).
2. **Firebase Console → Authentication → Authorized domains:** shtoni `zeriqytetarve.com` (kërkohet nga hyrja me Google). `ALLOWED_ORIGINS` dhe `PUBLIC_APP_URL` janë tashmë të saktë te `apphosting.yaml`.
3. **Rregullat e Firestore:** vendosni sipas `ADMIN_SECURITY_REMEDIATION.md` §5 (claims → server+ueb → verifikim → rregulla). Vendimi mbetet i juaji; asgjë nuk u vendos nga unë.
4. **Pagesat:** vendosni IBAN-in te cilësimet e pagesave të Debatit dhe, nëse e doni Paysera, variablat e tij; pa to serveri kthen “Pagesat nuk janë konfiguruar”. Donacionet publike janë kauza me lidhje të jashtme, jo pagesa në platformë.
5. **Kuti postare** `privatisi@`, `abuzim@`, `privacy@` në domenin e ri.
6. **Kapaciteti:** testi real kërkon staging; `CAPACITY_TEST_REPORT.md` thotë se matja aktuale është vetëm shtresa e aplikacionit.
7. **Pas deploy:** instalim real në Android Chrome dhe iOS Safari, Lighthouse PWA, Search Console (dërgoni sitemap-in e ri).

## Debati publik i fshehur (vendim i pronarit, 2026-10-16)
Rregulli u memorizua në `ZERI/CLAUDE.md` dhe në kod: flamuri `DEBATE_PUBLIC_ENABLED` (ueb: `src/lib/featureFlags.ts`; server: `server/debateGate.ts`, i fikur si parazgjedhje). Rezultati: `/forum`, `/moderimi-im` dhe `/verifikimi` ridrejtohen te Ballina; `/forum` hiqet nga sitemap dhe bllokohet te robots; endpoint-et e qytetarit `/api/v1/forum/*` kthejnë 404 (`DEBATE_CLOSED`); paneli i stafit (`/debatwp`), moderimi dhe radhët e raportimeve mbeten të hapura. 4 teste të reja. Mbetet i pandryshuar: paketat e reklamave që quhen “Debati Publik” te Partnerët/Kërko ofertë (çmimet i vendos pronari te paneli i debatit) dhe disa fjali të përgjithshme te Politika e Privatësisë, që përmendin debatin — kërkojnë vendim për përmbajtjen.

## Reklamimi i ripunuar dhe pastrimi i përmendjeve të debatit (2026-10-16)
- Tri oferta të vetme (`AD_PACKAGES`): Komunat, Lajmet, Gjithë Kosova + Komunat + Lajmet (“Oferta më e mirë”). Pa çmime: “Çmimi sipas marrëveshjes”; forma nuk krijon më urdhër pagese. Zgjedhja e komunës shfaqet vetëm për ofertën “Komunat”; dy të tjerat ruhen si “Të gjitha Komunat”.
- U hoqën përmendjet publike të debatit nga: Politika e Privatësisë (profili, Reels, tabela e ruajtjes), Kushtet, Qendra e ndihmës, Sondazhet, Regjistrimi, zgjedhja e vendndodhjes, asistenti, pozicionet e reklamave.
- Mbetet: paneli i stafit të debatit ende ka cilësimin e vjetër të çmimeve të paketave (përdoret vetëm nga ai panel, jo nga faqja publike); çelësat e rinj shqip nuk janë përkthyer në gjuhët e tjera (shfaqen në shqip).
