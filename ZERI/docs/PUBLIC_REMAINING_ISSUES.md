# Remaining issues and blockers

## 1. Before the new endpoints do anything
- **Restart or deploy the server.** `POST /api/v1/public/{contact,ideas,feedback,donation-applications}` exist only after a restart. The shared dev server returned 404 for them (the pages handled it correctly), so the success path is verified by unit tests, not end to end against Firestore.
- **Admin inboxes.** `contactMessages`, `platformIdeas` and `platformFeedback` have no admin screen. Donation applications do (`AdminDonations`). Until an inbox exists, an operator must read the rest in the Firebase console, and the on-page wording deliberately promises no response time.

## 2. Data that cannot be fixed by code
- **`settings/general` in Firestore still contains the sample ad contacts** (`+383 44 123 456`, `reklama@qytetari.ks`, `+38344123456`), saved there by the admin ad-settings form. The public site now ignores those exact values (`src/lib/placeholderContacts.ts`, applied in `App.tsx`, `AdBanner.tsx`, `PartnersPage.tsx`; verified in the browser: no `tel:`, `wa.me` or `mailto:` for them remains), but the owner should replace or clear them in the admin, and `AdminAds.tsx` should stop seeding them.
- **Verified contact details** for the platform and for institutions. The repo contains none that can be trusted; `src/lib/data/contacts.tsx` still holds ~100 ministry/municipality/utility numbers and emails that look generated. The page carries a "not verified" notice. Replace with the admin-maintained `contacts` collection (`/api/public/contacts`, already cached) or an official list.
- **Municipal project data** (budget, contractor, progress): no source exists; the Projects page says so.
- **Service catalogue facts** (fees, deadlines, documents): removed; they must come from the institutions.
- **Mayors, population, area** for the municipality cards: population/area kept as labelled reference for the ~20 hand-written entries; mayors are no longer shown.

## 3. Defects found, not changed
- `donationCauses` is `read: if true`, so pending/rejected applications are readable through the Firestore API. Fixing needs a rule change plus changing the public listener to `where('status','==','approved')` and a separate admin listener.
- `ReportIssue.tsx`: direct-write fallback after a server failure can duplicate a report (different ids); an AI "forensics" score blocks submission with no appeal.
- Health registry: unauthenticated submissions are accepted but the submitter has no way to look the case up; CSV export contains PII (own data only).
- `AdminAds.tsx` seeds the placeholder ad phone/email on save.
- Repeated signed-out `permission-denied` console errors.

## 4. Not done
Visual redesign of homepage, report form, map, statistics, registry, news, forum; per-item detail pages; Lighthouse/bundle work; screen-reader testing; viewports other than 320 px and the desktop pane; the 21 other languages for new copy; emulator rules tests (`test:rules`) were not run.

## 5. Business decisions
- Citizen reopening of closed reports (no control exists; none added).
- Whether ideas should be public, voted on, or given a status.
- Whether guest health submissions should remain possible.
- Whether donation campaigns need receipts/transparency data (the page is informational only; it takes and records no payment).
