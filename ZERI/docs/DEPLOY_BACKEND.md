# Deploying the backend (`/api`) so Google sign-in works on zeriqytetarve.com

## Easiest: Firebase App Hosting (uses your Firebase project and Gmail login)

1. Firebase Console → Build → **App Hosting** → *Get started* → connect GitHub repo
   `bardhiicloud-cell/zeri`, **root directory `ZERI`**, branch `main`.
   Backend ID: `zeri-api`. Deploy.
   (`apphosting.yaml` in `ZERI/` already sets the environment.)
2. Create the secret once (terminal with the Firebase CLI, logged in with your Gmail):
   ```
   npm i -g firebase-tools
   firebase login
   firebase use gen-lang-client-0907710011
   firebase apphosting:secrets:set firebase-service-account
   ```
   Paste the full JSON of a service-account key (Project settings → Service accounts →
   Generate new private key). Then delete the downloaded file.
3. When the deploy finishes, copy the backend URL App Hosting shows
   (`https://zeri-api--<something>.hosted.app`) and send it to me.
   I then add the `/api/*` redirect to `netlify.toml`.

---

Netlify hosts only the static site. `/api/v1/*` (profile sync after Google sign-in, reports,
forum, payments, admin) is the Express server in `server.ts`. Until it is deployed, Google
sign-in ends with "serveri ktheu gabim (404)".

The server runs on **Google Cloud Run** in the same Google project as Firebase
(`gen-lang-client-0907710011`). Netlify then forwards `/api/*` to it, so the browser still
talks to zeriqytetarve.com only (no CORS surprises).

## One-time setup (Google Cloud Shell or any machine with `gcloud`)

1. Billing must be on for the project (Blaze plan). Cloud Run has a free tier.
2. Enable services:
   ```
   gcloud config set project gen-lang-client-0907710011
   gcloud services enable run.googleapis.com cloudbuild.googleapis.com secretmanager.googleapis.com artifactregistry.googleapis.com
   ```
3. Service-account key (Firebase Console → Project settings → Service accounts → Generate new
   private key). Store it as a **secret**, never in git or in chat:
   ```
   gcloud secrets create firebase-service-account --data-file=serviceAccountKey.json
   gcloud secrets add-iam-policy-binding firebase-service-account \
     --member="serviceAccount:$(gcloud projects describe gen-lang-client-0907710011 --format='value(projectNumber)')-compute@developer.gserviceaccount.com" \
     --role=roles/secretmanager.secretAccessor
   ```
   Then delete the downloaded `serviceAccountKey.json`.

## Deploy (from the `ZERI/` folder)

```
gcloud run deploy zeri-api --source . --region europe-west1 --allow-unauthenticated \
  --set-secrets=FIREBASE_SERVICE_ACCOUNT=firebase-service-account:latest \
  --set-env-vars=NODE_ENV=production,CLUSTER_WORKERS=1,ALLOWED_ORIGINS=https://zeriqytetarve.com,PUBLIC_APP_URL=https://zeriqytetarve.com,FIREBASE_PROJECT_ID=gen-lang-client-0907710011,VITE_FIREBASE_DATABASE_ID=ai-studio-ba83412d-22cf-4764-9885-a01600d542ae \
  --memory=1Gi --min-instances=0
```

Copy the service URL it prints (`https://zeri-api-xxxxx-ew.a.run.app`).
Add any other variables the server needs from `.env.example` (mail, Paysera, Gemini...) with
`--set-env-vars` / `--set-secrets`; real secrets go to Secret Manager.

## Connect Netlify

In `netlify.toml` (repo root and `ZERI/`), add **above** the `/*` rule:

```
[[redirects]]
  from = "/api/*"
  to = "https://zeri-api-xxxxx-ew.a.run.app/api/:splat"
  status = 200
  force = true
```

Push to `main`; Netlify redeploys. Then in Firebase Console → Authentication → Settings →
Authorized domains, make sure `zeriqytetarve.com` is listed (needed for the Google pop-up).

## Check

`curl -i -X POST https://zeriqytetarve.com/api/v1/auth/sync` must answer **401** (not 404).
