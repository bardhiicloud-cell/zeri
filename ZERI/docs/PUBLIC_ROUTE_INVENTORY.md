# Public route inventory

Source: `src/App.tsx` (route table), read 2026-10-13. Every public route also exists under a `/:lang/` prefix mirror.

| Route(s) | Page component | Notes |
|---|---|---|
| `/` | `Dashboard` | Homepage |
| `/raporto` | `ReportIssue` | Report submission (1465 lines) |
| `/trackid` | `TrackIdPage` | Uses the allow-list endpoint `/api/v1/public/track/:id` |
| `/harta` | `MapPage` | Public map |
| `/statistikat` | `StatisticsPage` | Public statistics |
| `/transparenca` | `TransparencyPage` | Added to the `/:lang` mirror in this pass |
| `/detailed-registry`, `/regjistri`, `/registry` | `DetailedRegistryPage` | Public report registry |
| `/shendetesia`, `/semundjet` | `HealthRegistryPage` | Sensitive; submits to `healthRegistry` |
| `/sondazhet`, `/sondazhe` | `PollsPage` | |
| `/komunat` | `KomunatPage` | |
| `/sherbimet` | `SherbimetPage` | Services directory (data hardcoded in the page) |
| `/Idea` | `IdeaPage` | Capital "I" in the path; submit-only, no public list |
| `/projektet` | `ProjektetPage` | |
| `/rreth-projektit`, `/rreth-nesh` | `RrethProjektitPage` | About |
| `/lajme`, `/lajmet` | `LajmePage` | News |
| `/forum` | `ForumPage` (behind `GuestGuard`) | Community / public debate |
| `/ndihma` | `CitizenHelpCenterPage` | The **only** help route: "Ndihma" and "Qendra e Ndihmës" are one page, not two |
| `/kontakt`, `/kontakte` | `KontaktPage` | |
| `/kontakt-numrat` | `ContactNumbersPage` | Institution number registry (`/api/public/contacts`) |
| `/donacion` | `DonationsPage` | |
| `/partneret` | `PartnersPage` | "Partners" are ad campaigns the admin flags as partners |
| `/kushtet-e-perdorimit`, `/terms` | `TermsOfServicePage` | |
| `/privatesia`, `/politika-e-priveritetit`, `/politika-e-cookies` | `PrivacyPolicyPage` | |
| `/login`, `/register` | `LoginPage`, `RegisterPage` | Outside `AppLayout` |
| `/buxheti` | redirect to `/` | |
| `*` | `NotFoundPage` | |

**Not public (out of scope, untouched):** `/admin`, `/approvals`, `/agent`, `/menagjer`, `/monitorim`, `/moderim`, `/komuna`, `/komuna-panel`, `/debatwp`, `/debatiwp`.

## Routes that do not exist
There is no public detail route for a report, project, service, idea, partner, campaign or news article. The brief asks for such detail pages; none can be improved because none exists. Creating them is new product work (see PUBLIC_REMAINING_ISSUES.md).
