# Matrica e lejeve të dispatcher-it

**Statusi: Nuk u ndryshua asgjë. Në pritje të miratimit.** Pyetja për autoritetin e dispatcher-it u bë më 2026-10-13; përgjigjja e marrë ishte një kërkesë tjetër (ridizajn i faqeve publike) dhe nuk e përcaktonte politikën. Pa vendim, kodi mbetet siç ishte.

## 1. Çfarë thotë burimi (verifikuar)

| Burimi | Çfarë thotë |
|---|---|
| `docs/ADMIN_ROLE_DESIGN.md` §2 | Titulli: "Agjenti i terrenit (agent · responder · dispatcher · approver)". Dispatcher grupohet me agjentët; përshkrimi i punës dhe i veprimeve është i atij grupi. Nuk cakton punë te të tjerët. |
| `src/lib/roleCatalog.ts` | Qëllimi: "Cakton dhe shpërndan punët: radha, kërkesat, moderimi dhe njoftimet." Por shënimi: "Si përgjegjësi, me shtimin e njoftimeve" dhe "nuk menaxhon staf ose role". |
| `src/lib/adminPermissions.ts` (`BY_ROLE.dispatcher`) | Seksionet: `dashboard`, `reports`, `support`, `forum`, `notifications`, `agentpanel`. |
| `server/approvalPipeline.ts` `pipelineRoleOf` | `dispatcher` → `agent`. |
| `server/roleClaims.ts` `buildRoleClaims` | `dispatcher` merr flamurin `agent: true`. |
| `server/reportAssignment.ts` `decideAssignment` | vetëm `staff` (admin, superadmin) cakton te të tjerët; `agent` merr përsipër vetë ose lëshon atë që mban. |
| `ReviewMode.tsx` | lista e agjentëve për caktim përfshin `dispatcher` si objektiv (mund t'i caktohet punë), jo si caktues. |

Përfundim: autoriteti i synuar **nuk përcaktohet**. Dokumenti i dizajnit dhe zbatimi thonë "agjent"; përshkrimi në katalog thotë "shpërndan punët".

## 2. Lejet aktuale (pa ndryshim)

| Veprimi | Dispatcher sot |
|---|---|
| Hap listën e raportimeve | Po |
| Merr përsipër një raport (claim) | Po |
| Aprovon dhe e dërgon te komuna | Po |
| Refuzon (me arsye) | Jo |
| Kërkon informacion, shënim i brendshëm, eskalon | Po |
| Mbyll një eskalim | Jo |
| Ia cakton raportin një agjenti tjetër | **Jo** |
| Lëshon një raport që mban vetë | Po |
| Lëshon raportin e dikujt tjetër | Jo |
| Sheh historikun e caktimeve | Po (agjentët lexojnë) |
| Sheh ngarkesën e ekipit (`teamOverview`) | Jo (vetëm admin dhe monitor) |
| Ndryshon role, heq llogari, cakton komuna | Jo |
| Njofton qytetarët në masë | Po (seksioni `notifications`) |

## 3. Opsionet e propozuara

| | A. Pa ndryshim (rekomandim) | B. Dispatcher cakton | C. B plus ngarkesa e ekipit |
|---|---|---|---|
| Cakton/ricakton/lëshon të tjerët | Jo | Po, vetëm raporte të radhës së shqyrtimit (`Draft`, `Pending Review`), vetëm te agjentë aktivë | Po, si B |
| Arsye e detyrueshme (5–300), historik, njoftim, auditim, zbulim ndryshimi të njëkohshëm | – | Po, ato që ekzistojnë tashmë | Po |
| Sheh ngarkesën e ekipit | Jo | Jo | Po (vetëm lexim) |
| Ndryshon role, nivel komune, raportet e fazës së komunës | Jo | Jo | Jo |

Pse A është rekomandimi: asgjë nuk e provon se dispatcher duhet të ketë këtë fuqi, dhe fuqia është e ndjeshme (ndan punën dhe e merr nga të tjerët). Shtohet më vonë me një ndryshim të vogël.

## 4. Si do të zbatohej B ose C (nuk është bërë)

1. `decideAssignment`: `isOwner` bëhet `actorRole === 'staff' || actor.role === 'dispatcher'` (kontroll i qartë i rolit nga tokeni i verifikuar, jo nga leje `agents`, që e kishte çdo agjent me leje të veçantë).
2. Mbrojtjet që mbeten: objektivi duhet të jetë agjent aktiv; vetëm `Draft` dhe `Pending Review` (para fazës së komunës, ndaj nuk ka qasje ndër-komunë); arsyeja e detyrueshme kur i merret dikujt; transaksion; historik; auditim `report.assign`.
3. `policy.ts` (`checkRoleChange`) nuk preket: dispatcher nuk fiton asnjë rrugë për të ndryshuar role; ngritja e rolit mbetet vetëm admin/superadmin.
4. Për C: `teamOverview.ts` shton `dispatcher` te rolet e lejuara dhe `PERMISSIONS_MATRIX` rigjenerohet (`npm run matrix:write`); testi `permissionsMatrix.test.ts` e detyron.
5. Teste të nevojshme: dispatcher cakton (po), dispatcher cakton te komunë/qytetar/të pezulluar (jo), pa arsye (jo), raport i aprovuar (jo), dispatcher ndryshon rol (jo), rastet e njëkohshme (një fitues).

Kërkohet një përgjigje e qartë: A, B ose C.

---

## Vendimi dhe zbatimi (2026-10-13): opsioni C

Pronari zgjodhi C: dispatcher-i cakton dhe sheh ngarkesën e ekipit. Zbatuar te `server/reportAssignment.ts` (`decideAssignment`), `server/teamOverview.ts` (`mayViewTeam`), `ReviewMode.tsx` (zgjedhësi nga pamja e ekipit, sepse dispatcher-i nuk lexon direktorinë e përdoruesve), `AgentPanelPage.tsx` (paneli i ngarkesës, lexim, pa hyrje te auditimi i individit). Testet: 3 grupe njësi, 2 emulatori (përfshirë regjistrimin e auditimit `report.assign`), matrica e gjeneruar, dhe një caktim i vërtetë në shfletues lokal me arsye të detyrueshme. "Brenda komunës/ekipit": stafi i platformës nuk ka fushë komune; kufiri efektiv është radha e shqyrtimit para fazës së komunës dhe agjentët aktivë. Dispatcher-i nuk merr qasje në të dhëna raportuesish (pamja e ekipit ka vetëm numra dhe emra stafi).
