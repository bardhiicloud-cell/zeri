# Harta e rrjedhës operacionale

Burimi i së vërtetës: `server/approvalPipeline.ts` (fazat dhe tranzicionet), `server/decisions.ts`, `server/reportAssignment.ts`, `server/reportCase.ts`, `src/lib/reportStatus.ts`. Kjo hartë përshkruan atë që kodi bën; nuk shton rregulla të reja.

## 1. Cikli i jetës së një raportimi

Statuset e ruajtura (anglisht, përputhen me rregullat e Firestore): `Draft`, `Pending Review`, `Approved`, `Assigned`, `In Progress`, `Resolved`, `Rejected`, `Overdue` (dhe `Closed` në etiketat e interfaqes).

Fazat e rrjedhës së aprovimit (`stageOf`): `submitted` (E paraqitur) → `inspecting` (Në inspektim; një raport i `Pending Review` me mbajtës) → `inspected` (`Approved`) → `responding` (`Assigned`, `In Progress`, `Overdue`) → `responded` → `verifying` → `published` (`Resolved`); dega `rejected`.

Aktorët: `agent` (agjent, approver, responder, dispatcher, moderator), `municipality`, `staff` (admin, superadmin). Administratori mund të bëjë hapat e agjentit; nuk dëshmon punën fizike të komunës dhe nuk bën hapat e komunës.

| # | Hap | Kush | Ku zbatohet | Gjurma |
|---|---|---|---|---|
| 1 | Qytetari paraqet raportin | llogari e identifikuar | rregullat `reports` create: `authorId == uid`, status `Pending Review`, pa `timeline`/`assignedTo`; Track ID gjenerohet | dokumenti `reports/{id}` |
| 2 | Merr përsipër (claim) | agjent/admin | tranzicioni `claim` te `decisions.ts` | `assignedToUid`, `assignedAt`, `assignedBy`, timeline |
| 3 | Caktim te një agjent / lëshim | vetëm admin cakton; mbajtësi lëshon | `reportAssignment.ts` (transaksion) | `assignmentHistory` + njoftim + auditim |
| 4 | Kërkesë për informacion | agjent/admin, vetëm në shqyrtim | `reportCase.ts` `request-info` | `caseMessages`, timeline publik (pa tekstin e pyetjes), njoftim për qytetarin |
| 5 | Përgjigje e qytetarit | vetëm autori | `provide-info` / `my-reports/:trackingId/provide-info` | `caseMessages`, njoftim për kërkuesin |
| 6 | Shënim i brendshëm | staf | `notes` | `internalNotes` (kurrë te qytetari, komuna ose publiku) |
| 7 | Eskalim / mbyllje eskalimi | agjent/admin eskalon; vetëm admin mbyll | `escalate`, `resolve-escalation` | `internalNotes` + flamuri `escalated` |
| 8 | Aprovim ose refuzim (me arsye) | aprovim: agjent/admin; refuzim: admin | tranzicionet te `decisions.ts` + `approvalPipeline.ts` | timeline + auditim |
| 9 | Komuna merr përsipër, përgjigjet, shënon punimet e kryera | komuna e vet | `municipalityDesk.ts` | timeline; një komunë tjetër merr "nuk u gjet" |
| 10 | Verifikim dhe publikim `Resolved` | admin | tranzicionet | timeline |
| 11 | Ndjekja nga qytetari | kushdo me Track ID | `trackLookup.ts` (lista e lejuar e fushave) | – |

Rregulla të zbatuara nga serveri: një tranzicion refuzohet me kod (`NO_STANDING`, `WRONG_ROLE`, `WRONG_STAGE`, …); caktimi lejohet vetëm për `Draft` dhe `Pending Review`; një raport që pret përgjigje nuk aprovohet; kërkesa e dytë për informacion bllokohet derisa të vijë përgjigjja.

## 2. Dorëzimi i punës (caktimi)

Veprimet te `POST /api/v1/reports/:id/assign`:

- `{ uid, reason?, expectedHolderUid? }` caktim; `{ release: true, reason?, expectedHolderUid? }` lëshim.
- Vetëm admin/superadmin caktojnë; agjenti lëshon vetëm atë që mban; objektivi duhet të jetë agjent aktiv (jo i pezulluar).
- Arsyeja është e detyrueshme kur puna i merret një personi tjetër; kufijtë 5–300 shenja.
- `expectedHolderUid` e kthen 409 një ndryshimi të vjetruar (dy njerëz njëkohësisht).
- Në të njëjtin transaksion: ndryshimi i raportit, hyrja në `assignmentHistory`, njoftimet (marrësi i ri, mbajtësi i mëparshëm). Njoftimet shkojnë vetëm te stafi, jo te qytetari.
- Heqja e një llogarie: `releaseHeldReports` kthen raportet e para-aprovimit në radhën e përbashkët me historik.
- Leximi i historikut: `GET /api/v1/reports/:id/assignments` (staf, agjentë, monitor).

Parim: një dështim njoftimi nuk bllokon dorëzimin, sepse njoftimi shkruhet në të njëjtin transaksion me ndryshimin (ose të dyja ose asnjë); nuk ka dorëzim që humbet.

## 3. Aktorët jashtë rrjedhës së raportimeve

Përmbajtja (lajme, reklama, donacione, shëndetësi, sondazhe, forum/DebatWP) ndjek tranzicionet e veta; matrica e veprimeve dhe e rolave është te `PERMISSIONS_MATRIX.md` dhe `ROLE_WORKFLOW_MATRIX.md`. Cikli i detajuar i secilit nuk u audit­ua rresht për rresht në këtë sesion.

## 4. Çfarë nuk ekziston (nuk u shpik)

- Afate dhe eskalim automatik: ekziston statusi `Overdue` dhe `src/lib/reportDue.ts`; nuk u gjet politikë e miratuar afatesh për eskalim automatik, ndaj nuk u shtua.
- Caktim automatik sipas ngarkesës: nuk u shtua (do të kërkonte kufij të shpikur).
- Hap i veçantë "shqyrtim i përfundimit": rrjedha ka fazat `verifying` dhe `published`; nuk u ndryshua.

## 5. Njoftimet: çfarë provohet vërtet

| Nivel | Gjendja në kod |
|---|---|
| Ngjarja e rrjedhës | shkruhet në timeline |
| Rekordi i njoftimit | dokument te `notifications` me `state: 'published'`, shkruar në të njëjtin transaksion/batch me ngjarjen |
| Dërgim në email | vetëm posta për institucionet: `emailOutbox` me `queued` dhe `mailer.ts` (jep `retryable`), që pa konfigurim mbetet `queued` |
| Konfirmim marrjeje | **nuk ekziston**: një njoftim i brendshëm "publikuar" nuk provon se u lexua; emaili nuk ka konfirmim dorëzimi |
| Provë ripërpjekjeje/ idempotencë | nuk u verifikua për njoftimet e brendshme |
