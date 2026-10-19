# Lidhja e serverit `/api` (10 minuta, pa kartë)

Faqja zeriqytetarve.com punon edhe pa server: raportet ruhen, admini aprovon/refuzon
drejtpërdrejt, lajmet publikohen. Caktimi i agjentëve, detyrat, emailet dhe historia e plotë
e vendimeve kërkojnë serverin. Për ta lidhur:

1. **render.com** → *Sign in with GitHub* → **New → Blueprint** → repo `bardhiicloud-cell/zeri`, branch `main` → *Apply*.
2. Te shërbimi **zeri-api** → **Environment** → `FIREBASE_SERVICE_ACCOUNT` = i gjithë JSON-i i çelësit
   (Firebase Console → Project settings → Service accounts → *Generate new private key*). Ruaj.
3. Kopjo adresën e shërbimit (p.sh. `https://zeri-api.onrender.com`).
4. GitHub → repo `zeri` → **Settings → Secrets and variables → Actions → Variables → New variable**:
   emri `API_BASE_URL`, vlera adresa nga hapi 3 (pa `/` në fund).
5. GitHub → **Actions → Deploy to Firebase Hosting → Run workflow**. Pas 2 minutash faqja përdor serverin.

Punëtori "Keep the API awake" e mban serverin zgjuar çdo 10 minuta, që faqja të mos presë 30–60 sekonda.

## Rolet e administratorëve

Nëse admini hap panelin por nuk mund të aprovojë ("Kjo llogari nuk ka të drejtë…"):
GitHub → **Actions → Sync admin roles → Run workflow**. Pastaj dilni dhe kyçuni përsëri.
