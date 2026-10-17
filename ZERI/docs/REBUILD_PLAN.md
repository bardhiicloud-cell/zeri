# Zëri i Qytetarëve — Plani i Rindërtimit (Tasks, Workflow, RBAC, Agent Creation)

Gjendja u auditua direkt në kod. Ky dokument është plani ekzekutues; çdo hap ka skedarë konkretë.

## 1. Gjet e auditit (çfarë ekziston dhe çfarë mungon)

### Çfarë ekziston dhe është SOLID (ruhet, nuk rindërtohet)
- `src/lib/workflow/{definitions,transition,assignment,escalation,workload,performance}.ts` — motor i plotë detyrash me state machine, validim rolit, caktim automatik me skor (headroom/skills/continuity/fairness), SLA + eskalim idempotent.
- `server/workItems.ts` + `server/workItemRoutes.ts` — CRUD, transaksione, `planList` që kufizon query-n sipas rolit, views `mine/unassigned/attention/overdue/open/worker/done`.
- `server.ts` POST `/api/v1/admin/users` (f. 1082–1184) — krijon llogari Auth + claims + doc Firestore, me rollback në gabim, validim fjalëkalimi, 409 për email duplikat. **Logjika e krijimit ekziston dhe duket e saktë.**
- `server/policy.ts` `checkRoleChange`, `roleClaims.ts`, `adminPermissions.ts`, custom claims.
- Teste reale: `tests/server`, `tests/rules`, `tests/emulator` (vitest + emulator).

### Problemet e identifikuara (shkaqet rrënjësore)
1. **P1 — Raporti nuk krijon detyra automatikisht.** `report_referral` krijohet vetëm kur agjenti bën `pass_to_municipality`. Faza "Raportuar → Shqyrtim → Aprovim" nuk ka asnjë detyrë në `workItems`; agjenti sheh raportet vetëm përmes listave të raporteve, jo përmes sistemit të detyrave. Prandaj "Tasks" duket i shkëputur.
2. **P2 — Workflow-i ka vetëm 6 faza** (`reported/approved/waiting/responded/completed/rejected` në `src/lib/workflowStages.ts`) kundrejt 10 të kërkuara. Mungojnë: *Në pritje të shqyrtimit*, *Në pritje të aprovimit*, *Në pritje të verifikimit*, *Kërkojnë korrigjim*. Statuset e raportit (`Pending/Assigned/In Progress/Overdue/Approved/Resolved/Rejected`) mapohen ngushtë dhe raporti "Aprovuar" kalon direkt te komuna — s'ka skedar aprovi të veçantë.
3. **P3 — "Merr përsipër" ekziston në dy vende:** `MunicipalityPanelPage.tsx` f.548 (`claim` i raportit) dhe `approvalPipeline.ts` `municipality_accept` me `claim: true` — plus `StageBoard.tsx` përdor të njëjtat kalime. Duhet zëvendësuar me caktim (assignment), jo claim të lirë.
4. **P4 — Skedat e raportit në WorkflowCenter numërohen vetëm nga artikujt e ngarkuar** (`StageBoard` numëron nga lista e faqes) → numërues të gabuar.
5. **P5 — Krijimi i agjentit** ka endpoint të saktë, por: role `municipality` dhe `manager` NUK janë në `allowedRoles`; nuk caktohet `municipality`/`department`/`skills` në `workerProfiles` (motori i caktimit i refuzon si `role`/`municipality`), dhe pas krijimit s'krijohet profil i punonjësit → agjenti i ri nuk shfaqet në listat e caktimit. Ky është "nuk funksionon" praktik.
6. **P6 — Roli `monitor` është read-only në motor, por `manager` i mangon skedës `manager` në `server.ts`** (`actorRole` kontrollohet me `['admin','superadmin']`) — duhet zgjeruar që manager-i të caktojë punë pa qenë admin.
7. **P7 — `rules`/indexes:** verifikohen; query-t e reja (status+updatedAt, assignee+open) mund të kërkojnë indeks kompozitë.

## 2. Modeli kanonik i statusit (10 faza)

I ri `ReportStage` (kanonik, në `src/lib/reportWorkflow.ts`, i përbashkët front+back):

| # | StageKey | Status i DB-së (ekzistues, pa migrim destruktiv) | Zotëruesi |
|---|---|---|---|
| 1 | `reported` | `Pending` (i ri) | Sistemi/Agjenti i sektorit |
| 2 | `review` | `Pending` + `reviewStage: true` (ose `stage` field) | Agjenti i sektorit |
| 3 | `awaiting_approval` | `Pending` + `stage: 'awaiting_approval'` | Approver/Manager |
| 4 | `approved` | `Approved` | Manager |
| 5 | `in_process` | `Assigned` | Agjenti/Komuna |
| 6 | `response` | `In Progress` + përgjigje e shkruar | Komuna/Agjenti |
| 7 | `awaiting_verification` | `Overdue`+claim → ridëfinohet si `stage: 'awaiting_verification'` | Staff |
| 8 | `completed` | `Resolved` | Staff (pas verifikimit) |
| 9 | `rejected` | `Rejected` (arsye e detyrueshme) | Agjenti/Approver |
| 10 | `correction` | `Pending` + `needsInfo: true` | Agjenti (kërkon sqarim qytetarit) |

**Strategjia e migrimit:** shtojmë fushën `workflowStage` në doc-et `reports` (backfill script idempotent `scripts/backfill-workflow-stage.ts`), duke MBJTUR statuset e vjetra të paprekura. Lexuesit e rinj lexojnë `workflowStage ?? mapFromLegacyStatus(status)`. Rollback: fshij fushën, lexuesit bien automatikisht te mappingu legacy.

## 3. Detyrat e lidhura me raportet (P1)

`reportWorkflow.ts` (server) — funksion `ensureStageTasks(reportId, fromStage, toStage)` i thirrur brenda transaksionit të çdo kalimi:
- `reported→review`: krijon detyrë `internal_task` me `kind: 'report_stage'`-metadata, `requiredSkills: [category-sector]`, `municipality`, priority e derivuar nga `risk`/`urgency`.
- `review→awaiting_approval`: detyrë aprovi (assigneeRoles: approver/manager).
- `approved→in_process`: detyrë punë agjenti + referim komune.
- `response→awaiting_verification`: detyrë verifikimi për staff.
- Çdo detyrë ka: `reportId` (unique), `taskId` auto, `type: review|approval|investigation|response|verification|completion`, `status`, `deadline` (SLA sipas prioritetit), `activity[]`.
- **Idempotencë:** `dedupeKey = reportId:stage` unique — dy agjentë të njëjtit raport → dy detyra me `dedupeKey` të ndarë (`reportId:stage:uid`), pa duplikuar raportin.
- Mos-caktim i mundshëm: `unassigned` + notifikim manager (`unassignedAlerts` tashmë ekziston).

## 4. Workflow backend (P2, P3)

- `server/approvalPipeline.ts` — shto tranzicionet: `request_correction` (kërkon arsye), `request_info`, `send_to_approval`, `approve_report` (vetëm approver/manager, JO agjenti që e shqyrtoi — `independentReview: true`), `verify_resolution`.
- Hiq `claim: true` nga `municipality_accept`; caktimi te komuna bëhet nga assignment engine.
- Çdo tranzicion: validim `decideTransition`-i brenda transaksionit + shkrim audit (`actorAudit`).
- Refuzimi: `reason` e detyrueshme (ka `MIN_REASON`).

## 5. UI (P3, P4, P5)

- `workflowStages.ts`: `StageKey` → 10 keys, `reportStage()` lexon `workflowStage` me fallback legacy.
- `StageBoard.tsx`: 10 tab me numërues server-side (endpoint `GET /api/v1/reports/stage-counts`), search, pagination.
- `WorkflowCenter.tsx`: kalimet përmes `planReportMove`, pa buton "Merr përsipër"; veprimet e sektorit: Aprovo / Refuzo (arsye) / Kërko info / Dërgo te sektori tjetër / Cakto person / Shëno përgjigje.
- `MunicipalityPanelPage.tsx`: heq butonin "Merr përsipër" (f.548) dhe logjikën e claim; komuna sheh detyrat e caktuara.
- Paneli i agjentit (`AgentPanelPage.tsx`): seksione — Detyrat e mia / Prioritare / Pranë afatit / Vonuar / Në pritje të veprimit tim / Në punë / Për verifikim / Të kryera / Notifikime. Të gjitha nga `workItemRoutes` views ekzistuese + të reja.

## 6. Krijimi i agjentit (P5) — ndryshimet konkrete

1. `server.ts` POST `/admin/users`: shto në `allowedRoles` rolet `municipality`, `manager`, `monitor` (me `checkRoleChange`-të). Prano fusha `municipality`, `department`, `skills[]`, `capacity`.
2. Pas `setCustomUserClaims`: **krijo `workerProfiles/{uid}`** me rolin e punës (`toWorker`-ish), që agjenti të shfaqet menjëherë në listat e caktimit.
3. Validim duplikat në fron: provë 409 para `createUser`.
4. Frontend `AdminAgents.tsx`: formular me komunë/sektor/skills; error i qartë; pa ruajtje fjalëkalimi në Firestore.
5. Test në emulator: krijo agjent, verifiko claims + doc + workerProfile + signin.

## 7. RBAC (P6)

- `workRolesOf` (`transition.ts`): shto `manager` në `workRolesOf` për role `manager`; `monitor` → `observer` (ka); `municipality` → vetëm komuna e vet (ka).
- Zgjero `requireAdmin` me opsion `allowRoles`; endpoint-et e reja të kalimeve përdorin `pipelineRoleOf`.
- Firestore rules: detyrat lexoheshin nga të gjithë stafit e skopit; raportet e konfidentiale (`location`, kontakti) vetëm stafi në skop — verifikohet me `tests/rules`.

## 8. Testet (P9)

Skenariet 1–15 si në spec, në `tests/workflow/` (unit) + `tests/emulator/workflow.e2e.test.ts` (kundër emulatorit) + `tests/rules/workflow.rules.test.ts`. Ekzekutimi: `npm test`, `npm run test:rules`, `npm run lint`, `npm run build`.

## 9. Rendit ekzekutues
1. `reportWorkflow.ts` + 10 faza kanonike + backfill script.
2. Backend transitions + ensureStageTasks + stage-counts API.
3. Krijimi i agjentit (workerProfiles + roleve të zgjeruara).
4. RBAC + rules.
5. UI: WorkflowCenter/StageBoard/AgentPanel/MunicipalityPanel.
6. Testet + regresioni + ndërtimi.
7. Raporti final me shkaqet rrënjësore dhe hapat e vendosjes.

## Kufizime të jashtme
- Vendosja në prodhim (claims, rregulla, backfill mbi DB reale) kërkon konfirmim; backfill është idempotent dhe i kthyeshëm.
- Hostimi statik (Firebase Hosting, SPA vetëm) nuk mund të strehojë Express+Admin; serveri kërkohet ndryshe (Cloud Run/Functions) — ndryshim arkitekturor që vendoset më vete.
