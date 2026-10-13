# Responsive and accessibility report

Run 2026-10-13 in the in-app browser against the dev server (Vite, :3020).

## Responsive — what was actually measured
Measure: `document.documentElement.scrollWidth − innerWidth` after the page settled (≈2.5 s). 0 = no horizontal scroll.

| Width | Routes | Result |
|---|---|---|
| **320 px** | `/ /raporto /trackid /harta /statistikat /detailed-registry /shendetesia /komunat /sherbimet /Idea /projektet /lajme /kontakt /kontakt-numrat /rreth-projektit /donacion /partneret /ndihma /sondazhet /transparenca /login /register /privatesia /kushtet-e-perdorimit` (24) | **0 on all 24** |
| 320 px, German | `/de/kontakt /de/ndihma /de/sherbimet /de/komunat /de/trackid` | 0 on all 5; German strings render (e.g. "Schreiben Sie uns") |
| desktop pane (~1280) | `/kontakt`, `/sherbimet` | 0 |

Visual inspection: one screenshot at 320 px (`/sherbimet` top of page) showed a correct stacked layout. Other pages were measured, not looked at.

**Not tested:** 360, 375, 390, 430, 768, 820, 1024, 1366, 1440, 1600, 1920 px; landscape; keyboard-open mobile; maps and charts at touch size; dialogs against short viewports.

## Accessibility — measured
Script counts on `/kontakt`, `/ndihma`, `/donacion`, `/Idea`: buttons/links/inputs without an accessible name = 0; images without `alt` = 0; `h1` count 1 (Contact, Help, Ideas). `/donacion` had **no `h1`**: fixed.
Built in by design on the rebuilt pages: label/`for` pairs, `aria-invalid` + `aria-describedby` on errors, focus moves to the first invalid field, `role="status"`/`role="alert"` for results, disclosure buttons with `aria-expanded`/`aria-controls`, `aria-pressed` on filter chips, 44 px touch targets on new controls, `role="dialog"` + Escape on the campaign dialog.

**Not tested:** screen reader, tab order end to end, colour contrast ratios, reduced-motion, 200 % zoom, focus trap in dialogs.

## Known issues
- ~22 controls under 32 px tall on `/kontakt` and `/ndihma`: these are in the shared navigation (sidebar/top bar), which was not changed.
- Signed-out sessions log repeated `FirebaseError: Missing or insufficient permissions` ("Gabim gjatë leximit të përdoruesit"); not investigated.
- On `/donacion` the application dialog is an inline panel, not a modal; Escape closes only the campaign dialog.
