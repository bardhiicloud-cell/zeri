# Dizajni i punës sipas roleve — Zëri i Qytetarëve

> Dokument dizajni për miratim. Nuk është kod. Çdo seksion thotë **çfarë ekziston**
> (✅), **çfarë ekziston pjesërisht** (🔧) dhe **çfarë mungon** (❌), që të dihet
> vëllimi real i punës. Konsolat ekzistuese (`/agent`, `/komuna`, `/monitorim`,
> `/moderim`) i kam parë vetëm në strukturë (skedat dhe madhësia), jo i kam
> audituar linjë për linjë — kjo është pjesë e hapit të parë të ndërtimit.

---

## 0. Parimet që vlejnë për të gjithë rolet

1. **Një rol = një punë.** Ekrani i parë i çdo roli përgjigjet një pyetjeje:
   *"çfarë pret mua tani?"* Jo statistika, jo menu me 25 pika.
2. **Një objekt i përbashkët: "Dosja" (case).** Raporti, rasti shëndetësor, kërkesa
   për donacion, fakti i komunës, biseda — të gjitha hapen në të njëjtin sirtar anësor
   me të njëjtat skeda: **Përmbledhje · Historia · Komunikimi · Dëshmi · Shënime**.
   Kështu një agjent që di një dosje, di të gjitha.
3. **Çdo ndryshim ka autor, kohë, para→pas.** Jo "u ndryshua statusi", por
   *"Arta B. · 14:02 · Në pritje → U aprovua · arsyeja: …"*. Shih §7.
4. **Serveri vendos, ndërfaqja pasqyron.** Asnjë buton nuk është kufi sigurie. Çka një
   rol nuk mund të bëjë, nuk vizatohet, dhe serveri e refuzon gjithsesi.
5. **Çdo listë ka të njëjtën anatomi** (§1) — kërkim, skeda statusi me numra, filtra,
   grupim, veprime masive, faqosje me kursor.
6. **Gjendje të plota:** po ngarkon · bosh (me hapin tjetër) · gabim (me arsyen
   e vërtetë dhe "provo përsëri") · pa lidhje.
7. **Shumë gjuhë:** çdo tekst i ri kalon nga `dt()`; shqip i plotë, pastaj
   përkthimi. Asnjë status në anglisht në ndërfaqe.

---

## 1. Anatomia e përbashkët e një liste pune

```
┌ Titulli i listës ───────────────────────── [Kërko… ⌘K] [Pamjet e ruajtura ▾] ┐
│ Skedat:  Të gjitha 1,284 · Për mua 12 · Të vonuara 8 · Sot 31 · Në pritje 96  │
│ Filtra:  Komuna ▾  Kategoria ▾  Urgjenca ▾  Institucioni ▾  Periudha ▾  [×]   │
│ Grupo sipas: ○ Pa grup  ● Afati  ○ Komuna  ○ Kategoria  ○ Agjenti            │
├──────────────────────────────────────────────────────────────────────────────┤
│ ▼ TË VONUARA (8)                                                              │
│ □ ● Gropa në rrugën kryesore        Prishtinë · Rrugë   Vonuar 3 ditë  [Hap]⋯│
│ ▼ SOT (31)                                                                    │
│ □ ● Ndriçim i dobët…                Gjakovë · Ndriçim   Afati sot      [Hap]⋯│
├──────────────────────────────────────────────────────────────────────────────┤
│ 3 të zgjedhura:  [Cakto…] [Aprovo] [Shëno] [Eksporto]            1–50 / 1,284 │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Rregullat e listës**
- **Skedat** = gjendjet kryesore të rolit, me numra të saktë nga serveri (✅ për Raportet).
- **Grupimi** ndan listën në seksione të palosshme sipas afatit (Të vonuara / Sot /
  Këtë javë / Më vonë), komunës, kategorisë ose personit. Kjo është mënyra e
  "ndarjes dhe kategorizimit" të punëve. ❌ (sot lista është e sheshtë)
- **Pamjet e ruajtura** — çdo person ruan kombinimet e veta ("Raportet kritike të Prizrenit").
  ❌
- **Rreshti** tregon gjithçka për të vendosur pa e hapur: titull, vend, kategori,
  urgjencë, status, afat (e kuqe e vonuar / e verdhë sot), kush e ka. 🔧 (✅ te Raportet)
- **Një veprim parësor** për rresht, pjesa tjetër në `⋯`. 🔧
- **Tastierë:** `j/k` lëviz, `Enter` hap, `x` zgjedh, `a` aprovo, `/` kërko. ❌
- **Faqosje me kursor nga serveri**, jo 100 rreshta në shfletues. 🔧 (✅ Raportet)
- **Numrat:** të saktë kur janë të saktë, me "≥" kur janë të pjesshëm; asnjëherë të rremë.

---

## 2. Agjenti i terrenit (agent · responder · dispatcher · approver)

**Puna e tij:** merr raportet e reja, i verifikon, i dërgon te komuna e duhur dhe
ndjek që të mos mbeten pas.

### Ekrani i parë: *Kutia e Punës* (✅ ndërtuar) → e zgjeruar
Tre blloqe, nga lart:
1. **Shiritat e urgjencës:** *Kritike të pashqyrtuara · Të vonuara · Presin >72 orë ·
   Biseda që presin* — secili një klik te lista e filtruar. (✅ pjesërisht)
2. **"Të miat"** (kryesorja): çfarë ka marrë ky agjent mbi vete, e renditur sipas afatit.
3. **"Radha e përbashkët":** raportet pa të zot, që çdokush në ekip mund t'i marrë me
   *"Merr përsipër"* — kështu dy veta nuk i marrin të njëjtat. ❌ (sot `assignedTo`
   është tekst i lirë, jo një përdorues; kjo është ndryshimi më i madh strukturor.)

### Skedat e listës së tij
`Radha · Të miat · Të vonuara · Presin komunën · Të përfunduara sot`

### Dosja e një raporti (sirtari)
- **Përmbledhje:** foto/video, vendndodhja në hartë, përshkrimi, kategoria, urgjenca,
  **lista e kontrollit të plotësisë** (komuna, adresa, përshkrimi 20+ shenja, foto,
  kategoria) — butoni *"Paso te komuna"* mbetet i çaktivizuar derisa të plotësohet. ✅
- **Dyshim për dublikat:** panel anash me raportet e ngjashme (afër në hartë, e njëjta
  kategori, 14 ditët e fundit) dhe *"Bashko"*. ❌
- **Rrugëzimi:** institucioni përgjegjës i sugjeruar nga kategoria + kontakti i
  verifikuar; *"Dërgo email"*. 🔧 (draft `mailto:`; automatik ❌, shih §8)
- **Historia, Komunikimi, Shënime të brendshme** (të padukshme për qytetarin dhe komunën). 🔧
- **Veprimet:** Merr përsipër · Kërko më shumë të dhëna nga qytetari · Paso te komuna ·
  Refuzo (arsye e detyrueshme, i shfaqet qytetarit) · Ngrit te stafi (eskalim).

### Çfarë NUK sheh/bën
Nuk sheh qytetarët, stafin, shëndetin (përveç approver-it), reklamat, konfigurimet;
nuk fshin; nuk ndryshon rolet.

### Metrikat e tij (private, jo të rradhitura publikisht)
Raportet e trajtuara sot/javë · koha mesatare deri në përgjigje · % brenda afatit ·
sa i janë kthyer si "e paplotë".

---

## 3. Komuna (llogari klienti, jo staf)

**Puna e saj:** t'u përgjigjet raportimeve për komunën e vet dhe të tregojë çfarë u
rregullua. Gjithmonë brenda Firewall-it Editorial: **shton kontekst, nuk heq asgjë.**

### Ekrani i parë: *Radha e punëve të komunës* (🔧 `/komuna`)
- Vetëm raportime të **komunës së vet** dhe vetëm në statuse **publike** (U aprovua →
  Në proces → U zgjidh; Të vonuara). Të papërfunduarat dhe të refuzuarat nuk shfaqen
  kurrë — kjo zbatohet nga serveri (✅ provuar me 34 prova).
- **Skedat:** *Për t'u pranuar · Në punë · Presin faktet · Të vonuara · Të zgjidhura*.
- **Grupimi:** sipas afatit të përgjigjes dhe sipas **drejtorisë/zyrës** (infrastrukturë,
  ujësjellës, mjedis…) — që kryetari ta shpërndajë brenda komunës. ❌

### Rrjedha për një punë (hap pas hapi)
1. **Pranon** ("Marr përsipër punën") → statusi *Në proces*.
2. **Shton fakte** për punimet: çfarë u rregullua, kur, kush, kostoja, foto "pas".
   (✅ forma ekziston; faktet kalojnë verifikim nga stafi para se të bëhen publike.)
3. **Shënon të kryer** — i lejuar vetëm kur ka të paktën një fakt me tekst. ✅
4. Stafi **verifikon dhe publikon** → qytetari njoftohet.

### Çfarë sheh për veten
- **Performanca:** koha mesatare e përgjigjes, % brenda afatit, punë të hapura, të vonuara
  — krahasim me mesataren kombëtare, jo me komuna të emërtuara. 🔧
- **Regjistri i veprimeve të veta**, përfshirë çfarë iu **refuzua** nga firewall-i. 🔧
- **Mesazhet me stafin e platformës** (fije e vetme, e pandryshueshme). ✅ API ekziston.

### Çfarë NUK mund të bëjë (zbatuar në kod)
Të fshijë, fshehë ose ndryshojë tekstin e qytetarit · të shohë identitetin e raportuesit
(✅ hequr nga API) · të veprojë jashtë komunës · të shohë qytetarët, stafin, sigurinë.

### Mungesa kryesore për komunat
**Njoftimi:** komuna duhet të marrë email kur i vjen një punë e re dhe 48/24 orë para
afatit. ❌ (varet nga §8)

---

## 4. Monitorimi (roli i ri, vetëm lexim) dhe Menaxheri i agjentëve

Dy nevoja të ndryshme që sot janë të përziera:

| | **Monitorues** (✅ ndërtuar) | **Menaxher i agjentëve** (❌ propozim) |
|---|---|---|
| Sheh | raporte, afate, auditim | gjithçka që monitoruesi + punën e secilit agjent |
| Ndryshon | asgjë | **Cakton, rishpërndan, eskalon** — asgjë tjetër |
| Pyetja | "çfarë ndodhi dhe a është në rregull?" | "kush po bën çfarë dhe kush ka nevojë për ndihmë?" |

**Vendim që më duhet:** Menaxheri të jetë (a) i njëjti rol me një leje shtesë
`cases.assign`, apo (b) rol i ndarë? Rekomandoj **(a)**: një monitorues me leje
caktimi — më pak role, më pak gabime.

### Ekrani i parë: *Pulsi i ekipit* (🔧 `/monitorim` ka bazën)
- **Rreshta për agjent:** emri · punë të hapura · të vonuara · mesatarja e përgjigjes ·
  veprimi i fundit (para sa kohe) · **semafor** (jeshil/verdhë/kuq).
- **Anomalitë** (🔧 ekziston): shumë aprovime në pak kohë, aprovime pa kontroll të
  plotësisë, agjent pa aktivitet me punë të hapura, ndryshime jashtë orarit.
- **Klik te një agjent →** *Inspekto një person* (✅): çdo veprim i tij, i renditur,
  me para→pas, i filtrueshëm sipas ditës/llojit.
- **Rrjedha live** e veprimeve të ekipit. ✅
- **Për menaxherin:** *"Rishpërndaj"* nga një agjent i mbingarkuar te një tjetër, me arsye.

### Detaji i saktë që kërkove ("çdo pranim, ndryshim, i detajuar")
Çdo rresht i regjistrit tregon: **kush · çfarë · mbi çfarë dosje · para→pas · arsyen ·
kur · nga cila komunë/skope**. Shih §7. 🔧 (regjistri ekziston; pamja e detajuar
para→pas dhe filtrat sipas dosjes ❌)

---

## 5. Superadmin / Admin

**Puna e tij:** shëndeti i platformës, njerëzit, paratë (reklama, komuna), politikat.

- **Ekrani i parë: Paneli** (✅ ndërtuar): *Kërkon vëmendje tani* (kritike, të vonuara,
  spitale pa njoftim, biseda, donacione), 4 kartat kryesore, ecuria e raporteve,
  aktiviteti i fundit, gjendja e sistemit (e matur).
- **Njerëzit:** Qytetarët (ndalim me arsye, verifikim — ✅ nga serveri) · Stafi
  (krijim, role, leje) · Llogaritë e komunave (plan, pranimi i klauzolës editoriale).
- **Superadmin vetëm:** caktimi i adminëve, fshirja e përhershme, cilësimet e
  AdSense, mbyllja e llogarive të komunave.
- **Mbrojtje:** asnjë veprim shkatërrues pa konfirmim të shkruar; çdo ndryshim roli
  mbyll sesionet e personit menjëherë (✅).

---

## 6. Rolet e përmbajtjes dhe të biznesit

**Redaktori i lajmeve (newsadmin):** skicë → rishikim → publikim; kalendar botimi;
moderim i debatit publik; sondazhe. Lista: *Skica · Në rishikim · Të planifikuara ·
Të botuara*.

**Menaxheri i reklamave (adsadmin):** *Kërkesat e reja* (ad requests) → ofertë →
fushatë aktive. Lista: *Të reja · Në bisedë · Aktive · Skaduar*; pamje për kosto
dhe shfaqje. Nuk sheh asnjë raportim të qytetarëve (✅ në rregulla).

**Shëndetësia (approver / me leje):** *Raste që presin verifikim · Urgjente pa spital
të njoftuar · Mungesa barnash*. Pamja nuk tregon kurrë emrin dhe diagnozën në listë
(✅ në Kutinë e Punës). Hapja e dosjes regjistrohet në auditim. ❌ (auditimi i
hapjes)

---

## 7. Regjistri i detajuar i ndryshimeve (për të gjithë)

Struktura e një hyrjeje, e shkruar **vetëm nga serveri**:

```
{ kush: {uid, emri, roli}, çfarë: "report.status.changed",
  mbi: {lloji:"report", id:"…", kodi:"ZQ-1042", komuna:"Prizren"},
  para: {status:"Pending Review"}, pas: {status:"Approved"},
  arsyeja: "…", kur: <koha e serverit>, ip, sesioni }
```

**Ku shfaqet:**
1. **Skeda "Historia" e çdo dosjeje** — vetëm ndryshimet e asaj dosjeje.
2. **Inspekto një person** — çdo gjë që ka bërë një person.
3. **Siguria & Auditimi** — gjithçka, me filtra (kush, çfarë, komuna, data) dhe eksport.
4. **Qytetari** sheh vetëm pjesën publike (timeline-in e raportit të vet).

🔧 Sot regjistri ekziston (shkrim vetëm nga serveri ✅), por nuk ka fushat `para/pas`
për çdo veprim dhe nuk filtrohet sipas dosjes.

---

## 8. Komunikimi me institucionet (email-i i vërtetë)

Sot: draft `mailto:` që e dërgon administratori me dorë. ❌ Automatik.

**Dizajni i synuar**
1. Kur një raport kalon te komuna → serveri krijon një **dërgesë** në radhë
   (`mailOutbox`): marrësi nga drejtoria e kontakteve, shablloni sipas institucionit,
   linku i sigurt për përgjigje.
2. Statuset e dërgesës: *Në radhë → Dërguar → Dorëzuar → Hapur → Dështoi (+ ridërgim)*.
3. Skeda **Komunikimi** e dosjes tregon çdo dërgesë dhe përgjigje.
4. **Spitalet:** i njëjti mekanizëm, me shabllon pa të dhëna personale (vetëm kodi dhe
   urgjenca); njoftimi regjistrohet si veprim i auditueshëm.
5. **Rregull privatësie:** asnjë email nuk mban emrin e qytetarit ose diagnozën;
   linku hap një faqe me kontroll qasjeje.

**Çfarë më duhet nga ti:** një ofrues email-i (Resend / SendGrid / SMTP) dhe domen me
SPF/DKIM. Nuk mund të hap llogari. Pa to ndërtoj gjithçka deri te "regjistrim në
radhë, pa dërgim real".

---

## 9. Çfarë nënkupton kjo për ndërtimin (rendi i propozuar)

| # | Hapi | Madhësia | Varësi |
|---|---|---|---|
| 1 | **Caktimi i vërtetë i punëve** (`assignedTo` → përdorues; "Merr përsipër"; radha e përbashkët) | E madhe | Qëndron në themel të §2 dhe §4 |
| 2 | **Dosja e përbashkët** (sirtar me 5 skeda) në vend të modaleve të ndryshme | E madhe | — |
| 3 | **Regjistri para→pas** + filtrat sipas dosjes | Mesatare | Server |
| 4 | **Grupimi dhe pamjet e ruajtura** në listat | Mesatare | — |
| 5 | **Pulsi i ekipit** + roli i Menaxherit (leje caktimi) | Mesatare | #1, #3 |
| 6 | **Konsola e komunës** e ri-dizajnuar (grupim sipas zyrës, njoftime) | Mesatare | #2 |
| 7 | **Email-i i vërtetë** | E madhe | Ofruesi i email-it |
| 8 | **Dublikatet**, tastiera, eksporte të detajuara | Mesatare | — |

## 10. Pyetje që vendosin dizajnin

1. **Menaxheri i agjentëve:** i njëjti rol si Monitorimi me leje caktimi (rekomandoj),
   apo rol i veçantë?
2. **Caktimi:** një raport ka **një** përgjegjës, apo ekipe (p.sh. "Ekipi i Prizrenit")?
   Rekomandoj një person + ekip opsional.
3. **Komuna:** a ka llogari të shumta (kryetar, zyrtarë) brenda së njëjtës komunë, ku
   kryetari shpërndan punët? Kjo ndryshon modelin e komunës.
4. **Qytetari:** a mund të shohë me emër kush e trajtoi raportin e tij, apo vetëm
   institucionin? (Privatësia e stafit.)
5. **Afatet:** a janë afatet e përgjigjes të njëjta për të gjitha komunat, apo
   kontraktohen sipas planit (basic/standard/pro)?

---

## Vendimet e fundit (tetor 2026)

**Çdo rol hyn në vendin e vet, jo te `/admin`.**

| Adresa | Kush | Çfarë hapet |
|---|---|---|
| `/admin` | superadmin, admin | Gjithçka. Nga "Hap si…" në menu hap `/agent`, `/menagjer`, `/komuna` për të parë saktësisht çfarë shohin ata. |
| `/agent` | agjentët: persona të cilëve admini u jep qasje (aprovime raportesh, donacione, shëndetësi, lajme, reklama) | Vetëm ato fusha që u janë dhënë. |
| `/menagjer` | Menaxheri i agjentëve (roli `monitor`, dikur "Monitorim") | Vëzhgim i plotë, vetëm lexim: çfarë bëri secili agjent e komunë. |
| `/komuna` | llogaritë e komunave (planet basic / standard / pro) | Raportimet e komunës, shëndetësia/barnat, mbledhja e të dhënave dhe dërgimi me email. |
| `/` | qytetari | Faqja, raportimi, lajmet. |

Logjika e rrugëve është te `src/lib/roleHome.ts` (me teste). Adresa është vetëm dera; ç'hapet brenda vendoset nga roli dhe nga lejet, në server dhe në faqe.

**Superadmini mund të bëjë punën e agjentëve.** Hapat e agjentit në rrjedhën e aprovimit (merr për inspektim, paso te komuna) i lejohen edhe pronarit; regjistrohen me `onBehalfOf: 'agent'` në timeline dhe në auditim. Hapat e komunës (merr përsipër, punimet u kryen) mbeten vetëm të komunës: pronari nuk dëshmon punë fizike që nuk e ka bërë komuna. *Pasojë për t'u ditur:* i njëjti person tani mund ta kalojë dhe ta verifikojë një raportim; ndarja e dy personave është vetëm praktikë, jo më kontroll i detyruar.

**Admini heq llogari dhe monitoron punën e tyre.** `DELETE /api/v1/admin/users/:uid` (vetëm admin/superadmin; arsye + emaili i shkruar; superadmini nuk hiqet; vetëm superadmini heq një admin) mbyll hyrjen dhe sesionet, pastaj fshin profilin. Puna e personit mbetet e regjistruar me emër. Butoni është te Agjentët dhe te sirtari i monitorimit të aktorit, ku admini sheh çdo veprim, raportimet e prekura dhe e ndryshon qasjen.

**Rishikimi një nga një.** "Fillo rishikimin" te Raportimet: hap rekordin, kontrollo, vepro (aprovo, refuzo me arsye, fshi), hiq foton me arsye (zhbëhet), pastaj vazhdon vetë te tjetri. Tastet: ← → A R X Esc. Fotot e hequra ruhen në nënkolekcion privat `reports/{id}/removedMedia`; skedari mbetet në Storage. Prerja e fotos (crop) kërkon shkrim imazhi në server dhe nuk është bërë ende.

## Sistemi i pranimit (vendimet) — tetor 2026

Çdo gjë që pret vendim kalon nga një vend i vetëm: `POST /api/v1/admin/decisions/:lloji/:id`. Rregullat janë te `src/lib/decisionRules.ts` dhe i lexojnë njëkohësisht serveri dhe ekranet.

| Lloji | Gjendjet | Veprimet (arsye e detyrueshme me *) |
|---|---|---|
| Donacion | pending → approved / rejected | Aprovo, Refuzo*, Kthe në shqyrtim |
| Rast shëndetësor | pending → verified → resolved; rejected | Verifiko, Refuzo*, Shëno të zgjidhur, Kthe në shqyrtim |
| Lajm / Video | draft → published; rejected | Publiko, Tërhiq nga publikimi*, Refuzo*, Kthe në draft |
| Kërkesë reklame | pending → payment_confirmed → approved → completed; rejected | Konfirmo pagesën, Aprovo (me fushatën), Refuzo*, Mbyll fushatën, Kthe në pritje |
| Postim forumi | pending → approved; hidden | Aprovo, Fshih nga publiku*, Hiq aprovimin |

- **Kush vendos.** Pronari vendos për gjithçka. Agjenti vendos vetëm në fushat që i janë dhënë. Komuna vetëm verifikon dhe mbyll rastet shëndetësore të komunës së vet, pa refuzuar. Menaxheri sheh historinë, por nuk vendos.
- **Konfliktet.** Leximi, vendimi dhe shkrimi bëhen në një transaksion. Kur dy persona vendosin njëkohësisht, njëri fiton dhe tjetri merr "dikush tjetër e ndryshoi" (409).
- **Historia.** Çdo vendim ruhet te `<koleksioni>/{id}/decisions`, që klientët s'e lexojnë: kush, kur, nga cila gjendje në cilën dhe pse. Ruhet edhe në auditim. Dokumenti publik nuk mban as emrin e vendimmarrësit, as arsyen.
- **Rregullat e bazës.** Një lajm krijohet vetëm si draft, dhe `published` nuk ndryshohet nga klienti. Autori i postimit nuk mund ta aprovojë ose ta nxjerrë nga fshehja postimin e vet; më parë mundte.
- "Refuzo" te donacionet nuk e fshin më kauzën. Fshirja e përhershme mbetet veprim i veçantë.

## Raportimet: kush e mban punën, rishikimi, fotot

- **Klikimi i një rreshti** hap rishikimin te ai rekord: kontrollo, vepro, kalo te tjetri.
- **"Merr përsipër"** e lidh raportin me personin (`assignedToUid`), jo vetëm me emrin. Një agjent nuk merr raportin që e mban tjetri. Pronari i cakton raportin një agjenti ("Cakto te…"). Mbajtësi ose pronari e lëshon ("Lësho"). "Të miat" në listë filtrohet nga serveri sipas llogarisë së kyçur.
- **Fotot.** "Prit" e pret foton në shfletues; serveri e ruan nën `reports/edited/…` dhe e mban origjinalin privatisht. "Hiq foton" (me arsye) dhe "Zhbëj" punojnë si më parë. Serveri lexon vetëm foto nga bucket-i ynë nën `reports/`, kurrë adresa të jashtme (mbrojtje nga SSRF).

## Konsola e komunës (`/komuna`) — tetor 2026

Para kësaj, përgjigjet, kërkesat për korrigjim dhe faktet e komunës ruheshin vetëm në kujtesën e shfletuesit: humbnin në ringarkim dhe s'arrinin askund. Tani çdo gjë ruhet te serveri.

- **Radha.** Lexohet nga serveri, e kufizuar te komuna e llogarisë dhe vetëm te raportimet e aprovuara. Raportuesi nuk shfaqet. Hapat: Të gjitha, Të reja, Në punim, Të vonuara, Të zgjidhura, me numra të saktë për gjithë komunën.
- **Dosja e një raportimi.** "Merr përsipër" (me plan që lexon qytetari), regjistrim faktesh (përshkrim, data, kush e kreu, kostoja; presin verifikimin e redaksisë), "Punimet u kryen".
- **Shkruaj te redaksia ose publiku.** Katër lloje: *Përgjigje zyrtare* (publikohet menjëherë te historiku si "Komuna e …"), *Korrigjim fakti*, *Kundërshtim*, *Kërkesë për heqje* (këto tre presin shqyrtimin e redaksisë). Nuk ekziston asnjë lloj që heq ose ndryshon diçka: një përpjekje e tillë refuzohet dhe regjistrohet.
- **Kërkesat e mia.** Çdo kërkesë me gjendjen dhe arsyen e vendimit të redaksisë. Komuna nuk mund ta lexojë regjistrin e vet editorial (vendim i vjetër i qëllimshëm); këtë pamje e zëvendëson.
- **Stafi.** Te "Faktet e komunës" ka tab të ri "Kërkesat e komunave" me Pranoje / Refuzoje (arsye e detyrueshme) dhe Historia. Komuna nuk e vendos kurrë vendimin e kërkesës së vet.
- **Inspektimi nga admini.** Zgjidh një komunë dhe e sheh vetëm për lexim.
- **Privatësia.** Një raportim i një komune tjetër, ose i paaprovuar, kthen "nuk u gjet", jo "ndalohet".

## Debati, kutia e punës dhe shkalla — tetor 2026

- **Admini i debatit (`debatwp`).** Konsola ndërtohet nga autori tjetër në `/debatwp` (postimet, fshirja në masë, raportimet e postimeve, reklamat e debatit, tiket, pagesat). Tani përgjigjet edhe në `/debatiwp`. Pronari e hap nga "Hap si… → Debati". Roli e shikon vetëm këtë dhe Forumin; nuk ka qasje në raportimet e qytetarëve.
- **Kutia e punës** përfshin tani edhe kërkesat e komunave (korrigjim, kundërshtim, kërkesë për heqje; kjo e fundit renditet më lart). Merren nga API e stafit dhe rifreskohen çdo minutë.
- **Kufiri i kërkesave.** Trafiku i kyçur ka kovën e vet: 900 në minutë për IP, përballë 120 për trafikun anonim. Një zyrë komunale ose ministri që del nga një IP nuk bllokohet më si e tërë; një përmbytje me kokë të rreme "Bearer" ndalet prapë pas 2700.

## Shkalla, planet, emaili dhe menaxheri — tetor 2026

**Kutia e punës në shkallë.** Raportet e saj vijnë nga serveri mbi gjithë koleksionin, jo nga 100-të e fundit në shfletues: më të vjetrat që presin shqyrtim (`order=oldest`), të vonuarat dhe kritikët e hapur. Kërkon dy indekse të reja `reports` (status dhe komunë+status, `createdAt` ngjitës); janë te `firestore.indexes.json`.

**Planet e komunave** (`municipalityPlan`, e shkruar vetëm nga serveri; një llogari pa plan llogaritet Bazë):

| Plani | Çfarë përfshin |
|---|---|
| Pa pagesë / Bazë | radha, përgjigje zyrtare, kërkesa te redaksia |
| Standard | + shëndetësia, faktet e punimeve, eksporti |
| Pro | + email te institucionet |

Serveri i zbaton: lista shëndetësore, vendimet shëndetësore, faktet e punimeve dhe dërgimi me email kthejnë `PLAN_REQUIRED` me emrin e planit që e përfshin. Admini e ndryshon planin nga kartela e komunës te "Menaxheri → Zgjidh personin".

**Emaili te institucionet.** `server/mailer.ts` flet me SendGrid, Mailgun ose Resend përmes `fetch`, pa varësi të reja. Konfigurohet me `MAIL_PROVIDER`, `MAIL_API_KEY`, `MAIL_FROM` (shih `.env.example`). Pa to, dërgimet mbeten "në radhë" dhe konsola e thotë hapur. Çdo dërgim është rresht te `emailOutbox` (kush, te kush, kur, a shkoi). Dërgohen vetëm raporte të aprovuara, vetëm te kontakte të drejtorisë së verifikuar, kurrë me emrin e raportuesit, dhe i njëjti raport nuk shkon dy herë te e njëjta adresë brenda 24 orëve.

**Menaxheri (`/menagjer`).** Skeda e re "Ekipi": sa presin, sa s'i ka marrë askush, sa janë të vonuara, ngarkesa e secilit agjent dhe kush mban raporte por ka heshtur 3+ ditë. Numërohet te serveri (`/api/v1/admin/team-overview`), jo duke ngarkuar raporte; kërkon indeksin `auditLogs` (`actorUid`, `createdAt`).

**Kufiri i kërkesave.** Trafiku i kyçur ka kovën e vet (900/min për IP); trafiku anonim mbetet 120.
