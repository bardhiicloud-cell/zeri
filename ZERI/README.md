<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/ba83412d-22cf-4764-9885-a01600d542ae

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies: `npm install`
2. Set `GEMINI_API_KEY` in `.env.local` if you need Gemini features.
3. Run the app: `npm run dev`

## Test the complete admin panel locally

The local prototype uses the existing `/admin` panels against Firebase Auth, Firestore, and Storage Emulators. No Firebase Console account, service-account key, deployed rules, or production database is used. Emulator writes are disposable and never leave `127.0.0.1`.

**Prerequisites:** Node.js, Java 21+, and `npm install`.

Start the isolated environment:

```powershell
npm run dev:admin-prototype
```

Open `http://127.0.0.1:3010/login` and use:

- Email: `admin@kosova.com`
- Password: `admin123`

The launcher seeds test users, agent activity, reports, health cases, work facts, support chats, notifications, polls, news, ads, and other records before starting the existing admin interface. Changes persist while the emulator is running and reset after it stops. The production `firebase.json`, `firestore.rules`, and `storage.rules` remain unchanged.

On this Windows workspace, the launcher detects Java 21 in `%USERPROFILE%\\.kombai\\tools\\temurin-21`; elsewhere set `JAVA_HOME` or `PROTOTYPE_JAVA_HOME` to a Java 21 installation. If the launcher reports a port conflict, stop the process using ports 8080, 9099, 9199, or 3010 before retrying.
