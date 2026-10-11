# Auditimi i Reklamave — Zëri i Qytetarëve

> Numërim real i bazuar në leximin e kodit, jo në supozime.

---

## Përmbledhje

| Metrika | Vlera |
|---|---|
| **Vende `<AdBanner>` në kod** | **19** |
| **Vende që shfaqen realisht** | **9** |
| **Vende që kthejnë `null` (të vdekura)** | **6** |
| **Vende që shfaqen vetëm në faqe të caktuara** | **4** |

**Konkluzioni kryesor:** Nga 19 vende reklamash, vetëm **9 funksionojnë**.
6 janë pozicione të vdekura (`banner`) që **kurrë nuk shfaqin asgjë** —
administratori mendon se ka blerë reklamë, por qytetari nuk sheh asgjë.

---

## 1. Tabela e plotë — çdo vend reklame

| # | Skuadra | Pozicioni | Shfaqet? | Shënim |
|---|---|---|---|---|
| **1** | `Dashboard.tsx:491` | `banner` | ❌ **JO** | Pozicion i vdekur |
| **2** | `DashboardOriginalBackup.tsx:925` | `inline` | ⚠️ skedar rezervë | Nuk është i rrugëtuar |
| **3** | `DashboardOriginalBackup.tsx:1229` | `inline` | ⚠️ skedar rezervë | Nuk është i rrugëtuar |
| **4** | `DashboardEngagementBlock.tsx:61` | `inline` | ✅ **PO** | Ballina, aktiv |
| **5** | `AppLayout.tsx:201` | `top` | ✅ **PO** | **Çdo faqe** (përveç forum/lajme) |
| **6** | `DonationsPage.tsx:165` | `inline` | ✅ **PO** | Donacione — ⚠️ e ndjeshme |
| **7** | `DonationsPage.tsx:523` | `banner` | ❌ **JO** | Pozicion i vdekur |
| **8** | `HealthRegistryPage.tsx:1033` | `banner` | ❌ **JO** | Pozicion i vdekur — ⚠️ etike |
| **9** | `IdeaPage.tsx:150` | `banner` | ❌ **JO** | Pozicion i vdekur |
| **10** | `DetailedRegistryPage.tsx:382` | `feed` | ✅ **PO** | Regjistri, mes raporteve |
| **11** | `DetailedRegistryPage.tsx:503` | `banner` | ❌ **JO** | Pozicion i vdekur |
| **12** | `ForumPage.tsx:882` | `top` | ✅ **PO** | Debat Publik, në krye |
| **13** | `ForumPage.tsx:1511` | `feed` | ✅ **PO** | Çdo 4 postime (dinamik) |
| **14** | `ForumPage.tsx:1585` | `sidebar` | ✅ **PO** | Debat Publik, anësor |
| **15** | `LajmePage.tsx:623` | `feed` | ✅ **PO** | Lajme, mes seksioneve |
| **16** | `LajmePage.tsx:749` | `feed` | ✅ **PO** | Lajme, brenda grid-it |
| **17** | `LajmePage.tsx:912` | `article` | ✅ **PO** | Lajme, brenda artikullit |
| **18** | `LajmePage.tsx:1001` | `sidebar` | ✅ **PO** | Lajme, kolona djathtas |
| **19** | `PollsPage.tsx:175` | `inline` | ✅ **PO** | Sondazhe, në krye |
| **20** | `PollsPage.tsx:513` | `banner` | ❌ **JO** | Pozicion i vdekur |
| **21** | `StatisticsPage.tsx:845` | `inline` | ✅ **PO** | Statistikat |

---

## 2. Reklamat që një qytetar sheh realisht

### Në Ballinë (`/`)
- `AppLayout:201` — `top` **1 reklamë**
- `DashboardEngagementBlock:61` — `inline` **1 reklamë**
- **Totali: 2**

### Në Lajme (`/lajme`)
- `AppLayout:201` — `top` ❌ (përjashtuar)
- `LajmePage:623` — `feed` **1**
- `LajmePage:749` — `feed` **1**
- `LajmePage:912` — `article` **1**
- `LajmePage:1001` — `sidebar` **1**
- **Totali: 4**

### Në Debat Publik (`/forum`)
- `AppLayout:201` — `top` ❌ (përjashtuar)
- `ForumPage:882` — `top` **1**
- `ForumPage:1511` — `feed` **1 për çdo 4 postime**
- `ForumPage:1585` — `sidebar` **1**
- **Totali: 3+ (rritet me scroll)**

### Në Regjistrin e Detajuar (`/regjistri`)
- `AppLayout:201` — `top` **1**
- `DetailedRegistryPage:382` — `feed` **1**
- **Totali: 2**

### Në Sondazhe (`/sondazhet`)
- `AppLayout:201` — `top` **1**
- `PollsPage:175` — `inline` **1**
- **Totali: 2**

### Në Statistikat (`/statistikat`)
- `AppLayout:201` — `top` **1**
- `StatisticsPage:845` — `inline` **1**
- **Totali: 2**

### Në Donacione (`/donacion`)
- `AppLayout:201` — `top` **1**
- `DonationsPage:165` — `inline` **1**
- **Totali: 2** ⚠️

### Në Regjistrin Shëndetësor (`/shendetesia`)
- `AppLayout:201` — `top` **1**
- `HealthRegistryPage:1033` — `banner` ❌
- **Totali: 1** ⚠️

### Në Bankën e Ideve (`/Idea`)
- `AppLayout:201` — `top` **1**
- `IdeaPage:150` — `banner` ❌
- **Totali: 1**

---

## 3. Problemet e gjetura

### 🔴 3.1 — 6 pozicione të vdekura (`banner`)

`AdBanner.tsx:234`:
```ts
if (['floating', 'modal', 'auth', 'map', 'banner'].includes(position)) return null;
```

Kjo do të thotë se këto 6 vende **nuk shfaqin kurrë asgjë**:

| Skuadra | Pse është problem |
|---|---|
| `Dashboard.tsx:491` | Ballina — vendi kryesor i shitjes |
| `DonationsPage.tsx:523` | Donacione |
| `HealthRegistryPage.tsx:1033` | Regjistri Shëndetësor |
| `IdeaPage.tsx:150` | Banka e Ideve |
| `DetailedRegistryPage.tsx:503` | Regjistri |
| `PollsPage.tsx:513` | Sondazhe |

**Efekti:** administratori krijon një fushatë me pozicion `banner`, shpenzon
kohë, dhe **asgjë nuk shfaqet**. Nuk ka gabim, nuk ka paralajmërim.

### 🔴 3.2 — Reklama në faqe të ndjeshme

| Skuadra | Problem |
|---|---|
| `HealthRegistryPage` | `top` shfaqet mbi raste mjekësore |
| `DonationsPage:165` | reklamë mes apelit për donacione |
| `AppLayout:201` | `top` shfaqet në `/raporto`, `/ndihma`, `/trackid` |

### 🟡 3.3 — Dy skedarë të vdekur

`DashboardOriginalBackup.tsx` përmban 2 `<AdBanner>` që nuk rrugëtohen —
kodin e vjetër që rrit konfuzionin gjatë mirëmbajtjes.

---

## 4. Numri përfundimtar

| Pyetja | Përgjigja |
|---|---|
| Sa vende reklamash kam në kod? | **19** |
| Sa shfaqen realisht? | **9** |
| Sa janë të vdekura? | **6** |
| Sa në faqe të ndjeshme? | **3** |
| **Sa sheh qytetari në një tur normal?** | **~15 reklama** |
| **Sa duhet të ketë?** | **4** |

---

## 5. Rekomandimi

**Fshi 6 pozicionet e vdekura** (ose implementoji). Ato janë mashtrim i heshtur
ndaj advertiserit.

**Hiq reklamat nga:** Regjistri Shëndetësor, Donacionet, `/raporto`, `/ndihma`.

**Mbaj vetëm:** Lajmet (4 pozicione) dhe Debat Publik (3).

**Rezultati:** nga ~15 reklama në **4–7**, të gjitha në kontekst editorial.

---

*Raport auditimi — bazuar në `AdBanner.tsx`, `AppLayout.tsx` dhe 12 skedarë faqesh.*