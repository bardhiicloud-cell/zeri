# Public feature functionality matrix

Audit 2026-10-13. Legend: **OK** works as described, verified by reading the code and, where noted, running it. **Fixed** was broken or false and was changed. **Found** a defect, not changed. **Gap** missing capability.
"Tested" = unit test (`vitest`) and/or browser run against the dev server on :3020, which predates the new API routes, so success paths of the new endpoints are covered by unit tests only.

| Feature | Real behavior | Status | Evidence |
|---|---|---|---|
| Contact form | Persists to `contactMessages` through `POST /api/v1/public/contact`; reference = stored id; rate limited; honeypot; field errors; failure keeps input | Fixed | 7 unit tests; browser: validation, focus, failure path, 320 px |
| Idea submission | `POST /api/v1/public/ideas`; author from verified token only | Fixed | 3 tests; browser failure path |
| Service feedback | `POST /api/v1/public/feedback` | Fixed | tests |
| Donation application | `POST /api/v1/public/donation-applications`; always `pending`; media must be an image/video data URI under the body limit; link must be http(s) | Fixed | 2 tests. Admin queue (`AdminDonations`) already lists `pending` causes |
| Donation page | Informational: each campaign links to an external page; no payment is taken or recorded here; page now says so | Fixed | browser |
| Donation campaign list | Shows only `approved`; **pending/rejected docs are still world-readable in Firestore** (rule is `read: if true`) | Found | `firestore.rules:427`, `App.tsx` listener |
| Report submission | Track-ID only after a persisted write; uploads reported individually; draft kept on failure | OK | code read |
| Report submission fallback | If the server route fails the client writes directly with its own generated id; a network failure after the server created the document can leave two documents | Found | `ReportIssue.tsx:801-872` |
| AI forensics block | A low "authenticity score" blocks submission with no appeal path | Found | `ReportIssue.tsx:636` |
| Track-ID lookup | Allow-list API, uniform not-found, rate limits | OK | `tests/server/trackLookup.test.ts` |
| Report reopening | No citizen reopen control exists; none was added | Gap (business decision) | |
| Public report detail page | Does not exist (modal and registry only) | Gap | |
| Homepage numbers | Real loaded public reports or "—"; no demo rows | Fixed | browser |
| Homepage status badges | Canonical labels | Fixed | |
| Help centre | 12 articles, search, categories, status table, gaps list | Fixed | browser: search "foto" → 4 results; 320 px; German |
| Projects | Directory of real modules; no invented data | Fixed | browser |
| Services catalogue | No fees/deadlines/forms; links to e-Kosova or the contacts register | Fixed | browser |
| Municipalities | Generated data removed; notice | Fixed | browser (German, 320 px) |
| Contact numbers | 112/192/193/194 plausible; everything else unverified, now labelled so | **Blocked** (needs a verified dataset; admin `contacts` collection exists and is cached at `/api/public/contacts` but the page does not read it) | |
| Polls | Server-side vote, one per account | OK / copy fixed | |
| Health registry | No public read; owner/staff only; copy fixed; donation-link save no longer lies | Fixed | code |
| Health registry CSV export | Exports the owner's own cases including name, phone and diagnosis | Found (acceptable only because it is the owner's own data) | `HealthRegistryPage.tsx:421` |
| Guest health submission | Rules allow unauthenticated submissions; the submitter cannot see or track it afterwards | Found (design gap) | rules |
| Footer / ad contacts | No invented values | Fixed | browser |
| Partners page | "Partners" are ad campaigns flagged by the admin; claims removed | Fixed | |
| News (Lajme) | Real articles; demo articles and promo cards only in DEV builds | OK | `import.meta.env.DEV` guards |
| Map, Statistics, Registry | Data-driven; not audited beyond overflow | Unaudited | |
| Forum | Server APIs, moderation; being edited by another session | Unaudited | |
| Login / Register | Reset mail shown only after success | OK | |
| Languages | Albanian complete; English and German added for 211 new/missing strings (0 missing in the audited files); other 21 languages fall back to Albanian | Partial | key check script; German rendered on 4 pages |

## Needs an owner decision
- Who reads `contactMessages`, `platformIdeas`, `platformFeedback`: no admin screen exists, so until one does the pages must not imply a response.
- Verified public contact details for the platform (email, phone, address, hours).
- Whether pending donation causes should stop being world-readable (requires changing the rule and the two Firestore listeners together).
- Where verified institution/municipality contact data comes from.
