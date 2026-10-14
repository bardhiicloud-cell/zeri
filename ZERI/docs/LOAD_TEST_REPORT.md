# Raporti i testit të ngarkesës: sistemi i detyrave (work items)

Ekzekutuar më 2026-10-14 me `scripts/loadtest-work.ts`. **Matet vetëm kodi i aplikacionit dhe transaksionet e tij mbi emulatorin e Firestore.** Nuk ka rrjet, nuk ka Cloud Run, nuk ka Firestore të vërtetë, kyçja është një header. Asnjë pohim kapaciteti për prodhim nuk mbështetet nga këto numra.

Si ta përsërisni:

```bash
firebase emulators:exec --config firebase.rules-test.alt.json --only firestore --project demo-zeri-load "node node_modules/tsx/dist/cli.mjs scripts/loadtest-work.ts"
```

Ndryshoret mjedisore: `AGENTS`, `ITEMS`, `CONCURRENCY`, `DASHBOARDS`. Mjedisi: Windows 11, Node 22.18, emulator Firestore lokal (një proces Java), gjeneruesi i ngarkesës dhe serveri në të njëjtin proces Node.

## Çfarë bën testi

1. **Pranimi**: menaxheri krijon `ITEMS` detyra (prioritete të përziera) me `CONCURRENCY` kërkesa njëkohësisht.
2. **Gara**: 12 thirrje njëkohësisht `auto-assign` mbi të njëjtën detyrë.
3. **Zbrazja e radhës**: për secilën detyrë: menaxheri e cakton, agjenti e pranon, e fillon, e mbyll. Njëkohësisht `DASHBOARDS` menaxherë shfletojnë përmbledhjen, radhën pa caktuar dhe ekipin pa pushim.
4. **Konsistenca**: ngarkesa e ruajtur e secilit agjent krahasohet me punën që ai mban realisht.

## Rezultatet e matura

| | Provë A | Provë B |
|---|---|---|
| Agjentë / detyra / njëkohësi / menaxherë në panel | 40 / 600 / 25 / 4 | 150 / 2000 / 60 / 8 |
| Pranimi (krijime) | 10 267 detyra/min | 8 481 detyra/min |
| Zbrazja e plotë (4 veprime për detyrë) | 2 024 detyra/min | 1 556 detyra/min |
| Koha e rikuperimit të radhës (pa kthim të detyrave) | 17.8 s | 77.1 s |
| Gabime | 0 nga 3 674 thirrje (0.00%) | 0 nga 11 129 thirrje (0.00%) |
| Fitues të garës mbi një detyrë (duhet 1) | 1 | 1 |
| Agjentë me ngarkesë të ruajtur ≠ punës së mbajtur | 0 | 0 |
| Detyra të mbyllura / ende të hapura në fund | 599 / 1 | 1999 / 1 |

Vonesat (ms), Prova A → Prova B:

| Veprimi | p50 | p95 | p99 |
|---|---|---|---|
| krijimi i detyrës | 141 → 391 | 222 → 700 | 257 → 903 |
| caktimi (menaxher) | 204 → 592 | 293 → 996 | 316 → 1851 |
| pranimi (agjent) | 170 → 462 | 252 → 788 | 268 → 936 |
| fillimi (agjent) | 163 → 468 | 240 → 771 | 255 → 996 |
| mbyllja (agjent) | 193 → 574 | 266 → 962 | 305 → 1202 |
| "Puna ime" (agjent) | 88 → 265 | 140 → 449 | 176 → 567 |
| paneli: radha pa caktuar | 105 → 364 | 156 → 634 | 200 → 812 |
| paneli: ekipi | 93 → 292 | 144 → 533 | 184 → 650 |
| **paneli: përmbledhja** | 137 → **1051** | 254 → **3073** | 385 → **5114** |
| gara e caktimit (12 njëkohësisht) | 3605 → 4440 | 3970 → 5095 | 3970 → 5095 |

## Çfarë tregojnë

- **Korrektësia mbahet nën njëkohësi.** Në të dy provat një fitues i vetëm në garë, asnjë ngarkesë e shkëputur nga puna reale, asnjë gabim. Kjo është gjetja më e fortë.
- **Përmbledhja e menaxherit është pika e ngadaltë.** Çdo thirrje lexon deri në 5000 detyra të hapura dhe 2000 profile pa cache; me 8 panele njëkohësisht p99 arriti 5.1 s. Në prodhim kjo do të kushtonte edhe leximet e Firestore për çdo thirrje. Rekomandim: cache 15-30 s për përmbledhjen ose agregim i mbajtur nga transaksionet (numërues).
- **Gara e caktimit është e saktë por e ngadaltë (3.6-5 s)** sepse transaksionet kundërshtare përsërisin. Rekomandim: një kontroll i shpejtë para transaksionit që kthen 409 menjëherë kur detyra tashmë ka mbajtës.
- **Rritja e vonesave nga A në B** është e pritshme (3.3x më shumë njëkohësi, emulator me një fije); nuk mund të ndahet çfarë është emulatori dhe çfarë është aplikacioni.
- Ky test nuk përfshin: lexime nga browser-i, ngarkim skedarësh, njoftimet, skedulerin e afateve nën ngarkesë, rrjetin, ose kostot.

## Çfarë mungon për një pohim kapaciteti

Një projekt Firebase staging i autorizuar, pragje pranimi të përcaktuara nga pronari (p95/p99, shkalla e gabimeve), një mjet ngarkese HTTP nga jashtë (k6), dhe ripërsëritja e këtij skenari me të dhëna të sintetizuara. Kostoja e vlerësuar nuk u llogarit: emulatori nuk faturon dhe numri i leximeve/shkrimeve për thirrje nuk u instrumentua.

## Ripërsëritje pas dy rregullimeve (commit 8f632ea: cache 20 s për përmbledhjen, bashkim i thirrjeve të njëkohshme të caktimit)

Prova B u ekzekutua sërish me të njëjtat parametra (150 / 2000 / 60 / 8):

| | Para | Pas |
|---|---|---|
| Zbrazja e plotë | 1 556 detyra/min (77.1 s) | 4 153 detyra/min (28.9 s) |
| Përmbledhja p50 / p95 / p99 | 1051 / 3073 / 5114 ms | 69 / 100 / 2128 ms |
| Gara e caktimit (12 njëkohësisht) | 4440-5095 ms | 453-454 ms |
| Gabime | 0 | 0 nga 12 218 |
| Fitues në garë / ngarkesë e shkëputur | 1 / 0 | 1 / 0 |

p99 i përmbledhjes (2.1 s) mbetet te thirrjet që gjejnë cache-in bosh (një herë në 20 s për proces). Bashkimi i caktimit vlen vetëm brenda një procesi; me disa instanca serveri vendos përsëri transaksioni (i saktë, por më i ngadaltë). Kufizimet e emulatorit më sipër vlejnë njësoj.
