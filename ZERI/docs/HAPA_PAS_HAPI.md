# HAPA PAS HAPI — DERI NË PUBLIKIM FINAL

> Udhëzues operacional. Ekzekuto komandat në radhë. Pas secilës ka **çka duhet të shihësh** —
> nëse s'të del ajo, ndalo dhe ma trego gabimin.

---

## HAPI 0 — Përgatitja e makines (5 min)

```powershell
# 1. Kontrollo që je në dosjen e saktë
cd c:\Users\bardh\OneDrive\Desktop\ZERI\ZERI

# 2. Kontrollo Node
node --version
```

**Duhet të shohësh:** `v20.x` ose më i ri.

---

## HAPI 1 — Ndalo serverin lokal (1 min)

Para build-it të prodhimit, mbyll dev serverin:

```powershell
Get-NetTCPConnection -LocalPort 3002 -State Listen -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
Write-Output "serveri u mbyll"
```

**Duhet të shohësh:** `serveri u mbyll`.

---

## HAPI 2 — Build final i prodhimit (3 min)

```powershell
npm ci
npm run build
```

**Duhet të shohësh:**
- `npm ci` — pa gabime
- `✓ built in ~10s` nga Vite
- `server.cjs` kompilon me esbuild

Pastaj verifiko dist-in:

```powershell
Get-ChildItem dist -Name | Select-Object -First 12
```

**Duhet të shohësh:** `index.html`, `server.cjs`, `favicon.svg`, `robots.txt`, `sitemap.xml`, `assets/`.

---

## HAPI 3 — Cila platformë publikimi? (vendim)

Këshilloj **Cloud Run** (i njëjti server Express + API në një vend, meFirestore/Admin SDK gati). Alternativa: Railway, Render, Fly.io — të gjitha funksionojnë me `dist/server.cjs`.

### Nëse Cloud Run (rekomandohet):

```powershell
# 3a. Instalo gcloud (vetëm njëherë) — shkarko nga https://cloud.google.com/sdk/docs/install

# 3b. Kyçu
gcloud auth login
gcloud config set project <PROJEKTI_JOT>   # gen-lang-client-0907710011

# 3c. Deploy (vetëm rreshti i parë është i ngadalshëm, pastaj ~5 min)
gcloud run deploy zeri-qytetareve `
  --source . `
  --region europe-west1 `
  --allow-unauthenticated `
  --memory 512Mi `
  --set-env-vars NODE_ENV=production
```

⚠️ Kujdes: `--source .` ngarkon gjithë dosjen — sigurohu që `.gcloudignore` përmban
`node_modules`, `.env.local`, `serviceAccountKey.json`. KRIJOJE para deploy-it (Hapi 3d).

### Hapi 3d — Mbroj sekretet para deploy-it (E DOMOSDOSHME):

```powershell
@"
node_modules
dist
.env
.env.local
serviceAccountKey.json
firebase-debug.log
*.log
qa
"@ | Set-Content .gcloudignore
```

**Duhet të shohësh:** fajllin `.gcloudignore` krijuar në rrënjë.

⚠️ PËRSËRITJE: pa këtë hap, sekretet e tua (service account!) ngarkohen në cloud pa dashje.

---

## HAPI 4 — Sekretet në Cloud Run (5 min)

Service account NUK duhet të jetë në git/cloud asnjëherë. Në Cloud Run, sekretet jepen me:

```powershell
# 4a. Krijo sekretin në Secret Manager (vendos JSON-in e service account-it)
gcloud secrets create firebase-sa --data-file=serviceAccountKey.json

# 4b. Lidhe me shërbimin
gcloud run services update zeri-qytetareve `
  --region europe-west1 `
  --set-secrets=FIREBASE_SERVICE_ACCOUNT=firebase-sa:latest
```

Pastaj te `server.ts` (ose env), lexoje si: `process.env.FIREBASE_SERVICE_ACCOUNT`
(nëse kodi yt e lexon si file, më trego dhe e përshtatim te Hapi 8 — kjo s'është ende e lidhur).

---

## HAPI 5 — Firestore Rules + Indexes (2 min)

```powershell
firebase deploy --only firestore:rules,firestore:indexes
```

**Duhet të shohësh:** `✔ Deploy complete!` dhe rregullat e reja në console.

Nëse hedh gabim indekse, Firebase Console → Firestore → Indexes → shtoji sipas udhëzimit.

---

## HAPI 6 — Firebase Console (me dorë, 15 min)

Hap https://console.firebase.google.com → projekti yt:

1. **Authentication → Settings → Authorized domains** → shto URL-në e Cloud Run (`zeri-qytetareve-xxxx.a.run.app`)
2. **Authentication → Sign-in method** → kontrollo: Email/Password ✓, Google ✓, Anonymous ✓
3. **Firestore → Rules** → verifiko datën e fundit të publikimit
4. **Storage → Rules** → deploy nga `storage.rules` (nëse s'është)
5. **Billing** → duhet plani **Blaze** (jo Spark — Spark bllokon Cloud Run + kufij leximi)

---

## HAPI 7 — Krijo adminin e parë (2 min)

```powershell
# Regjistrohu normalisht në faqe, pastaj merr UID-në:
node -e "
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./serviceAccountKey.json')) });
admin.auth().setCustomUserClaims('<UID_JOT>', { admin: true, superadmin: true });
console.log('Admin u krijua');
"
```

**Duhet të shohësh:** `Admin u krijua`. Pastaj dil-hyr në faqe — paneli `/admin` hapet.

---

## HAPI 8 — Verifikimi im i fundit (5 min) — MË TREGO ÇKA SHEH

Kur deploy mbaron, trego URL-në (p.sh. `https://zeri-qytetareve-xxxx.a.run.app`) dhe
**ekzekuto këto 5 teste** në browserin tënd:

| # | Testi | Hapi | Kalon nëse |
|---|---|---|---|
| 1 | Health | hap `URL/api/health` | `{"status":"ok","dataSource":"firestore"}` |
| 2 | Home | hap URL-në | faqja ngarkohet, pa blank |
| 3 | Raportim testues | bëj raportim | Track ID shfaqet |
| 4 | Admin | ndrysho statusin | njoftimi duket te zilja |
| 5 | Guest | dil, hap /admin | "Qasje e Mohuar" |

Nëse të 5 kalojnë — **je LIVE.** Nëse ndonjë dështon, ma trego gabimin ekzakt.

---

## HAPI 9 — Backup + Monitoring (pas publikimit)

```powershell
# Backup i parë
gcloud firestore export gs://<BUCKET_BACKUP> --project=<PROJEKTI_JOT>

# UptimeRobot: shto monitor për URL/api/health — interval 5 min
```

Vendimi i mbetur (jo sot): Sentry për error tracking; og:image 1200×630; kod OTP me email.

---

## TL;DR — rendi i komandave

```
1. mbyll serverin lokal
2. npm ci && npm run build
3. krijo .gcloudignore → gcloud auth login → gcloud run deploy
4. sekretet me Secret Manager
5. firebase deploy --only firestore:rules,firestore:indexes
6. Firebase Console: authorized domains + billing Blaze
7. script-i për admin claims
8. 5 testet e verifikimit
9. backup + UptimeRobot
```

Pas hapit 8 je **live**. Pas hapit 9 je **gati për përdorues realë**.
