# Firewall Editorial

> Kufiri i pandryshueshëm midis *klientit* dhe *subjektit të raportimit*.
> Ky dokument është tekst zyrtar: pjesë e **Kushteve të Përdorimit**,
> **Politikës Editoriale** dhe **Kontratës me Komunën**.

---

## 1. Parimi themelor

Platforma **Zëri i Qytetarëve** financohet pjesërisht nga abonime komunale.
Kjo krijon konflikt të natyrshëm: **klienti është edhe subjekti i raportimit**.

Pa një kufi të qartë, herën e parë që një raport zyrtari të ketë për turp,
presioni vjen — një telefonatë, një aluzion për "rishqyrtim kontrate" — dhe
ankesa e një qytetari zhduket në heshtje.

**Firewall Editorial është ai kufi, i shprehur në kod, jo në premtim.**

---

## 2. Asimetria

E gjithë politika është një dallim i vetëm:

> **Komuna mund të SHTOJË kontekst. Komuna nuk mund të HEQË përmbajtje.**

| | Veprimi | Efekti |
|---|---|---|
| ✅ **SHTON** | Përgjigje, dokument, korrigjim fakti | Pa shtypje ndaj qytetarit |
| ❌ **HEQ** | Fshirje, fshehje, ndryshim, censurim | **Shtyp gjithmonë** |

Çdo rregull më poshtë është rast i këtij parimi të vetëm.

---

## 3. Çka MUND të bëjë komuna

### ✅ 3.1 Të korrigjojë të dhëna faktike

Kur komuna vërteton se një detaj është **faktikisht i gabuar** — data, adresa,
numri i rastit — mund të paraqesë korrigjim.

**Procesi:** Kërkesa regjistrohet → shqyrtohet nga redaksia → nëse vërtetohet,
korrigjimi **shtohet** përbri raportit origjinal. **Origjinali nuk fshihet.**

---

### ✅ 3.2 Të dërgojë përgjigje zyrtare

Çdo raport pranon një përgjigje zyrtare nga komuna përkatëse. Përgjigjja shfaqet
**direkt nën raport**, me emrin e institucionit dhe vulën e komunës.

**Kjo është kanali kryesor.** Përgjigjja nuk e zëvendëson raportin —
qytetari e lexon të dyja.

---

### ✅ 3.3 Të ngarkojë dokumente

Akta, vendime, foto të punimeve, raporte inspektimi, fatura.

**Statusi:** "Dokument zyrtar i ngarkuar nga Komuna X" + data.

---

### ✅ 3.4 Të kundërshtojë një raport

Kur komuna konsideron se raporti është i pasaktë ose i pabazuar, mund të
**kundërshtojë zyrtarisht**.

**Efekti:** Fillon shqyrtim nga redaksia. Kundërshtimi **shfaqet publikisht**
përbri raportit, me arsyetimin. Nëse redaksia e pranon, raporti shënohet si
"Kundërshtuar nga komuna — në shqyrtim". **Nuk fshihet.**

---

### ✅ 3.5 Të kërkojë korrigjim kur ka gabim faktik

E njëjta si 3.1, por me theks në **gabimin e provuar**. Kërkesa duhet të
përmbajë: fushën e gabuar, vlerën e saktë, burimin e verifikimit.

---

## 4. Çka NUK MUND të bëjë komuna

> **Asnjë nga këto nuk është e mundur teknikisht.** Nuk është çështje leje që
> mund të kërkohet — butoni nuk ekziston, dhe serveri e refuzon edhe nëse
> dërgohet direkt.

### ❌ 4.1 Të fshijë raport qytetari sepse nuk i pëlqen

**Pse:** Ky është rasti klasik i censurimit. Një raport i vërtetë nuk fshihet
sepse është i pakëndshëm.

**Mbrojtja:** `delete_report` → `FIREWALL_DENIED`. Regjistrohet përpjekja.

---

### ❌ 4.2 Të ndalojë publikimin e kritikës

**Pse:** Platforma ekziston për kritikë konstruktive.

**Mbrojtja:** Nuk ka mekanizëm aprovimi para publikimit për raportet e qytetarëve.

---

### ❌ 4.3 Të zgjedhë cilat raportime lejohen

**Pse:** Zgjedhja e përmbajtjes = kontrolli i narrativës.

**Mbrojtja:** Radha e raporteve është kronologjike, jo e filtruar nga komuna.

---

### ❌ 4.4 Të ndryshojë rezultatet

**Pse:** Rezultatet e sondazheve, statistikat dhe statuset janë të dhëna publike.

**Mbrojtja:** `alter_outcome`, `alter_statistic` → `FIREWALL_DENIED`. Të dhënat
janë append-only.

---

### ❌ 4.5 Të blejë pozicionim editorial

**Pse:** Buxheti i abonimit nuk blen pozicion në lajme, në renditje, ose në faqe
kryesore.

**Mbrojtja:** `buy_editorial_position` → `FIREWALL_DENIED`. Advertiser dhe
subscriber janë kategori të ndara; abonimi nuk prek përmbajtjen.

---

### ❌ 4.6 Të kërcënojë me ndërprerje kontrate për shkak të një raportimi

**Pse:** Ky është presion ndaj pavarësisë editoriale.

**Mbrojtja:**
1. Përpjekja e tillë regjistrohet dhe **shfaqet në raportin vjetor të
   transparencës**.
2. Shkelje materiale e kontratës → komuna humb profilin, pa rimbursim.
3. Themeluesit nuk mund të fshijnë këtë regjistër — është append-only.

---

## 5. Zbatimi teknik

### 5.1 Në kod

`src/lib/editorialFirewall.ts` është burimi i vetëm i së vërtetës:

```ts
evaluateEditorialAction(user, 'delete_report')
// → { allowed: false, code: 'FIREWALL_DENIED', reason: '...' }
```

**Leja e serverit është autoritare.** Verifikimi në klient vetëm fsheh butonat.

### 5.2 Në server

Çdo endpoint që prek përmbajtjen kontrollon firewall-in **para** çdo shkrimi:

```ts
const decision = evaluateEditorialAction(user, 'delete_report');
if (!decision.allowed) {
  auditDenied(user, decision);   // regjistrohet përgjithmonë
  return res.status(403).json({ error: decision.reason });
}
```

### 5.3 Regjistri i pandryshueshëm

`src/lib/editorialLog.ts` regjistron **çdo veprim, përfshirë refuzimet**:

```ts
appendEditorialEvent({ kind: 'action_denied', attemptedAction: 'delete_report', ... })
```

**Nuk ekziston `update` ose `delete`** — vetëm `append`. Ky është regjistri që
gjykatat dhe gazetarët kërkojnë.

---

## 6. Juridiksioni

Komuna vepron **vetëm brenda komunës së vet**. Përpjekja për të komentuar raport
të komunës fqinje refuzohet me `OUT_OF_JURISDICTION`.

**Pse:** Pa këtë, një llogari e paguar e një komune mund të ndërhynte në punët e
fqinjit — mënyrë e lirë për të penguar.

---

## 7. Transparenca publike

### 7.1 Raporti vjetor

Çdo vit, platforma publikon:

| Metrika | Shembull |
|---|---|
| Përgjigje komunale të publikuara | 1,240 |
| Korrigjime fakti të pranuara | 87 |
| Kundërshtime të shqyrtuara | 34 |
| **Përpjekje për fshirje — të refuzuara** | **12** |
| Komuna me përpjekje të refuzuara | 3 |

**Përpjekjet e refuzuara publikohen.** Ky është frenimi më i fortë i mundshëm.

### 7.2 Në faqen e çdo raporti

- ✅ Shfaqet: "Përgjigjur nga Komuna X më [data]"
- ✅ Shfaqet: "Kundërshtuar nga Komuna X — në shqyrtim"
- ❌ **Nuk shfaqet** asgjë rreth përpjekjeve për fshirje **individuale** —
  ato grupohen në raportin vjetor, për të mbrojtur raportuesin anonim.

---

## 8. Çka ndodh nëse komuna kërcënon

1. **Regjistrohet** automatikisht çdo përpjekje e refuzuar.
2. **Njoftohet** bordi editorial i pavarur.
3. **Vlerësohet** nga këshilli i platformës.
4. **Shkelje materiale** → pezullim i llogarisë, pa rimbursim, njoftim publik.
5. **Përsëritje** → ndërprerje përfundimtare.

**Klauzola kontraktuale:** Komuna pranon që abonimi nuk jep kontroll editorial
dhe që kërcënimi me ndërprerje për shkak të një raportimi është shkelje
materiale.

---

## 9. Përmbledhje

| Komuna MUND | Komuna NUK MUND |
|---|---|
| Të korrigjojë të dhëna faktike | Të fshijë raport sepse nuk i pëlqen |
| Të dërgojë përgjigje | Të ndalojë publikimin e kritikës |
| Të ngarkojë dokumente | Të zgjedhë cilat raportime lejohen |
| Të kundërshtojë një raport | Të ndryshojë rezultatet |
| Të kërkojë korrigjim | Të blejë pozicionim editorial |
| | Të kërcënojë me ndërprerje kontrate |

> **Parimi:** Kush përfiton nga transparenca, e finansoka atë. Por **kush
> financon, nuk e kontrollon.**

---

*Dokument zyrtar. Pjesë e: Kushteve të Përdorimit §7, Politikës Editoriale §3,
Kontratës me Komunën §4.*