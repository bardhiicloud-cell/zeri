# Public UI/UX audit remediation: defect register (2026-10-15)

Partial pass, stopped early at the owner's request. Status: PASS = fixed and verified; PARTIAL = implemented, verification incomplete; OPEN = not done.
The original PUB-UI-001..031 list was not in the repository; items are mapped from the brief's references.

| ID | Route | Root cause / fix | Evidence | Status |
|---|---|---|---|---|
| PUB-UI-001 | /raporto | Step 1 blocked without media, but server and homepage treat it as optional. "Vazhdo pa dëshmi", copy says optional | server test "evidence optional"; browser | PASS |
| PUB-UI-002 | first visit | Location picker mounted behind age + cookie dialogs. Now waits for both, and stays off /raporto, /trackid, login, legal pages | tests/lib/firstVisitGates.test.ts | PARTIAL (not re-checked in browser after change) |
| PUB-UI-003 | /raporto | `report_step2_category_ph` key never existed. Replaced by a translated placeholder | browser | PASS |
| PUB-UI-004/022 | /raporto | Named stepper (nav/ol, aria-current), focus moves to step heading | browser | PASS |
| PUB-UI-007 | / | h1 fell back to "Prishtinë" under national scope; table fallback too. Photo fallback only | tsc; not browser-checked | PARTIAL |
| PUB-UI-009/019 | /raporto | File input and fields had no labels; removal only on hover. Labelled input, drag and drop kept, always-visible remove buttons, htmlFor/aria-invalid/aria-describedby, error summary | browser: 0 unlabelled controls | PASS |
| PUB-UI-010/031 | /raporto, age gate | Native English validation bubbles; hard-coded Albanian. noValidate and localized messages | browser (report form) | PASS (age gate PARTIAL) |
| PUB-UI-015/029 | public shell | 8-10px text raised to >=11px in 19 public files; 44px targets on new controls | tsc | PARTIAL (no visual overflow review at 320px) |
| PUB-UI-016 | / | h3 section titles under h1 -> h2 | tsc | PARTIAL |
| PUB-UI-017 | /harta, /raporto | Leaflet `Map.remove()` leaves the 250ms zoom timer armed; fixed in src/lib/leafletLifecycle.ts. Fake 1s "searching" overlay removed; failed feed no longer shown as empty | tests/lib/leafletLifecycle.test.ts (reproduces the bug unpatched); 6 mount/unmount cycles in browser | PASS |
| PUB-UI-018 | /, /harta, registry | `startPublicReports` and the staff listener reported "ready, 0 reports" on failure. Now status `error` | tests/lib/publicReportsStatus.test.ts | PASS |
| PUB-UI-028 | /raporto | Topic vs institution explained; 40 topics grouped in 5 optgroups without emoji | tests/lib/reportTopicGroups.test.ts | PASS |
| PUB-UI-030 | /raporto | Session-only draft (no name, phone, media; owner-bound; 6h) | tests/lib/reportSubmit.test.ts | PASS |
| AI transparency | /raporto | Copy claimed automatic analysis; it is button-triggered, first photo, advisory. authenticityScore<40 no longer a dead end (confirm and send for staff review) | translations; code | PARTIAL (no runtime test of the AI path) |
| Duplicate reports | /raporto, server | Fallback write could duplicate. Client id reused, server `create()` idempotent, fallback only when the server is unreachable. Server also kept 6 of 12 files and coerced audio/PDF to image | tests/server/reports.test.ts | PASS (unit level; no emulator run) |
| Location | /raporto | Default Prishtina centre treated as location. Source tracked; pin/GPS/address required; denied/failed GPS messages | browser (validation) | PARTIAL |
| /harta a11y | /harta | Labels, aria-labels, list alternative, loading/error/empty banner, status live region | browser: 0 unnamed controls | PARTIAL |
| /statistikat | /statistikat | Unlabelled selects, charts without text equivalent, no error state | none | OPEN |
| /trackid, registry, /transparenca, health, multilingual audit, mobile viewports, Lighthouse, screen reader | | not reviewed in this pass | | OPEN |

## Findings not changed
- Guest phone number is required and validated but never sent or stored. Product decision needed.
- A non-anonymous report publishes the typed name; the form now says so only on the anonymity checkbox hint.
- Only English and German were written for new copy; the other 21 languages fall back to Albanian.
- The local `.env` points at the real Firebase project (read quota exhausted). No report was submitted during testing.
