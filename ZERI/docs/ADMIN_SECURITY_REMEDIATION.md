# Riparimi i sigurisë: raportet nuk janë më të lexueshme nga kushdo

**Statusi: Implementuar dhe i verifikuar në kod, me emulator dhe teste njësi. NUK është vendosur në prodhim.** Rregullat e reja nuk janë aplikuar te `firestore.rules`; ato mbahen si transformim të testuar (shih §5). Ndërfaqja e re nuk është provuar në shfletues.

## 1. Problemi (verifikuar në kod)

`firestore.rules` kishte `allow read: if true` për `reports`. `App.tsx` abonohej te 100 dokumentet e fundit për çdo vizitor, ndaj çdo vizitor merrte dokumentet e plota: `authorId`, emrin e punonjësit te `assignedTo`, `assignedToUid`, përmbledhjen dhe etiketat e AI-së, flamujt e brendshëm, e çdo fushë tjetër. Çdo klient mund të lexonte edhe gjithë koleksionin.

## 2. Çfarë është publike dhe çfarë jo

Lista e lejuar ndërtohet te `server/publicReports.ts`, duke ripërdorur listën e Track ID (`buildPublicTrackView`). Çdo fushë e re në një raport mbetet private derisa dikush ta lejojë.

| Publike në feed | Private (nuk del kurrë nga serveri) |
|---|---|
| titulli, përshkrimi, kategoria, urgjenca, statusi, datat | `authorId` (në feed është `''`), emri i punonjësit, `assignedToUid`, `assignedBy` |
| komuna, lagjja, koordinata të rrumbullakuara në 2 dhjetore (~1.1 km) | adresa e rrugës (hiqet nga feed; Track ID e tregon me id-në) |
| foto dhe media me `https://` të raporteve të pranuara | emaili, telefoni, shënimet e brendshme, `internalNotes`, `caseMessages`, `assignmentHistory` |
| `upvotes`, `commentsCount`, emri i raportuesit vetëm nëse nuk është anonim | `aiSummary`, `aiTags`, `aiSeverity`, `awaitingInfo`, `escalated`, çdo fushë e padeklaruar |
| institucioni përgjegjës; `assignedTo` është institucioni, jo personi | |
| timeline publik (institucioni, jo personi) | |

Në feed hyjnë vetëm statuset e pranuara nga një rishikues: `Approved`, `Assigned`, `In Progress`, `Overdue`, `Resolved`, `Closed`. `Draft`, `Pending Review` dhe `Rejected` nuk hyjnë; autori i vet i sheh përmes pyetjes së tij; kushdo me Track ID arrin faqen e gjurmimit.

Vendimi i pronarit (2026-10-13): koordinata me 2 dhjetore, sipas politikës te `municipalityNormalizer.ts`. Pasoja: pinat e hartës publike janë qeliza ~1.1 km dhe lista nuk tregon adresën e rrugës.

## 3. Çfarë u ndërtua

| Skedari | Ndryshimi |
|---|---|
| `server/publicReports.ts` (i ri) | `GET /api/v1/public/reports`: projeksioni, faqosja me kursor (max 100), kufizimi i shkallës për IP (60/min), cache 30 s i tekstit JSON, vetëm komuna reale në filtër |
| `server.ts` | regjistrimi i rrugës (2 rreshta) |
| `src/lib/publicReportsApi.ts` (i ri) | zgjedhja e burimit sipas pretendimeve të tokenit; feed + raportet e mia për të gjithë të tjerët |
| `src/App.tsx` | dëgjuesi i vjetër i Firestore bëhet funksion; startohet vetëm për staf dhe monitor; ndryshon kur ndryshon përdoruesi; pastrohet në dalje |
| `src/lib/store.ts` | "ngarko më shumë" përdor kursorin e feed publik |
| `scripts/reportsLockdownRules.ts` (i ri) | transformimi i rregullave; shkruan `firestore.reports-lockdown.rules` ose, me `--in-place`, `firestore.rules` |
| `docs/` | ky dokument |

Rregulli i ri (`canReadReport`): lexon autori i vet; stafi (`isStaff()`: admin, superadmin, approver, adsadmin, newsadmin, agent) dhe monitori; komuna vetëm raportet e komunës së vet pasi janë pranuar (`isMunicipalityVisibleStatus`). Asgjë tjetër.

## 4. Testet dhe rezultatet reale (2026-10-13)

| Test | Rezultati |
|---|---|
| `tests/server/publicReports.test.ts` (12): një raport me çdo fushë private nuk nxjerr asnjë prej tyre; institucion jo person; emër vetëm kur nuk është anonim; statuset e lejuara; faqosje; cache; kërkesa të gjata/të këqija refuzohen pa prekur bazën | 12/12 kaluan |
| `tests/server/reportsLockdownRules.test.ts` (5): transformimi aplikohet te `firestore.rules` aktuale, ndryshon vetëm një rregull, refuzon të hamendësojë nëse rregullat ndryshojnë | 5/5 kaluan |
| `tests/lib/publicReportsApi.test.ts` (6): kush merr koleksionin e plotë; dështim i mbyllur; bashkimi i raporteve të mia; fetch | 6/6 kaluan |
| `tests/rules/reportsRead.rules.test.ts` (15, **emulator**): vizitor pa hyrje, mysafir, qytetar tjetër, autor, mysafir anonim, çdo flamur stafi/monitori, rol pa flamur, komunë (vetëm e vetja dhe e pranuar), komunë pa emër, debatwp | 15/15 kaluan |
| `tests/rules/reportHandover.rules.test.ts` (**emulator**): `assignmentHistory`, `internalNotes`, `caseMessages` të pakapshme nga autori, stafi (me token superadmini), agjenti, komuna, vizitori | kaluan |
| Gjithë suita e emulatorit | 22 skedarë, 326 teste, kodi i daljes 0 |

Nuk u provuan: leximi i drejtpërdrejtë i dokumentit nga një klient i vjetër pas aplikimit; sjellja e `App.tsx` në shfletues (as feed, as raportet e mia, as ndërrimi hyrje/dalje); lidhja `claims` e tokenave të vërtetë.

## 5. Plani i vendosjes (nuk u ekzekutua) dhe kthimi prapa

Renditja ka rëndësi, sepse rregullat vendosen të fundit.

1. **Para çdo gjëje:** `npm run claims:sync` në modalitet provë; sigurohuni që çdo llogari stafi/monitori ka flamujt (`admin`, `agent`, `monitor`, …) në token. Një person pa flamur humb qasjen te lista e plotë pas hapit 4. Pas ndryshimit të claims duhet rifreskuar tokeni (dalje/hyrje).
2. Vendosni serverin dhe ueb-in së bashku (ndërfaqja e re thërret `/api/v1/public/reports`). Ndërfaqja e re punon edhe me rregullat e vjetra.
3. Verifikoni në prodhim: një vizitor pa hyrje sheh listën; një agjent dhe një monitor shohin panelin; një qytetar sheh raportet e veta, përfshirë ato në pritje; ngarkimi i faqes tjetër ("ngarko më shumë") punon.
4. Aplikoni rregullat: `npx tsx scripts/reportsLockdownRules.ts --in-place`, rishikoni `git diff firestore.rules`, pastaj `firebase deploy --only firestore:rules`. **Kujdes:** `firestore.rules` ka edhe ndryshime të pa-commit nga sesione të tjera (rrjeti social), që kanë renditjen e tyre të vendosjes (skriptet `backfill-*` me `--apply`, pastaj indekset, pastaj serveri dhe ueb-i, rregullat të fundit). Bashkërendoni, ose bëni versionin e rregullave nga skedari i vendosur së fundi plus këtë ndryshim të vetëm.
5. Vëzhgoni 24 orë gabimet `permission-denied` në regjistra dhe shifrat e leximit të Firestore.

Efekt tranzitor i pritur: faqet e hapura me paketën e vjetër JavaScript do të marrin `permission-denied` te lista e raporteve derisa të rifreskohen. Për ta zbutur, vendosni rregullat të paktën një ditë pas ueb-it.

**Kthimi prapa:** rivendosni rregullat e mëparshme (historiku i versioneve në Firebase Console, ose `git show HEAD:ZERI/firestore.rules` pas rishikimit); kjo e hap leximin menjëherë. Klienti i ri punon edhe me rregullat e hapura, ndaj ueb-i nuk kthehet prapa.

## 6. Rreziqe të mbetura (të ndershme)

- Nënkolekcioni `reports/{id}/comments` ka ende `allow read: if true`; ai lexohet nga kushdo që njeh id-në e raportit. Nuk u prek.
- Kursori i faqosjes është një datë çfarëdo; një sulmues mund t'i ndryshojë për të anashkaluar cache-in, secila kërkesë një lexim i Firestore. Kufizuar nga limitori për IP (60/min/IP), jo i eliminuar. Rruga `municipality` u mbyll (vetëm emra realë).
- `description` i lirë mund të përmbajë një adresë që qytetari e shkroi vetë; nuk filtrohet.
- Komunat dhe të tjerët pa flamur stafi përdorin feed publik: shohin vetëm raporte të pranuara (që është edhe politika e tyre te rregullat).
- Stafi pa flamur te token (p.sh. `debatwp`, `moderator` pa `agent`) nuk lexon koleksionin; `moderator` mapohet te `agent` te `buildRoleClaims`, `debatwp` jo. Panelet e numërimit (`useDashboardCounts`) mund të japin `permission-denied` për një rol që nuk është në `isStaff()`; nuk u provua për çdo rol.
- Fushat `upvotes`/`commentsCount` mbeten publike; emri i raportuesit shfaqet publikisht kur nuk është anonim, si më parë.
