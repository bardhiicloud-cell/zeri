# Gatishmëria për shkallë kombëtare

**Përfundim i ndershëm: nuk ka asnjë matje kapaciteti. Asnjë test ngarkese nuk u ekzekutua dhe nuk ka bazë për të pohuar se platforma i shërben 200,000 përdoruesve, regjistrues, aktivë ditorë apo njëkohësisht.** Ky dokument liston vetëm ç'u gjet në kod dhe çfarë mungon.

## 1. Pyetja që duhet përgjigjur para çdo plani

"200,000+" mund të nënkuptojë llogari të regjistruara, përdorues aktivë mujorë, aktivë ditorë ose të njëkohshëm. Kërkesat janë shumë të ndryshme (disa mijëra të njëkohshëm kundrejt qindra mijëra të regjistruar). Pronari i projektit duhet ta përcaktojë, bashkë me pragjet e pranimit (p95/p99, shkalla e gabimeve) para se të bëhet ndonjë pohim.

## 2. Çfarë u vërtetua në kod

| Fushë | Gjetje |
|---|---|
| Faqosja | `server/reportQuery.ts`: `MAX_PAGE_SIZE = 50`, kursor, filtra të planifikuar në server; kombinimet pa indeks refuzohen (400) në vend që të skanojnë (`planReportQuery`) |
| Indekset | `firestore.indexes.json` (109 fusha në indekse); `REQUIRED_REPORT_INDEXES` testohet kundrejt planit të pyetjeve |
| Cache | `server/cache.ts`: LRU brenda procesit, Redis opsional (`REDIS_URL`); përdoret për të dhëna publike (reklama, kontakte) |
| Kufizim shkalle | `express-rate-limit`, `hpp`, `helmet`; testet `rateLimit.test.ts`, `rateLimitBuckets.test.ts` |
| Madhësia e trupit | `express.json` 1 MB, 12 MB për imazhe |
| Konkurrenca e shkrimit | caktimi, ndryshimet e statusit përmes `runTransaction`/batch; tani caktimi ka zbulim ndryshimi të vjetruar (`expectedHolderUid`) |
| Rrethi i shkrimit për historikun | `assignmentHistory` si nënkolekcion i raportit: shkrim i një dokumenti për ndryshim, pa hot-spot në një dokument të vetëm |
| Postë me radhë | `emailOutbox` (`queued`, `retryable`) për emailin e institucioneve |
| Ndërtimi | `vite build` + `esbuild` për serverin; nuk u ekzekutua në këtë sesion |

## 3. Rreziqe të identifikuara (jo të matura)

1. `reports` lexohet nga kushdo (`allow read: if true`). Çdo klient mund ta lexojë gjithë koleksionin, jo vetëm një Track ID, dhe fusha operacionale si `assignedToUid` janë të dukshme. Kjo është problem privatësie dhe kosto leximi me qindra mijëra përdorues; zgjidhja është lookup nga serveri (`trackLookup.ts` ekziston) dhe mbyllja e leximit, por kërkon migrim të klientit. Nuk u ndryshua pa miratim.
2. Metrikat e panelit (`adminDashboardMetrics.ts`, `useDashboardCounts`) nuk u verifikuan për leximin e kufizuar; një numërim i pakufizuar mbi `reports` do të rritej me volumin.
3. Rritja e `internalNotes`, `caseMessages`, `assignmentHistory` (kufizuar në 100 / 100 / 50 në lexim, por jo në shkrim) dhe e auditimit nuk ka politikë ruajtjeje të dokumentuar.
4. `release` në heqje llogarie: kufizuar në 2000 raporte për thirrje; një staf me më shumë se kaq kërkon thirrje të përsëritur.
5. Ngarkimi i imazheve/videove: nuk u audit­ua rruga e depozitimit/CDN.
6. Jo të audit­uara: kopjet rezervë, rikuperimi, vëzhgueshmëria (metrika/alarme), zhvendosja e punëve të rënda në sfond.

## 4. Plani i matjes që duhet bërë (nuk është bërë)

Vetëm në mjedis testimi të autorizuar, me të dhëna sintetike, me emulator ose projekt të veçantë Firebase:

| Skenari | Ç'matet |
|---|---|
| Paraqitje publike raportimesh | kalueshmëri, p50/p95/p99, shkalla e gabimeve, kufizimi |
| Kërkim me Track ID | latencë, kosto leximi për kërkesë |
| Radhët e administratës (faqe me 50) | latencë sipas filtrave, përdorimi i indekseve |
| Caktime të njëkohshme në të njëjtin raport | saktësia (një fitues), shkalla e 409 |
| Panelet e komunave | leximet për ngarkim |
| Njoftime dhe punë në sfond | thellësia e radhës, ripërpjekjet |
| Ngarkime skedarësh | koha, dështimet |
| Ngarkesë e papritur | sjellja e kufizimit të shkallës, rikuperimi |

Pragjet e pranimit duhet t'i përcaktojë pronari para ekzekutimit. Nuk guxohet të bëhet test ngarkese në prodhim.
