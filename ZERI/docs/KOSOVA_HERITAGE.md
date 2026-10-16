# Kosova identity & KLA archive — delivery notes

Routes: `/kosova`, `/kosova/:section`, `/kosova/:section/:id`, `/historia-e-uck`, `/historia-e-uck/:section`, `/historia-e-uck/:section/:id` (also under `/:lang/`).
API: `GET /api/public/heritage`; staff `/api/v1/admin/heritage/*` (server/heritage.ts). Firestore: `heritageEntries` (+`revisions`), `heritageSources`, `heritageSettings`, `heritageLog` — closed to browsers in firestore.rules.
Admin: section `heritage` ("Arkivi i Kosovës"), roles admin/superadmin/newsadmin (+ per-staff grant). Workflow draft→review→approved→published→archived, four-eyes, fact-check gate, revisions, visible corrections, append-only log.

## Needs human verification before it is called verified
- Every seed entry is `unverified`; every source has `linkChecked:false` (no outbound access when written). Open each link in the CMS and tick it.
- Figures to confirm against the source: Memory Book 13,535; ICRC ~1,600 missing; UNHCR 800–850k; UNSCR 1199 "230,000"; HRW ~500 NATO civilian deaths; 109/120 deputies on 17 Feb 2008; ICJ 10–4; KSC Mustafa verdict date; Thaçi et al. trial status (not checked); recognition count; 112 emergency number; document symbols (S/1999/648, 04/L-172, 06/L-122/123).
- Signatory list of the Declaration is intentionally NOT written: import from the Assembly archive.
- No photographs, official emblem or KLA imagery are shipped (rights not clearable here); add via CMS settings/media with credit, licence, privacy check.
- Support-organisation contacts/helpline numbers deliberately omitted until called and confirmed.
- English only for non-Albanian UI languages; other languages not translated.

## Not done
- Visual QA in a browser (no Playwright in the project); mobile layout unchecked.
- Firestore emulator rules tests not run (needs Java).
- Existing mobile dock untouched (Ballina, Harta, Raporto, Lajme, Menu — Debati Publik was already hidden in the repo).
