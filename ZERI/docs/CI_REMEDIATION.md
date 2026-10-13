# Korrigjimi i CI-së dhe i ESLint

**Statusi: Implementuar dhe i verifikuar lokalisht. Nuk është parë një ekzekutim i vërtetë në GitHub Actions** (asgjë nuk u publikua; punëtoria jo e commit).

## 1. Cila CI është e vërtetë

- `.github/workflows/ci.yml` (rrënja e depos) është ajo që GitHub lexon. Hapat: `tsc`, porta ESLint për një listë skedarësh, `npm test`, `npm run build`, auditim varësish (vetëm raportim), job `rules` (emulatorë, Java 21, `npm run test:rules`), skanim sekretesh. **Nuk përmban asnjë `|| echo` që fsheh dështime të testeve.** Një `|| true` ka vetëm hapi i auditimit të varësive, që është shënuar si "report only" dhe nuk është test.
- `ZERI/.github/workflows/production.yml` **nuk lexohet nga GitHub** (workflow-t lexohen vetëm nga rrënja). Përmban `npm test || echo …` dhe një hap vërtetimi GCP të shënuar "Mock". Sipas udhëzimit nuk u fshi dhe nuk u zhvendos (nuk u verifikua qëllimi i strukturës); nuk është i përdorur, ndaj nuk ka maskim aktiv. Rekomandim: pronari ta fshijë ose ta zëvendësojë me workflow real zhvillimi.

## 2. Çfarë ishte e prishur dhe çfarë u rregullua

| Gjetje | Para | Pas |
|---|---|---|
| Porta ESLint e `ci.yml` (komanda e saktë) | **dështonte**: 65 gabime (61 `no-explicit-any` te testet, 4 `no-unused-vars`) në 21 skedarë; kodi i daljes 1 | kodi i daljes 0 |
| Skedarët e rinj në portë | – | `server/reportAssignment.ts`, `staffRemoval.ts`, `publicReports.ts`, `src/lib/publicReportsApi.ts`, `handoverHistory.ts`, `reportAssignmentApi.ts`, `HandoverHistoryPanel.tsx`, `scripts/reportsLockdownRules.ts` |
| `server/gdpr.ts` | 2 `any` | të tipizuara me `unknown`; sjellja e pandryshuar (testet e GDPR kaluan, edhe në emulator) |

Ndryshimet te `eslint.config.js` (të gjitha janë të lexueshme aty, pa shtypje komentesh në kod):
1. `tests/**`: `no-explicit-any` fiket, sepse dyfishat e testimit (Firestore i simuluar, kërkesa të pjesshme) janë legjitimisht të lirshëm. Kodi i prodhimit e mban rregullin.
2. `no-unused-vars` pranon prefiksin `_` (konventë e qëllimshme: çelës i lënë jashtë, argument i detyrueshëm i pa përdorur).
3. Skriptet Node (rrënja, `scripts/`, `qa/`, `tools/`, skedarë `.js` në `src/`) marrin globalët e Node/shfletuesit; kjo hoqi ~510 gabime `no-undef` që ishin zhurmë, jo gabime.
4. Vendosës pa efekt për `react-hooks/exhaustive-deps` (pluginën nuk e kemi të instaluar; kodi ka 16 komente `eslint-disable` për të). **Rregulli NUK zbatohet**; duhet instaluar `eslint-plugin-react-hooks` (vendim për varësi të reja).

## 3. Gjendja e ESLint për gjithë projektin

Para: 1672 gabime, 14 paralajmërime. Pas: **1035 gabime, 30 paralajmërime** (16 paralajmërime të reja janë "direktivë e panevojshme", pasojë e vendosësit të mësipërm). 14 gabime riparohen automatikisht (`--fix`) në 9 skedarë; nuk u aplikuan, sepse skedarët i redakton edhe sesione të tjera.

| Zona | Gabime | Shkaku kryesor | Rëndësia |
|---|---|---|---|
| `src/` (ueb) | 750 | 431 `no-unused-vars`, 282 `no-explicit-any`, 7 `no-useless-assignment`, 6 `prefer-const` | Mesatare/ulët: kod i vdekur dhe tipizim i dobët; asnjë gabim i llojit "variabël e papërcaktuar" |
| `server/` | 97 | 93 `no-explicit-any`, 2 `no-unused-vars`, 1 `no-control-regex`, 1 `no-useless-assignment` | Mesatare: `any` në trajtimin e gabimeve; 1 regex me karaktere kontrolli për rishikim |
| skriptet në rrënjë | 158 | 102 `any`, 29 `unused`, 14 paralajmërime `no-open-reads` (skedarët prototip `*.rules`, jo rregullat e prodhimit) | Ulët: skripte njëpërdorimshe |
| `qa/` | 56 | 42 `any`, 14 `unused` | Ulët |
| `scripts/` | 3 | `no-regex-spaces` | Ulët |
| `backup_stale_js/` | 1 | `no-useless-escape` | Shumë ulët |

Asnjë gabim në `src/` nuk është "emër i papërcaktuar" i vërtetë (kontrolluar): `no-undef` i mbetur (5) është te skripta ndihmëse `.cjs`/`.js` në `src/` dhe rrënjë.

## 4. Plan i sigurt për pjesën e mbetur

1. `eslint --fix` vetëm për 14 gabimet e riparueshme, në një ndryshim të veçantë pas bashkimit të punës së sesioneve të tjera.
2. Pastrimi i `no-unused-vars` te `server/` dhe pastaj `src/pages`, nga skedarët që nuk po redaktohen; shtoni çdo skedar të pastruar te lista e portës në `ci.yml`.
3. `any` te `catch (error: any)` → `unknown` me ngushtim, skedar pas skedari (siç u bë te `reportAssignment.ts`, `staffRemoval.ts`).
4. Instalimi i `eslint-plugin-react-hooks` dhe heqja e vendosësit.
5. Kur `server/` dhe `src/lib` të jenë të pastra, portën ta bëni `eslint server src/lib tests`.

Nuk u bë asnjë ndryshim masiv automatik në `src/`.

## 5. Kontrollet e ekzekutuara lokalisht, njësoj si CI

`tsc --noEmit` (pa gabime), komanda e portës ESLint (kodi 0), `vitest run tests/server tests/lib` (750 teste), `vite build` dhe `esbuild server.ts` (kaluan), `npm run test:rules` ekuivalent me emulator (326 teste). Dështimi i testeve e dështon CI-në, sepse `npm test` nuk ka maskim.

---

## Përditësim: React Hooks (2026-10-13)

`eslint-plugin-react-hooks` 7.1.1 u instalua si varësi zhvillimi. `eslint.hooks.config.js` zbaton `rules-of-hooks` dhe `exhaustive-deps` si gabime për gjithë `src`, me 23 skedarë të vjetër si paralajmërime të listuara (76 paralajmërime). CI e ekzekuton (`npx eslint -c eslint.hooks.config.js src`) pa maskim; një shkelje kontrolli e vënë me qëllim e dha kodin 1 dhe u hoq. Gjetje të vërteta: hook pas `return` te `AgentPanelPage.tsx` (riparuar), `Dashboard.tsx` dhe `ReportIssue.tsx` (faqe publike, të pa-prekura). Vendosësi i vjetër (rregull bosh) u hoq.
