aj v# UDHËZUESI I PUBLIKIMIT — Zëri Qytetarëve

> Shtesë e `PLAN_PUBLIKIMIT.md`. Ky dokument është procedura operacionale për t'i çuar
> platformën live. Çdo hap ka komandën e saktë dhe çfarë duhet verifikuar para se të kalojë më tej.

---

## 1. VENDIMET E MUNDA NDRYSHOHET NGA OWMER-I (5 minuta)

### 1.1 Domaini i prodhimit
`SITE_ORIGIN` te `src/lib/seo.ts` është `https://zeriqytetare.republiks` — placeholder.
Ndryshoje në domainin e vërtetë në 4 vende:
- `src/lib/seo.ts` → `SITE_ORIGIN`
- `index.html` → canonical, hreflang, og:image
- `public/robots.txt` → rreshti `Sitemap:`
- `public/sitemap.xml` → secili `<loc>`

### 1.2 Fqinjësia e admin accounts
Krijoj llogari admin me Firebase Admin SDK (një script i vogël):

```bash
node -e "
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./serviceAccountKey.json')) });
admin.auth().setCustomUserClaims('<UID>', { admin: true });
"
```

---

## 2. KONFIGURIMI I MJEDISIT (10 minuta)

### 2.1 Server-side sekrete (`.env.local`, JO i komprometueshëm)
Këto MUNDET NDRYSHOHET, s'i prek gjë — janë të sakta:

| Variabla | Përdorimi |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | Admin SDK (server) |
| `FIREBASE_ADMIN_PROJECT_ID` | Projekti Firestore real |
| `GEMINI_API_KEY` / `OPENAI_API_KEY` | Asistencë AI |
| `NODE_ENV=production` | Ky është ndryshimi kryesor |

### 2.2 Client-side (`.env`, publike by design)
Firebase Web API keys janë **publike** — kufizohen te Firebase Console → Authentication → Settings → Authorized domains.
Shto domainin e prodhimit aty, ndryshe auth dështon në prodhim.

---

## 3. NDËRTIMI (5 minuta)

```bash
npm ci
npm run build
```

Verifiko: `dist/server.cjs`, `dist/index.html`, `dist/favicon.svg`, `dist/robots.txt`, `dist/sitemap.xml` ekzistojnë.

---

## 4. PUBLIKIMI (Cloud Run — rekomandohet)

```bash
gcloud run deploy zeri-qytetareve \
  --source . \
  --region europe-west1 \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production,FIREBASE_ADMIN_PROJECT_ID=<projekti> \
  --memory 512Mi
```

`trust proxy 1` tashmë është konfiguruar te serveri — Cloud Run e kërkon.

---

## 5. FIRESTORE — RULES + INDEXES

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

Verifiko në Firebase Console → Firestore → Rules: `rules_version = '2'`, data e publikimit e re.

---

## 6. FIREBASE CONSOLE — 5 HAPA ME DORË (15 minuta)

1. **Authentication → Settings → Authorized domains**: shto domainin e prodhimit
2. **Authentication → Sign-in method**: email/password + Google + Anonymous — të gjitha të aktivizuara
3. **Firestore → Usage**: kontrollo planin e pagesave (jo Spark free — Spark ka kufi leximi)
4. **Storage → Rules**: deploy nga `storage.rules`
5. **Custom claims për admin**: script-i nga 1.2

---

## 7. BACKUP I PARË (para se të shkojë live)

```bash
gcloud firestore export gs://<bucket-backup> \
  --project=<projekti>
```

Planifikon backup të përditshëm me Cloud Scheduler → `gcloud firestore export`.

---

## 8. MONITORING (10 minuta)

### 8.1 Uptime
Shto në [UptimeRobot](https://uptimerobot.com) ose Better Stack:
```
https://<domain>/api/health
```
Interval: 5 min. Alert nëse `status != "ok"` ose HTTP != 200.

### 8.2 Error tracking (vendim manual)
Sentry ose GlitchTip nuk është i lidhur. Kur të vendosësh:
1. Krijo projekt te sentry.io
2. `npm i @sentry/react`
3. `Sentry.init({ dsn: '<dsn>' })` te `src/main.tsx`, para `ReactDOM.createRoot`
4. `Sentry.init({ dsn: '<dsn>' })` te `server.ts`, para të gjitha ruteve

### 8.3 Analytics
`react-ga4` tashmë është i lidhur — verifiko që matur vetëm me cookie consent (`useAnalyticsConsent` e bën këtë).

---

## 9. TESTIMI PAS PUBLIKIMIT (checklist)

| Test | Si | Kalon nëse |
|---|---|---|
| Health | `curl https://<domain>/api/health` | `status: "ok"` |
| HTTPS | `curl -I https://<domain>` | 301/200, HSTS header |
| Raportim real | Bëj një raportim testues nga UI | Track ID shfaqet |
| Njoftim mysafiri | Ndrysho statusin e raportit testues | Zilja tregon njoftimin |
| Admin gate | Hap `/admin` pa llogari | "Qasje e Mohuar" |
| Dark mode | Ndrysho temën në 3 faqe | Asnjë tekst i palexueshëm |
| Mobile | Hap nga telefoni | Pa overflow, butonat funksionojnë |
| SEO | `view-source:` → kontrollo canonical | Unik per faqe |
| robots | `curl https://<domain>/robots.txt` | Sitemap-URL e saktë |

---

## 10. ÇFARË NUK MUNDET TË BËHET NGA KËTU (pengesa reale)

Ky sandbox nuk ka internet. Çdo verifikim kundrejt Firestore real (`firestore.googleapis.com`)
kthehet `ERR_ABORTED`. Pra këto **duhet** bërë nga një makinë me internet:

1. `npm run build` final nga makina jote (këtu kaloi, por riprovoje)
2. `firebase deploy --only firestore:rules`
3. `gcloud run deploy` ose hosting i zgjedhur
4. Backup-i i parë i Firestore
5. Testi end-to-end: raportim → ndryshim statusi → njoftim te zilja
6. Vendosja e domainit të prodhimit te Firebase Authorized domains

Kodi është gati për të gjitha këto. Mungon vetëm ekzekutimi i jashtëm.
