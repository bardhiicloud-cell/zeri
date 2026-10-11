# Vizioni i Reklamave — Zëri i Qytetarëve

> Dokument strategjik. Nuk përmban kod aplikacioni; përshkruan **sa reklama, ku,
> dhe çka duhet hequr/shtuar**, bazuar në auditimin real të kodit.

---

## 1. Gjendja aktuale (auditim real)

Kam kontrolluar çdo rubrikë. Ja ku janë reklamat **sot**:

| Rubrika | Pozicionet e deklaruara | Sa shfaqen realisht |
|---|---|---|
| **Ballina (Dashboard)** | `inline` ×2 (backup), `inline` (engagement) | 1–2 |
| **Lajmet** | `feed` ×2, `article`, `sidebar` | **4** |
| **Debati Publik (Forum)** | `top`, `sidebar` | 2 |
| **Donacionet** | `inline`, `banner` | 2 |
| **Regjistri Shëndetësor** | `banner` | 1 |
| **Regjistri i Detajuar** | `banner` | 1 |
| **Sondazhet** | `inline`, `banner` | 2 |
| **Statistikat** | `inline` | 1 |
| **Banka e Ideve** | `banner` | 1 |
| **Çdo faqe tjetër** | `top` (nga AppLayout) | 1 |

**Totali në një tur nëpër faqet kryesore: ~17 reklama.**

### Problemi qendror

> **17 reklama është shumë për një platformë qytetare.**

Kjo nuk është faqe lajmesh komerciale. Është platformë **llogaridhënieje
publike** — qytetari vjen të raportojë një gropë në rrugë, të kërkojë ndihmë
shëndetësore, ose të ndjekë një donacion. Çdo reklamë në atë rrugë e dobëson
besimin në momentin më të ndjeshëm.

---

## 2. Vizioni: **4 pozicione strategjike, asnjë në rrugët e ndjeshme**

Parimi drejtues:

> **Reklama lejohet aty ku qytetari lexon. Ndalohet aty ku qytetari vepron.**

Kur njeriu raporton problem, dërgon kërkesë shëndetësore, apo dhuron para —
ai është në një **transaksion besimi**. Reklama aty lexohet si "po ma shet
vuajtjen time". Reklama në faqen e lajmeve, ku ai lexon me kohë të lirë,
lexohet si normale.

### Ku duhet të JEN reklamat

| # | Pozicioni | Rubrika | Pse |
|---|---|---|---|
| **1** | `feed` | **Lajmet** — mes artikujve | Konteksti editorial; lexuesi ka kohë. Vendi më i natyrshëm. |
| **2** | `sidebar` | **Lajmet** — kolona djathtas | Tashmë ekziston (300px). Reklamë vertikale, e qetë. |
| **3** | `article` | **Lajmet** — brenda artikullit | Pas paragrafit 2. Ndarje natyrale e leximit. |
| **4** | `sidebar` | **Debati Publik** | Bashkë me postimet, jo mbi to. |

**Katër. Kaq.**

---

## 3. Çka duhet HEQUR (dhe pse)

### ❌ 3.1 — Reklama në Regjistrin Shëndetësor — **HIQET**

```
src/pages/HealthRegistryPage.tsx:1033   <AdBanner position="banner" />
```

**Pse:** Kjo faqe mban raste mjekësore, shpesh fëmijë me diagnoza të rënda dhe
kërkesa për ndihmë financiare. Të shfaqësh një reklamë banke ose telefonie
përbri një apeli për operacion është **joetike** dhe ligjërisht e rrezikshme
(eksploatim i gjendjes së nevojës). Asnjë arsye komerciale nuk e justifikon.

**Zëvendësim:** një shirit i vetëm "Si të ndihmosh" me udhëzime verifikimi.

### ❌ 3.2 — Reklama në Donacione — **HIQET (të dyja)**

```
src/pages/DonationsPage.tsx:165   <AdBanner position="inline" />
src/pages/DonationsPage.tsx:523   <AdBanner position="banner" />
```

**Pse:** Kjo është faqja ku njeriu jep **para**. Reklama këtu krijon konflikt
të drejtpërdrejtë interesi: "po dhuron, por edhe po ma shet diçka". Dëmton
konvertimin e donacioneve më shumë sesa fiton nga reklama.

**Zëvendësim:** një bllok "Transparenca e donacioneve" — ku shkoi çdo euro.

### ❌ 3.3 — Reklama `top` në çdo faqe — **KUFIZOHET**

```
src/components/layout/AppLayout.tsx:201   <AdBanner position="top" />
```

**Pse:** Shfaqet mbi **çdo** faqe, përfshirë `/raporto` (formulari i raportimit)
dhe `/ndihma`. Qytetari hyn të raportojë dhe gjëja e parë që sheh është reklamë.
Ky është vendi ku humbet besimi.

**Zëvendësim:** lejohet **vetëm** në `/`, `/lajme`, `/statistikat`, `/projektet`.
Në `/raporto`, `/ndihma`, `/trackid`, `/shentetesia`, `/donacion`, `/admin` —
**asnjë**.

### ❌ 3.4 — Reklama në Statistikat dhe Bankën e Ideve — **HIQEN**

**Pse:** Statistikat janë mjet llogaridhënieje për gazetarë dhe kërkues. Banka
e Ideve është moment krijimtarie qytetare. Të dyja humbin nga zhurma vizuale.

### ❌ 3.5 — Pozicionet e vdekura — **PASTRIM KODI**

`floating`, `modal`, `auth`, `map`, `banner` — `AdBanner` kthen `null` për to.
Janë 5 pozicione që **nuk shfaqin asgjë** por mbeten në kodin e adminit si
opsione. Administradori zgjedh "banner" dhe mendon se bleu diçka.

**Zëvendësim:** fshi nga lista e pozicioneve në `AdminAds`, ose implementoji.

---

## 4. Rregullat e reja (të propozuara)

### 4.1 — Lista e zezë e faqeve (të paprekshme)

Asnjë reklamë, kurrë:

```
/raporto           → formulari i raportimit
/ndihma            → qendra e ndihmës
/trackid           → ndjekja e rastit
/shendetesia       → regjistri shëndetësor
/donacion          → donacionet
/login  /register  → hyrja
/admin  /approvals → administrimi
```

### 4.2 — Kufijtë e densitetit

| Rregull | Vlera |
|---|---|
| Maksimum reklama për faqe | **2** |
| Maksimum reklama `top` për sesion | **1** |
| Distanca minimale mes reklamave | **1 ekran scroll** |
| Reklamë para përmbajtjes kryesore | **ndalohet** |
| Reklamë brenda formularit | **ndalohet** |

### 4.3 — Etika e përmbajtjes

- **Zero reklama politike.** Tashmë e deklaruar — duhet e zbatuar teknikisht.
- **Zero kripto, kredi të shpejta, baste, alkool.** Kategorikisht.
- **Etiketa "SPONSORIZUAR"** — e dukshme, jo 9px e zbehtë.
- **Reklamat vendore përparësi** — biznesi i Prishtinës para markës globale.
  Kjo përputhet me misionin dhe shitet më lehtë.

---

## 5. Modeli i të ardhurave (i qëndrueshëm)

Me 4 pozicione në vend të 17, të ardhurat nga bannerat bien. Kompensohet me
**sponsorizime**, që sjellin më shumë dhe nuk dëmtojnë besimin:

| Modeli | Ku | Pse funksionon |
|---|---|---|
| **Sponsor i rubrikës** | "Lajmet e Komunave — sponsorizuar nga X" | Marka lidhet me temën, jo me apelin |
| **Partner i verifikuar** | Drejtoria e kontakteve | Biznesi lokal që ofron shërbim real |
| **Grant komunal** | Komunat paguajnë për transparencë | Modeli më i fortë: kush përfiton, paguan |
| **Banner i kufizuar** | Vetëm 4 pozicionet e mësipërme | I qetë, i pranueshëm |

**Parimi:** *Kush përfiton nga transparenca, e financoka atë — jo qytetari me
vëmendjen e tij.*

---

## 6. Zbatimi — hapat konkretë

### Hapi 1 — Bllokimi teknik (1 orë)
Në `AdBanner.tsx`, shto një listë të zezë rrugësh që kthen `null` menjëherë:

```ts
const AD_FREE_ROUTES = [
  '/raporto', '/ndihma', '/trackid', '/shendetesia', '/semundjet',
  '/donacion', '/login', '/register', '/admin', '/approvals',
];
if (AD_FREE_ROUTES.some(r => path.startsWith(r))) return null;
```

### Hapi 2 — Heqja e pozicioneve (30 min)
Fshi `<AdBanner>` nga:
- `HealthRegistryPage.tsx:1033`
- `DonationsPage.tsx:165, 523`
- `StatisticsPage.tsx:845`
- `IdeaPage.tsx:150`
- `DetailedRegistryPage.tsx:503`

### Hapi 3 — Kufizimi i `top` (30 min)
Në `AppLayout.tsx:201`, kushti:

```tsx
{['/', '/lajme', '/statistikat', '/projektet'].includes(location.pathname)
  && <AdBanner position="top" />}
```

### Hapi 4 — Pastrimi i pozicioneve (1 orë)
Në `AdminAds`, hiq `floating`, `modal`, `auth`, `map`, `banner` nga picker-i.

### Hapi 5 — Etiketa e dukshme (30 min)
"Ndrysho `text-[9px]` → `text-[11px]`, kontrast më i lartë, sfond i errët."

---

## 7. Rezultati i pritur

| | Para | Pas |
|---|---|---|
| Reklama në tur të plotë | ~17 | **4** |
| Faqe me reklama | 10 | **2** (Lajmet, Forumi) |
| Faqe të paprekshme | 0 | **10** |
| Besueshmëria e perceptuar | e ulët | e lartë |
| Të ardhurat | banner i shpërndarë | sponsorizim i përqendruar |

**Përfundim:** më pak reklama, më shumë vlerë. Platforma që mbron qytetarin në
momentin e nevojës është platforma që ai mbron me besim.

---

*Dokument vizionar — asnjë ndryshim kodi nuk është bërë. Për zbatim, konfirmo
hapat 1–5.*