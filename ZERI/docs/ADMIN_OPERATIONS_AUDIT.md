# Auditimi i operacioneve të administratës

Gjendja: 2026-10-13, dega `main`. Ky dokument përmban vetëm ato që u verifikuan në kod ose në ekzekutimin e testeve. Ku nuk u verifikua diçka, thuhet qartë.

## 1. Pika e nisjes (Stage B)

| Kontrolli | Rezultati |
|---|---|
| `tsc --noEmit` (kjo është komanda `npm run lint`) | pa gabime |
| `vitest run tests/server tests/lib` | 64 skedarë, 698 teste kaluan para ndryshimeve; 66 skedarë, 713 teste pas tyre |
| ESLint mbi gjithë projektin | **1672 gabime** (rreth 1658 gabime, 14 paralajmërime): ~780 në `src`, ~460 në skedarët skicë të rrënjës, ~245 në `qa`, ~100 në `server`, ~55 në `tests`. Rregullat kryesore: `no-explicit-any` (431), `no-unused-vars` (453), `no-undef` (22). |
| Emulatorët (`npm run test:rules`) | **nuk u ekzekutuan**: Java nuk është e instaluar në këtë makinë. Ekzekutohen vetëm në CI (job `rules`). |
| Ndërtimi (`npm run build`) | nuk u ekzekutua në këtë sesion |

CI-ja aktive është `.github/workflows/ci.yml` në rrënjën e depos: `tsc`, një portë ESLint vetëm për një listë skedarësh të pastër, `npm test`, `npm run build`, emulatorët dhe skanimi i sekreteve. Porta ESLint përfshin direktorinë `tests` të plotë, e cila ka gabime ESLint (kryesisht `no-explicit-any`); kjo duhet verifikuar në CI para se të mbështetet te ajo portë.

`ZERI/.github/workflows/production.yml` **nuk lexohet nga GitHub** (workflow-t lexohen vetëm nga rrënja e depos). Ai përmban `npm test || echo ...`, që do ta fshihte çdo dështim testi, dhe një hap vërtetimi GCP që e vetëdeklaron "Mock". Nuk u fshi pa miratim; shih `REMAINING_BLOCKERS.md`.

## 2. Inventari i moduleve të administratës

Burimi: `src/components/admin/`, `src/pages/AdminPanel.tsx`, `src/lib/roleCatalog.ts`, `src/lib/adminPermissions.ts`, `server/policy.ts`. Autorizimi i serverit është në `server/*.ts`; matrica e gjeneruar e lejeve është `docs/PERMISSIONS_MATRIX.md` (testi `permissionsMatrix.test.ts` dështon nëse ndryshon nga kodi).

| Moduli | Komponenti | Autorizimi i serverit | Testet |
|---|---|---|---|
| Përmbledhja / paneli | `AdminDashboard.tsx`, `dashboard/` | të dhëna nga API-t e listuara më poshtë; metrika te `adminDashboardMetrics.ts` | `adminDashboardMetrics.test.ts`, `adminDeepLink.test.ts` |
| Raportimet (radhët, shqyrtimi) | `AdminReports.tsx`, `ReviewMode.tsx`, `reports/` | `server/reportQuery.ts` (faqosje, max 50), `approvalPipeline.ts`, `decisions.ts` | `reportQuery`, `reports`, `reviewQueue`, `reportQueue` |
| Caktimi dhe dorëzimi | `ReviewMode.tsx` | `server/reportAssignment.ts` | `reportAssignment.test.ts`, emulator `reportAssignment.routes.test.ts` |
| Bashkëbisedimi i rastit, shënime, eskalim | `CaseThreadPanel.tsx` | `server/reportCase.ts` | `reportCase.test.ts` |
| Rrjedha e aprovimit (bordi i fazave) | `workflow/StageBoard.tsx`, `WorkflowCenter.tsx` | `approvalPipeline.ts`, `decisions.ts` | `stageBoard`, `workflowStages`, `decisionRules` |
| Ekipi, ngarkesa, monitorimi i agjentëve | `TeamOverviewPanel.tsx`, `AdminAgentMonitoring.tsx` | `server/teamOverview.ts` | `teamOverview.test.ts`, `monitorRole.test.ts` |
| Agjentët, stafi, rolet, llogaritë | `AdminAgents`, `AdminUsers`, `AdminRoles`, `RemoveAccountDialog` | `policy.ts` (`checkRoleChange`), `staffRemoval.ts`, `userModeration.ts`, `roleClaims.ts` | `policy`, `staffRemoval`, `userModeration`, `roleClaims`, `resolveRole` |
| Komunat | `MunicipalityAccountManager`, `MunicipalityProvisioning`, `MunicipalityScopeControl` | `municipalityDesk.ts`, `municipalityPlans.ts` | `municipalityDesk`, `municipalityPlans` |
| DebatWP dhe moderimi i forumit | `AdminForum`, `AdminForumReports`, `AdminForumStories`, `AdminReelReports` | `debateAdmin.ts`, `forumReports.ts`, `userModeration.ts` | `debateAdmin`, `adminReelReports`, emulator `forumReports` |
| Lajme, video, përditësime | `AdminNews`, `AdminVideos`, `AdminUpdates` | rregullat e Firestore + `editorialFirewall` | `newsPlacement`, `EDITORIAL_FIREWALL.md` |
| Reklama dhe sponsorë | `AdminAds` | `decisions.ts`, `adTracking.ts` | `adTracking`, rregullat `adRequests` |
| Donacione | `AdminDonations` | `paymentOrders.ts`, `payments.ts` | `paymentOrders`, `payments` |
| Sondazhe | `AdminPolls` | `polls.ts` | emulator `polls` |
| Regjistri shëndetësor | `AdminHealthRegistry`, `AdminMedicineShortages` | rregullat + `decisions.ts` | rregullat Firestore |
| Njoftimet | `AdminNotifications`, `AdminInbox` | shih `OPERATIONAL_WORKFLOW_MAP.md` §5 | `adminInbox.test.ts` |
| Mesazhet e drejtpërdrejta / chat mbështetjeje | `AdminChat`, `AdminSupportChats` | `directMessages.ts`, `policy.ts` (`checkMessageParties`) | `directMessages` |
| Siguria dhe auditimi | `AdminSecurity` | `auth.ts`, `security.ts` | `authority`, `rateLimit` |
| Cilësimet | `AdminSettings` | vetëm admin/superadmin | matrica e lejeve |
| Statistikat, GIS, eksportet | `AdminGIS`, `AdminWorkFacts`, `exportUtils.ts` | `adminReports.ts`, `reportQuery.ts` | `adminReportsApi` |

Kufizim: ky inventar u ndërtua nga leximi i strukturës dhe i skedarëve kyç, jo nga hapja e çdo ekrani në shfletues. Kolonat "veprimet" dhe "problemet" për secilin modul janë plotësuar vetëm aty ku kodi u lexua drejtpërdrejt (raportimet, caktimi, rastet, politika e roleve, heqja e stafit).

## 3. Gjetjet dhe rezultati i zbatimit

### Zbatuar në këtë sesion

**P1 — Dorëzimi i punës ishte i pagjurmueshëm.** `POST /api/v1/reports/:id/assign` mbishkruante `assignedTo` pa arsye, pa historik dhe pa njoftuar askënd. Dy administratorë që caktonin njëkohësisht kishin "fituesin e fundit" pa e ditur. Tani (`server/reportAssignment.ts`):
- arsyeja (5–300 shenja) është e detyrueshme kur puna merret nga një person tjetër (rikaktim ose lëshim nga administratori);
- çdo kalim shkruhet në `reports/{id}/assignmentHistory` **brenda të njëjtës transaksion** me ndryshimin (kush, nga kush, te kush, kur, pse);
- personi që merr punën dhe personi që e humbet njoftohen (njoftim i brendshëm; qytetari nuk njoftohet);
- `expectedHolderUid` opsional: nëse mbajtësi ndryshoi ndërkohë, serveri kthen 409 dhe nuk shkruan asgjë; ndërfaqja e dërgon gjithmonë;
- `GET /api/v1/reports/:id/assignments` jep historikun (maks. 50, `no-store`) vetëm për staf, agjentë dhe monitorin.
- Ndërfaqja (`ReviewMode.tsx`) kërkon arsyen përmes kutisë ekzistuese të arsyeve vetëm kur puna i merret dikujt.

**P1 — Puna e një llogarie të hequr mbetej e caktuar te një uid i fshirë.** `server/staffRemoval.ts` mbyllte llogarinë por nuk prekte raportet. Tani, pasi llogaria mbyllet, `releaseHeldReports` (`server/reportAssignment.ts`) kthen në radhën e përbashkët raportet që ajo mbante në fillim të radhës (`Draft`, `Pending Review`), me një shënim historiku për secilin, maksimumi 2000 për thirrje. Nëse hapi dështon ose mbeten të tjera, përgjigjja ka `releaseIncomplete: true`, hyrja e auditimit e ruan, dhe ndërfaqja e tregon gabimin në vend që të thotë 'u krye'. Raportet e aprovuara dhe më tej nuk preken (i përkasin komunës).

Nënkolekcioni `assignmentHistory` nuk ka rregull `match` në `firestore.rules`, ndaj refuzohet nga rregulli i fundit `deny all`; testi i ri `tests/rules/reportHandover.rules.test.ts` e mbron këtë për `assignmentHistory`, `internalNotes` dhe `caseMessages` (përfshirë një token superadmini).

### Gjetur dhe NUK u zgjidh (shih `REMAINING_BLOCKERS.md`)

- Roli `dispatcher` ekziston, por `pipelineRoleOf` e rendit si `agent`, ndaj nuk mund t'ua caktojë punën të tjerëve; vetëm admin/superadmin caktojnë. Nëse dispatcher-i duhet të caktojë, është vendim politikash.
- `reports` lexohet nga kushdo (`allow read: if true`); fusha të brendshme në dokumentin e raportit janë të lexueshme nga klienti. Shënimet e brendshme dhe bisedat janë në nënkolekcione të mbyllura, por fusha si `assignedTo`, `assignedToUid` në dokumentin kryesor lexohen publikisht. Kjo duhet vlerësuar para skalimit.
- Porta ESLint e CI-së përfshin `tests`, që ka gabime.
