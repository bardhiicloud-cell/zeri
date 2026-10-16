# Rregullat e projektit (të përhershme)

## Debati publik është i fshehur (vendim i pronarit, 2026-10-16)
Debati publik (`/forum`, postimet, reels, stories, mesazhet, ndjekjet) mbetet **i fshehur nga i gjithë sajti** derisa pronari të përfundojë punën e zgjerimit. Mos e rihap, mos e lidh, mos e reklamo, mos e fut në sitemap.
- Flamuri në ueb: `src/lib/featureFlags.ts` → `DEBATE_PUBLIC_ENABLED` (`VITE_DEBATE_PUBLIC_ENABLED=true` për ta hapur).
- Flamuri në server: `server/debateGate.ts` (`DEBATE_PUBLIC_ENABLED=true`); mbyll me 404 endpoint-et e qytetarit nën `/api/v1/forum/*`.
- Mbeten të hapura vetëm mjetet e stafit: paneli i debatit (`/debatwp`, `/api/v1/debate/*`), moderimi (`/api/v1/moderation/*`), radhët e raportimeve dhe verifikimit.
- Rihapja bëhet vetëm me kërkesë të qartë të pronarit.

## Punë që i bën vetë pronari (jo kodi)
Kutitë postare (`privatisi@`, `abuzim@`, `privacy@`), DNS/HTTPS dhe Authorized domains te Firebase, vendosja e rregullave të Firestore (`docs/ADMIN_SECURITY_REMEDIATION.md` §5), testi i kapacitetit në staging, instalimi në Android/iOS, Lighthouse dhe Search Console.

## Reklamimi: vetëm tri oferta, pa çmime (vendim i pronarit, 2026-10-16)
Faqja Partnerët dhe forma "Kërko ofertë" kanë vetëm tri oferta: **Komunat**, **Lajmet** dhe **Gjithë Kosova + Komunat + Lajmet** (oferta më e mirë). Nuk shfaqen çmime dhe nuk krijohet pagesë në faqe: çmimi caktohet sipas marrëveshjes. Asnjë ofertë nuk përmend Debatin publik. Burimi i vetëm: `AD_PACKAGES` te `src/components/AdRequestModal.tsx`.
