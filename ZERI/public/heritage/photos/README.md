# Fotot e arkivit

Mos i vendosni fotot e papërpunuara këtu. Vendosini origjinalet te `public/heritage/originals/` me të njëjtin emër (p.sh. `familja-jashari.webp`) dhe ekzekutoni `node scripts/crop-heritage-photos.mjs`: ai i pret profesionalisht (portret 4:5 për njerëz, 16:10 për vende) dhe shkruan `.webp` këtu, plus version 640px për telefon. Fokusin e një fotoje e ndryshoni te `public/heritage/focus.json`, p.sh. `{"familja-jashari": "top"}`. Nëse mungon një foto, faqja tregon një kornizë të qetë — nuk prishet asgjë.
Shtoni vetëm foto me licencë të lirë ose me leje, dhe shkruani autorin te `credit` (Photo.tsx).

- `adem-jashari.webp` — portreti i Adem Jasharit (4:5)
- `familja-jashari.webp`, `familja-lladrovci.webp`, `familja-haradinaj.webp`, `familja-meha.webp`, `familja-gervalla.webp`, `familja-fazliu.webp`
- `dheshmor-<id>.webp` — p.sh. `dheshmor-zahir-pajaziti.webp` (id nga `src/lib/heritage/memorial.ts`)
- Vendet: `prizren`, `rugova`, `bjeshket`, `mirusha`, `radavc`, `sharri`, `gadime`, `germia`, `batllava`, `ulpiana`, `novoberde`, `gjakova`, `kullat`, `unesco`, `prishtina`, `prekaz`, `koshare`, `arinjte` (.webp)
- Qytetet: `qyteti-prishtina`, `qyteti-prizren`, `qyteti-peja`, `qyteti-gjakova`, `qyteti-gjilani`, `qyteti-mitrovica`, `qyteti-ferizaj` (.webp)
