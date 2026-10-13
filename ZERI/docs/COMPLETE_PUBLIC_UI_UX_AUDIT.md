# Public UI/UX audit

Audit date 2026-10-13. Scope: the public site only. Admin, agent, municipality, monitoring and moderation screens were not redesigned.

**Scope statement.** The brief asks for a complete redesign of every public page. What was delivered is a **truthfulness and integrity pass over every public route, plus a rebuild of the five pages whose problem was structural** (Contact, Help, Projects, Donations' application flow, Ideas). It is not a visual redesign of the whole site: the existing look (hero, cards, palette) was kept, and homepage, report form, map, statistics, registry and forum layouts were not redesigned. See "Not done".

Status words: **Implemented** = changed in code. **Tested** = exercised (unit test and/or browser). **Partial** = some of it. **Blocked** = needs a decision, data or an integration. **Not implemented**.

## Method
1. Route inventory from `src/App.tsx` (PUBLIC_ROUTE_INVENTORY.md).
2. Source read of every page that shows facts, numbers, contacts, fees, downloads or submissions, looking for: client-made identifiers, success messages without a write, hardcoded statistics, sample data, invented contacts, and writes the Firestore rules deny.
3. Fixes, each kept small and reversible; unit tests for every new server path.
4. Browser checks against the running dev server: 24 public routes at 320 px (horizontal overflow), German at 320 px on four pages, form validation and failure paths, accessibility counts.

## Baseline
- Working tree was already dirty with 100+ files from other sessions; nothing here reverts or commits their work.
- `tsc --noEmit` clean at start and end. `vitest run tests/server tests/lib`: 698 passing at start, **717 at the end**. `vite build` and an esbuild bundle of `server.ts` succeed.
- Not run: Firestore emulator suites (`npm run test:rules`), Playwright-type end-to-end, Lighthouse.

## Findings that were fixed (P0/P1)

| # | Page | Defect | Fix |
|---|---|---|---|
| 1 | Contact | Reference invented in the browser, success toast, nothing sent | Real endpoint, reference = stored id (Implemented, Tested) |
| 2 | Contact | Invented toll-free number, email, office hours, "48 hour" promise | Removed (Implemented) |
| 3 | Ideas | Direct browser write to `platformIdeas`; no rule, so every submission was denied | Server endpoint (Implemented, Tested) |
| 4 | Services | Same for `platformFeedback` | Server endpoint (Implemented, Tested) |
| 5 | Donations | Public application wrote `donationCauses` from the browser; the rule allows only a superadmin, so every application failed | Server endpoint, stored as `pending` regardless of body (Implemented, Tested) |
| 6 | Donations | Every card labelled "Rast Prioritar", "Ndihmë Urgjente", "● AKTIVE"; modal said donating helps "the whole community"; a made-up 50/50 split suggestion; dead `#` links | Replaced by "Miratuar për publikim" and the date, explicit note that donations happen on an external page, dead links replaced by a disabled note (Implemented) |
| 7 | Services | "Shkarko Formularin PDF" button with no file | Replaced by an honest note + link (Implemented, Tested) |
| 8 | Services | Fees (1 €, 4 €, 10 €, 1 €/m²), deadlines ("10 min", "48-72 h"), required-document lists, an unverified `tatimineprone-rks.org` link, an "e-Komuna soon" promise | All removed; municipal entries keep title/department/description and link to e-Kosova (Implemented) |
| 9 | Homepage | Invented national numbers 1.248 / 742 / 436 when reports had not loaded, plus `DEMO_REPORTS` rows shown as real | Real counts or "—"; honest loading/error/empty states (Implemented) |
| 10 | Homepage | Status badge mapped Assigned, Overdue, Closed to "Të raportuar" | Uses the canonical status label and tone (Implemented) |
| 11 | Homepage | "Ideas bank" with invented ideas, votes (184, 142), donation causes presented as ideas, "Mbi 24 ide të pranuara këtë muaj" | Replaced by a plain call to action (Implemented) |
| 12 | Homepage / Track-ID | Example Track-ID "ZQ-4587" (invalid; the real format is `ZQ-YYYYMMDD-…`) with quick buttons that always failed | Removed, correct example (Implemented) |
| 13 | Every page (footer), ad areas, Partners | The same sample values were also saved in the live `settings/general` document, so a code-only fix was not enough: they are now filtered by `placeholderContacts.ts` (2 unit tests, browser-verified). Placeholder phone `+383 44 123 456`, email `privatisi@zeriqytetare.republiks` (invalid TLD), `reklama@qytetari.ks` | Removed; contact buttons render only when the owner configured a value (Implemented, browser-verified for the footer) |
| 14 | Projects | Nine municipal "projects" with budgets, contractors, progress and impact claims, and six platform "initiatives" with invented completion percentages — no data source exists | Page rebuilt as a directory of the real platform modules; honest empty state for municipal projects (Implemented, Tested) |
| 15 | Municipalities | ~19 municipalities got generated population "12,000+", area "180 km²", phone `+383 (0) 38 200 12 345`, made-up email and website; mayors may be stale after the 2025 elections | Generated values removed; mayor, phone, email no longer shown; notice added (Implemented) |
| 16 | Contact numbers | Ministry/municipality/utility numbers and emails look generated (patterns like `038 200 xx000`, `…001`); a made-up entry for the platform itself | Platform entry removed; prominent "not verified" notice; only 112/192/193/194 are stated as national numbers (Partial; **Blocked** on a verified dataset) |
| 17 | About | "30 seconds", "100% anonymous", "100% radical transparency", "SLA guaranteed", "before/after photos open to all", React/Firebase "millisecond" claims | Rewritten to what the product does (Implemented) |
| 18 | Partners | "100% creatives reviewed", "22 languages" (actual: 23 options) | Removed / computed (Implemented) |
| 19 | Polls | "100% guaranteed security & anonymity", "fully anonymous votes" (votes are stored per voter id) | Replaced by the real rule (one vote per account) (Implemented) |
| 20 | Health registry | Success toast after a failed save of the donation link; "notification sent to hospital" when the platform sends nothing; copy saying "every citizen can click Contribute" while cases are private | Fixed (Implemented) |
| 21 | Track-ID | Hero claimed an email confirmation exists; it does not | Fixed (Implemented) |
| 22 | Report confirmation | Copy button failed silently; no explanation of what happens next | Feedback + "what happens now" box (Implemented) |
| 23 | Help | Page was a six-link launcher with unrelated counts | Real help centre: 12 searchable articles, status table built from the real status vocabulary, honest "what we can't answer yet" list (Implemented, Tested) |

## What was inspected and found sound
- **Report submission** (`ReportIssue.tsx`): the Track-ID is shown only after the write succeeds; failed uploads are reported and the draft is preserved; a duplicate suggestion is the citizen's choice. Not redesigned.
- **Track-ID lookup**: server allow-list, uniform not-found, per-IP limits, no private fields.
- **Polls**: votes go through the server; one vote per account.
- **Health registry privacy**: Firestore rules give no public read; only the owner or health staff.
- **Login**: password reset is shown as sent only after `sendPasswordResetEmail` resolves.

## Not done
- Visual redesign of the homepage, report form, map, statistics, registry, news and forum. Layouts were only checked for horizontal overflow.
- Public detail pages (report, project, service, partner, campaign, article) — none exist, none created.
- Forum: another session edits `ForumPage.tsx` concurrently, so it was left alone.
- Languages other than Albanian, English and German for the new copy (they fall back to Albanian).
- Lighthouse, bundle-size and re-render work; screen-reader testing; contrast measurement.

## Files changed (this pass)
New: `server/contactMessages.ts`, `server/publicSubmissions.ts`, `src/lib/publicSubmit.ts`, `src/lib/publicPagesTranslations.ts`, `tests/server/contactMessages.test.ts`, `tests/server/publicSubmissions.test.ts`.
Edited: `server.ts` (route registration), `src/lib/dt.ts` (one lookup), `src/lib/store.ts` and `src/App.tsx` (empty ad-contact defaults), `src/lib/data/contacts.tsx` (one entry removed), `src/components/AppFooter.tsx`, `src/components/AdBanner.tsx`, `src/components/dashboard/DashboardEngagementBlock.tsx`, and pages `Dashboard`, `KontaktPage`, `CitizenHelpCenterPage`, `ProjektetPage`, `DonationsPage`, `IdeaPage`, `SherbimetPage`, `KomunatPage`, `ContactNumbersPage`, `RrethProjektitPage`, `PartnersPage`, `PollsPage`, `TrackIdPage`, `HealthRegistryPage`, `ReportIssue`.
Several of these were already modified by other sessions, so `git diff` mixes their work with this pass.

## Admin regression check
Nothing under `src/components/admin/`, `AdminPanel`, `MunicipalityPanelPage`, `MonitoringPage`, `server/approvalPipeline.ts`, `firestore.rules` or role/policy files was edited. Shared files (`store.ts`, `AdBanner.tsx`, `App.tsx`) only lost three invented default strings. `AdminAds.tsx` still seeds the same placeholders when ad settings are saved (admin scope; reported).

## Phase 2 — visual redesign ("Aura")
Everything above was a truthfulness pass. This phase replaced the look of the public pages, except the homepage (left untouched on request).

- **Design system:** `src/styles/aura.css` + `src/components/aura/Aura.tsx` (hero with glow, grid and an icon orbit; compact tiles, chips, lists, inputs, buttons). One type scale (13/15/17/20-24 px body and section titles, 32-52 px hero title), hairline borders, soft shadows, all colours from variables that switch with day/night. Motion is short and disabled under `prefers-reduced-motion`. The earlier "Futura" kit was removed.
- **Redesigned (new composition):** Contact, Help centre (search in the hero, status track), Projects (orbit icons are real links), Services, Ideas, About, Donations (photo-led cards), Partners/Ads, News (masthead, sticky filters, lead story), Health registry (hero + body: steps strip, figures strip, toolbar, tiles).
- **Restyled through the shared `PageHero` and local headers:** Public registry, Track-ID, Municipalities, Contact numbers, Polls, Statistics, Transparency; the report form got the compact heading scale and tile chrome. The map and the homepage were not changed.
- **Checked:** `tsc` clean, 750 unit tests pass, no horizontal overflow at 360 px on the 10 main pages and on the pages restyled last (one registry reading was lost to a reload and not repeated); day and night both seen on Contact, Projects and Health; English and German strings for all redesigned pages (0 missing in the audited files).
- **Not done:** the homepage and map; screen-reader testing; the other 21 languages for new copy; visual review of every state (dialogs, empty/error states) of the restyled-by-wrapper pages.
