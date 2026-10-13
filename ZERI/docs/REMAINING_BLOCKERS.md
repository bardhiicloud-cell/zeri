# Çështjet e mbetura

Përditësuar 2026-10-13. Statuset: **IV** = implementuar dhe i verifikuar; **INV** = implementuar por jo plotësisht i verifikuar; **B** = i bllokuar; **NS** = nuk filloi.

## Detyrat e kësaj faze

| # | Detyra | Statusi | Dokumenti |
|---|---|---|---|
| 1 | Raportet nuk lexohen nga kushdo (feed publik i listës së lejuar, rregull i ri, kliente të përditësuara) | **INV**: kodi, 12+5+6 teste njësi dhe 15 teste rregullash në emulator kaluan; **nuk është vendosur** dhe `App.tsx` nuk u provua në shfletues | `ADMIN_SECURITY_REMEDIATION.md` |
| 2 | Lejet e dispatcher-it | **B**: autoriteti nuk përcaktohet nga burimet; pyetja nuk u përgjigj (u mor një kërkesë tjetër). Asgjë nuk u ndryshua | `DISPATCHER_PERMISSION_MATRIX.md` |
| 3 | Ekrani i historikut të caktimeve | **INV**: 9 teste komponenti + 11 emulator kaluan; nuk u pa në shfletues | `HANDOVER_HISTORY_IMPLEMENTATION.md` |
| 4 | Testim dhe cilësi | **INV**: 750 teste njësi + 326 emulator kaluan; responsive, aksesueshmëri, gjuhë, rrjedha e plotë nuk u provuan | `ADMIN_TEST_RESULTS.md` |
| 4b | ESLint (1672) | **INV**: 1035 gabime të mbetura, të klasifikuara; porta e CI jeshile | `CI_REMEDIATION.md` |
| 5 | Korrigjimi i CI | **IV** lokalisht (porta ESLint dështonte, tani kalon); nuk u pa në GitHub; `production.yml` i pa-përdorur nuk u prek | `CI_REMEDIATION.md` |
| 6 | Kapaciteti | **B**: vetëm matje e shtresës së aplikacionit me bazë të simuluar; pa staging, asnjë pretendim | `CAPACITY_TEST_REPORT.md` |

## Hapat manualë ose të prodhimit që mbeten (nuk u bë asnjë)

1. Vendosja e rregullave të reja sipas renditjes te `ADMIN_SECURITY_REMEDIATION.md` §5 (claims → server+ueb → verifikim → rregulla).
2. Bashkërendimi me ndryshimet e pa-commit të sesioneve të tjera te `firestore.rules`, `server.ts`, `App.tsx` përpara çdo commit-i. Asgjë nuk u bë commit.
3. Provë në shfletues e ndryshimit të burimit të raporteve (vizitor, qytetar, agjent, monitor, hyrje/dalje).
4. Vendime të pronarit: autoriteti i dispatcher-it (A/B/C); ruajtja e adresës dhe koordinatave të rrumbullakuara (u vendos 2 dhjetore, pa adresë në feed; harta publike tani ka pina ~1.1 km); `ZERI/.github/workflows/production.yml` (fshirje); instalimi i `eslint-plugin-react-hooks`.
5. Mjedis staging dhe pragje pranimi për testin real të kapacitetit.

## Rreziqe të hapura

- `reports/{id}/comments` lexohet nga kushdo; kursori i feed mund të anashkalojë cache-in (kufizuar për IP); `description` i lirë mund të përmbajë adresë.
- Staf pa flamur token (p.sh. `debatwp`) nuk lexon koleksionin pas rregullit; panelet e numërimit nuk u provuan për çdo rol.
- Çelësat e rinj shqip nuk janë përkthyer në gjuhët e tjera; tubacioni i18n nuk u ekzekutua.
- Nuk ka rrugë rihapjeje raportesh të provuar; regjistri i auditimit nuk lexohet nga testet.
- Njoftimet e brendshme nuk kanë konfirmim marrjeje; emaili i institucioneve ka outbox por jo konfirmim dorëzimi.
- Mbetet e hapur nga faza e mëparshme: provë fund-më-fund nga qytetari te auditimi; politika e afateve dhe eskalimit automatik; politika e ruajtjes për `internalNotes`, `caseMessages`, `assignmentHistory`.

## Kërkesa e re e paqartë

Në përgjigjen e pyetjes për dispatcher-in u ngjit një kërkesë për ridizajn rrënjësor vizual të faqeve publike (Shërbimet, Projektet, Lajmet, Kontakti, Rreth Projektit, Shëndeti, Donacionet, Ndihma, Banka e Ideve, Partneritetet, Reklamat). Ajo bie ndesh me rregullin e kësaj pune "mos prek faqen publike" dhe nuk u nis. Kërkon konfirmim të qartë si detyrë e veçantë.

---

## Përditësim i vonë, 2026-10-13 (pas vendimeve të pronarit)

| Çështja | Statusi i vërtetë |
|---|---|
| Dispatcher (opsioni C: cakton + sheh ngarkesën) | **IV në kod, teste dhe shfletues lokal**: `decideAssignment` dhe `mayViewTeam` lejojnë rolin `dispatcher` (vetëm nga tokeni, jo nga leje seksionesh); paneli i ngarkesës është te Paneli i Agjentit, pa hapur auditimin individual; zgjedhësi i agjentëve vjen nga pamja e ekipit; arsyeja e detyrueshme u pa e funksionojë; auditimi `report.assign` thirret (test emulatori). Nuk ka kufizim "komunë/ekip" sepse stafi i platformës nuk ka fushë komune; kufiri është radha e shqyrtimit (para fazës së komunës) dhe agjentët aktivë. Matrica e lejeve u rigjenerua me kolonën Dispatcher |
| `eslint-plugin-react-hooks` | **IV**: instaluar (7.1.1), vetëm dy rregullat klasike; hapi i ri i CI `eslint -c eslint.hooks.config.js src` dështon për çdo shkelje të re (provuar me shkelje kontrolli, kodi 1). 23 skedarë me gjetje të vjetra janë paralajmërime të listuara |
| Defekt i vërtetë nga rregulli: hook pas `return` të hershëm | Riparuar te `AgentPanelPage.tsx` (admin). **Mbeten** te `Dashboard.tsx` dhe `ReportIssue.tsx` (faqe publike, jashtë fushës; mund të shkaktojnë "Rendered more hooks…"): kërkon vendim për t'i prekur |
| Privatësia e Track ID | **IV**: pamja nuk jep më adresën e rrugës (vetëm lagjen nëse jepet) dhe nuk ka koordinata; testet përditësuar. Autori e sheh adresën e plotë te llogaria e vet |
| Koordinatat publike | **IV**: feed rrumbullakos në 2 dhjetore, pa adresë |
| Feed vs koleksion në `App.tsx` | **Provuar në shfletues lokal me emulator dhe rregullat e vërteta të ngushtuara**: vizitor (feed 200, leximi i drejtpërdrejtë 403, pa rrjedhje), qytetar, dispatcher (koleksioni i plotë: sheh të gjitha raportet në pritje). Tokena të vërtetë të emulatorit për qytetar/agjent/dispatcher/monitor: autori lexon vetëm të vetin, koleksioni i plotë i refuzohet qytetarit, stafi lexon gjithçka |
| Responsive tablet/telefon, gjuhët e mbështetura, aksesueshmëri me lexues ekrani | **NS (nuk u testuan)**: u testua vetëm desktop 1440x900; pamjet e ekranit shpesh skaduan |
| Rihapja e raporteve | **NS**: nuk u gjet rrugë rihapjeje; asnjë pretendim |
| Paneli i historikut pas një caktimi të vërtetë | Caktimi u krye në shfletues dhe u ruajt; **përmbajtja e panelit të historikut nuk u pa në ekran**; mbulohet nga teste komponenti dhe emulator |
| Rregullat e reja në prodhim | **Nuk janë vendosur.** Hapat te `ADMIN_SECURITY_REMEDIATION.md` §5 mbeten |
| Ridizajni publik | Jashtë kësaj detyre, sipas vendimit të pronarit |

Gabimi në konsolë `PERMISSION_DENIED` për krijimin e profilit `users` nga një mysafir anonim u pa në sandbox dhe lidhet me koleksionin `users`, jo me `reports`; nuk u hetua.
