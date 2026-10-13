# Matrica e roleve dhe e rrjedhës

Burimet: `src/lib/roleCatalog.ts` (profili i çdo roli), `src/lib/adminPermissions.ts` (seksionet), `server/policy.ts` (ndryshimi i roleve, mesazhet), `server/approvalPipeline.ts` (`pipelineRoleOf`), `docs/PERMISSIONS_MATRIX.md` (matricë e gjeneruar, e mbrojtur nga test). Këtu nuk përsëritet matrica e plotë e veprimeve; shih skedarin e gjeneruar.

## Rolet që ekzistojnë vërtet

`superadmin`, `admin`, `approver`, `newsadmin`, `debatwp`, `agent`, `responder`, `dispatcher`, `monitor`, `adsadmin`, `municipality`, dhe qytetari (pa rol stafi). Roli i caktueshëm nga paneli: `ASSIGNABLE_STAFF_ROLES` te `policy.ts` (përjashton `municipality`, që krijohet nga ofrimi i komunave).

| Roli | Roli në rrjedhën e aprovimit | Çfarë mund të bëjë në raportime | Çfarë nuk mund |
|---|---|---|---|
| superadmin / admin | `staff` | gjithçka të rrjedhës, përfshirë caktimin, refuzimin, mbylljen e eskalimit, verifikimin | superadmini nuk heqet nga paneli; admini nuk ndryshon/heq admin tjetër (vetëm superadmini); askush nuk ndryshon rolin e vet |
| approver, responder, dispatcher, moderator | `agent` | merr përsipër, aprovon, kërkon informacion, shënim, eskalim, lëshon atë që mban | nuk cakton te tjerët, nuk refuzon, nuk mbyll eskalim |
| agent (me leje `agents`) | `agent` | si më lart | si më lart |
| monitor | s'ka | lexon ngarkesën e ekipit, sigurinë/auditimin, thread-in e rastit (lexim) | nuk shkruan, nuk aprovon, nuk menaxhon përdorues |
| municipality | `municipality` | vetëm komuna e vet: merr përsipër, shënon punimet, përgjigje zyrtare, kërkon korrigjim | asnjë komunë tjetër; asnjë veprim stafi |
| newsadmin, adsadmin, debatwp | s'ka | seksionet e veta (lajme / reklama / DebatWP) | rrjedha e raportimeve |
| qytetar | s'ka | paraqet raport, përgjigjet vetëm për raportin e vet, ndjek me Track ID | gjithçka tjetër |

**Pikë për vendim:** `dispatcher` është i listuar me seksionet `reports`, `agentpanel` etj., por `pipelineRoleOf` e trajton si `agent`; për këtë arsye nuk cakton punë te të tjerët. Titulli "dispatcher" sugjeron të kundërtën. Nuk u ndryshua pa vendim (shih `REMAINING_BLOCKERS.md`).

## Si zbatohet (3 shtresa)

1. Interfaca: `adminPermissions.ts` / `navConfig.tsx` fshehin seksionet (komoditet, jo kufi sigurie).
2. Serveri: `requireAuth` + `mayUseSection`, `decide*` të pastra për çdo veprim, auditim i refuzimeve (`*.denied`). Roli lexohet nga të dhënat e verifikuara të tokenit (`permissionsFromClaims`), jo nga profili i shkrueshëm nga klienti.
3. Rregullat e bazës: nënkolekcionet `internalNotes`, `caseMessages`, `assignmentHistory` nuk kanë `match`, ndaj i mbulon rregulli përfundimtar `deny all`; testi `tests/rules/reportHandover.rules.test.ts` e provon (ekzekutohet në CI me emulator; **nuk u ekzekutua lokalisht**, Java mungon).

## Testet që mbulojnë kufijtë (të ekzekutuara lokalisht)

`policy.test.ts`, `roleClaims.test.ts`, `resolveRole.test.ts`, `monitorRole.test.ts`, `permissionsMatrix.test.ts`, `reportAssignment.test.ts` (përfshirë refuzimin e monitorit, komunës dhe qytetarit), `reportCase.test.ts`, `municipalityDesk.test.ts`, `staffRemoval.test.ts`.
