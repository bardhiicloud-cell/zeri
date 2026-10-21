# Auditimi i panelit të administrimit — faza 1 (para ndryshimeve)

Data: 2026-10-21 · Dega `claude/panel-design-accessibility-dd0094` (mbi origin/main) · Mjedisi: emulatorë lokalë (Auth/Firestore/Storage) me të dhënat seed, rregullat REALE (`firestore.rules`, `storage.rules`), llogaria seed e superadminit, Chrome pa kokë.

## Si u mat (dhe çfarë NUK u mat)

Matësi (`audit.mjs`, i ekzekutuar në faqe) numëron për çdo faqe: kontrolle pa emër, fusha pa etiketë, numrin e `h1`, tekst < 12px, objektiva < 44px (celular) / < 24px (desktop), elemente jashtë viewport-it, kontrast tekst/sfond (WCAG AA, i përafërt: ngjyra e llogaritur kundrejt sfondit të parë jo-transparent), gabime konsole dhe përgjigje HTTP ≥ 400.

**Nuk u mat**: axe-core (`@axe-core/playwright` nuk është i instaluar këtu), koha e ngarkimit në 4G (serveri është Vite dev; kohët nuk përfaqësojnë prodhimin), veprimet një nga një (butona, filtra, veprime masive), provat sipas rolit (komunë, moderator, agjent) në shfletues. Kolonat "Funksion" dhe "Siguri" janë ndaj vetëm "ngarkohet pa gabim" dhe provat statike më poshtë, jo 10/10.

**Formulat e notave** (1–10, vetëm për atë që u matet):
- Aksesueshmëri = 10 − (0.5 × kontrolle pa emër + 0.7 × fusha pa etiketë + 2 nëse h1 ≠ 1 + 2 nëse mungon `<main>` + 10 × pjesa e tekstit me kontrast të dobët në desktop të çelët)
- Celular (prekja) = 10 − 10 × (objektiva < 44px / kontrolle)
- Madhësia e tekstit = 10 − 0.1 × elemente < 12px
- Kontrast dark = 10 − 10 × pjesa e dobët në dark

## Tabela fillestare

| Faqja | A11y | Celular | Tekst | Kontrast çelët / dark | h1 | Pa emër | Pa etiketë | Ngarkim (gabime konsole / HTTP) |
|---|---|---|---|---|---|---|---|---|
| dashboard | 10 | 4 | 3 | 6/188 · 0/188 | 1 | 0 | 0 | 0 / 0 |
| inbox | 10 | 5 | 5 | 3/94 · 0/94 | 1 | 0 | 0 | 0 / 0 |
| reports | 7 | 4 | 3 | 12/116 · 2/116 | 2 | 0 | 0 | 0 / 0 |
| work | 7 | 1 | 8 | 3/32 · 0/32 | 2 | 0 | 0 | 0 / 0 |
| workflow | 7 | 6 | 8 | 3/42 · 1/42 | 2 | 0 | 0 | 0 / 0 |
| support | 8 | 2 | 6 | 2/65 · 5/65 | 2 | 0 | 0 | 0 / 0 |
| health | 5 | 2 | 4 | 10/92 · 0/92 | 1 | 0 | 5 | 0 / 0 |
| donations | 8 | 2 | 8 | 5/37 · 0/37 | 1 | 0 | 1 | 0 / 0 |
| debate | 10 | 4 | 8 | 2/45 · 2/45 | 1 | 0 | 0 | 0 / 0 |
| polls | 6 | 2 | 8 | 14/54 · 0/54 | 1 | 2 | 1 | 0 / 0 |
| forum | 8 | 1 | 8 | 5/47 · 0/47 | 1 | 0 | 1 | 0 / 0 |
| users | 5 | 1 | 6 | 2/79 · 0/79 | 1 | 9 | 1 | 0 / 0 |
| news | 8 | 1 | 6 | 8/58 · 0/58 | 1 | 0 | 1 | 0 / 0 |
| heritage | 10 | 9 | 1 | 2/501 · 0/501 | 1 | 0 | 0 | 0 / 0 |
| notifications | 9 | 1 | 8 | 3/49 · 0/49 | 1 | 0 | 1 | 0 / 0 |
| videos | 9 | 3 | 8 | 2/32 · 0/32 | 1 | 0 | 1 | 0 / 0 |
| ads | 6 | 1 | 6 | 5/102 · 0/102 | 1 | 3 | 3 | 0 / 0 |
| agents | 7 | 1 | 6 | 15/80 · 0/80 | 1 | 0 | 1 | 0 / 0 |
| roles | 7 | 4 | 6 | 6/83 · 0/83 | 2 | 0 | 0 | 0 / 0 |
| municipalities | 7 | 2 | 7 | 3/47 · 0/47 | 2 | 0 | 0 | 0 / 0 |
| workfacts | 9 | 1 | 8 | 4/37 · 0/37 | 1 | 0 | 0 | 0 / 0 |
| monitoring | 9 | 1 | 2 | 14/189 · 0/189 | 1 | 0 | 0 | 0 / 0 |
| updates | 8 | 4 | 6 | 12/79 · 0/79 | 1 | 0 | 0 | 0 / 0 |
| categories | 1 | 1 | 8 | 4/43 · 0/43 | 1 | 26 | 1 | 0 / 0 |
| security | 10 | 2 | 1 | 2/221 · 0/221 | 1 | 0 | 0 | 0 / 0 |
| settings | 1 | 6 | 8 | 2/53 · 0/53 | 1 | 6 | 11 | 0 / 0 |
| /komuna | 8 | 2 | 10 | 0/0 · 0/0 | 1 | 0 | 0 | 0 / 0 |
| /debatwp | 8 | 7 | 9 | 0/14 · 0/14 | 0 | 0 | 0 | 0 / 0 |
| /agent | 10 | 4 | 5 | 3/93 · 0/93 | 1 | 0 | 0 | 0 / 0 |
| /monitorim | 7 | 5 | 5 | 0/0 · 0/0 | 1 | 0 | 1 | 0 / 0 |
| /menagjer | 7 | 4 | 4 | 3/91 · 0/91 | 2 | 0 | 1 | 0 / 0 |
| /moderim | 8 | 2 | 9 | 0/0 · 0/0 | 1 | 0 | 0 | 0 / 0 |
| /approvals | 10 | 4 | 4 | 4/167 · 0/167 | 1 | 0 | 0 | 0 / 0 |
| **Mesatarja** | **7.6** | **3.0** | **6.1** | | | | | |

## Gjetjet kryesore (me provë)

1. **Kontrasti në modalitetin e çelët** (WCAG AA): më të dobëtat: polls (14/54), agents (15/80), updates (12/79), news (8/58), donations (5/37), health (10/92). Në dark është pothuajse 0 — çelësi është te tokens e çelëta (tekst gri mbi sfond të çelët).
2. **Objektiva prekjeje < 44px në celular**: më të këqijat: work (1), forum (1), users (1), news (1), notifications (1), ads (1). (Mesatarja 3.0/10.)
3. **Tekst < 12px**: më të këqijat: heritage (1), security (1), monitoring (2), dashboard (3), reports (3), health (4). Etiketat `text-[10px]/[11px]` janë në çdo panel.
4. **Kontrolle pa emër**: categories (26), users (9), settings (6), ads (3), polls (2). **Fusha pa etiketë**: settings (11), health (5), ads (3).
5. **h1**: shumë se një në reports, work, workflow, support, roles, municipalities, /menagjer; asnjë në /debatwp.
6. **Pa `<main>`** (landmark): /komuna, /monitorim, /moderim (teksti i `main` = 0).
7. **Asnjë gabim konsole ose HTTP ≥ 400** në ngarkimin e secilës faqe (me superadmin). Pozitive.
8. **Heritage**: 165 kontrolle dhe 17.8k shenja në një faqe (nuk është e faqosur/virtualizuar).

## Prova statike

- `console.log`/`TODO`/`FIXME` në kodin e adminit: **0 / 0**. Pozitive.
- ESLint (`src/components/admin` + `AdminPanel.tsx`): **117 gabime**, 0 paralajmërime (konfigurimi ekzistues; ka baseline në main).
- Skedarë > 800 rreshta: AdminAgents (1974), AdminHealthRegistry (1536), AdminAds (1288), AdminReports (1200), ReportQueuesPanel (1168), ModerationCenterPage (1007), MonitoringPage (988), AdminDashboard (852).
- Kufij gabimesh (`ErrorBoundary`) **brenda panelit të adminit: 0** (vetëm në nivel aplikacioni); `Suspense` te AdminPanel: po, 32 seksione `lazy`.
- Endpoint-et admin (`/api/v1/admin|workflow|work|municipality|moderation`): **52**; vetëm **21** përmenden në ndonjë test. Pa provë në testet: `DELETE /admin/users/:uid`, `PUT /admin/users/:uid/role`, `PUT /admin/users/:uid/plan`, `POST /admin/users`, `POST /admin/users/:uid/set-password`, `POST /admin/users/:uid/moderate`, `GET /admin/users`, `GET /admin/reports`, `POST /admin/reports/classify`, `POST /admin/decisions/:kind/:id`, `POST|PUT /admin/municipalities`, `GET|PUT /admin/work-facts`, `GET /municipality/{desk,health,reports}`, `POST /municipality/reports/:id/request`, `POST /municipality/work-facts`, `POST /admin/cache/invalidate`, `POST /moderation/backfill`, `POST /admin/emails/:id/retry`, `POST /admin/verification-requests/:uid/decision`, `GET /admin/team-overview`, `GET /admin/editorial-log`, `GET /admin/decision-rules`.
- Rregullat Firestore: 56 blloqe `match`; **leximi publik** (`allow read: if true`) te: `comments`, `polls`, `ads`, `categories`, `donationCauses`, `officialProfiles`, `settings/general`, `liveMessages`. `reports` është mbyllur (provuar me 476 teste rregullash të kaluara).
- Testet: 1301 njësi dhe 476 rregulla/emulator kalojnë; **asnjë test e2e** i rrjedhave të adminit sipas rolit (`e2e/` ka vetëm smoke + a11y, `@playwright/test` nuk është i instaluar).

## Ç'duhet marrë vendim para fazës 2

- Çdo ndryshim te RBAC/rregullat/Storage kërkon miratimin tënd (rregulli 4). Kandidatët: (a) roli "pronar" për `bardhiicloud@gmail.com` — aktualisht `staffRemoval.ts` thotë "Llogaria e superadminit nuk hiqet nga paneli", pra as ti nuk fshin një superadmin tjetër nga paneli; (b) testet e rregullave për leximet publike më sipër.
- Provat e rolit (qytetar, komunë, moderator, agjent, admin) kërkojnë llogari seed për secilin: seed-i aktual ka vetëm superadminin.

## Të dhënat e plota (JSON)

Matjet kryesore janë të ruajtura në `docs/admin-audit-2026-10-21.json`.
