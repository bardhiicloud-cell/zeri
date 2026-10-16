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
