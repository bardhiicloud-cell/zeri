# Public UI/UX, Design & Usability Audit — Zëri i Qytetarëve

| | |
|---|---|
| Audit date | 2026-10-15 |
| Code under audit | commit `f8e13f1` (`main`, merge "public-redesign-final"), identical to this worktree's HEAD |
| Scope | Public citizen-facing site only (no admin, superadmin, agent, municipality, moderation or debate-admin panels) |
| Type | **Audit only. No source file was modified.** The only file created is this report. |
| Method | Real app served by the project's own dev server (`server.ts`, port 3030) and driven in the built-in browser pane; in-page DOM measurements; reading the relevant public components. |

> **How to read evidence labels.** Every finding carries one of:
> **CONFIRMED** (reproduced in the running app and/or verified in code), **SUSPECTED** (strong signal, needs verification elsewhere), **UNTESTED** (could not be exercised), **EXPECTED** (looks intentional), **OPPORTUNITY** (improvement, not a defect).
> Line numbers are quoted only where I read them in the file.

---

## A. Executive Summary

The public site has a clear civic purpose, a recognisable visual identity, a well-organised homepage ("Çfarë dëshiron të bësh sot?" with five plain-language task cards), and several genuinely well-built pages: **Track ID** (`/trackid`), **Contact** (`/kontakt`), the **404 page** and the **registration form** are good examples of labelled fields, helpful errors and honest copy. Across every route and viewport I measured (320, 390, 768, 1440, 1920 px) there was **no horizontal page scroll**.

The main problems are not cosmetic; they sit on the core "report a problem" journey and on first-visit friction:

1. **The reporting flow contradicts itself.** The homepage card says *"Fotografia është sipas dëshirës"* (photo is optional) but step 1 of `/raporto` refuses to continue without an upload and says the proof is *"obligative"* (PUB-UI-001).
2. **A first-time visitor must clear three stacked blocking modals** (age gate → cookie consent → location picker) before seeing any content, including the tracking page and emergency numbers (PUB-UI-002).
3. **A raw translation key is visible to every citizen** in the report form's sector field: `report_step2_category_ph ose kërko problemin…` (PUB-UI-003).
4. **An advertising banner is the first element on every routed page**, including `/raporto` and `/trackid`. At 320×700 it fills about 60 % of the first screen (PUB-UI-004).
5. **Accessibility basics are missing or weak:** no skip link (49 focusable controls before `<main>`), report-form labels not tied to inputs and no required-field markers, dialog focus not managed, many targets below 24 px, 8–10 px text in the shell.
6. **Localization is only partly complete.** Switching to Bosnian or English leaves Albanian blocks (hero copy, ad banner, 404 suggestions, support-bot labels, several toasts).
7. **Naming is inconsistent** — the same destinations and the brand itself appear under 3–6 different names.
8. **Dead and misleading elements:** five dead `href="#"` links in the Debate footer (including Privacy and Accessibility); the cookie "Decline" button shows a spinner on the "Accept" button; the homepage title says *Prishtinë* even when the visitor chose "all municipalities".

**Not claimed:** I did not submit any report, create an account, upload real media, use geolocation, run a screen reader, or measure production-build performance. Coverage details are in section L. There is no quality score in this report on purpose.

Counts of findings in the defect register (section I): **P0 0 · P1 3 · P2 19 · P3 10** (32 IDs; PUB-UI-018 and PUB-UI-026 are SUSPECTED, the rest CONFIRMED or code-verified). No P0: the core journeys are reachable, and I did not observe directly exposed private data.

---

## B. Public Route Inventory

The route table is in `ZERI/src/App.tsx` (`<Routes>` from line ~861). Unprefixed Albanian routes are mirrored under `/:lang/…` (22 other languages; the Albanian prefix is empty).

Legend for **Audit status**: **Deep** = content read + interactions exercised · **Partial** = loaded and measured (DOM metrics, title/h1, text), not exercised · **Alias** = same component as another route, only title/h1/redirect checked · **Gated** = reachable, content requires a citizen login.

| # | Route | Purpose | Access | Audit status |
|---|---|---|---|---|
| 1 | `/` | Home, hero, task cards, mini-map, latest reports, track box, partners, contacts | Public | **Deep** |
| 2 | `/raporto` | Report a problem (2 steps) | Public (guest session on submit) | **Deep** (step 1 + step 2 inspected; **not submitted**) |
| 3 | `/trackid` (`?id=`) | Look up a report by Track-ID | Public | **Deep** |
| 4 | `/harta` | Public map of reports | Public | **Deep** (map empty — 0 markers) |
| 5 | `/regjistri` | Public report registry | Public | Partial |
| 6 | `/detailed-registry`, `/registry` | Aliases of #5 | Public | Alias |
| 7 | `/statistikat` | Statistics | Public | Partial |
| 8 | `/transparenca` | Transparency centre | Public | Partial |
| 9 | `/shendetesia` (+ `/semundjet`) | Health registry | Public / personal part gated | Partial; alias checked |
| 10 | `/sondazhet` (+ `/sondazhe`) | Public polls | Public (voting not tested) | Partial; alias has wrong tab title |
| 11 | `/komunat` | 38 municipalities | Public | Partial |
| 12 | `/sherbimet` | Public services | Public | Partial |
| 13 | `/Idea` | Idea bank (capital `I` in path) | Public | Partial |
| 14 | `/projektet` | Platform modules/projects | Public | Partial |
| 15 | `/lajme` (+ `/lajmet`) | News & announcements | Public | Partial; alias checked |
| 16 | `/lajmero` | "Lajmëro" (news tip form) | Public | Partial (title/h1 only) |
| 17 | `/kontakt` (+ `/kontakte`) | Contact form | Public | **Deep**; alias checked |
| 18 | `/kontakt-numrat` | Institution phone directory | Public | Partial |
| 19 | `/rreth-projektit` (+ `/rreth-nesh`) | About | Public | Partial; alias checked |
| 20 | `/kushtet-e-perdorimit` (+ `/terms`) | Terms | Public | Partial; alias checked |
| 21 | `/privatesia` (+ `/politika-e-priveritetit`, `/politika-e-cookies`) | Privacy / cookie policy | Public | Partial; aliases checked |
| 22 | `/donacion` | Donation campaigns | Public | **Deep** |
| 23 | `/partneret` | Partners & advertising | Public | Partial |
| 24 | `/ndihma` | Help centre | Public | Partial |
| 25 | `/forum` | Public Debate (own shell) | Guest guard (guest session auto-created) | Partial (page text, footer, no posting) |
| 26 | `/moderimi-im` | "My moderation" | Gated (login prompt) | Gated; title/h1 only |
| 27 | `/verifikimi` | Request account verification | Gated | Gated; title only |
| 28 | `/login` | Sign in | Public | **Deep** (not submitted) |
| 29 | `/register` | Sign up | Public | Partial (DOM metrics + code; not submitted) |
| 30 | `/buxheti` | Redirects silently to `/` | Public | Alias/redirect |
| 31 | `*` (e.g. `/nuk-ekziston`) | 404 page | Public | **Deep** |
| 32 | `/:lang/…` mirrors | Language-prefixed copies | Public | Tested `/en/raporto`, `/bs/trackid`; `/sq/harta` → bug PUB-UI-025 |

**Total distinct public paths in the route table: 39** (37 in the main layout + `/login`, `/register`), plus the catch-all and the `/:lang` mirrors.

**Deliberately excluded (staff routes, not audited):** `/komuna`, `/komuna-panel`, `/debatwp`, `/debatiwp`, `/agent`, `/monitorim`, `/menagjer`, `/moderim`, `/admin`, `/approvals`.

> **Disclosure.** While checking route aliases my scripted navigation briefly passed through `/komuna-panel`, which redirects to the municipality staff panel `/komuna`. I only read the tab title (`Paneli i komunës`), did not look at, interact with or test its content, and navigated away immediately.

Routes that failed to load: none. Redirect/alias oddities: `/buxheti` → `/` with no message; unknown paths return HTTP 200 on the dev server (see PUB-UI-026).

---

## C. Page-by-Page Audit

Each entry lists **what I observed**; recommended fixes are collected in the defect register (section I) and referenced by ID. Metrics are from in-page DOM measurement at 1440 px unless stated.

### C1. Home — `/`  (Deep)
- **Layout.** Fixed top bar + 248 px left sidebar (≥768 px) + content in a centred container. Order: (optional announcement) → **ad banner** → search → hero (`H1`) → "Çfarë dëshiron të bësh sot?" with five cards → stat tiles → partner block → mini-map + latest reports → Track-ID box → idea box → social block → participation → municipalities → phone numbers → transparency → footer.
- **Good.** Task cards use verbs a citizen understands ("Raporto një problem", "Ndiq raportimin tim", "Më duhet ndihmë"). Emergency numbers (112, 192) are on the page. Page `<title>` is set per route; `<html lang>` follows the language.
- **Issues.**
  - First-visit modal stack (PUB-UI-002).
  - Hero says "Zëri Qytetarëve **Prishtinë**" while `kosova_user_muni = "Të gjitha Komunat"` (PUB-UI-007; `Dashboard.tsx:97`, `:256`).
  - Stat tiles show **0 / 0 / 0 / 6** with the caption "Numrat tregojnë raportet publike të ngarkuara". Whether the database is empty or the read failed could not be told from the UI; there is no empty or error state (PUB-UI-018, SUSPECTED).
  - Heading hierarchy: 1 level skip (H1→H3 in places); two blocks titled "NA NDIQNI" (social block and footer) (PUB-UI-029).
  - 85 text nodes below 12 px (e.g. "Republika e Kosovës" brand subtitle at 8 px, "AL" at 10 px) (PUB-UI-016).
  - 33 interactive elements below 24 px height (incl. "Harta e plotë", "Shiko të gjitha", "Të gjitha 38 komunat") (PUB-UI-015).
  - Mobile 390: search placeholder truncated ("…komunë ose rap…"); hero CTA and cards usable; fixed bottom nav overlays the lower edge (needs bottom padding check — UNTESTED).
- **Responsive.** 1920: content stays in a centred max-width container with wide margins (acceptable). 768: sidebar consumes ~⅓ of width (PUB-UI-013). 320: social cards clip their text.

### C2. Report a problem — `/raporto`  (Deep, not submitted)
Flow: **Step 1** "Hap Procedurën." (upload evidence) → **Step 2** "Specifikat e rastit." (form) → submit → Track-ID confirmation screen (UNTESTED: confirmation).

- **Step 1.**
  - Top of page: ad banner, then a stepper "1 — 2" **without step names**, then a 100+ px hero, then the content card. At 390×844 the dropzone starts at ≈725 px, i.e. just above the fold and partly covered by the bottom nav (PUB-UI-004).
  - **Photo is required** (`ReportIssue.tsx:979-983`: `if (mediaItems.length === 0) { setMediaError(true); … return; }`) while the homepage promises it is optional (`QuickAccessGrid.tsx:21`, English translation "A photo is optional"). The error (`translations.ts:177`, "…dëshmi (Foto/Video) obligative…") is shown for 5 s, has no `role="alert"`/live region, and the page does not scroll to it (PUB-UI-001). *Reproduce:* open `/raporto`, press "Vazhdo te hapi tjetër" without a file.
  - The file input is an invisible full-size `<input type=file class="opacity-0">` (`ReportIssue.tsx:935`) with no accessible name (DOM check: 1 unlabeled input) (PUB-UI-009).
  - Dropzone caption is ALL-CAPS mono 10 px on mobile (`:934`, `text-[10px] … font-mono uppercase`). Limits (12 files, 10 MB) are stated, which is good.
  - Uploaded thumbnails: the **Remove** button appears only on hover (`opacity-0 group-hover:opacity-100`, around `:955`), unreachable by touch or keyboard focus; images are rendered with `mix-blend-luminosity` (grey until hover) (PUB-UI-019).
  - After upload the message "Sistemi Inteligjent Qendror do të procedojë me analizën strukturore bazuar në të dhënat." (`translations.ts:178`) is opaque: it does not say in plain words that the photo is analysed by AI, by whom, or what happens if the analysis fails.
  - Help copy below: "…klikoni direkt mbi hartëpër…" (missing space), `Kliko "Krijim me AI"që…` (missing space, `:1041`), heading "Hap**Procedurën**." renders without a space on ≥640 px (`:922`, `<br className="sm:hidden"/>` between two `dt()` fragments), and a note referring to **"ZëriYT"** (brand name that appears nowhere else) (PUB-UI-022).
- **Step 2.**
  - Fields: title, description, **topic (≈40 emoji options)**, a *second* categorisation "Sektori / Ministria (Kërko Problemin)", urgency "SHKALLA I–IV", municipality, address/coordinates with map and "Zbulo lokacionin (Live)", then for guests **name + phone (both `required`)** unless "Kërkoj statusin anonim në proces" is ticked, then "PROTOKOLLO DHE PËRCELLO".
  - **Raw key shown:** the sector input's placeholder is `report_step2_category_ph ose kërko problemin (psh. rrugë, mbeturina)...` because the key is not defined in any translation file (`ReportIssue.tsx:1153`; grep finds the key only there) (PUB-UI-003). The appended Albanian text is also hard-coded, so it is wrong in the other 22 languages.
  - Two decisions for one idea (topic vs sector/ministry) with help text "…zgjedhja e institucionit poshtë përcakton adresimin e raportit" is expert-level. Jargon: "Identifikimi Subjektit", "Zona e Operimit", "Niveli i Rrezikshmërisë", "PROTOKOLLO DHE PËRCELLO" (hard-coded, not passed through `dt`, `:1412`) (PUB-UI-028).
  - **Labels not associated:** `<label>` elements have no `htmlFor` and do not wrap their input (e.g. `:1353`, `:1365`); placeholders are `"..."` and `"+383..."`. No asterisks, no `aria-required`, no `aria-invalid` (DOM: `aria-required` = 0, `*` = 0, `aria-invalid` = 0) (PUB-UI-009).
  - **Validation.** Native HTML `required` triggers first; the bubble was the browser's own English text ("Please fill out this field.") inside an Albanian page (confirmed). The custom rules (title ≥ 5, description ≥ 20, phone format) live in `validateForm` (`:581-607`, function starts at `:581`) and only run once all native checks pass; their messages are built from field *labels* via `validations.isRequired(title, 'Emërtimi i Çështjes')`. Custom error text uses brand **indigo** (`text-indigo-600`), not an error colour, and no live region (PUB-UI-009, PUB-UI-031).
  - Hard-coded, untranslated user messages: `:538`, `:542`, `:883` and the `toast.error('Për të ruajtur raportin nevojitet një sesion aktiv…')` at `:624` (PUB-UI-010).
  - AI gate: if `aiInsights.authenticityScore < 40` the submit is blocked with "Sistemi Forenzik AI bllokoi raportin: …" (`:638`). A citizen can be refused by an automated judgement with no human route stated on the page (OPPORTUNITY/trust; UNTESTED at runtime).
  - Location: the map pin and `coordinates` default to Prishtinë centre (`:417`); choosing a municipality recentres (`:1232`), but nothing requires the citizen to confirm the pin (SUSPECTED wrong-location risk; UNTESTED).
  - The form deliberately forgets everything on reload (`:421` removes `reportDraft`); only session errors keep the data (PUB-UI-030).
  - Submit button uses `isSubmitting` + `disabled` (duplicate-click protection present — good).
- **Not exercised:** geolocation prompt, address autocomplete, AI analysis, actual submission and the confirmation screen (all would change real data or need real media).

### C3. Track a report — `/trackid`  (Deep)  — **best page in the audit**
- Hero with explanation, one labelled input (`label` ↔ `#track-id-input`, `autocomplete=off`), format example `ZQ-20260101-ABC123`, honest note "Platforma nuk dërgon email konfirmimi", three-step explainer.
- Invalid input ("abc") → inline format help ("8 deri 40 shenja…"); well-formed but unknown ID → `role="alert"` "Nuk u gjet asnjë raportim" with two recovery tips; the lookup is deep-linkable (`?id=`).
- Issues: four different names for this function across the site (PUB-UI-012); decorative hero chips ("Format: ZQ-data-kod", "Pa llogari / Mjafton Track ID") use the word "mjeton"/"token" style jargon in the visual; in Bosnian the hero and ad stay Albanian (PUB-UI-010). 29 text nodes < 12 px.

### C4. Public map — `/harta`  (Deep)
- Map container 1184×500 px at 1440×900 (fixed height; footer starts at y = 657, i.e. inside the first screen); left "Navigator" panel overlays about a third of the map; legend "Niveli i urgjencës".
- **0 markers and no empty-state message** (regex for "nuk ka / asnjë raport" found nothing) (PUB-UI-017).
- No `<h1>` on the page (PUB-UI-029). Icon-only controls without accessible names: the panel-collapse button (`absolute z-[1001] … -right-14`) and a 40×40 rose button inside the navigator (PUB-UI-017). One `<select>` without label.
- Console error captured after route changes: `Uncaught TypeError: Cannot read properties of undefined (reading '_leaflet_pos')` from Leaflet's `_onZoomTransitionEnd` (map unmounted while a zoom animation finishes) (PUB-UI-017).
- 768 px: map area ≈ 500 px wide, controls crowd the map; ad CTA clipped by the container edge (PUB-UI-013). Touch map usability: UNTESTED (no touch device).

### C5. Registry — `/regjistri`, `/detailed-registry`, `/registry`  (Partial)
- H1 is "Regjistri i Zgjeruar"; tab title, footer and sidebar call it "Regjistri i Raporteve" / "Raportimet" (PUB-UI-012). 104 interactive elements; 32 small-text nodes. Mobile 390 clips a "Rendit sipas…" label. Table-vs-card behaviour on phones: UNTESTED visually.

### C6. Statistics — `/statistikat`  (Partial)
- Three `<select>` controls and three chart SVGs without accessible names (DOM: 3 + 3); 86 text nodes < 12 px; charts' textual alternatives UNTESTED. At 390 a search placeholder is clipped.

### C7. Transparency — `/transparenca`  (Partial)
- Clean metrics; 46 small-text nodes; no blocking issue found.

### C8. Health registry — `/shendetesia`, `/semundjet`  (Partial)
- Content partly gated; at 390 several labels clip ("Të dhëna personale të mbr…", "Sipas urgjencës së regjis…") (PUB-UI-014). I did not open or fill the health case wizard.

### C9. Polls — `/sondazhet`, `/sondazhe`  (Partial)
- At **320 px the hero heading breaks mid-word** ("Sondaz/het & Pjesëm/arrja Qyteta/re") because the decorative orbit takes half the card (PUB-UI-014). The `/sondazhe` alias sets the tab title **"Faqja nuk u gjet"** on a valid page (`App.tsx` `ROUTE_TITLES`, lines 135-190, has no `/sondazhe` key) (PUB-UI-021).

### C10. Municipalities — `/komunat`  (Partial)
- 38 cards with photos (38 images, all have `alt`), 288 interactive elements, 99 targets < 24 px ("Raportimet (0)" buttons), 197 small-text nodes. Photo-credit links exist in the DOM with text but render empty (`innerText` = "") — SUSPECTED visually hidden/clipped attribution; verify the licence-credit display. Search input has only a placeholder (no label).

### C11. Services — `/sherbimet`  (Partial)
- At 390 the "Kërko shërbim…" field and several "Hap" links (7 targets < 24 px) are cramped.

### C12. Idea bank — `/Idea`  (Partial)
- Route path has a capital `I` (`/Idea` vs lowercase everywhere else); `/idea` is not defined (PUB-UI-025 note). Clean metrics otherwise.

### C13. Projects `/projektet`, About `/rreth-projektit`, Partners `/partneret`, Help `/ndihma`  (Partial)
- No horizontal overflow at 320–1920; 24–51 small-text nodes each; `/ndihma` search placeholder clipped at 390/768. Help-centre content not read in depth.

### C14. News — `/lajme`, `/lajmet`, `/lajmero`  (Partial)
- `/lajme`: 22 images (all `alt`), 127 small-text nodes, **3 buttons without accessible name** (`rounded-full px-3 py-1.5` — filter pills; SUSPECTED, verify) and 3 heading-level skips. At 390 the example-chip buttons ("●Shembull: …") are < 24 px high (25 targets).

### C15. Contact — `/kontakt`  (Deep) — **good**
- Every field has a label and the right `autocomplete`; honeypot field ("Website", `autocomplete=off`); optional fields are marked "(opsional)", required ones "*"; emergency block first ("Në rrezik? Telefononi menjëherë, mos shkruani këtu. 112/192/193/194"); three routing cards for the most common intents; honest "what happens next" steps.
- Issues: required fields are marked with "*" in text but have no `required`/`aria-required`; "Subjekti" is legal jargon for "Subject".

### C16. Phone directory — `/kontakt-numrat`  (Partial)
- **274 text nodes < 12 px** on desktop and 362 at 390 px — the densest small-text page; search input labelled only by placeholder ("KERKO INSTITUCIONIN…"); "THIRR", "INST." at 9 px (PUB-UI-016). I could not verify the numbers' correctness (not a UI matter).

### C17. Donations — `/donacion`  (Deep)
- **Two identical ad banners are stacked** at the top (confirmed in page text). Clear, honest sentence: "Donacionet nuk kalojnë përmes kësaj faqeje…".
- Dates render as **"Oct 12, 2026"** in the Albanian UI although the code asks for `toLocaleDateString('sq-AL', {month:'short'})` (`DonationsPage.tsx:382`) — likely missing `sq` ICU data in the test browser (SUSPECTED; verify in real Chrome/Safari).
- Content mismatch visible to citizens: a card titled "Hapësira të gjelbra në lagje" describes a flooding house; category chips duplicate "Shtëpi" (looks like seed data; trust impact if it reaches production).

### C18. Legal — `/kushtet-e-perdorimit`, `/privatesia`, `/politika-e-cookies`  (Partial)
- ~11 000 characters each with 3–6 clipped section headings at 390–768 (single-line truncation of long headings such as "Pranimi i kushteve dhe zb…"). `/politika-e-cookies` renders the privacy page (no dedicated cookie policy, EXPECTED but check content). Footer "Menaxho Cookies" is < 24 px high (PUB-UI-015).

### C19. Public Debate — `/forum`  (Partial)
- Uses its own shell: no site header/footer, "Kthehu te platforma" link, guest identity "Mysafir-0000201". Footer line "© 2026 **Platforma Raporto**" (a different brand name) and five links — Privatësia, Kushtet, Reklamimi, Rreth Nesh, **Aksesueshmëria** — all `href="#"` (`ForumPage.tsx:2444-2449`); clicking appends `#` and does nothing (PUB-UI-006). Label "Kërko Reklamë / IBAN" in the composer area is unexplained. Posting, reels, DMs: UNTESTED.

### C20. Login — `/login` and Register — `/register`  (Login Deep, Register Partial)
- **Login.** Always dark, even when the site is in light mode. **No landmarks** (`header/nav/main/footer` count = 0), **no link back to the site** (the only `<a>` is "Krijoni një herë"), brand heading misspelled **"Zeri-Qytetarve."** (`LoginPage.tsx:280`, `:300`), the email/password inputs have **no `autocomplete`** (DOM), "Sistemi Qendror" is internal jargon. Error strings aimed at operators are shown to citizens: "…Aktivizoje në Firebase Console → Authentication" (`LoginPage.tsx:235-237`, `RegisterPage.tsx:175`) (PUB-UI-011). Placeholder colour `rgb(100,116,139)` on a dark translucent field — contrast likely < 4.5:1 (SUSPECTED; not measured against the final composited background).
- **Register (code + metrics).** Good: `autoComplete` on every field, `aria-invalid` + `aria-describedby` error ids, password-strength meter with `role="img"` and label. Friction: required **phone number and date of birth** to create an account (OPPORTUNITY: justify or make optional); no `<h1>` at 390 px because the hero panel is hidden; page has no global navigation (same dead-end risk as login).

### C21. 404 — any unknown path  (Deep) — **good, with one gap**
- Clear heading, "Kthehu te Ballina" / "Kthehu mbrapa", four suggestions, `min-h-11` buttons. Gap: suggestion **labels and hints are hard-coded Albanian** (`NotFoundPage.tsx:18-21`) while the rest of the page is translated — in English the page mixes "Page not found" with "Raporto një problem" (PUB-UI-010).

### C22. Global shell (all routes)
- **Header/sidebar.** Brand "Zëri Qytetarëve." plus 7 top links, bell, theme, language ("AL" = country code, not the language code), "Track ID", "Raporto", "Hyr". Sidebar (≥768 px): 5 groups, active page highlighted, collapse control, social icons, municipality switcher.
- **Mobile (<768 px).** Bottom nav: Ballina · Harta · **＋ (Krijo)** · Hyr · Menu. The ＋ opens a menu "Raporto një problem / Publiko në Debatin Publik / Publiko Reel / Krijo Reklamë" — the citizen's main task shares a menu with creators' tools. **Escape did not close it** (tested with a real key press); the "Menu" drawer has `role=dialog aria-modal="true"` but **focus stayed on the previous control** (`document.activeElement` = "Krijo") (PUB-UI-020).
- **Support bot** (`FloatingSupportBot.tsx`): has `aria-label`s and `role="alert"` for errors (good) but hard-coded labels "Agjent / AI Bot / Ju" (`:338`), hard-coded placeholders (`:357`), input without an accessible name, and the way to reach a human is to type `/agent` (PUB-UI-027). It overlaps page content at 320 px.
- **Cookie banner** (`CookieConsentBanner.tsx`): see PUB-UI-008 and the age gate in PUB-UI-002.
- **Ad slot** (`AppLayout.tsx:196`, `<AdBanner position="top" />` before `<Outlet/>` on all but forum/news): see PUB-UI-004.

---

## D. Component-Level Findings

| Component | Problem | Scope | IDs |
|---|---|---|---|
| `AdBanner` (top slot) | Occupies the first screen on every page; duplicates on `/donacion`; copy stays Albanian in other languages; CTA clipped at 768 px beside the 248 px sidebar | All routed pages | 004, 010, 013 |
| First-visit modals (`CookieConsentBanner` age gate, consent, `LocationDetectorModal`) | Three sequential blocking dialogs; consent spinner on wrong button | Site-wide, first visit | 002, 008 |
| Form labelling pattern (`<label>` without `for`, placeholder-only inputs, `"..."` placeholders) | Missing programmatic labels | `/raporto` step 2, `/komunat`, `/kontakt-numrat`, `/statistikat`, `/harta` selects | 009 |
| Native `required` bubbles + custom error text | English native message in Albanian UI; custom errors are indigo and silent for AT | `/raporto` (Contact page uses custom validation and is better) | 009, 031 |
| Small text (8–11 px) | Brand subtitle, badges, mono captions, directory rows | All pages (24–362 nodes per page) | 016 |
| Small targets (<24 px, mostly <44 px) | Footer "Menaxho Cookies", inline "Shiko të gjitha", chips | All pages (≈86–104 targets < 44 px at 768–1440) | 015 |
| `dt()` bypass (hard-coded Albanian strings) | Toasts, bot labels, 404 suggestions, submit label, placeholders | Multiple | 010 |
| Dialog/menu focus handling | No focus move on open, Escape ignored on FAB menu | Mobile nav | 020 |
| Hover-only controls | "Remove upload" | `/raporto` | 019 |
| Hero + decorative orbit | Starves headline of width at 320 px, mid-word breaks | `/sondazhet`, `/raporto`, `/trackid` heroes | 014 |
| Heading structure | Level skips, missing `h1`, duplicate headings | `/harta`, `/register` (mobile), most pages | 029 |
| Status/error colour | Errors in brand indigo; rose for others | `/raporto` | 031 |
| Footer / shell variants | Forum has its own footer with dead links and different brand | `/forum` | 006, 012 |

---

## E. Responsive Audit Matrix

Status rules: **Pass** only if all relevant checks were completed — **I did not complete the full check set on any page/viewport, so no cell is Pass.** Instead:

- **P\*** = *Partial*: loaded, **no horizontal page scroll**, automated metrics collected, selected screenshots only. Visual and touch usability not fully reviewed.
- **Fail** = a confirmed viewport-specific defect (reference in brackets).
- **NT** = not tested.

Tested viewports (emulated in the built-in browser pane): **1920×1080, 1440×900, 768×1024, 390×844, 320×700.** **1366×768 was not tested.** Landscape orientation: NT.

| Route | 1920 | 1440 | 1366 | 768 | 390 | 320 |
|---|---|---|---|---|---|---|
| `/` | P\* | P\* | NT | Fail (013) | P\* | Fail (004, 014) |
| `/raporto` | NT | P\* | NT | P\* | Fail (004) | Fail (004) |
| `/trackid` | NT | P\* | NT | P\* | P\* | Fail (004) |
| `/harta` | NT | P\* | NT | Fail (013) | P\* | P\* |
| `/regjistri` | NT | P\* | NT | P\* | P\* | P\* |
| `/statistikat` | P\* (contrast only) | P\* | NT | P\* | P\* | P\* |
| `/transparenca` | NT | P\* | NT | P\* | P\* | NT |
| `/shendetesia` | NT | P\* | NT | P\* | P\* | NT |
| `/sondazhet` | P\* (contrast only) | P\* | NT | P\* | P\* | Fail (014) |
| `/komunat` | P\* (contrast only) | P\* | NT | P\* | P\* | P\* |
| `/sherbimet` | NT | P\* | NT | P\* | P\* | P\* |
| `/Idea` | NT | P\* | NT | P\* | P\* | NT |
| `/projektet` | NT | P\* | NT | P\* | P\* | NT |
| `/lajme` | NT | P\* | NT | P\* | P\* | P\* |
| `/kontakt` | NT | P\* | NT | P\* | P\* | P\* |
| `/kontakt-numrat` | P\* (contrast only) | P\* | NT | P\* | P\* | P\* |
| `/rreth-projektit` | NT | P\* | NT | P\* | P\* | NT |
| `/kushtet-e-perdorimit` | NT | P\* | NT | P\* | P\* | NT |
| `/privatesia` | NT | P\* | NT | P\* | P\* | NT |
| `/donacion` | NT | P\* | NT | P\* | P\* | P\* |
| `/partneret` | NT | P\* | NT | P\* | P\* | NT |
| `/ndihma` | NT | P\* | NT | P\* | P\* | P\* |
| `/forum` | NT | P\* (text only) | NT | NT | NT | NT |
| `/login` | NT | P\* | NT | P\* | P\* | P\* |
| `/register` | NT | NT | NT | P\* | P\* | P\* |
| 404 | NT | P\* | NT | NT | P\* (script only) | NT |

Cross-viewport facts from the sweeps: `scrollWidth ≤ viewport` for every measured route at 320/390/768/1440; the "overflow" probe flagged only a decorative off-canvas element at 1440 on `/`.

---

## F. Citizen Journey Analysis

### F1. "I see a problem and want to report it" (highest priority)
Current path (first visit, phone):
1. Open site → **age modal** (type age, Enter) → **cookie modal** (choose) → **location modal** (choose municipality or "all") → homepage, with an **ad on top**.
2. Scroll to the hero or the "Raporto një problem" card → `/raporto` → ad again → stepper → hero (~1 screen) → dropzone.
3. **Needs a photo** (contradicts the card). If none, the citizen is stuck.
4. Step 2: topic (40 options) → **second** category ("Sektori/Ministria") → urgency "SHKALLA I–IV" → municipality → location → name + phone (unless anonymous) → "PROTOKOLLO DHE PËRCELLO".
5. Confirmation with Track-ID (UNTESTED).

Friction points: modal stack; ad before task; photo rule; two category decisions; jargon; no required markers; transient error; no draft saved.

Proposed (preserves all capabilities): (a) one combined, dismissible first-visit sheet, with the age check scoped to account creation/posting rather than blocking read-only content — **policy decision for the owner/legal**; (b) remove the top ad from task pages or push it below the primary action; (c) make the photo optional (or change the copy everywhere, and keep an explicit "no photo available" path); (d) single "what is the problem about?" choice with the ministry/sector derived or moved to an "advanced" disclosure; (e) plain labels ("Titulli", "Përshkrimi", "Kategoria", "Urgjenca", "Komuna", "Emri", "Telefoni"), `*` + `aria-required`, inline errors in an error colour with a summary and focus on the first error; (f) button text "Dërgo raportin"; (g) after submit, explain what the statuses mean and what is *not* promised.

### F2. "I want to know what happened to my report"
Path: nav "Track ID" (1 click) or home card → `/trackid` → paste ID → result. **This is the strongest journey** (clear format, deep link, good errors). Gaps: four names for it (PUB-UI-012); behind the first-visit modals like everything else; hero decoration in the visual uses unexplained chips.

### F3. "I need a phone number / emergency"
112/192 are on the homepage and `/kontakt`; the directory page `/kontakt-numrat` is dense (274 tiny text nodes). A citizen in an emergency still must pass the age/cookie/location modals on first visit (PUB-UI-002).

### F4. "What is happening in my area?" (map / registry / statistics)
Three overlapping pages with three different names ("Harta e Raportimeve", "Raportimet"/"Regjistri i Raporteve"/"Regjistri i Zgjeruar", "Statistikat & Analiza"). Map shows nothing and explains nothing when empty (PUB-UI-017).

### F5. "I want an account"
Register asks name, date of birth, email, **phone**, password. Login is a dead-end page (no way back except the browser). Operator-style error messages appear on failure (PUB-UI-011).

### F6. Language switching
Page is preserved on switch (`/trackid` → `/bs/trackid` ✔), but content is only partly translated (PUB-UI-010).

---

## G. Accessibility Findings

Target: WCAG 2.2 AA. Automated + manual DOM inspection only. **No screen reader, no Lighthouse/axe run** (not available here), so nothing below is a compliance claim.

| ID | Issue | Component | WCAG (verified) | Impact | Evidence | Remediation |
|---|---|---|---|---|---|---|
| G-1 / PUB-UI-005 | No skip link; 49 focusable controls before `<main>`; `main` has no id | App shell | 2.4.1 Bypass Blocks (A) — failure | Keyboard/AT users tab through ≈49 controls on every page | DOM: `beforeMain: 49`, no `a[href^="#"]` | Add a first-in-DOM "Kalo te përmbajtja" link to `<main id="main" tabindex="-1">` |
| G-2 / PUB-UI-009 | Report-form labels not bound to inputs; placeholders `"..."`; no `required` semantics; native English bubble | `/raporto` step 2 | 1.3.1, 3.3.2, 4.1.2 (A) — failure (code-verified; step-2 DOM label count not measured) | Screen-reader users hear unnamed fields | `ReportIssue.tsx:1353`, `:1365`; DOM `aria-required` 0 | `htmlFor`/`id`, visible `*`, `aria-required`, `aria-describedby` error ids, `aria-live` summary |
| G-3 | File input has no accessible name | `/raporto` step 1 | 4.1.2 (A) | Upload control unnamed | DOM `noLabel` = `INPUT[file]` | Visible `<label>` / `aria-label` on the input; keep it focusable with visible focus ring |
| G-4 / PUB-UI-019 | "Remove upload" appears on hover only | `/raporto` | 2.1.1 (A), 1.4.13 | Touch/keyboard cannot remove a wrong file | Code around `:955` | Always-visible remove button, `aria-label="Hiq <file>"` |
| G-5 / PUB-UI-020 | Dialog opened without moving focus; `Escape` didn't close the FAB menu | Mobile nav | 2.4.3 (A), 2.1.2 | Focus order lost behind a modal drawer | `activeElement` stayed "Krijo"; menu still open after Escape | Focus first control on open, trap, restore on close, handle Escape |
| G-6 / PUB-UI-015 | Targets < 24 px: 33 on home (1440), 6 at 390 px, footer "Menaxho Cookies" | Many | 2.5.8 Target Size (Minimum) (AA) — failure for non-inline targets | Mis-taps, esp. motor impairments | DOM; e.g. `A:Rreth Projektit` at 390 | Min 24×24 (prefer 44×44 on touch) with spacing |
| G-7 / PUB-UI-016 | Text at 8–11 px (brand subtitle 8 px, badges 9–10 px, directory 9 px) | Shell + many pages | 1.4.4 (AA) at risk; readability | Hard to read, zoom-dependent | DOM tiny-text counts 19–362/page | Floor of 12 px for informational text, 14 px for body |
| G-8 | Unnamed controls: 2 on `/harta`, 3 SVG charts + 3 selects on `/statistikat`, 3 buttons on `/lajme`, search inputs by placeholder only | Listed pages | 4.1.2, 1.1.1, 3.3.2 | Unnamed controls | DOM `noName`/`noLabel` | Names/labels; chart text alternative or data table |
| G-9 / PUB-UI-011 | Login/register: no landmarks on login, no `autocomplete` on login | `/login` | 1.3.1 (A), 1.3.5 (AA), 3.3.7 (A) | Password managers/AT struggle; dead end | DOM landmarks `[]`, `autocomplete=""` | `<main>`, home link, `autocomplete="username"/"current-password"` |
| G-10 / PUB-UI-029 | Heading problems: missing `h1` (`/harta`, `/register` mobile), level skips on most pages, duplicate "NA NDIQNI" | Several | 1.3.1, 2.4.6 | Poor outline navigation | DOM `h1: 0`, `headingSkips` 1–3 | One `h1` per page; no skipped levels |
| G-11 | Transient error not announced: report-photo error disappears after 5 s, no live region | `/raporto` | 4.1.3 Status Messages (AA), 3.3.1 | Error missed | `ReportIssue.tsx:970-976` | `role="alert"`, persist until fixed |
| G-12 | Custom error colour = brand indigo, same as links/CTAs | `/raporto` | 1.4.1 (colour alone) risk | Errors not distinct | `text-indigo-600` on error `<p>` | Error token + icon (an icon is already present) |
| G-13 | Contrast | all | 1.4.3 | — | Computed-style sampling on 5 pages found **no confirmed failures** among measurable text; all 3 "failures" were gradient/photo-backed buttons my method cannot measure. Login placeholder likely low (SUSPECTED) | Run axe/Lighthouse + manual check on gradient heroes and login |
| G-14 | Reduced motion | all | 2.3.3 (AAA) / best practice | — | 3 `prefers-reduced-motion` rules exist; no infinite CSS animation seen at rest | UNTESTED beyond that |
| — | Present and OK (spot-checked) | — | — | — | Visible focus outline (2 px) on nav links; `<html lang>` follows language; landmarks `header/nav/main/footer/aside` on the main layout; `alt` on all `<img>` measured (0 missing on 16–38 images) | — |

**Not tested:** screen-reader behaviour, 200 %/400 % zoom and text-spacing overrides, high-contrast mode, captions/transcripts (no public video content seen), dark mode on most pages, RTL (Arabic) layout.

---

## H. Localization Findings

The site advertises **23 selectable languages** (`languageConstants.ts`, `SUPPORTED_LANGUAGES`). I tested **Bosnian and English** only; **21 languages are untested.** Arabic (RTL) is NT.

| # | Finding | Evidence | Affected |
|---|---|---|---|
| H-1 | Page preserved on language switch (`/trackid` → `/bs/trackid`); `<html lang>` and `<title>` update | Confirmed | Switcher — **good** |
| H-2 | `/bs/trackid` shell is Bosnian but the page body (hero, ad, explainer) stays **Albanian** | Confirmed (text after 10 s wait) | `/trackid` and likely others |
| H-3 | `/en/raporto` hero subtitle, ad banner ("HAPËSIRË REKLAMIMI", "Kërko ofertë") stay Albanian; "mapto determine" (missing space) | Confirmed | `/raporto`, all pages with the ad |
| H-4 | 404 suggestions (labels + hints) hard-coded Albanian | `NotFoundPage.tsx:18-21`; seen in English | 404 |
| H-5 | Hard-coded strings bypassing `dt`: report toasts (`ReportIssue.tsx:538, 542, 624, 883`), submit label (`:1412`), support bot labels/placeholders (`FloatingSupportBot.tsx:338, 357`) | Code | `/raporto`, bot |
| H-6 | Sector field placeholder = untranslated **key** + hard-coded Albanian tail | Confirmed | `/raporto` all languages (PUB-UI-003) |
| H-7 | Native validation bubble uses the browser language, not the site language | Confirmed (English bubble on Albanian page) | forms with `required` |
| H-8 | Route slugs stay Albanian under every prefix (`/en/raporto`, `/de/sherbimet`) | Confirmed | EXPECTED/OPPORTUNITY (shareable, but unreadable to non-Albanian speakers) |
| H-9 | Header links under `/bs/…` point to unprefixed hrefs (`/komunat`, `/sherbimet`); language is retained via stored preference | DOM hrefs | Shared/copied links lose the language |
| H-10 | `/sq/harta` becomes `/en/sq/harta` → 404 when the stored language is English | Confirmed | PUB-UI-025 |
| H-11 | Date shown as "Oct 12, 2026" in Albanian UI | Observed; likely ICU data in test browser | `/donacion` — SUSPECTED |
| H-12 | Language button shows "AL" (country code) rather than "SQ" | Confirmed | Switcher — minor |
| H-13 | Product/brand names inconsistent (see PUB-UI-012) | Confirmed | Global |

Proposed wording is **not** supplied for legal/procedural text — those need review by a Kosovo-law-aware translator. For plain UI labels, suggested Albanian replacements appear in PUB-UI-028.

---

## I. Prioritised Defect Register

Severity per the brief (P0 critical, P1 high, P2 medium, P3 low). Complexity: **S** ≤ ½ day, **M** 1–3 days, **L** > 3 days. "Verify" lists acceptance checks.

### P1 — High

**PUB-UI-001 — Photo is mandatory in the report flow but advertised as optional** · `/raporto`, home card · **CONFIRMED**
- *Evidence.* Home card copy `QuickAccessGrid.tsx:21` ("Fotografia është sipas dëshirës"; en: "A photo is optional"). Step 1 gate `ReportIssue.tsx:979-983`; message `translations.ts:177` calls proof "obligative". DOM check after clicking continue with no file: message shown, no live region.
- *Repro.* `/raporto` → "Vazhdo te hapi tjetër" without a file.
- *Impact.* Citizens without a photo (or on a bad connection) are blocked from the core action by a rule the site told them does not exist. Scope: every reporter.
- *Fix.* Decide the rule; then make copy match in all languages. Preferred: allow reports without media (keep the stepper), keep the "add evidence" prompt; if mandatory, change the home card and the step-1 title, and make the error persistent with `role="alert"` and scroll/focus.
- *Dependencies.* Product decision; server/rules may also require media (not checked). *Complexity.* S (copy) / M (flow).
- *Verify.* Home card, step 1 and error text agree in sq/en/bs; submission without photo either works end-to-end or is consistently described.

**PUB-UI-002 — Three stacked blocking modals on first visit (age → cookies → location)** · site-wide · **CONFIRMED**
- *Evidence.* Fresh profile: age modal ("Sa vjeç jeni?", `CookieConsentBanner.tsx:17,38-76`) → consent modal → location modal "Zgjidhni Vendndodhjen"; nothing behind them is usable; the age check blocks reading entirely (<16 = refused). Body scroll is locked.
- *Impact.* First-time and time-pressured users (incl. someone who only wants `/trackid` or 112) face three decisions with no content. The age gate is self-declared and gates read-only public information.
- *Fix.* Do not block read-only pages; scope the age check to account creation/posting (confirm the legal requirement with the owner); merge consent + location into one non-modal bar/sheet; default municipality to "all" without a modal; never gate emergency contacts.
- *Dependencies.* Legal/policy decision on the 16+ rule; analytics consent logic. *Complexity.* M.
- *Verify.* A new visitor can reach `/trackid`, `/kontakt-numrat` and the home page content with 0 required dialogs; consent still recorded before analytics/ads.

**PUB-UI-003 — Raw translation key shown in the report form** · `/raporto` step 2 · **CONFIRMED**
- *Evidence.* Sector input placeholder renders `report_step2_category_ph ose kërko problemin (psh. rrugë, mbeturina)...`; `ReportIssue.tsx:1153` calls `(t as any)('report_step2_category_ph')`; the key exists in no translation file (grep).
- *Impact.* Developer text in the form's key categorisation field, on every report, in every language; the hard-coded tail is Albanian only.
- *Fix.* Add the key to `translations.ts` for all languages (or use `dt('Kërko problemin (psh. rrugë, mbeturina)…')`); add a lint/test that fails on missing `t()` keys.
- *Dependencies.* none. *Complexity.* S.
- *Verify.* Placeholder reads naturally in sq/en/bs; a unit test asserts no rendered text matches `/^[a-z0-9_]+_ph\b/`.

### P2 — Medium

**PUB-UI-004 — Ad banner leads every routed page, including task pages** · all routes except forum/news · **CONFIRMED**
- *Evidence.* `AppLayout.tsx:196` renders `<AdBanner position="top" />` before `<Outlet/>`. At 320×700 the banner (~430 px tall) fills ≈60 % of the first viewport on `/sondazhet`; at 390×844 the report dropzone starts at ≈725 px. `/donacion` shows **two** identical ads (page text).
- *Impact.* Primary task is pushed down on small phones; ads read as part of the civic UI (trust).
- *Fix.* No top ad on `/raporto`, `/trackid`, `/login`, `/register`, `/kontakt`; elsewhere cap the strip to ≤ 64 px on mobile (single-line, collapsible) and place it after the page title; never render two ad slots adjacent; label clearly as advertisement (it already says "HAPËSIRË REKLAMIMI").
- *Dependencies.* Ad business rules. *Complexity.* S–M.
- *Verify.* At 390×844 the report step-1 dropzone and Track-ID input are fully above the fold; no page has two adjacent banners.

**PUB-UI-005 — No skip link; ~49 tab stops before main content** · all · **CONFIRMED** · WCAG 2.4.1 · *Fix* see G-1 · **S** · *Verify* first Tab on any page focuses a visible "Kalo te përmbajtja" that moves focus to `<main>`.

**PUB-UI-006 — Five dead `href="#"` links in Public Debate footer** · `/forum` · **CONFIRMED**
- *Evidence.* `ForumPage.tsx:2444-2449` (Privatësia, Kushtet, Reklamimi, Rreth Nesh, Aksesueshmëria); click leaves URL at `/forum#` with no dialog. Footer also says "© 2026 Platforma Raporto".
- *Impact.* Privacy/terms and an *Accessibility* link that do nothing — a trust and legal-visibility problem on the most social page.
- *Fix.* Link to `/privatesia`, `/kushtet-e-perdorimit`, `/partneret`, `/rreth-projektit`, and an accessibility statement (create or remove); use the site brand. **S.** *Verify.* All five open real pages; none has `href="#"`.

**PUB-UI-007 — Hero shows "Prishtinë" when "all municipalities" is chosen** · `/` · **CONFIRMED**
- *Evidence.* `kosova_user_muni = "Të gjitha Komunat"`, H1 "Zëri Qytetarëve Prishtinë" (`Dashboard.tsx:97` `activeMunicipality || 'Prishtinë'`, `:256`).
- *Impact.* National visitors are told they are in Prishtinë; hero photo is Prishtinë.
- *Fix.* For the national scope show "Zëri i Qytetarëve" / "Kosovë" and a neutral hero image. **S.** *Verify.* Select "Të gjitha Komunat" → H1 has no municipality name.

**PUB-UI-008 — Cookie "Decline" shows a spinner on the "Accept" button** · consent dialog · **CONFIRMED**
- *Evidence.* Clicking "Refuzo jo-esencialet" renders the `Loader2` inside "Prano të gjitha" (`CookieConsentBanner.tsx:249-252, 269-272`, `isSaving` shared; screenshot).
- *Impact.* Looks as if the citizen accepted; weakens consent trust (GDPR-style "equal prominence" concerns).
- *Fix.* Track which action is pending (`savingAction: 'accept' | 'reject' | null`) and show the spinner on that button only. **S.**
- *Verify.* Decline → spinner on Decline; stored consent matches the clicked button.

**PUB-UI-009 — Report form fields: unbound labels, no required markers, native English bubbles, silent custom errors** · `/raporto` step 2 · **CONFIRMED (code + DOM)**
- *Evidence.* G-2, G-3, G-11, G-12; `ReportIssue.tsx:581-607`, `:1353-1372`; placeholders `"..."`, `"+383..."`.
- *Fix.* Add `noValidate` and use the existing `validateForm` for all fields in a single pass; error summary with `role="alert"` + focus first error; `htmlFor`/`id`; `*`; error colour token; Albanian messages by field ("Shkruani titullin (të paktën 5 shkronja)"). Keep the Contact page's pattern as the reference. **M.**
- *Verify.* Submit empty: summary announced, first invalid field focused, all messages localized, keyboard-only completion possible at 320 px.

**PUB-UI-010 — Mixed-language UI outside Albanian** · multiple · **CONFIRMED**
- *Evidence.* H-2 … H-5, H-7; list of hard-coded strings in section H.
- *Fix.* Route all visible strings through `dt`/`t`; extract ad-banner chrome, hero subtitle, 404 labels, bot labels; add a CI check that scans for non-`dt` JSX text in public pages. **M.** *Verify.* In `en` and `bs`, an automated text scan of the 10 core pages finds no Albanian-only strings.

**PUB-UI-011 — Login/Register: dead end, misspelled brand, operator error text** · `/login`, `/register` · **CONFIRMED**
- *Evidence.* No landmarks and no link back (DOM); "Zeri-Qytetarve." (`LoginPage.tsx:280, 300`); no `autocomplete`; citizen-visible errors mention Firebase Console (`LoginPage.tsx:235-237`, `RegisterPage.tsx:175`).
- *Fix.* Add logo/home link and `<main>`; correct the brand; `autocomplete`; replace operator messages with citizen messages ("Hyrja me Google nuk është e disponueshme tani. Provoni me email.") and log details to the console only. **S–M.** *Verify.* No page text contains "Firebase", "Console", "domain nuk është i autorizuar".

**PUB-UI-012 — Inconsistent names for the same things** · global · **CONFIRMED**
- *Evidence.* Tracking: "Track ID" (nav) · "Ndiq raportimin tim" (home card) · "Gjej Raportin Tim" (footer, tab title) · "Ndiq raportimin tënd, hap pas hapi" (H1). Registry: "Raportimet" (sidebar) · "Regjistri i Raporteve" (footer, title) · "Regjistri i Zgjeruar" (H1). Map: "Harta e Raportimeve" vs "Harta e Raporteve". Report noun: "raport" vs "raportim". Brand: "Zëri Qytetarëve", "Zëri i Qytetarëve", "ZëriYT", "Zeri-Qytetarve", "Platforma Raporto", "Zëri Qytetar" (bot).
- *Fix.* Glossary of canonical labels (one noun for report, one name per destination, one brand string); apply to nav, footer, titles, H1s, `ROUTE_TITLES`. **S–M.** *Verify.* Each destination uses exactly one label sitewide.

**PUB-UI-013 — Tablet (768 px): permanent 248 px sidebar leaves ~520 px content; ad CTA clipped** · `/`, `/harta`, all · **CONFIRMED**
- *Evidence.* Sidebar shown from `md` (768) (`AppLayout.tsx:134,157`); `/harta` screenshot: "Kërko ofertë" cut at the container edge; map ≈ 500 px wide.
- *Fix.* Raise the sidebar breakpoint to ≥1024 px (use the mobile drawer on tablets) or make it collapsible/icon-only at 768–1023; ensure ad CTA wraps. **M.** *Verify.* At 768 content width ≥ 640 px or sidebar collapsed by default; no clipped CTA.

**PUB-UI-014 — At 320 px, decorative orbit squeezes hero headings (mid-word breaks)** · `/sondazhet` and other `Aura` heroes · **CONFIRMED**
- *Evidence.* 320×700 screenshot: "Sondaz/het & Pjesëm/arrja Qyteta/re". Several pages truncate long headings with ellipsis at 390–768 (legal pages, health).
- *Fix.* Hide the orbit < 480 px (or stack it below), `hyphens: manual; overflow-wrap: anywhere` only as a fallback, and let headings wrap instead of truncating. **S.** *Verify.* No heading breaks inside a word at 320; legal headings fully visible.

**PUB-UI-015 — Touch/pointer targets too small** · all · **CONFIRMED**
- *Evidence.* Targets < 24 px: 33 on `/` (1440), 6 at 390 (e.g. "Rreth Projektit", "38 Komunat", "Shërbimet" in the footer), "Menaxho Cookies" on every page (at 320–390: 1–3 per page); < 44 px: 86–104 on desktop/tablet and ≥ 39 at 390.
- *Fix.* Enforce 24×24 minimum (WCAG 2.5.8) now and 44×44 for primary mobile controls; use padding rather than larger text; footer link rows `py-2`. **M.** *Verify.* DOM probe: 0 non-inline targets < 24 px; primary actions ≥ 44 px at 390.

**PUB-UI-016 — Text below 12 px is widespread** · all · **CONFIRMED**
- *Evidence.* DOM counts per page 19–362 (`/kontakt-numrat` 362 at 390; brand subtitle 8 px; dropzone caption 10 px mono caps; "INST." 9 px).
- *Fix.* Type scale floor: 12 px for meta, 14 px body; avoid all-caps + mono + tiny together. **M.** *Verify.* Probe finds 0 text nodes < 12 px on core pages.

**PUB-UI-017 — Public map: empty state, unnamed controls, console error, fixed height** · `/harta` · **CONFIRMED**
- *Evidence.* 0 markers and no empty message; two unnamed buttons; no `h1`; Leaflet `_leaflet_pos` TypeError after route changes; map fixed 500 px so the footer is in the first screen at 1440×900.
- *Fix.* Empty state ("Nuk ka ende raporte publike për këtë zonë"), `aria-label`s, an `h1`, cancel Leaflet animations on unmount (`map.remove()`/`whenReady` guards), height `clamp(420px, 70dvh, 800px)`. **M.** *Verify.* No console errors on navigating away mid-zoom; screen reader announces the controls.

**PUB-UI-018 — Homepage statistics show 0 without context** · `/` · **SUSPECTED**
- *Evidence.* "0 / 0 / 0 / 6" with caption about uploaded public reports; couldn't tell empty data from a failed read. No loading/empty/error variation.
- *Fix.* Skeleton while loading, "—" + retry on error, explanatory empty text. **S.** *Verify.* Simulate failed read → no "0".

**PUB-UI-019 — "Remove upload" is hover-only; previews are greyscale until hover** · `/raporto` · **CONFIRMED (code)** · `ReportIssue.tsx:955` (remove button), `:943,:945` (`mix-blend-luminosity`) · *Fix* always-visible remove control with `aria-label`; normal colour previews · **S** · *Verify* touch device can remove a file.

**PUB-UI-020 — Dialog/menu focus and Escape handling** · mobile nav · **CONFIRMED** · G-5 · **M** · *Verify* keyboard-only open/close of "Krijo" and "Menuja", focus returns to the trigger.

### P2 (continued)

**PUB-UI-028 — Report step 2 is dense and uses jargon** · `/raporto` · **CONFIRMED**
- *Evidence.* ≈40 topics + a second sector/ministry list; labels "Identifikimi Subjektit", "Zona e Operimit", "Niveli i Rrezikshmërisë", "SHKALLA I–IV", button "PROTOKOLLO DHE PËRCELLO" (hard-coded).
- *Fix (wording proposals, for review — not authoritative).* "Ku ndodhi?" (Zona e Operimit) · "Sa urgjent është?" (Niveli i Rrezikshmërisë) with plain descriptions · "Të dhënat tuaja" (Identifikimi Subjektit) · "Dërgo raportin" (submit). Make one "Kategoria" required and move ministry/sector into an optional "Institucioni përgjegjës (opsional)". **M.**
- *Verify.* Moderated test with 5 first-time users: ≥ 4 finish without help (not yet performed).

**PUB-UI-029 — Heading/landmark structure** · many pages · **CONFIRMED** · G-10 · **S–M**.

### P3 — Low

**PUB-UI-021 — Tab title "Faqja nuk u gjet" on a valid route** · `/sondazhe` · **CONFIRMED** · `App.tsx` `ROUTE_TITLES` (lines 135-190) lacks `/sondazhe` · *Fix* derive title from the component (`usePageMeta`) rather than a path table, or add the key · **S**.

**PUB-UI-022 — Missing spaces / typos in visible copy** · `/raporto` · **CONFIRMED** · "hartëpër", `Kliko "Krijim me AI"që` (`:1041`), heading "HapProcedurën." (`:922`), "mapto determine" (en) · **S**.

**PUB-UI-023 — Language label "AL" instead of "SQ"; header links lack language prefix** · switcher/header · **CONFIRMED** · **S**.

**PUB-UI-025 — `/sq/…` is not a valid prefix; with another stored language it turns into `/en/sq/…` → 404; `/Idea` is case-sensitive** · **CONFIRMED** · *Fix* treat `/sq/*` as an alias that redirects to the unprefixed path, lowercase `/idea` alias · **S**.

**PUB-UI-026 — Unknown URLs return HTTP 200 (soft 404)** · **SUSPECTED** (observed on the dev server only; check the Netlify config) · **S**.

**PUB-UI-027 — Support bot: hard-coded labels, unnamed input, `/agent` command to reach a human** · `FloatingSupportBot.tsx:338, 357` · **CONFIRMED (code)** · *Fix* visible "Fol me një agjent" button; `aria-label` on the input · **S**.

**PUB-UI-030 — Report draft is deliberately not kept** · `ReportIssue.tsx:421` · **EXPECTED/OPPORTUNITY** · keep an in-memory (not storage) draft across step navigation and recoverable errors · **M**.

**PUB-UI-031 — Error colour = brand indigo** (see G-12) · **CONFIRMED** · define `--color-danger` tokens · **S**.

**PUB-UI-032 — Mobile home search placeholder truncated; fixed bottom nav overlays page end** · **CONFIRMED (placeholder) / UNTESTED (padding)** · shorten placeholder ("Kërko në platformë"), ensure `padding-bottom ≥ nav height + safe-area` · **S**.

**PUB-UI-033 — Donation page content/formatting** · dates "Oct 12, 2026" (SUSPECTED), title/body mismatch (data), duplicate ad · **S**.

**Also noted, no ID needed:** the donation/campaign wording is clear that no money is processed on the site (good). Photo-credit links on `/komunat` rendered with empty text (SUSPECTED hidden attribution).

---

## J. Recommended Design Direction

Keep the current identity: deep blue + indigo accent, serif display (`title-serif`) over a grotesque sans, soft cards with light borders, large rounded hero panels, task-card home. These are recognisable and appropriate for a civic product. What needs a system rather than one-off tweaks:

1. **Task-first pages.** On `/raporto`, `/trackid`, `/login`, `/kontakt`: one `h1`, the primary control above the fold on 390×844, no ad above it.
2. **One status palette.** Define tokens `--status-info/success/warning/danger` with accessible text/background pairs; use them for errors, toasts, report statuses (Të raportuar / Në trajtim / Të zgjidhur / Urgjent) with an icon + text (not colour alone). Reserve indigo for brand and links.
3. **Form pattern = the Contact page.** Visible label above field, `*` for required, helper text below, error message with icon in the danger token, summary on submit, 44 px control height, 16 px input text (avoids iOS zoom).
4. **Type scale.** 12 (meta, min) / 14 (small body) / 16 (body) / 20 / 24 / 32–40 (display), line-height 1.5 for body; stop combining mono + ALL-CAPS + ≤ 10 px.
5. **Spacing and containers.** 4 px base; page container max 1200 px content + 248 px sidebar ≥ 1024 px; drawer navigation < 1024 px; 16 px side gutters on phones.
6. **Breakpoints.** 360 / 480 / 768 / 1024 / 1280; hide decorative hero art below 480.
7. **Buttons.** Three sizes (36/44/52) × primary / secondary / quiet / destructive; same radius (e.g. 12 px) everywhere; label sentence case (avoid "PROTOKOLLO DHE PËRCELLO").
8. **Ads.** A single component with a defined max height and a clear "Reklamë" label; none on task pages.
9. **Language.** One i18n access path (`t`/`dt`), no raw keys, and a CI check for missing keys and hard-coded JSX text.

These are recommendations to validate against the existing CSS tokens (`ZERI/design-tokens.json`, `src/index.css`, `src/styles/`), not a mandate to replace them.

---

## K. Implementation Roadmap

**Phase 1 — Critical citizen-facing blockers (mandatory)** · PUB-UI-001, 003, 002 (design decision first), 008, 006. *Dependencies:* product + legal decisions for 001/002.

**Phase 2 — Core navigation & reporting usability (mandatory)** · 004, 009, 028, 012, 011, 017, 018, 019, 027. *Dependencies:* glossary of labels (012) before copy edits; error-token (031) before form work.

**Phase 3 — Responsive & accessibility (mandatory for WCAG 2.2 AA claim)** · 005, 013, 014, 015, 016, 020, 029, plus axe/Lighthouse runs and manual screen-reader passes (NVDA/VoiceOver) that this audit could not do.

**Phase 4 — Typography, dimensions, design-system consistency** · tokens (section J), 031, 023, 032, 022.

**Phase 5 — Polish & performance** · 007, 010 (full sweep for the remaining 21 languages), 021, 025, 026, 030, 033; production-build Lighthouse/Core Web Vitals; image formats/sizes; Leaflet unmount fix (017 part).

*Optional enhancements:* saved in-memory draft, human-handover button in the support bot, stats skeletons, language-prefixed internal links.

---

## L. Final Coverage Statement

- **Total public routes discovered:** 39 distinct paths in the route table (+ catch-all 404 + `/:lang` mirrors for 22 other languages). Staff routes (10 paths) were intentionally excluded.
- **Deeply inspected (content read + interactions):** 8 — `/`, `/raporto` (steps 1–2, not submitted), `/trackid`, `/harta`, `/kontakt`, `/donacion`, `/login`, 404.
- **Partially inspected (loaded, DOM-measured, text/title/h1 read, some code read):** ~26 — all remaining public paths and aliases in section B, including `/forum`, `/register`, gated `/moderimi-im`, `/verifikimi`.
- **Not inspected in depth / not exercised:** poll voting, idea submission, news-tip form, registry filters and report detail modal, statistics charts, health case wizard, forum posting/reels/DMs, notification menu, share sheet, partner/ad request modal, municipality switcher, global search results, success/confirmation screens.
- **Viewports actually tested:** 1920×1080 (home + contrast probes), 1440×900 (all routes), 768×1024 (24 routes), 390×844 (25 routes), 320×700 (16 routes). **Not tested:** 1366×768, landscape, real devices/touch.
- **Languages tested:** Albanian (default), Bosnian (`/bs/trackid`), English (`/en/raporto`). **21 of 23 languages untested**, including Arabic RTL.
- **Interactions tested:** age gate (test value, passed), consent decline, location picker ("all"), step navigation on `/raporto` with an in-memory generated test image (never submitted), native validation, Track-ID lookup (invalid and unknown IDs), language switch, mobile "Krijo" menu + "Menu" drawer, support-bot open, forum footer link, keyboard Tab/Escape, direct URL loads and SPA navigation.
- **Not done on purpose:** no report submitted, no account created, no registration/login attempt, no real upload, no geolocation grant, no real AI analysis, nothing posted.
- **Tools used:** project dev server (`server.ts`, port 3030, run from the main checkout at the same commit because this worktree has no `node_modules`/`.env`); the built-in browser pane with viewport emulation; in-page JavaScript probes (DOM, computed styles, PerformanceObserver); code reading of the public pages/components cited. Screenshots were taken for evidence but are **not stored in the repo**.
- **Performance:** measured on the **unbundled Vite dev server**, which is not representative (FCP/LCP ≈ 5.4 s there; CLS 0 observed). **No production-build Core Web Vitals were measured.** Console: one Leaflet `TypeError` and one unattributed `404` resource error observed; no failed requests were observed in the performance entries I inspected.
- **Known limitations:** automated contrast sampling cannot measure gradient/photo backgrounds, so contrast is **not** verified; no screen reader; no axe/Lighthouse; the test browser may lack some locale data (affects date finding); the app talked to the project's configured backend with public reads only; the zeros on the homepage could be genuine.
- **Remaining verification work:** production-build performance; full axe + manual AT pass; remaining 21 languages incl. RTL; 1366 and landscape; touch testing of the map and upload; confirmation/success screens with a safe test environment; user testing of the report flow; checking `/komunat` photo-credit rendering; Netlify 404 behaviour; confirming the stats zeros against the data.
