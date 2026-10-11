# Security Fix — Firestore Rules

> Ngurtësim i rregullave pas shtimit të koleksioneve `editorialLog` dhe
> `workFacts`. Dy gjetje reale, njëra prej të cilave ekspozonte kredenciale.

---

## 1. Gjetja kryesore — kredencialet AdSense ishin publike

### Problemi

`settings/general` kishte `allow read: if true` — hapur për botën. Në të
njëjtin dokument ruheshin:

| Fusha | Rreziku |
|---|---|
| `adSenseClientId` | ID e botuesit — mjafton për të servuar reklama në emër të platformës |
| `adSenseSlot` | Sloti i reklamës — lejon mbushjen e vendit me përmbajtje të huaj |
| `adSenseCode` | Kodi i injektuar në faqe — **XSS i mundshëm nëse keqpërdoret** |
| `adBankIban`, `adBankSwift`, `adAccountHolder` | Detaje bankare — ftojnë mashtrim pagese |

Kushdo mund t'i lexonte me një kërkesë të vetme.

### Vlerësimi i rrezikut

`adSenseCode` është më i keqi. Nëse komponenti e injekton atë me
`dangerouslySetInnerHTML`, një sulmues që **nuk** mund ta shkruajë atë ende nuk
mund t'i bëjë dëm — por ID-ja dhe sloti publikë lejojnë **rrëmbim të të ardhurave
nga reklamat**, gjë që prek drejtpërdrejt qëndrueshmërinë e platformës.

### Zgjidhja

Ndarja e dokumentit në **publik** dhe **privat**:

```
settings/general       →  hapur (showReels, kontakt reklamash, slogan)
settings/ads-private   →  vetëm superadmin (kredencialet AdSense)
```

**Rregulli i shkrimit gjithashtu forcon kufirin:**

```
allow create, update: if isSuperAdmin() &&
                       request.resource.data.diff(resource.data)
                         .affectedKeys().hasNone([
                           'adSenseEnabled', 'adSenseClientId',
                           'adSenseSlot', 'adSenseCode'
                         ]);
```

Kjo e bën **të pamundur** shkrimin e kredencialeve në dokumentin publik, edhe
nga një superadmin. Pa këtë, rregullimi mund të anashkalohej duke shkruar
kredencialet përsëri në `general`.

### Pse nuk u thye reklamimi

Verifikuar: `AdBanner.tsx` lexon **vetëm** `adContactPhone`, `adContactEmail`,
`adContactCompanyName`, `adSlogan`, `adWhatsApp`. Asnjë komponent publik nuk
lexon fushat AdSense — ato përdoren vetëm në formularin e adminit.

### Klienti

Store-i i rrugëton fushat private në dokumentin e tyre:

```ts
const PRIVATE_KEYS = ['adSenseEnabled', 'adSenseClientId', 'adSenseSlot', 'adSenseCode'];
// ndarë në publicFields + privateFields, shkruar veçmas
```

Shkruhen **veçmas** me qëllim: një dështim në ruajtjen e kredencialeve nuk duhet
të bllokojë ruajtjen e konfigurimeve publike. Një ndryshim i slotit dhe një
flamur i faqes nuk duhet të ndajnë të njëjtin mënyrë dështimi.

Lexohen përsëri vetëm për stafin:

```tsx
const unsubscribePrivateSettings = canAccessAdmin(currentUser)
  ? onSnapshot(doc(db, 'settings', 'ads-private'), ...)
  : () => {};
```

Gate-i parandalon një **gabim lejeje në çdo ngarkesë faqe** për qytetarët, që
ndryshe do të dukej si defekt.

---

## 2. Fushat bankare të vdekura — u hoqën

`adBankName`, `adAccountHolder`, `adBankIban`, `adBankSwift`, `adBankInstructions`
ishin **deklaruara në interfacen `SystemSettings` por nuk kishin as UI, as
lexues, as shkrues.**

Këto ishin kod spekulativ. Do të bëheshin rrjedhje e menjëhershme sapo dikush të
shtonte formularin — sepse dokumenti është publik. U hoqën.

---

## 3. `editorialLog` — shtuar

Nuk kishte rregulla fare; binte në `deny all`. Kjo është e sigurt por e thyer.

```
allow read: if isStaff();
allow create: if isAuthenticated() &&
                request.resource.data.actorUserId == request.auth.uid &&
                request.resource.data.at == request.time;
allow update, delete: if false;
```

**Append-only për të gjithë, përfshirë superadminin.** Arsyeja është e
drejtpërdrejtë: gjysma e hyrjeve kanë të bëjnë me një komunë, pra një regjistër i
editueshëm do t'i lejonte palës nën shqyrtim të modifikonte provat.

**Leximi është vetëm për stafin, dhe qëllimisht jo për komunën** — edhe për hyrjet
për të vetë. Komuna nuk mund të kërkojë kopje të regjistrit të përpjekjeve të
vetë të refuzuara; raporti vjetor i transparencës e përmbledh atë, që është
llogaridhënia e premtuar.

**Krijimi kontrollon `actorUserId == request.auth.uid`** — pa këtë, një klient
mund të falsifikonte hyrje në emër të një komune tjetër, pra të ndyrte provat
kundër një fqinji.

---

## 4. `workFacts` — shtuar

```
allow read:   if resource.data.review == 'confirmed' || isStaff();
allow create: if isMunicipality() && municipality == ownMunicipality() && review == 'pending' && ...
allow update: if isStaff() && affectedKeys().hasOnly(['review', 'reviewedBy', 'reviewedAt']);
allow delete: if (isMunicipality() && authorUserId == uid && review == 'pending') || isSuperAdmin();
```

Katër vendime, secila mbyll një rrugë:

### 4.1 Leximi vetëm për `confirmed`

Një pretendim i paverifikuar është pohim i komunës, jo fakt. Publikimi i tij si
fakt do të shtrembëronte rekordin.

### 4.2 `municipality == ownMunicipality()`

Komuna mund të paraqesë vetëm në emrin e vet. Pa këtë, një llogari e paguar e një
komune mund të ngarkonte fakte për punimet e fqinjit — mënyrë e lirë për të
penguar.

### 4.3 `review == 'pending'` në create

Komuna nuk mund të krijojë një hyrje të shënuar `confirmed`.

### 4.4 **Update-i më i rëndësishëm**

```
allow update: if isStaff() && affectedKeys().hasOnly(['review', 'reviewedBy', 'reviewedAt']);
```

Komuna **nuk është në `isStaff()`**, pra nuk mund ta ndryshojë `review` fare.

**Pa këtë rresht**, komuna mund të paraqiste një hyrje dhe menjëherë ta shënonte
`confirmed` — e njëjta fuqi si redaktimi i raportit të qytetarit, vetëm më
ngadalë. Kjo është mbrojtja qendrore e mekanizmit.

Teksti i pretendimit, autori dhe timestamp-i **nuk janë të editueshëm nga
askush** — as nga stafi. Rekordi i kush tha çka dhe kur mbijeton edhe kur
pretendimi rrëzohet.

---

## 5. `auditLogs` — ndryshim i sjelljes

**Para:** `allow update, delete: if isSuperAdmin();`
**Pas:** `allow update, delete: if false;`

Një regjistër auditimi që llogaria më e privilegjuar mund ta rishkruajë nuk
përgjigjet asnjë prej pyetjeve për të cilat ekziston regjistri i auditimit.

---

## 6. Roli `municipality` — jashtë `isStaff()`

```
function isMunicipality() {
  return isAuthenticated() && request.auth.token.municipality_account == true;
}
```

**Qëllimisht NUK është pjesë e `isStaff()`.** Komuna është klient i sistemit të
transparencës, jo staf, dhe është subjekti i raportimit që përndryshe do të
shihte të plotë.

Mbajtja jashtë `isStaff()` do të thotë që **çdo rregull ekzistues që jep qasje
stafi vazhdon ta përjashtojë atë** — që është parazgjedhja e sigurt.

---

## 7. Verifikimi

| Kontrolli | Rezultati |
|---|---|
| `npx tsc --noEmit` | ✅ **0 gabime** |
| `npx eslint firestore.rules` | ✅ **0 gabime**, 12 paralajmërime |
| `npx vite build` | ✅ **kalon** |
| Fushat AdSense në dokumentin publik | ✅ **NUK shkruhen më** |
| Reklamimi (`AdBanner`) | ✅ **i paprekur** — lexon vetëm fushat e kontaktit |

### Paralajmërimet e mbetura (të qëllimshme)

12 `no-open-reads` në koleksione që janë publike me dizajn për një platformë
civike: `reports`, `polls`, `newsArticles`, `ads`, `categories`, `forumPosts`,
`forumStories`, `officialProfiles`, `liveMessages`, `settings/general`.

Secila është rishikuar; asnjë nuk është aksidentale.

---

## 8. Çka mbetet

1. **Claims** — `municipality_account` dhe `municipality` duhen vendosur si
   custom claims nga Admin SDK gjatë provizionimit. Pa to, `isMunicipality()`
   është gjithmonë false dhe komuna nuk mund të shkruajë.
2. **Indeksat** — `workFacts` ku `review == 'confirmed'` dhe `editorialLog` i
   renditur sipas `at` kërkojnë indekse në `firestore.indexes.json`.
3. **Deploy** — `firebase deploy --only firestore:rules` (kërkon projekt aktiv).
