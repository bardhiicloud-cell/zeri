# Matrica e testimit funksional

Vetëm rezultate të vërteta. "Ekzekutuar lokalisht" do të thotë `vitest run tests/server tests/lib` (66 skedarë, **713 teste kaluan**, `tsc --noEmit` pa gabime, 2026-10-13). "CI vetëm" do të thotë shkruar dhe kontrolluar nga `tsc`, por **jo ekzekutuar**, sepse emulatori i Firestore kërkon Java 21 që mungon këtu.

## Skenarët e kërkuar

| Skenari | Mbulimi | Statusi |
|---|---|---|
| Rrjedha e plotë: qytetari → ruajtje → Track ID → shqyrtim → caktim → agjent → komunë → verifikim → gjendje përfundimtare → gjurmim → monitorim → auditim | pjesë të veçanta: `reports`, `trackLookup`, `reportAssignment`, `municipalityDesk`, `teamOverview`; **nuk ka një test të vetëm nga fillimi në fund** | **Hendek**: nuk u shkrua, sepse kërkon emulator dhe Auth; i dokumentuar te `REMAINING_BLOCKERS.md` |
| Refuzim dhe kërkesë për informacion | `reportCase.test.ts`, `decisionRules.test.ts` | Ekzekutuar lokalisht, kalon |
| Rikaktim dhe dorëzim me arsye | `reportAssignment.test.ts` (5 teste të reja; 15 gjithsej në skedar) | Ekzekutuar lokalisht, kalon |
| Caktim i njëkohshëm / ndryshim i vjetruar | `reportAssignment.test.ts` (logjika); `reportAssignment.routes.test.ts` (dy kërkesa paralele: një 200, një 409) | logjika: kalon; rruga me transaksion: **CI vetëm** |
| Historiku + njoftimi shkruhen bashkë | `reportAssignment.routes.test.ts` | **CI vetëm** |
| Kthimi i punës pas heqjes së llogarisë | `reportAssignment.routes.test.ts` (`releaseHeldReports`) | **CI vetëm** |
| Refuzim i monitorit, komunës, qytetarit | `reportAssignment.test.ts`, `monitorRole.test.ts` | Ekzekutuar lokalisht, kalon |
| Veprime të paautorizuara, ngritje roli | `policy.test.ts`, `roleClaims.test.ts`, `authority.test.ts` | Ekzekutuar lokalisht, kalon |
| Izolimi i komunave | `municipalityDesk.test.ts`; rregullat në `firestore.rules.test.ts` | server: kalon; rregullat: **CI vetëm** |
| Shënimet e brendshme dhe historiku s'janë të lexueshme nga klienti | `tests/rules/reportHandover.rules.test.ts` (të reja) | **CI vetëm** |
| Kufizimet e të dhënave shëndetësore | rregullat Firestore | **nuk u ekzekutuan**; asnjë test i ri |
| Moderimi i DebatWP dhe historiku | `debateAdmin.test.ts`, `adminReelReports.test.tsx` | Ekzekutuar lokalisht, kalon |
| Dështim njoftimi dhe rimarrje | `mailer`/`institutionMail.test.ts` për emailin e institucioneve | njoftimet e brendshme: **pa test dështimi** |
| Ngarkime të dështuara, forma të paplota | `reportMedia.test.ts`, `reportPhotoEdit.test.ts` | Ekzekutuar lokalisht, kalon |
| Lejet e eksporteve | `adminReportsApi.test.ts`, matrica e lejeve | pjesërisht; eksportet e komunës **nuk u testuan veç** |
| Navigimi dhe format responsive | – | **Nuk u testua** |
| Të gjitha gjuhët e administratës | – | **Nuk u testua** |
| Ngarkesa / kapaciteti | – | **Nuk u testua** (shih `NATIONAL_PLATFORM_READINESS.md`) |

## Rezultatet e ekzekutimit

| Kontroll | Para | Pas |
|---|---|---|
| `tsc --noEmit` | pa gabime | pa gabime |
| Teste njësi/server | 698 kaluan (64 skedarë) | 713 kaluan (66 skedarë). Rritja prej 15 përfshin punën e sesioneve të tjera paralele; nga ky punim janë vetëm 5 |
| Të reja nga ky punim | – | 5 teste në `tests/server/reportAssignment.test.ts` (të ekzekutuara); 2 skedarë emulator/rregulla (vetëm CI) |
| ESLint, gjithë projekti | 1672 gabime | i pandryshuar nga ky punim; skedarët e mi të rinj kanë 0 gabime të reja (mbeten 2 `any` të vjetra në `reportAssignment.ts`) |

Shënim: në mes të sesionit `tsc` tregoi një gabim në `SherbimetPage.tsx` ('Phone'), i shkaktuar nga një sesion tjetër që po e redaktonte; u zhduk vetë dhe nuk lidhet me këto ndryshime.
