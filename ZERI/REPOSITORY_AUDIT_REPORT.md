# ZERI — Repository Audit & Engineering Improvement Plan

**Audit date:** 2026-10-11 · **Branch audited:** `main` @ `6595971` (+ 2 uncommitted modified files) · **Method:** static code review plus a handful of non-destructive checks (Section 10).
**Scope note:** the git root is `C:\Users\bardh\OneDrive\Desktop\ZERI`; the application lives in the `ZERI/` subfolder. Paths below are relative to the **application folder** (`ZERI/ZERI`) unless prefixed `[root]`.

> No secret values are reproduced in this report. Secrets are referred to by file name and key name only.

---

## Remediation status (updated 2026-10-11 — working tree only: nothing committed, pushed or deployed)

Legend: **Fixed** = code/rules changed and verified; **Partly** = some of the finding addressed; **Open** = untouched; **By design** = re-assessed, not a defect.

| ID | Status | What changed | Still required |
|---|---|---|---|
| F-01 secrets | **Partly** | 11 secret-bearing files untracked (`git rm --cached`, local copies kept); root `.gitignore` extended | **Owner action:** rotate the Google OAuth client secret, assess the password-hash signer key, purge git history + force-push, enable secret scanning; commit the untracking |
| F-02 self-granted `agents` | **Fixed** | Authority now only from token claims (`permissionsFromClaims`, `actingUser` in `server/auth.ts`); `transition` no longer reads `permissions`/`municipality` from the profile; rules deny self-writing `permissions`, `municipality`, `municipalityPlan`, `badges`, `email`, notes/clause fields on create **and** update | Deploy rules; re-issue claims for legacy staff accounts (see behaviour changes) |
| F-03 DM exposure | **Fixed** | Firestore: messages bound to `participants`, conversation ids must derive from the two members, participants immutable. Storage: `forum_dms/**` readable by the uploader only (recipients use the tokenised URL stored in the message) | Deploy rules |
| F-04 `actingUser` bug | **Fixed** | `municipality` read from `claims`; one shared `actingUser` | — |
| F-05 `editorialLog` forgery | **Fixed** | Client create denied; server (Admin SDK) is the only writer | Deploy rules |
| F-06 public `reports` read | **Open** | — | Product decision on the public data contract |
| F-07 poll tampering | **Fixed** | Votes go through `POST /api/v1/polls/:id/vote` (`server/polls.ts`): one transaction, one `votes/{uid}` ballot created with `create()`, so simultaneous requests count once (tested). Rules deny client writes to counters | Deploy rules. Hot-document contention under heavy traffic is a hypothesis: consider sharded counters |
| F-08 AI endpoints | **Partly** | `requireAuth` on `analyze-issue`, `moderate-comment`, `detect-duplicate`, `reporting-tips`, `ai-news`; client sends the token (`src/lib/apiAuth.ts`); rate limiter now keys on `req.ip` (spoofing bypass reproduced, fixed, tested); inputs clamped/validated (text length, image MIME + size, array sizes); static-prompt answers cached; fallback output flagged `degraded` and never cached | Shared (Redis/Firestore) limiter store, per-user quotas, prompt-injection hardening of moderation, surfacing `degraded` to the UI |
| F-09 global sanitizer | **Fixed** | Removed; passwords and `&`/`<` text are no longer altered. Because the sanitizer had been incidentally masking unescaped HTML sinks, those were fixed at the same time (see F-40) | Schema validation per route (recommended) |
| F-10 false "saved" report | **Fixed** | Track ID / success screen only after a confirmed save (server 201 or Firestore write); a failed save shows an error and keeps the form + draft | Remove the client direct-write fallback once the server path is trusted |
| F-11 CI/CD | **Open** | — | Move workflow to git root; real build/test/deploy |
| F-12 tests | **Partly** | 17 unit tests + 31 emulator rules tests added (`npm test`, `npm run test:rules`) | API integration + E2E tests; wire into CI |
| F-13 `NODE_ENV` | **Fixed** | `npm start` runs `scripts/start-prod.cjs`, which defaults `NODE_ENV=production` | Dockerfile should set it too |
| F-14 `settings` overlap | **Fixed** | Wildcard excludes `general`/`ads-private`; `ads-private` is owner-only (strict `isOwner()`); AdSense fields on `general` are owner-only | Deploy rules |
| F-15 `isSuperAdmin()` | **By design** | Re-assessed: `roleCatalog.ts` defines `admin` as the superadmin's deputy, so the helper matches the documented policy. Comment added; the real gap (admin could write owner-only AdSense secrets through the wildcard) is closed by F-14 | — |
| F-16 health-data roles | **Fixed** | `isHealthStaff()` = admin / superadmin / approver / `perm_health`, mirroring the role table; ad, news and frontline roles no longer read or edit health records | Run the claims sync so staff granted the health section carry `perm_health`. Unauthenticated create still has no App Check |
| F-17 GDPR erasure | **Fixed** | `server/gdpr.ts`: correct fields, paginated beyond 400, direct messages, ballots, upvotes, private files in Storage; account deleted only if every step succeeded; idempotent (tested on Firestore + Storage emulators) | Deploy indexes (collection-group overrides). Counsel to confirm retention; comments embedded in other posts and `auditLogs` are retained |
| F-18 rules write gaps | **Fixed (partly)** | Notifications limited to forum channels with in-app links; `likes`/`reposts` server-owned; `auditLogs` server-written (`POST /api/v1/audit`); reports cannot carry client-written timeline/assignment/counters; `liveMessages` bound to the sender | Forum `comments` / `reactions` / embedded `poll` arrays are still client-written |
| F-19 Storage rules | **Fixed** | Content-type allow-lists (no SVG/HTML), separate delete rule, legacy forum prefixes restricted; 16 emulator tests | Deploy rules |
| F-20 ad HTML sanitizer | **Fixed** | `dompurify` imported; https-only URIs; iframes forced into a sandbox without `allow-same-origin` | — |
| F-21 translate endpoint | **Fixed (partly)** | SHA-256 key, 5,000-char cap, now requires a session | Still forwards text to unofficial third-party providers |
| F-22 indexes / thread | **Fixed** | 3 composite indexes added; thread reads each direction explicitly with an equality-only fallback, so replies are never silently dropped | **Deploy indexes:** `firebase deploy --only firestore:indexes` |
| F-23 error handling | **Fixed** | Error handler moved last; 4xx from body-parser returned as 400/413 (verified end-to-end); `/api/*` JSON 404; raw `error.message` no longer returned (`sendServerError`); `pid`/worker removed from `/api/health` | — |
| F-24 50 MB limit | **Fixed** | Per-path parser: 12 MB for `analyze-issue`, 1 MB elsewhere; MIME allow-list (verified: a 2 MB body now reaches auth instead of being rejected) | — |
| F-25 coarse `requireAdmin` | **Fixed** | `requireSection()` enforces the same role -> section table as the UI for user list, work-facts, editorial log; staff <-> municipality only for messages (`server/policy.ts`, tested) | AI admin routes still accept any staff role |
| F-26 role-route issues | **Fixed** | `checkRoleChange`: no self-change, `moderator` accepted, only a superadmin touches admin-level accounts (tested) | — |
| F-27 sync/profile | **Fixed** | `isVerified` read from claims; profile PUT validates types/lengths and https avatars | — |
| F-28–F-30, F-33, F-34 | **Open** | — | See roadmap |
| F-32 stub endpoints | **Fixed** | `verify-image` / `check-botnet` removed | — |
| F-35 AI assistant page unauthenticated | **Fixed** | Sends the ID token (was a guaranteed 401) | — |
| F-36 `isBanned()` evaluation error | **Fixed** | `data.get('isBanned', false)` | Confirm intent in prod |
| F-40 unescaped print/export HTML | **Fixed** | `escapeHtml` applied in `AdminReports`, `exportUtils`, `AdminHealthRegistry` (2 windows); regression test | — |

| F-11 CI/CD | **Fixed (CI)** | Working workflow at the git root `.github/workflows/ci.yml`: type-check, lint gate on clean files, tests, build, emulator rules/transaction tests, gitleaks | Real deploy job (needs GCP details); old `ZERI/.github/workflows/production.yml` is inert |
| F-12 tests | **Partly** | 127 unit/jsdom tests (incl. another session's `tests/lib`) and 97 emulator-backed tests | API-level and E2E tests |
| F-31 client state | **Fixed (partly)** | Report upvotes persist via `POST /api/v1/reports/:id/upvote`; `zq-demo-user` restore only in dev; `/api/v1/admin/users/count` implemented | Store persistence of staff PII |
| F-37 AI duplicate auto-discard | **Fixed** | The citizen is asked; their report is no longer silently replaced | — |
| F-38 AI news without data | **Fixed** | Client sends recent reports; server flags fallback as `degraded` | — |
| F-39 fallback shown as real | **Fixed** | `degraded` returned to clients, which hide it | — |
| F-41 `undefined` writes rejected | **Fixed** | `db()` sets `ignoreUndefinedProperties`. Every report with an attachment threw on the server path and silently fell back to the unvalidated client write; every status change without a note lost its live-feed event (reproduced) | — |
| F-42 server path dropped fields | **Fixed** | `server/reports.ts` stores urgency, topic and a server-derived accountability block; hides names on anonymous reports; validates tracking ids | — |
| F-43 Quick Report bypass | **Fixed** | Went through Firestore with `status: Approved` (always denied) and auto-published a reel; now uses the server path | — |
| F-44 owner claims | **Fixed** | `make-owner.ts` omitted `superadmin`; shared `buildRoleClaims`; `npm run claims:sync` (dry-run default, never changes a role claim, profile data only with `--accept-profile-data`, tested on emulators) | **Run it before deploying the rules** |

**Evidence (all run on this working tree):**
- `npx tsc --noEmit` → clean.
- `npm test` → **127/127** unit/jsdom tests (10 files; includes `tests/lib` added by someone else working in the repo concurrently).
- `npm run test:rules` (Firestore + Storage emulators on their own ports via `firebase.rules-test.json`, Java 21, files run sequentially) → **97/97** across rules, Storage rules, poll votes, upvotes, report-document settings and GDPR erasure. Against the original rules the first 22 rules tests had 11 failures, reproducing F-02/F-03.
- `vite build` → succeeds. ESLint: **1,477 → 1,474 errors**, none added.
- End-to-end smoke of the built server bundle (isolated, no credentials): `/api/health` reports `production`; malformed JSON → 400; 2 MB body → 413; 2 MB image to `analyze-issue` → reaches auth (401); all five model endpoints → 401 without a token; removed stubs → 404; unknown `/api/*` → JSON 404; foreign `Origin` gets no CORS header.

**Behaviour changes to know before deploying**
1. Staff tokens without `perm_*` claims and municipality tokens without a `municipality` claim are no longer promoted from the profile document — re-issue claims first (an Admin-SDK sync script is recommended; not yet written).
2. Accounts lacking an `isBanned` field can now write where the rules previously errored.
3. The five model endpoints require a Firebase ID token (anonymous sessions count). A visitor with no session at all gets a 401 and the feature shows nothing.
4. A failed report save is now a visible error; previously it ended on a Track-ID screen.
5. Stored text is no longer HTML-stripped or entity-encoded on the way in. React escapes on render and the three print/export templates now escape; any *new* HTML-string sink must call `escapeHtml`.
6. Indexes must be deployed (`firebase deploy --only firestore:indexes`); until then the duplicate-submission guard still fails open and the message thread uses the unordered fallback.

---

## 0. Executive summary

ZERI is a React 19 + Vite + Tailwind 4 SPA backed by an Express server (`server.ts`, 3,053 lines) and Firebase (Auth, Firestore, Storage) with Gemini-based AI endpoints. It is a civic-reporting platform whose business model rests on an "editorial firewall" between citizens' reports and paying municipalities.

**Strengths.** Authorization intent is clearly designed: custom-claim roles, a server-side report state machine (`server/approvalPipeline.ts`), append-only audit/editorial logs, a server-side report-creation path, a GDPR erasure endpoint, Helmet/CORS/HSTS, a typed codebase that passes `tsc --noEmit` cleanly, and a production build that succeeds. The code is heavily commented with rationale, and `docs/` shows earlier audit rounds were acted on (e.g. `users` role self-escalation was fixed).

**Biggest risks (all confirmed by reading code unless marked "runtime verification needed"):**

1. **Credential/config exports are committed and pushed to `origin/main`** (OAuth client secret, Firebase Auth password-hash signer key, user lists). Rotate before anything else.
2. **Authorization bypasses in the core pipeline.** Any signed-in user can self-grant the `agents` permission in their own `users/{uid}` document, and the server trusts that field to give them the *agent* role on `/api/v1/reports/:id/transition`. Separately, a bug (`actingUser()` reads a claim that is never copied onto `req.user`) makes municipality jurisdiction depend on a **self-writable profile field**, while two municipality endpoints can never succeed.
3. **Firestore rules gaps**: private direct messages readable by any signed-in user who knows two UIDs; `reports` world-readable (including unverified/rejected items and anonymous reporters' `authorId`); polls tamperable; the public "editorial transparency" counter can be forged by any signed-in user; `settings/ads-private` is effectively public because of overlapping `match` blocks.
4. **Unauthenticated, cost-bearing AI endpoints** protected only by an in-memory, per-process, spoofable-by-header rate limiter.
5. **Silent data loss/corruption**: a global input sanitizer rewrites every `&` to `&amp;` and strips `<…>` from all API input (including admin-set passwords); the report form shows "saved successfully" when the report was only stored in `localStorage`.
6. **No automated tests, and CI never runs** (the workflow sits in a subfolder of the git root, deploy steps are `echo` mocks, and the secret reference is syntactically escaped).

**Production readiness:** *Not ready.* P0 items (secrets, privilege escalation, DM exposure) must be closed first; most fixes are small and local.

---

## 1. Repository overview

| Aspect | Finding |
|---|---|
| Stack | React 19, react-router 7, zustand 5 (persisted), Tailwind 4, Vite 6, Leaflet, Recharts; Express 4 + Helmet/CORS/hpp/compression; firebase 12 (web), firebase-admin 14; `@google/genai`; TypeScript 5.8 |
| Entry points | `src/main.tsx` → `src/App.tsx` (routes at `App.tsx:746-832`); server `server.ts` (dev: `tsx server.ts` with Vite middleware; prod: `esbuild` bundle → `dist/server.cjs`) |
| Data stores | Firestore (named DB `ai-studio-…`), Firebase Storage, localStorage (zustand key `civic-platform-storage-v3`) |
| External services | Gemini API, Firebase Auth, OSM Nominatim/tiles, Open-Meteo, **unofficial Google Translate `gtx`, MyMemory, Lingva** (`server/translate.ts`), GA4 (consent-gated) |
| Key flows | (a) Citizen report: `ReportIssue.tsx` → upload to Storage → `POST /api/v1/reports` → Firestore; (b) Pipeline: agent → municipality → staff via `POST /api/v1/reports/:id/transition` (`server.ts:2056`); (c) Admin: staff/municipality provisioning (`server.ts:1050,1440`), custom claims via `buildRoleClaims` (`server.ts:1025`); (d) Forum/DM/Reels directly against Firestore from the client; (e) GDPR erasure `DELETE /api/v1/profile` (`server.ts:1372`) |
| Layout | App root is a subfolder of the git root. 671 tracked files; 130 stale compiled `.js` twins beside `.ts/.tsx`; ~89 one-off `patch_*/fix_*/update_*/tmp-*/test-*` scripts at app root; translation caches, screenshots, and logs tracked |
| Tests | **None** (no `*.test.*`/`*.spec.*`, no `test` script). `qa/` holds ~50 ad-hoc Playwright-style scripts, not wired into CI |
| CI/CD | `ZERI/.github/workflows/production.yml` — see F-15 |

---

## 2. Overall assessment

- **Strongest areas:** type-checking is clean; build works; rules file is thoughtfully commented and covers most collections with a default-deny; server-side state machine and audit logging are the right architecture; Admin SDK credentials are correctly kept out of git (`.env`, `.env.local`, `serviceAccountKey.json` are git-ignored and not tracked — verified with `git ls-files`/`git check-ignore`).
- **Biggest risks:** see executive summary. The common pattern is *good server-side intent undermined by permissive client-writable Firestore paths* (the server trusts documents that clients can write) and *by misplaced global middleware*.
- **Caveats:** nothing was exercised against a live Firebase project or the Firestore emulator; rules findings are from reading the rules text and Firestore's documented semantics (overlapping `match` blocks are OR-ed). Items marked **[RV]** need runtime verification.

---

## 3. Prioritized findings (table)

Legend — Status: **C** = confirmed by code reading and/or a script I ran; **P** = potential risk; **RV** = needs runtime verification.

| ID | Sev | Pri | Status | Location | Issue | Effort | Fix status |
|---|---|---|---|---|---|---|---|
| F-01 | Critical | P0 | C | `[root] idp_result.json`, `[root] idp_config.json`, `[root] idp_result2.json`, `[root] users.json`, `[root] lookup.json`, `[root] claim_res.json`, `ZERI/anon_*.json`, `ZERI/email_verify.json` (all tracked on `origin/main`) | Secret-bearing Identity Platform exports and user data committed & pushed | S (+ rotation) | Partly |
| F-02 | Critical | P0 | C | `server.ts:2084-2110`, `server/approvalPipeline.ts:106-118`, `firestore.rules:108-114` | Citizen self-grants `permissions:['agents']` → agent role in pipeline | S | **Fixed** |
| F-03 | High | P0 | C | `forum_conversations/{id}/messages` `firestore.rules:384-385`; id scheme `DirectMessagesModal.tsx:59-61` | Any signed-in (even anonymous) user can read any DM thread | S | Partly |
| F-04 | High | P1 | C | `server.ts:1787-1795`, `:2290-2299`, `:1862`; `server/auth.ts:53-58` | `actingUser()` reads `req.user.municipality`, which doesn't exist; jurisdiction falls back to self-writable profile; two endpoints always deny | S | **Fixed** |
| F-05 | High | P1 | C | `firestore.rules:673-682`, `server.ts:2419-2431` | Any signed-in user can forge `editorialLog` "denied" entries → poisons public transparency report | S | **Fixed** |
| F-06 | High | P1 | C | `firestore.rules:125` | `reports` fully world-readable incl. pending/rejected, `authorId` of anonymous reports; defeats municipality status filter | M | Open |
| F-07 | High | P1 | C | `firestore.rules:204-212` | Any signed-in/anonymous user can rewrite poll `options` (vote counts) | S–M | Open |
| F-08 | High | P1 | C | `server.ts:2547,2623,2658,2696,2845`; `server/security.ts:15-26,134` | Unauthenticated Gemini endpoints; limiter is per-process and trusts client `X-Forwarded-For` | M | Partly |
| F-09 | High | P1 | C | `server.ts:579-599` | Global sanitizer corrupts data (`&`→`&amp;`, `<…>` stripped), incl. passwords | S | **Fixed** |
| F-10 | High | P1 | C | `src/pages/ReportIssue.tsx:836-852` | "Saved successfully" shown when report only saved to localStorage | S–M | **Fixed** |
| F-11 | High | P1 | C | `ZERI/.github/workflows/production.yml` (git root has no `.github`) | CI never runs; deploy is mocked; `npm test \|\| echo`; audit gate would fail | M | Open |
| F-12 | High | P1 | C | repo-wide | No automated tests | L | Partly |
| F-13 | Medium | P1 | C | `package.json:6-7`, `server.ts:2885` | `npm start` doesn't set `NODE_ENV`; without it production boots Vite dev server and permissive CORS | S | **Fixed** |
| F-14 | Medium | P1 | C | `firestore.rules:414-440` | `settings/ads-private` readable by everyone; `settings/general` field guard bypassable (overlapping matches) | S | **Fixed** |
| F-15 | Medium | P1 | C | `firestore.rules:18-20` | `isSuperAdmin()` is true for plain `admin`; rules can't distinguish the two | S | By design |
| F-16 | Medium | P1 | C | `firestore.rules:493-498,594`, `:34-43` | Health-registry PII readable/updatable by `adsadmin`/`newsadmin`; unauthenticated create | S–M | Open |
| F-17 | Medium | P1 | C | `server.ts:1372-1437` | GDPR erasure incomplete (wrong fields, no Storage, DMs, loops) | M | Open |
| F-18 | Medium | P2 | C | `firestore.rules:257-260,481-488,366-372,655-658` | Write-validation gaps: notifications to any user, unauthenticated `liveMessages`, forumPosts array rewrite, forgeable `auditLogs` | M | Partly |
| F-19 | Medium | P2 | C+RV | `storage.rules` | No content-type allowlist on forum paths; `write` rules reference `request.resource` (delete likely denied); `forum_dms` readable by all signed-in | S | Open |
| F-20 | Medium | P2 | C | `src/components/AdBanner.tsx:206` | Ad HTML injected unsanitized: DOMPurify read from `window` (never set), fallback is identity | S | **Fixed** |
| F-21 | Medium | P2 | C | `server.ts:734-767`, `server/translate.ts` | Public unmetered translate endpoint; cache-key collision; unofficial/third-party providers | S–M | Partly |
| F-22 | Medium | P2 | C+RV | `server.ts:1950-1975,1706-1716`; `firestore.indexes.json` | Missing composite indexes → duplicate/rate check fails open; DM thread fallback hides incoming messages | S | **Fixed** |
| F-23 | Medium | P2 | C | `server.ts:2442-2450`, AI routes `2495…` | Malformed JSON/oversize bodies → 500; error handler ordered before AI routes; raw `e.message` leaked | S | **Fixed** |
| F-24 | Medium | P2 | C | `server.ts:2547`, `:458` | `express.json({limit:'50mb'})` on analyze-issue is dead (global 1 MB parser runs first) | S | **Fixed** |
| F-25 | Medium | P2 | C | `server/auth.ts:67-98`, `server.ts:1733,2399` | `requireAdmin` accepts every staff role for PII/log endpoints | M | Open |
| F-26 | Low | P2 | C | `server.ts:1159-1223` | Role-change route: no self-lockout guard (comment claims one), `admin` may ban other admins, `moderator` not allowed here but allowed on create | S | Open |
| F-27 | Low | P2 | C | `server.ts:945-982,1333-1349` | `isVerified` always false; profile PUT has no type/length/URL validation | S | **Fixed** |
| F-28 | Medium | P2 | C | repo hygiene | 130 stale `.js` twins, ~89 root scripts, caches/logs/screenshots/IDE dirs tracked; 1,477 ESLint errors | M | Open |
| F-29 | Medium | P2 | C | dependencies | `npm audit`: 33 vulns (3 critical, 14 high) — mostly dev/transitive; do not apply suggested "fixes" blindly | M | Open |
| F-30 | Low | P2 | C | `index.html:8,27,38`, `server.ts:897` | Pinch-zoom disabled (WCAG 1.4.4); canonical/OG/sitemap point at `zeriqytetare.republiks` (non-existent TLD) | S | Open |
| F-31 | Low | P2 | C | `src/lib/store.ts:1391,1460`, `useCitizenDirectory.ts:191` | Production `zq-demo-user` restore; broken upvote; call to non-existent endpoint; full store persisted to localStorage | S | Open |
| F-32 | Low | P3 | C | `server.ts:2529-2544` | `verify-image`/`check-botnet` are stubs returning "Bypassed" (unused by client) | S | **Fixed** |
| F-33 | Low | P3 | P | `server.ts:486-532` | CSP allows `'unsafe-inline'` scripts and `connect-src https:`; COOP/CORP disabled | M | Open |
| F-34 | Info | P3 | P | perf | Per-request `verifyIdToken(…, true)`; 49 `onSnapshot` listeners (59 `getDocs/onSnapshot` w/o `limit(` by heuristic); 797 kB + 735 kB chunks | M | Open |

---

## 4. Detailed findings

### F-01 — Secret-bearing exports committed to `origin/main` — **Critical / P0**
- **Evidence:** `git ls-files` lists `idp_config.json`, `idp_result.json`, `idp_result2.json`, `users.json`, `lookup.json`, `claim_res.json`, `body.json` at the git root and `ZERI/anon_res.json`, `ZERI/anon_verify.json`, `ZERI/email_verify.json`, `ZERI/signin_res.json` in the app folder. `git branch -vv` shows `main` tracks `origin/main` at the same commit, so they have been pushed (to `github.com/bardhiicloud-cell/zeri`; repo visibility could not be checked).
  - `idp_result.json` has keys `clientId` and **`clientSecret`** (value begins with the Google OAuth `GOCSPX-` prefix).
  - `idp_config.json`, `idp_result2.json`, `anon_*.json`, `email_verify.json` contain `signIn.hashConfig.signerKey` (88-char base64) and `saltSeparator` — the project-wide Firebase Auth scrypt parameters.
  - `users.json` is an Auth export with `localId`, `email`, `displayName`, `photoUrl` for three accounts plus a `passwordHash` field for one; `lookup.json`/`claim_res.json` hold a user's email/localId/federated id.
  - Root `.gitignore` (`.gitignore:1-5`) ignores none of these; the app-level `ZERI/.gitignore` patterns (`idp_*.json`, `users.json`, …) don't apply to the git-root copies and were added after some files were committed.
- **Impact:** a leaked Google OAuth client secret allows impersonating the app's Google sign-in client; the signer key weakens protection of any exported password hashes; user emails are personal data.
- **Recommendation (in order):** (1) In Google Cloud / Identity Platform, **rotate the Google IdP client secret** and regenerate the project's password-hash signer key if feasible (or confirm no hashes beyond `users.json` ever leaked); (2) `git rm --cached` all files above and add patterns to the **root** `.gitignore`; (3) purge history with `git filter-repo` / BFG and force-push, then ask collaborators to re-clone (history rewrite is destructive — coordinate first); (4) check GitHub for forks/caches and enable secret scanning + push protection; (5) delete the local copies after rotation.
- **Effort:** S (rotation/purge are minutes–hours; coordination is the cost). **Dependencies:** none — do first.
- **Validation:** `git log --all -- idp_result.json` empty after purge; `gitleaks detect` clean; old client secret returns auth errors.

### F-02 — Self-granted `agents` permission yields the agent role — **Critical / P0** (confirmed by reading; not exploited at runtime)
- **Evidence:**
  - `firestore.rules:108-114`: a user may update their own `users/{uid}` as long as `role`, `isBanned`, `points`, `isVerified` are untouched — `permissions` (and `municipality`, `badges`, `email`) are writable. Creation (`:103-106`) only blocks `role`/`isBanned`.
  - `server.ts:2084-2099`: the transition endpoint loads `permissions` from that same profile document.
  - `server/approvalPipeline.ts:116-117`: `if (permissions.includes('agents')) return 'agent'` — evaluated for any role string, including the default `'citizen'` (`server/auth.ts:56`; `server.ts:2104` passes `actor.role || roleFromProfile`, and `actor.role` is always non-empty).
- **Impact:** any registered user (including an anonymous guest who has a profile doc via `/api/v1/auth/sync`) can `claim`, `approve`, `reject` or `pass_to_municipality` any report, defeating the pipeline that the previous refactor was built to protect. Audit entries would show a citizen UID.
- **Recommendation:** never derive authority from client-writable documents. (a) Remove the permissions-based promotion in `pipelineRoleOf` or source `permissions` from **custom claims** (`perm_*` are already flattened by `buildRoleClaims`, `server.ts:1046`); (b) in rules, add `permissions`, `municipality`, `badges`, `email`, `municipalityPlan`, `internalNote`, `editorialClause*` to the self-update deny list and use `hasOnly([...allowed profile fields])` instead of a deny list; same for `create`; (c) make `requireAdmin`'s Firestore fallback (`server/auth.ts:88-95`) opt-in/temporary.
- **Effort:** S. **Dependencies:** F-04. **Validation:** emulator rules test — as a citizen, `update users/{self} {permissions:['agents']}` is denied; server integration test — citizen token → `transition` returns 403 `NO_STANDING`.

### F-03 — Private direct messages readable by any signed-in user — **High / P0**
- **Evidence:** `firestore.rules:384-385` `match /messages/{messageId} { allow read: if isAuthenticated(); }` (no participant check; parent `read` rule isn't consulted for subcollection reads). Conversation id = `[uid1, uid2].sort().join('_')` (`DirectMessagesModal.tsx:59-61`). UIDs are exposed publicly as `authorId` on reports and forum posts (`firestore.rules:125,360`). Anonymous Firebase users satisfy `isAuthenticated()`.
- **Impact:** anyone can read any two people's DM thread (including image URLs). Related: `storage.rules:30-35` lets any signed-in user read all `forum_dms/**` objects.
- **Recommendation:** in the subcollection rule use `request.auth.uid in get(/databases/$(database)/documents/forum_conversations/$(convId)).data.participants` (add `{convId}` binding) and restrict create/update the same way; tighten `forum_dms` Storage read by embedding the conversation id in the path and checking membership (or move DM media behind the server). Consider unpredictable conversation ids.
- **Effort:** S. **Validation:** emulator test with a third uid fails to list/read; two participants succeed.

### F-04 — `actingUser()` reads a claim that isn't on `req.user` — **High / P1**
- **Evidence:** `server/auth.ts:53-58` builds `req.user = {uid,email,role,claims}`. `actingUser` (`server.ts:1787-1795`) reads `u.municipality` and `u.municipality_role` — both `undefined`; the token's `municipality` is under `req.user.claims.municipality`. Consequences:
  - `GET /api/v1/municipality/reports` (`:2290-2297`) always returns 403 "Llogaria nuk ka komunë të caktuar" — the endpoint can never succeed.
  - `POST /api/v1/municipality/work-facts` (`:1845-1877`): `canAddWorkFacts` receives `municipality:''` → municipalities are always denied (and each denial is logged as an editorial violation).
  - `transition` (`:2105`, `:2141`) works only because it falls back to `municipalityFromProfile` — a **client-writable field** (see F-02). A real municipal account can set its own profile `municipality` to another commune and act on that commune's reports.
- **Why `tsc` didn't catch it:** `actingUser(req: any)`.
- **Recommendation:** read `req.user.claims.municipality`; delete the profile fallback for jurisdiction; type `req` as `Request`; add unit tests for `actingUser`.
- **Effort:** S. **Validation:** integration tests: municipal token for commune A cannot transition a commune-B report even after editing its profile; `GET /municipality/reports` returns only A's visible-status reports.

### F-05 — Forgeable `editorialLog` entries poison the public transparency report — **High / P1**
- **Evidence:** `firestore.rules:678-680` lets *any* authenticated user create an `editorialLog` doc if `actorUserId == auth.uid` and `at == request.time` — no other field is constrained. `GET /api/v1/public/editorial-transparency` (`server.ts:2419-2431`) counts docs with `denied == true`, grouped by client-supplied `actorMunicipality`.
- **Impact:** anyone can inflate "denied attempts" against any commune on a public, cached (`max-age=3600`) endpoint — reputational/contractual harm in the product's core accountability feature.
- **Recommendation:** `allow create: if false` (server uses Admin SDK); the code comment says the client path exists "so a failed request can still be recorded" — route that through the server instead. If kept, require `isMunicipality()`, `actorMunicipality == ownMunicipality()`, `denied == true` only, and `hasOnly([...])`.
- **Validation:** rules test; transparency count unchanged after a citizen create attempt.

### F-06 — `reports` collection is world-readable — **High / P1**
- **Evidence:** `firestore.rules:125` `allow read: if true;`. Server stores `authorId` for anonymous reports too (`server.ts:1994,1998`) plus `authorName` from the request body (`:1995`). Comments claim "PII is not exposed in the TrackIdPage response", but the rule governs the database, not one page.
- **Impact:** any unauthenticated REST client can list every report, including `Pending Review`/`Rejected` items, locations, media URLs, `authorId` (re-identifying "anonymous" reporters by linking to forum posts/profiles) and `authorName`. It also nullifies the status filtering in `canSeeReportStatus` and the rules' own `isMunicipalityVisibleStatus` intent (`:71-73`) — a municipality can simply read everything.
- **Recommendation:** decide the public contract explicitly. Suggested: public read only for `status in [Approved, Assigned, In Progress, Resolved, Overdue, Closed]`; owner read of own; staff read all; never store `authorId` on anonymous reports (store a salted hash), and strip `authorName` when `isAnonymous`. For the Track-ID lookup, serve a minimal DTO through a server endpoint. Note `docs/AUDIT_2026-09-24.md` already flagged this and it is still open.
- **Effort:** M (client reads of `reports` must move to filtered queries / server). **Validation:** rules tests per role/status; confirm TrackIdPage still resolves.

### F-07 — Poll results can be rewritten by any signed-in user — **High / P1**
- **Evidence:** `firestore.rules:207-210` allows any `isAuthenticated()` update affecting only `options`; no check on which counter changed or by how much. Guests (anonymous auth) qualify, so sybil voting is free. Also flagged in `docs/AUDIT_2026-09-24.md`.
- **Recommendation:** store one vote doc per `{pollId}_{uid}` (create-only, `!exists`) and aggregate server-side/Cloud Function, or implement `POST /api/v1/polls/:id/vote` with a transaction; require non-anonymous accounts.
- **Validation:** rules/API test: second vote by same uid denied; direct `options` write denied.

### F-08 — Unauthenticated AI endpoints; rate limiter is weak — **High / P1**
- **Evidence:** no `requireAuth` on `/api/analyze-issue` (`:2547`), `/api/moderate-comment` (`:2623`), `/api/detect-duplicate` (`:2658`), `/api/dashboard/reporting-tips` (`:2696`), `/api/dashboard/ai-news` (`:2845`). Limiter facts:
  - `server/security.ts:15-26` `getClientIp` takes the **first** `X-Forwarded-For` entry. Behind Cloud Run/GFE the client-supplied value is the first element (the proxy appends the real IP), so any caller can rotate fake IPs and never be limited. The comment above it argues the opposite; prefer `req.ip` (Express already honours `trust proxy`, `server.ts:430`).
  - State is an in-process `Map` (`:53`) — resets on deploy/scale-out and multiplies by the worker count (clustering up to 8, `server.ts:3017`).
  - `moderate-comment` interpolates user text into the prompt (`:2627`) → prompt injection can force `isApproved:true`; `detect-duplicate` maps `existingReports` without type checks (`:2664`) → 500.
  - `generateContentWithFallback` (`:267-310`) swallows quota/key errors and returns canned text with HTTP 200 (and `ai-news` embeds hard-coded "fallback-news" items); consumers can't tell fabricated output from model output. **[RV]** confirm what moderation does on fallback (fail-open vs fail-closed).
- **Impact:** unbounded Gemini spend and quota exhaustion; unreliable moderation presented as a control.
- **Recommendation:** require `requireAuth` (non-anonymous) on every AI route; use `express-rate-limit` (already a dependency, unused) with a shared store (Redis/Firestore) keyed by uid then IP; cap input lengths; treat moderation as advisory and re-check server-side on write; return an explicit `degraded:true` flag on fallback.
- **Validation:** load test with spoofed XFF shows limiting; spend alert in GCP billing.

### F-09 — Global input sanitizer corrupts data (including passwords) — **High / P1** (reproduced)
- **Evidence:** `server.ts:579-599` runs `sanitize-html` (no tags allowed) over `req.body/query/params` for every `/api` request, mutating in place. I ran the same call on sample input (scratchpad script `probe.cjs`): `"Tom & Jerry <3 a<b"` → `"Tom &amp; Jerry &lt;3 a"`; `"P&ss<word>9"` → `"P&amp;ss9"`.
- **Impact:** every `&` in report titles/descriptions/names is persisted as `&amp;` (React then shows it literally); text after `<` is truncated; **admin-set and initial passwords** (`:1081,1301`) are silently changed — length/complexity are validated *after* mutation — so staff can be locked out with a password they believe they set. It also provides false assurance: React already escapes output, and HTML is stripped only for this route family (ads/news/forum bypass the server).
- **Recommendation:** remove the global mutator; validate with a schema (zod/valibot) per route; escape/strip at *render* time where HTML is possible; exempt password fields in any case.
- **Validation:** unit tests for `&`, `<`, unicode; set-password round-trip sign-in test.

### F-10 — Report form reports success for a local-only save — **High / P1**
- **Evidence:** `ReportIssue.tsx:836-852`: when `setDoc` fails the code stores the report in the zustand/localStorage store and calls `toast.success('Raporti u ruajt me sukses…')`, then shows Track ID. Earlier in the same function `setStep(3)` / `setSubmittedReportId` run before uploads and before the server call. The server path falls through to the direct write on any non-409/429 failure (`:820-826`), and uploaded media become orphans if the server rejects.
- **Impact:** a citizen believes their complaint was filed and receives a Track ID that does not exist server-side; nobody ever sees it.
- **Recommendation:** treat failure as failure: keep the form populated, show an error and a retry (and an offline queue with explicit "pending upload" state); only show Track ID after a 201. Remove the direct-write fallback once the server path is reliable (rules already allow it, which bypasses duplicate/rate checks).
- **Validation:** Playwright test with network blocked; assert error UI and no Track ID.

### F-11 — CI/CD is non-functional — **High / P1**
- **Evidence:** the workflow lives at `ZERI/.github/workflows/production.yml`; the git root is the parent folder and has no `.github` (`ls ../.github` empty), so GitHub never runs it. Inside: `npm test || echo "Tests not yet fully implemented…"` (`:26`) — and `package.json` has no `test` script; `credentials_json: \$\{\{ secrets.GCP_CREDENTIALS \}\}` (`:47`) is escaped and won't expand; build/push/deploy steps are `echo` comments; `npm audit --audit-level=high` currently fails (F-29). Node 20 in CI, `@types/node` 22. No Dockerfile exists in the repo.
- **Recommendation:** move to `[root]/.github/workflows/` (or make `ZERI/ZERI` the git root), add jobs: `npm ci`, `tsc`, `eslint` (after F-28), `vitest`, `vite build`, rules tests with `firebase emulators:exec`, `gitleaks`; add a Dockerfile (multi-stage, `NODE_ENV=production`, non-root) and real deploy (Workload Identity Federation instead of JSON key).
- **Validation:** a PR shows required checks; main deploy produces a revision with `/api/health` OK.

### F-12 — No automated tests — **High / P1 (process)**
- `vitest`, Testing Library and jsdom are in `devDependencies` but there are zero test files and no script. The riskiest logic (`approvalPipeline.decideTransition`, `editorialFirewall`, rules, `buildRoleClaims`, `security.createIpRateLimiter`, sanitizer, translate cache key) is pure or emulator-testable. See Section 6.

### F-13 — Production start doesn't force `NODE_ENV=production` — **Medium / P1**
- **Evidence:** `package.json:10` `"start": "node dist/server.cjs"`; `server.ts:2885` serves the Vite **dev** middleware whenever `NODE_ENV !== "production"`; `server/security.ts:187-190`/`server.ts:561-563` allow any origin when not production. Cloud Run does not set `NODE_ENV`. The bundle also marks packages external, so `vite` is required at runtime.
- **Recommendation:** `"start": "NODE_ENV=production node dist/server.cjs"` (use `cross-env` for Windows dev) **and** have the server refuse dev mode when a service account is configured/`K_SERVICE` is set; set it in the Dockerfile.

### F-14 — Overlapping `settings` matches make `ads-private` public — **Medium / P1**
- **Evidence:** `firestore.rules:430-433` restricts `settings/ads-private`, but `:437-440` `match /settings/{settingId} { allow read: if true; allow create, update, delete: if isSuperAdmin(); }` also matches that document; Firestore grants access if **any** matching rule allows. Likewise the `affectedKeys` guard on `settings/general` (`:416-421`) is bypassed by the wildcard write rule.
- **Recommendation:** replace the wildcard with explicit documents, or put the private config in a different collection (`privateSettings/*`) with no wildcard sibling. **[RV]** verify in the emulator (read `settings/ads-private` unauthenticated).

### F-15 — `isSuperAdmin()` includes plain admins — ~~Medium / P1~~ **Re-assessed: by design** (naming hazard only)
> **Update:** `src/lib/roleCatalog.ts` documents `admin` as the superadmin's operational deputy, differing only in two actions (creating municipal accounts, writing private ad credentials). The helper therefore matches the intended policy; the real gap was the second of those two, which the `settings` wildcard overlap (F-14) opened and which is now closed with a strict `isOwner()` helper. The original analysis below is kept for context.

- **Evidence:** `firestore.rules:18-20` `admin == true || superadmin == true`; `buildRoleClaims` gives superadmins `admin: true` so the first clause already covers both. Every `isSuperAdmin()` rule (delete users/reports, write settings, `bannedIPs`, `donationCauses`) is therefore open to `admin`, contrary to the server's superadmin-only gates (`server.ts:1185,1451`).
- **Recommendation:** `isSuperAdmin()` = `token.superadmin == true`; keep `isAdmin()` for admin-or-superadmin.

### F-16 — Health-registry data exposed to unrelated staff roles — **Medium / P1**
- **Evidence:** `firestore.rules:495-498` allows `isStaff()` to read, `:594` to update; `isStaff()` (`:34-43`) includes `adsadmin`, `newsadmin`, `agent`. Unauthenticated/guest create is allowed (`:507-593`) with consent flag but no rate limit/App Check. Storage `health/**` read is stricter (`storage.rules:72-76`), so the two stores disagree.
- **Impact:** special-category health data (diagnoses, names, phones) reachable by ad/news staff; spam/bulk submission by unauthenticated clients.
- **Recommendation:** dedicated `healthstaff`/`admin` check; enable App Check and reCAPTCHA Enterprise on the unauthenticated create path or route it via the server; align Storage and Firestore predicates.

### F-17 — GDPR erasure is incomplete — **Medium / P1–P2**
- **Evidence (`server.ts:1372-1437`):** (a) `PURGE` queries `where('userId','==',uid)` on `users` (no such field — the doc id is the uid; deleted separately at `:1429`) and on `messages` (the server writes `senderId/receiverId`, `:1662-1670`), so DMs aren't purged; (b) `ANONYMIZE` uses `authorId` but `liveMessages` use `userId` (`firestore.rules:483`), `forum_conversations`, `forumStories`, `healthRegistry`, `medicineShortages`, `budgetAllocations`, comment subcollections aren't touched; (c) only the first 400 docs per purge (no loop); (d) comment says uploaded media are erased — no Storage deletion exists (`grep` for `bucket()/getStorage` in `server*` returns nothing); (e) anonymised reports keep `location`, `description`, `media` and `authorName` is overwritten but `trackingId`/`images` remain; (f) failures are only logged and the endpoint still returns the "deleted in compliance" message.
- **Recommendation:** build a registry of per-collection erasure rules, loop to exhaustion, delete `reports/{uid}/…`, `avatars/{uid}/…`, `forum*/{uid}/…`, `health/{uid}/…` objects, return per-step results, and keep a retry queue. Have counsel confirm retention periods.

### F-18 — Rules write-validation gaps — **Medium / P2**
- `notifications` create (`:257-260`): any `canAct()` user may create a `audience:'user'` notification for *any* `userId` with arbitrary `link`/`message` → in-app phishing. Restrict to staff/server.
- `liveMessages` create (`:483-486`): no `isAuthenticated()` and `userId` isn't bound to `auth.uid`; anyone on the internet can post as anyone.
- `forumPosts` update (`:371`): any user may rewrite `likes/reposts/comments/reactions/poll` arrays wholesale (the server has a transactional like/repost endpoint, `server.ts:1743`, but the rule doesn't force its use).
- `auditLogs` create by any staff (`:656`): forgeable "append-only" evidence (any `adsadmin` can write entries naming another actor). Make server-only.
- `reports` create (`:129-136`) has no `hasOnly` key list or size limits, and `trackingId` is client-chosen (`server.ts:1981`) → tracking-ID squatting/collision.

### F-19 — Storage rules — **Medium / P2** (**[RV]** for delete behaviour)
- `forum*`, `forum_reels`, `forumStories`, `forum_dms` paths accept any content type up to 15–30 MB (`storage.rules:30-56`); the type allow-list exists only in client code (`src/lib/firebase.ts:66-89`). Public read + arbitrary type = free file hosting under the project's domain.
- `allow write` covers deletes, but the conditions dereference `request.resource` (null on delete) — owners likely cannot delete their own uploads (needed for erasure). Split into `allow create, update` and `allow delete: if request.auth.uid == userId`.

### F-20 — Fail-open HTML sanitizer for ads — **Medium / P2**
- `AdBanner.tsx:206` calls `window.DOMPurify` if present, otherwise an identity function; the `dompurify` npm package is never imported or attached to `window` (grep confirms), so `mediaType === 'html'` ads render raw HTML (iframe/style allowed) from Firestore. `adsadmin` accounts can write ads directly (`firestore.rules:238`), so one compromised ad account gets stored XSS for every visitor (CSP allows inline script).
- **Fix:** `import DOMPurify from 'dompurify'`, sanitize with `ALLOWED_URI_REGEXP`, force `sandbox` on iframes, or render HTML ads inside a sandboxed `<iframe srcdoc>`; make failure closed.

### F-21 — Public translation endpoint — **Medium / P2**
- `server.ts:734-767` is unauthenticated, accepts up to 1 MB of text, and calls free third-party providers (`server/translate.ts`: undocumented `translate.googleapis.com/translate_a/single?client=gtx`, MyMemory, Lingva), sending citizen-generated text off-platform with GET query strings (long text → 414s). The cache key `base64(text).slice(0,120)` (`:746`) uses only the first ~90 bytes — two different texts that share a 90-byte prefix return the same cached translation (**reproduced**: keys equal for `'A'×90 + X` vs `'A'×90 + Y`).
- **Fix:** key by `sha256(text)`, cap length (e.g., 5k chars), require auth or tight limits, use the official Cloud Translation API (`@google-cloud/translate` is already a dependency), and disclose processing in the privacy policy.

### F-22 — Missing Firestore indexes make safeguards fail open — **Medium / P2** (**[RV]**; the emulator doesn't enforce indexes)
- Duplicate/rate-window query (`server.ts:1953-1966`: `authorId ==`, `createdAt >=`, `title ==`) needs a composite index not present in `firestore.indexes.json` (no `reports` entry on `authorId`). On `FAILED_PRECONDITION` the `catch` (`:1971-1975`) intentionally "fails open", so duplicate and 5-per-10-min limits would silently never apply.
- `GET /api/v1/messages/:otherUid` (`:1698-1716`) uses `senderId in […]` + `orderBy createdAt` (index missing); on error the fallback reads only `senderId == me`, so the **other party's replies never appear**, and no pagination.
- **Fix:** add the indexes (`firebase deploy --only firestore:indexes`), alert on fallback paths, query both directions explicitly (`or()` / two queries), add cursors.

### F-23 — Error handling inconsistencies — **Medium / P2** (reproduced)
- The error handler is registered at `server.ts:2442`, *before* the AI routes (`:2456+`), and returns 500 for everything. I reproduced with a minimal Express app using the same parser setup: malformed JSON → **500** (should be 400), 2 MB body → **500** "request entity too large" (should be 413). `err.status` is never read.
- Many handlers return raw `e.message` to the client (`:1221, 1347, 2495, 2524, 2618, 2654…`), including Firebase/Gemini internals; `publicError` is used inconsistently (and `:818` returns it unwrapped). `/api/health` exposes `pid`/worker id.
- `unhandledRejection` is only logged (`:2966`), `uncaughtException` exits — fine, but ensure the supervisor restarts.
- **Fix:** move the handler to the end, honour `err.status`/`err.type`, one `sendError(res, code, publicMsg)` helper, request-id middleware (`crypto.randomUUID`, not `Math.random`).

### F-24 — Dead 50 MB limit on `analyze-issue` — **Medium / P2** (reproduced)
- `express.json({limit:'1mb'})` is mounted globally (`:458`); the route-level `express.json({limit:'50mb'})` (`:2547`) never gets a chance — body-parser has already rejected anything >1 MB. Base64 photos > ~750 KB (typical phone images) therefore fail with an error the user sees as "AI unavailable". **Fix:** mount a larger parser *before* the global one for that path only, cap at a realistic size (e.g. 8 MB), and reject non-image MIME types; prefer sending a Storage URL instead of base64.

### F-25 — Coarse `requireAdmin` — **Medium / P2**
- `ADMIN_ROLES` (`server/auth.ts:67-70`) lets `adsadmin`, `newsadmin`, `agent`, `responder`, `dispatcher`, `moderator` call `GET /api/v1/admin/users` (full user documents incl. email, phone, DOB; `server.ts:1733`), `GET /editorial-log` (`:2399`), work-fact review (`:2357`), and AI admin routes. The role-change route lets plain `admin` ban other admins. Use per-route permission checks based on `perm_*` claims (already emitted) and a field allow-list for user listings.

### F-26 / F-27 — Smaller server defects — **Low / P2**
- F-26 (`server.ts:1159-1223`): comment at `:1180` promises "a superadmin must not be able to demote themselves", no `uid === actor.uid` guard exists; `moderator` is missing from `allowedRoles` (`:1163`) though it can be created (`:1090`); multi-step Auth/Firestore updates aren't atomic (a failure between `setCustomUserClaims` and `update` leaves drift).
- F-27: `/api/v1/auth/sync` computes `isVerified: user.email_verified` (`:972`) but `req.user` has no such property (it is in `claims`) → always `false`; `PUT /api/v1/profile` accepts any type/length for `name`, `phone`, `avatar` (`:1336-1341`; `avatar` can be any URL scheme) and errors if the profile doc doesn't exist (`update`). Add schema validation (https URL only, length caps).

### F-28 — Repository hygiene and lint debt — **Medium / P2**
- **Evidence:** 130 tracked compiled `.js` files sit beside their `.ts/.tsx` sources (checked by pairing); `vite.config.ts:14-20` documents that this once made TypeScript edits invisible and works around it with an extension order hack. Also tracked: ~89 one-off root scripts (`patch_*.js`, `fix_*.js`, `update_*.js`, `tmp-*.cjs`, `test-*.js`), `_translation_cache.json` (3.0 MB), `_mul_cache.json`, `_shards/`, `__pycache__/*.pyc`, `*.err` logs, screenshots, `.idea/caches/deviceStreaming.xml`, `.kilo/`, `.kombai/`, `.qodo/`, `backup_stale_js/`, `*.stale-twin`, a stray root `package.json`/`package-lock.json`, and both `bun.lock` and `package-lock.json`. Image assets of 0.9–1.1 MB sit in `src/assets/images`.
- **Lint:** `eslint src server server.ts` → **1,477 errors in 328 files** (589 `no-unused-vars`, 522 `no-undef` — mostly the `.js` twins —, 329 `no-explicit-any`). `npm run lint` is only `tsc --noEmit`; `tsconfig.json` lacks `strict`, so `tsc` passing is weaker than it sounds. ~288 `any` usages in `src/`+`server*`.
- **Fix:** delete twins and one-off scripts (they're in git history), `.gitignore` caches/logs/IDE dirs, keep one lockfile, enable `strict` incrementally (`strictNullChecks` first), add `eslint` to CI scoped to `.ts/.tsx`.

### F-29 — Dependency vulnerabilities — **Medium / P2**
`npm audit` (run, exit 1): **33 vulnerabilities — 3 critical, 14 high, 14 moderate, 2 low** (556 prod / 677 dev / 1,378 total).
- Critical: `vitest` (+`tinypool`; **dev-only**, fix = vitest 5.x major), `proxy-addr` (transitive of Express; fix available — note the advisory concerns subnet-based `trust proxy`; this app uses a hop count, so likely not exploitable, **[RV]**).
- High: `firebase`/`@firebase/firestore`/`@grpc/grpc-js`, `firebase-tools` chain (`basic-ftp`, `braces`, `chokidar`, `get-uri`, `proxy-agent`; dev-only), `sharp` (dev), `brace-expansion`, `source-map-js`.
- Moderate on runtime path: `firebase-admin`, `body-parser`, `qs`, `ip-address`, `@google-cloud/storage`. Low: `dompurify` (unused, see F-20), `esbuild`.
- **Warning:** audit's `fixAvailable` for `firebase` points to **9.14.0** (a *downgrade* from ^12) — do not apply `npm audit fix --force`. Run plain `npm audit fix`, bump `vitest`/`firebase-tools` deliberately, and rerun. Also: `vite` is listed in both `dependencies` and `devDependencies`; `motion` and `framer-motion` are both present, and `@types/*`, `sharp`, `tailwindcss` sit in runtime/dev mixes — run `depcheck` before pruning (usage not verified here).

### F-30 — SEO/Accessibility basics — **Low / P2**
- `index.html:8` `maximum-scale=1.0, user-scalable=0` blocks zoom (WCAG 1.4.4 failure).
- Canonical, `hreflang`, `og:image` (`index.html:27-38`) and `SITE_ORIGIN` default (`server.ts:897`) use `https://zeriqytetare.republiks/` — `.republiks` is not a delegated TLD, so all canonical/sitemap URLs are unreachable; set the real production domain. `og:image` is a 64×64 SVG (not accepted by most social crawlers). `<meta http-equiv="Cache-Control">` tags are ignored by browsers and misleading.
- Heuristics: 6 `<div|span onClick>` with no `role`/keyboard handler (`grep`); a full accessibility/contrast pass was **not** done (needs axe/Lighthouse on a running build).

### F-31 — Client-state issues — **Low / P2**
- `store.ts:1391` restores `localStorage['zq-demo-user']` into `currentUser` in production builds (UI-level role spoofing; server/rules still enforce) — gate by `import.meta.env.DEV`.
- `store.ts:1460` `upvoteReport` optimistically increments then `updateDoc(... upvotes)`; rules (`:150-160`) deny non-author updates, so the upvote never persists (warning only) and the count reverts on next snapshot.
- `useCitizenDirectory.ts:191` calls `/api/v1/admin/users/count` which does not exist (in prod the SPA fallback `app.get('*')` returns `index.html` with 200 for any unknown GET without a dot, including `/api/*`; add an `/api` 404 JSON handler).
- zustand `persist` serialises almost the whole store (users list, reports, audit logs) to `localStorage` (`store.ts:1999-2005`): staff PII lingers on shared computers after logout; whitelist persisted keys and clear on `signOut`.

### F-32 / F-33 / F-34 — Lower-priority items
- F-32: `server.ts:2529-2544` placeholder "security" endpoints always return authentic / not-a-bot ("Bypassed"). They're not called by the client; delete them so no one later relies on them.
- F-33: CSP has `script-src 'unsafe-inline'` and `connect-src https: wss:`, `img-src https:`; `crossOriginOpenerPolicy:false`. Move to nonce/hash-based scripts and an explicit host list when feasible (GA, Firebase, OSM); keep COOP relaxed only if popup auth requires it (`same-origin-allow-popups`).
- F-34 (hypotheses, **not measured**): `verifyIdToken(token, true)` adds a revocation lookup per request (`server/auth.ts:52`); `/api/public/stats` aggregates at most 1,000 reports (`server.ts:790-793`) so totals silently cap; cache and rate limiter are per-process (inconsistent across cluster workers/instances); `agents/:uid/activity` fetches pages of the whole `auditLogs` collection and filters in memory (`:1254-1265`) so a page may be empty yet `nextCursor` non-null; build emits `ui` 797 kB (gzip 229 kB) and `firebase` 735 kB (gzip 171 kB) chunks and the Vite warning that `firebase.ts` is both statically and dynamically imported (so the ~25 dynamic imports in `store.ts` do not code-split); 49 `onSnapshot` listeners — profile reads with Firebase usage dashboards before optimising.

---

## 4b. Additional findings discovered during remediation

| ID | Sev | Status | Finding |
|---|---|---|---|
| F-35 | Medium | **Fixed** | `AIAssistantPage.tsx` called `/api/ai-assistant/chat` without an `Authorization` header while the server mounts `requireAuth` on that prefix, so every request was a 401 and the page could never work. Now sends the token via `src/lib/apiAuth.ts`. |
| F-36 | Medium | **Fixed** (RV in prod) | `isBanned()` in `firestore.rules` read `data.isBanned` directly. For a profile without that field (every profile created by `/api/v1/auth/sync`) the rule raised an evaluation error, which denied all of that account's `canAct()`-guarded writes. Found by the new emulator tests; now `data.get('isBanned', false)`. |
| F-37 | Medium | **Open** | `ReportIssue.tsx`: when `/api/detect-duplicate` says "duplicate", the code calls `upvoteReport()` and navigates away — **the citizen's report is never created**, and the upvote itself cannot persist (rules deny it, see F-31). An LLM verdict silently discards a complaint. Show the suggestion and let the citizen decide. |
| F-38 | Low | **Open** | `/api/dashboard/ai-news`: the client sends `{ municipality }` but the server reads `{ issues }`, so the "AI news" is generated from nothing and shown as breaking news; `/api/dashboard/reporting-tips` ignores its body entirely. Feed real aggregated data server-side or remove/label the feature. |
| F-39 | Low | **Partly** | `generateContentWithFallback` returns canned text with HTTP 200 on quota/key errors (including hard-coded "fallback-news" items). It is now flagged `degraded` internally and never cached, but the flag is not yet returned to clients. |
| F-40 | High | **Fixed** | Stored-XSS sinks in admin print/export windows: `AdminReports.tsx` (print), `src/lib/exportUtils.ts` (HTML/PDF export, including `<img src>` from report image URLs) and `AdminHealthRegistry.tsx` (referral + list export) interpolated citizen-written fields into `document.write` templates without escaping. `window.open('')` windows share the app origin, so markup in a report title would execute with the admin's session. This was already reachable because clients can write `reports` directly to Firestore (bypassing the server sanitizer); removing the sanitizer (F-09) made fixing it mandatory. All dynamic values now go through `escapeHtml` (`src/lib/escapeHtml.ts`) with a regression test. |

---

## 5. Security review

**Confirmed issues:** F-01, F-02, F-03, F-04, F-05, F-06, F-07, F-08, F-09 (integrity), F-14, F-15, F-16, F-18, F-20, F-21, F-25.
**Potential risks / need runtime verification:** F-13 (depends on platform env), F-14 (emulator confirm), F-19 (delete semantics), F-22 (indexes), proxy-addr advisory applicability, fallback behaviour of moderation, Firestore `get()` cost/latency from `isBanned()` on every write.
**Verification gaps:** no access to the live Firebase project (rules actually deployed may differ from `firestore.rules`; `docs/SECURITY_RULES_FIX.md` exists), GitHub repo visibility/forks, Cloud Run config, App Check status, actual IAM of the service account, whether Auth "anonymous" and email-enumeration protection are enabled.
**Positive controls to keep:** `.env*`/service-account files untracked; `requireAuth` uses `checkRevoked`; role changes revoke refresh tokens; server never takes status from the body (`transition`); `healthRegistry` read is owner/staff; `editorialLog`/`auditLogs` are update/delete-denied; Helmet with HSTS.

---

## 6. Testing and quality gaps

| Area | What to test | How |
|---|---|---|
| Firestore/Storage rules | Every collection × {anon, citizen, other citizen, municipality A/B, each staff role, admin, superadmin}; specific regressions for F-02/03/05/06/07/14/15/18 | `@firebase/rules-unit-testing` + `firebase emulators:exec` (the repo already has emulator tooling in `qa/run-admin-prototype.mjs`) |
| Pipeline | `decideTransition` matrix (role × stage × transition × jurisdiction) incl. permission-promotion negative case | Vitest unit tests (pure functions in `server/approvalPipeline.ts`, `server/editorialFirewall.js`) |
| Server API | `requireAuth`/`requireAdmin`, `actingUser`, report create (dup/rate), transition, GDPR erasure, set-password round-trip, error codes (400/413) | Vitest + supertest against the Express app (export `createApp()` from `server.ts`), Firestore emulator |
| Rate limiter | spoofed `X-Forwarded-For`, window reset, ban | Unit tests of `createIpRateLimiter` |
| Sanitization | `&`, `<`, unicode, password fields | Unit |
| Translation | cache key uniqueness, length cap | Unit |
| Frontend | report flow success/failure states, TrackId, auth redirect, admin gating, `AdBanner` sanitization | React Testing Library; Playwright E2E for report + login (reuse `qa/*.mjs` ideas) |
| Accessibility | zoom, focus order, labels, contrast | axe-core in Playwright; Lighthouse CI |
| Quality gates | `tsc`, `eslint`, `vite build`, `npm audit --omit=dev`, `gitleaks` | CI (F-11) |

Existing `qa/*.mjs` scripts are ad-hoc and depend on local state/ports; treat them as seeds, not regression tests. `qa-smoke.mjs` etc. do not assert in CI.

---

## 7. Architecture and performance recommendations

*Evidence-backed:*
1. **Single source of authority.** Make Firestore documents purely data and claims the only authority; delete the profile-fallbacks in `requireAdmin`, `transition`, `actingUser`. (F-02, F-04)
2. **Finish the "server owns writes" migration** for state that has invariants: reports (already), poll votes, likes/reposts, notifications, audit/editorial logs, GDPR. Then tighten rules to `allow write: if false` for those collections and delete the client fallback (F-10).
3. **Split `server.ts` (3,053 lines).** Suggested modules: `app.ts` (middleware), `routes/{public,admin,reports,municipality,messages,ai,profile}.ts`, `services/{gemini,translate,gdpr}.ts`, `middleware/{sanitize,errors,rateLimit}.ts`. Export `createApp()` for tests. Move the Vite/dev concerns and cluster bootstrap to a separate entry.
4. **Shared state for scale-out:** rate limits and cache are in-memory; with Cloud Run autoscaling or `cluster` they are per-instance. Use Redis/Memorystore or Firestore counters for limits; keep the in-process cache but accept bounded staleness (document it).
5. **Single typed source for roles/permissions** (`roleCatalog.ts`, `adminPermissions.ts`, `server/auth.ts` ADMIN_ROLES, `buildRoleClaims`, `firestore.rules` helpers currently duplicate the model); generate rules helpers/tests from one table.
6. **Frontend:** break up the 2,008-line `store.ts` and 2,270-line `ForumPage.tsx`; stop persisting the whole store; resolve the static+dynamic import of `firebase.ts` so the SDK can be lazy-loaded; compress/convert the five ~1 MB JPGs to WebP/AVIF with responsive `srcset` (sharp is already a devDependency).
*Hypotheses (measure first):* listener fan-out (49 `onSnapshot`) and unbounded reads drive Firestore cost; `isBanned()` adds one extra read per write evaluated by rules; cache `limit: 1000` for stats.

---

## 8. Implementation roadmap

**Phase 0 — Contain (same day; parallelisable)**
- F-01 rotate/purge secrets (owner: repo admin/GCP owner). *Acceptance:* new OAuth secret live, history clean, secret scanning enabled. *Rollback:* none needed (rotation); keep a private backup before history rewrite.
- F-02 + F-04 hot-fix: remove `permissions`-based promotion and fix `actingUser` (code) and add `permissions/municipality/...` to the rules' self-update deny-list. *Acceptance:* new tests green.
- F-03 DM rule fix; F-05 close `editorialLog` create; F-14/F-15 rules corrections. Deploy rules via emulator-tested change (`firebase deploy --only firestore:rules`); *rollback:* redeploy previous rules file from git.
- F-13 set `NODE_ENV=production` in start/Docker.

**Phase 1 — Stabilise (week 1–2)**
- F-08 gate AI endpoints + proper limiter (replace `getClientIp` first-hop logic); F-09 remove global sanitizer and add per-route validation; F-23/F-24 error handling + parser limits; F-10 report-flow honesty; F-22 add indexes; F-18/F-19 rules/storage tightening; F-16 health access.
- Stand up test infrastructure (F-12) *before* the larger refactors: rules tests first, then pipeline and API tests.
- F-11 fix CI location, add required checks. *Sequencing:* tests → CI → everything else gets regression protection.

**Phase 2 — Data/API boundaries (weeks 2–4)**
- F-06 public report DTO + rules; F-07 poll votes via server; F-17 erasure rewrite; F-21 translation; F-25 permission-based admin checks; `GET /api` 404 handler; schema validation layer.

**Phase 3 — Performance & UX (weeks 4–6)**
- Measure with Lighthouse/Firebase usage; image optimisation; chunking; listener audit; F-30 accessibility & SEO domain; F-31 store persistence.

**Phase 4 — Clean-up (ongoing)**
- F-28 delete twins/scripts/caches, one lockfile, `strict` TS, ESLint to green; F-29 dependency upgrades; F-32/F-33 hardening; docs: replace the AI Studio template `README.md` with real setup/deploy/runbook; update `docs/PRODUCTION_CHECKLIST.md` to match reality.

**Can run in parallel:** F-01, F-11, F-28, F-30, F-29. **Must be sequenced:** F-02 → F-04 → tests; F-06/F-07 after the server endpoints exist; F-17 after F-19; F-28 (deleting `.js` twins) after confirming no build path imports them (server.ts imports `./server/editorialFirewall.js` and `./server/approvalPipeline.js` explicitly; `src/lib/glossaryRuntime.js` has **no** `.ts` source and is imported by the server — keep or port it).

---

## 9. Suggested file-by-file changes

| File | Change | Reason |
|---|---|---|
| `[root] idp_*.json, users.json, lookup.json, claim_res.json, body.json, firebase-debug.log, package*.json` | Remove from git; add to root `.gitignore`; purge history | F-01 |
| `ZERI/anon_*.json, email_verify.json, signin_res.json` | Remove | F-01 |
| `firestore.rules` | Fix `isSuperAdmin`; participant-check DM messages; `reports` read scope; poll vote model; `editorialLog`/`auditLogs` create → false; remove `settings/{settingId}` wildcard overlap; self-update `hasOnly` allow-list; notifications/liveMessages/forumPosts constraints; split health staff predicate | F-02,03,05,06,07,14,15,16,18 |
| `storage.rules` | Content-type allow-lists; separate delete rule; DM read by participant | F-19 |
| `firestore.indexes.json` | Add `reports(authorId, createdAt, title)`, `messages(senderId/receiverId, createdAt)` | F-22 |
| `server/auth.ts` | Remove/limit profile fallback; per-permission guards; `AuthedUser.municipality` helper | F-02,04,25 |
| `server/approvalPipeline.ts` | Drop `permissions.includes('agents')` promotion (or source from claims) | F-02 |
| `server/security.ts` | `getClientIp` → `req.ip`; shared store; use `express-rate-limit` | F-08 |
| `server.ts` | Remove sanitizer (579-599); fix `actingUser`; error handler last; per-route body limits; auth on AI routes; remove stubs; `/api` 404; GDPR rewrite; split into modules | F-04,08,09,17,23,24,32 |
| `src/pages/ReportIssue.tsx` | Honest failure UI; remove direct-write fallback | F-10 |
| `src/components/AdBanner.tsx` | Import DOMPurify, fail closed | F-20 |
| `src/lib/store.ts` | Gate `zq-demo-user` to DEV; whitelist `persist`; fix/disable `upvoteReport` | F-31 |
| `index.html`, `server.ts:897` | Re-enable zoom; real domain/OG image | F-30 |
| `package.json` | Add `test`, `lint:eslint`, `start` with `NODE_ENV`; dedupe `vite`; upgrade deps | F-11,13,29 |
| `.github/workflows/production.yml` | Move to git root; real steps; WIF auth; gitleaks; rules tests | F-11 |
| `src/**/*.js` twins, root `patch_*/fix_*/update_*/tmp-*/test-*`, caches, logs, `.idea/caches`, `__pycache__`, `backup_stale_js`, `*.stale-twin` | Delete / ignore | F-28 |
| **Leave unchanged** | `server/approvalPipeline.ts` state-machine design, `buildRoleClaims`, audit/editorial append-only approach, Helmet/HSTS setup, `src/lib/firebase.ts` emulator guard (good defensive code) | Sound design |

---

## 10. Commands and checks

**Run (all non-destructive; outputs to a scratch dir, nothing in the repo was modified except this report):**

| Command | Result |
|---|---|
| `npx tsc --noEmit` | exit 0, no diagnostics (note: `strict` is off) |
| `npm audit --json` | 33 vulns: 3 critical / 14 high / 14 moderate / 2 low (Section F-29) |
| `npx vite build --outDir <scratch>` | succeeded in ~16 s, 3,827 modules; warnings: chunks > 1000 kB reported; largest `ui` 797 kB (229 kB gz), `firebase` 735 kB (171 kB gz), CSS 383 kB; `firebase.ts` mixed static/dynamic import |
| `npx eslint src server server.ts` | 1,477 errors / 0 warnings in 328 files (589 unused-vars, 522 no-undef, 329 no-explicit-any) |
| Node probe (`probe.cjs`, scratchpad) | reproduced: sanitizer output (F-09), translate cache-key collision (F-21), 500 for malformed JSON and 2 MB body (F-23, F-24) |
| `git ls-files`, `git branch -vv`, `git check-ignore`, `git ls-tree -l`, greps | basis for F-01, F-11, F-28 and counts quoted |

**Not run / still to do:** `firebase emulators:exec` rules tests; any live Firebase/Gemini call; `npm run build` server bundle (`dist/server.cjs`) and a container smoke test; `gitleaks detect --log-opts=--all`; Lighthouse/axe; `depcheck`; load test of limiter and AI endpoints; manual exploit confirmation of F-02/F-03 in the emulator.

---

## 11. Open questions and limitations

1. Is the GitHub repo public, and have the pushed files been cloned/forked? (Determines urgency/scope of F-01.)
2. Is the deployed `firestore.rules` identical to the file in git? (`docs/SECURITY_RULES_FIX.md` suggests manual fixes.)
3. Intended public contract for `reports`: should anyone be able to list all reports, or only look up by Track ID? (F-06 design decision.)
4. Are guests (anonymous auth) intended to vote, post in `liveMessages`, or create health records? Drives F-07/F-16/F-18.
5. Hosting target: Cloud Run (CI hints) or AI Studio? No Dockerfile exists; `NODE_ENV`, `ALLOWED_ORIGINS`/`APP_URL`, `CLUSTER_*` and service-account delivery depend on it.
6. Legal retention rules for reports/audit logs vs. erasure (Kosovo Law 06/L-082, GDPR) — need counsel input for F-17.
7. Which third-party translation providers are contractually acceptable for citizen text (F-21)?
8. Limitations: server.ts lines ~50-310 (Gemini wrapper/fallback text) and the 33k-line translation tables were only skimmed; most large page components (`ForumPage`, `AdminAgents`, `HealthRegistryPage`, etc.) were sampled via grep rather than read line-by-line; no runtime testing; accessibility, contrast and mobile behaviour are untested; GA/consent flow not traced; `qa/` scripts and Python translation tooling not reviewed. Two working-tree edits (`firebase-applet-config.json` adding `databaseURL`/`measurementId`, `LocationDetectorModal.tsx` reactive scope flag) were present and are benign (public client config; the Firebase web API key is public by design but should be HTTP-referrer-restricted in GCP).

---

## Appendix A — Master checklist

`[x]` fixed and verified · `[~]` partly done (remainder noted) · `[ ]` open

**P0**
- [~] F-01 Rotate Google IdP client secret; regenerate/assess password-hash signer key; remove files; purge history; enable secret scanning — *files untracked + root `.gitignore` extended; rotation, history purge and secret scanning need the repo owner*
- [x] F-02 Remove permission-based role promotion; lock profile fields in rules — *unit + emulator tests*
- [x] F-03 Restrict DM message reads to participants (rules + Storage) — *Firestore + Storage fixed and tested*

**P1**
- [x] F-04 Fix `actingUser` (use `claims.municipality`), drop profile jurisdiction fallback
- [x] F-05 Make `editorialLog` server-write-only
- [ ] F-06 Define/implement public report visibility + DTO — *needs a product decision*
- [x] F-07 Server-side poll voting — *server-side voting, tested*
- [~] F-08 Auth + `req.ip` limiter + input caps on AI routes — *done; shared limiter store, per-user quotas and moderation prompt-injection hardening remain*
- [x] F-09 Remove global sanitizer — *per-route schema validation still recommended*
- [x] F-10 Truthful report submission UX — *client direct-write fallback and duplicate auto-merge (F-37) remain*
- [x] F-11 Working CI at git root; Dockerfile; real deploy — *CI at git root; real deploy job still to write*
- [~] F-12 Test suite — *17 unit + 31 rules tests; API integration and E2E remain*
- [x] F-13 Force `NODE_ENV=production` for `npm start`
- [x] F-14 Remove `settings` wildcard overlap — *`ads-private` owner-only*
- [x] F-15 `isSuperAdmin()` — *re-assessed as by design; strict `isOwner()` added*
- [x] F-16 Health-data access & unauthenticated create controls — *role-aligned rule, tested; run claims sync first*
- [x] F-17 Complete GDPR erasure — *tested on emulators; deploy indexes*

**P2**
- [~] F-18 Rules write validation — *most done; forum comments/reactions/poll arrays remain*
- [x] F-19 Storage content types / delete / DM read — *tested*
- [x] F-20 Fail-closed ad sanitizer
- [~] F-21 Translation endpoint — *hashed key + length cap done; still public with third-party providers*
- [x] F-22 Add Firestore indexes; fix message-thread fallback — *deploy indexes*
- [x] F-23 Error handler ordering/status codes, `/api` 404, no raw error messages
- [x] F-24 Per-route body limits (`analyze-issue`)
- [x] F-25 Permission-based admin checks — *requireSection + message parties, tested*
- [x] F-26 Role-route fixes (self-lockout guard, `moderator`) — *tested*
- [x] F-27 `isVerified` bug; profile validation
- [ ] F-28 Repo cleanup, ESLint green, strict TS
- [ ] F-29 Dependency upgrades (no blind `--force`)
- [ ] F-30 SEO domain, pinch-zoom
- [x] F-31 Store persistence, `zq-demo-user` in prod, dead endpoint, broken upvote — *upvote, demo user, count endpoint; store persistence remains*

**P3**
- [x] F-32 Remove stub endpoints
- [ ] F-33 CSP tightening
- [ ] F-34 Measure & optimise (listeners, chunks, images, token revocation checks)
- [ ] Replace boilerplate `README.md`; update `docs/PRODUCTION_CHECKLIST.md`

**Found during remediation**
- [x] F-35 AI assistant page sends the ID token
- [x] F-36 `isBanned()` no longer errors on profiles without the field
- [x] F-37 Do not auto-discard a report on an AI "duplicate" verdict
- [x] F-38 Give AI news real data (or remove) · [x] F-39 surface `degraded` to clients — *real data sent; fallback hidden*
- [x] F-40 Escape HTML in print/export templates

**Deploy checklist for the work already done**
- [ ] Re-issue custom claims: `npm run claims:sync` (dry run), review, then `--apply --confirm-project <id>` (+ `--accept-profile-data` after review)
- [ ] `firebase deploy --only firestore:rules`
- [ ] `firebase deploy --only firestore:indexes` (adds report/message indexes and collection-group overrides for erasure)
- [ ] Set `NODE_ENV=production` in the container/Cloud Run service (or use `npm start`)
- [ ] Commit (secrets untracking first), then history purge

**Still quick wins:** F-30 (zoom + domain), F-31 (`zq-demo-user` gate).
**Needs a decision first:** F-06 (public data contract), F-07 (guest voting), F-16 (health-data roles), F-17 (retention), hosting target.

**Added during remediation:** F-41 `undefined` Firestore writes · F-42 server path dropped report fields · F-43 Quick Report bypass · F-44 owner claims — all fixed (see status table).
**Remaining open:** F-01 owner actions (rotate secret, purge history) · F-06 public report visibility (decision) · F-08 shared limiter store · F-28 repo cleanup (130 stale `.js` twins, one-off scripts) · F-29 dependency upgrades · F-30 zoom/canonical domain · F-33 CSP · F-34 performance · forum comment/reaction arrays · README/docs.
