# Raporti i testit të kapacitetit

**Statusi: Pjesërisht. U mat vetëm shtresa e aplikacionit e rrugës së re publike, në makinën lokale, me një bazë të dhënash të simuluar. Nuk u mat asgjë për Firestore, rrjetin, Cloud Run apo 200,000 përdorues, dhe asnjë pretendim kapaciteti nuk mbështetet nga këto numra.**

Pse jo më shumë: nuk ka mjedis staging të autorizuar; testi i ngarkesës në prodhim është i ndaluar; emulatori i Firestore është i përshtatshëm për teste korrektësie, jo për matje kapaciteti (një procesi Java lokal).

## 1. Çfarë u mat

Rruga `GET /api/v1/public/reports` (feed publik, 100 raporte për faqe, ~199 KB JSON): handler-i Express, projeksioni, cache-i i tekstit JSON, serializimi. Mjet: `scripts/loadtest-public-reports.ts` (përsëritshëm). Të gjitha në një proces Node: gjeneratori i ngarkesës dhe serveri ndajnë CPU-në, ndaj shifrat janë të ulëta (konservative). Pa kompresim (në prodhim `compression` e zvogëlon trafikun), pa limitor (u hoq me qëllim), pa rrjet real.

Konfigurimi: Windows 11, Node 22.18, 20 CPU logjike, 10 s për skenar, keep-alive me `fetch`, 100 dokumente të simuluara me fusha private, kohë leximi të bazës 0 ms (nuk simulohet latenca).

## 2. Rezultatet (të ekzekutuara më 2026-10-13)

| Skenari | Njëkohësi | kërkesa/s | p50 | p95 | p99 | max | gabime | lexime baze |
|---|---|---|---|---|---|---|---|---|
| A: e njëjta faqe për të gjithë (cache) | 50 | 1572 | 30.6 ms | 43.4 ms | 49.7 ms | 60.9 ms | 0% | 0 |
| B: çdo kërkesë ndryshe (pa cache) | 50 | 467 | 103.3 ms | 131.8 ms | 142.9 ms | 217.3 ms | 0% | 4696 (një për kërkesë) |
| A | 200 | 1528 | 126.4 ms | 163.9 ms | 193.3 ms | 234.1 ms | 0% | 0 |
| B | 200 | 426 | 462.5 ms | 521.5 ms | 764.6 ms | 767.8 ms | 0% | 4400 |

Përdorimi i burimeve (50 njëkohësi): ~13 s CPU për 10 s kohë muri në të dy skenarët; kujtesa: heap 64 MB, RSS 184 MB.

Përmirësimi i matur: para se të ruhej teksti JSON në cache, skenari A jepte 864 kërkesa/s me p99 95 ms; pas ruajtjes së tekstit të serializuar: 1541–1572 kërkesa/s me p99 ~49 ms.

## 3. Çfarë tregojnë dhe çfarë jo

- Një proces Node ngopet rreth 1500 kërkesa/s për këtë faqe kur gjithçka vjen nga cache; pas kësaj latenca rritet vetëm nga radha (200 njëkohësi: p50 126 ms me të njëjtën kalueshmëri). Skenari B është kufiri kur secila kërkesë shkon te baza: ~430–470/s në aplikacion, por **në realitet kufizohet nga Firestore**, që nuk u mat.
- Shifrat nuk lidhen me përdoruesit: 1500 kërkesa/s nuk është "X përdorues njëkohësisht" pa një model sjelljeje (sa shpesh rifreskohet, sa vizitorë ndajnë të njëjtën faqe).
- Rrjedha e re ul leximet e Firestore për vizitorët: një përdorues që më parë hapte një dëgjues në 100 dokumente (100 lexime fillestare + ndryshimet) tani merr kërkesë HTTP që shërbehet nga cache 30 s; leximet e bazës janë kufizuar në një për faqe për 30 s për proces, jo për vizitor. Kjo është arsyetim nga kodi, **jo matje në prodhim**.
- Rrezik i gjetur nga testi: cache-i mund të anashkalohet me kursorë të ndryshëm; kufizuar nga limitori për IP (60/min), jo i eliminuar. Parametri `municipality` që e lejonte këtë u mbyll gjatë këtij testimi.

## 4. Çfarë duhet bërë për një pretendim real (nuk u bë)

Të përcaktohet nga pronari: çfarë janë "200,000" (të regjistruar, aktivë mujorë, ditorë, të njëkohshëm) dhe pragjet e pranimit (p95/p99, gabime). Pastaj, vetëm në një projekt Firebase staging të autorizuar, me të dhëna sintetike:

| Skenari | Ç'matet |
|---|---|
| Feed publik me Firestore të vërtetë | latenca, leximet për kërkesë, kuota |
| Paraqitje raportesh (me ngarkim media) | kalueshmëria, gabimet, kostoja |
| Kërkim me Track ID | latenca, kufizimi |
| Radhët e administratës | latenca sipas filtrave, indekset |
| Caktime të njëkohshme | saktësia, shkalla e 409 |
| Njoftime dhe punë në sfond | thellësia e radhës |
| Rritje e papritur | sjellja e limitorëve, rikuperimi |

Mjeti i ngarkesës për HTTP (p.sh. k6) dhe një projekt staging nuk janë në dispozicion tani; pa to kjo nuk bëhet.
