# Matrica e lejeve

Gjeneruar nga rregullat e vërteta të serverit (`server/permissionsMatrix.ts`), jo e shkruar me dorë. Një test dështon nëse ky skedar ndryshon nga ajo që thotë kodi. Rigjenerohet me `npm run matrix:write`.

`✓` lejohet për rastin përfaqësues; `·` refuzohet. Veprimet e komunës vlejnë vetëm për komunën e vet (një komunë tjetër merr "nuk u gjet"). "Agjent me fusha të dhëna" ka Donacione, Shëndetësi, Lajme dhe Reklama. Komuna Bazë nuk ka shëndetësi, fakte punimesh as email; Pro i ka të gjitha.

Rasti përfaqësues për çdo rresht është te `CASES` në skedarin e mësipërm.

| Veprimi | Superadmin | Administrator | Agjent | Agjent me fusha të dhëna | Dispatcher | Menaxher (monitorim) | Komunë (Bazë) | Komunë (Pro) | Qytetar |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Raportimet** ||||||||||
| Hap listën e raportimeve | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | · |
| Merr përsipër një raport të ri (claim) | ✓ | ✓ | ✓ | ✓ | ✓ | · | · | · | · |
| Aprovon dhe e dërgon te komuna | ✓ | ✓ | ✓ | ✓ | ✓ | · | · | · | · |
| Refuzon (me arsye) | ✓ | ✓ | · | · | · | · | · | · | · |
| Kërkon informacion nga qytetari | ✓ | ✓ | ✓ | ✓ | ✓ | · | · | · | · |
| Shënim i brendshëm | ✓ | ✓ | ✓ | ✓ | ✓ | · | · | · | · |
| Eskalon te administratori | ✓ | ✓ | ✓ | ✓ | ✓ | · | · | · | · |
| Mbyll një eskalim | ✓ | ✓ | · | · | · | · | · | · | · |
| Ia cakton raportin një agjenti tjetër | ✓ | ✓ | · | · | ✓ | · | · | · | · |
| Prit ose heq një foto | ✓ | ✓ | ✓ | ✓ | ✓ | · | · | · | · |
| **Puna e komunës** ||||||||||
| Merr përsipër punën (komuna e vet) | · | · | · | · | · | · | ✓ | ✓ | · |
| Shënon punimet të kryera (komuna e vet) | · | · | · | · | · | · | ✓ | ✓ | · |
| Përgjigje zyrtare publike | · | · | · | · | · | · | ✓ | ✓ | · |
| Kërkon korrigjim ose kundërshton | · | · | · | · | · | · | ✓ | ✓ | · |
| Dërgon raportin me email te institucioni | ✓ | ✓ | ✓ | ✓ | ✓ | · | · | ✓ | · |
| **Përmbajtja** ||||||||||
| Aprovon ose refuzon një donacion | ✓ | ✓ | · | ✓ | · | · | · | · | · |
| Verifikon një rast shëndetësor | ✓ | ✓ | · | ✓ | · | · | · | ✓ | · |
| Publikon një lajm | ✓ | ✓ | ✓ | ✓ | · | · | · | · | · |
| Aprovon një kërkesë reklame | ✓ | ✓ | · | ✓ | · | · | · | · | · |
| Fsheh një postim në forum (me arsye) | ✓ | ✓ | ✓ | ✓ | ✓ | · | · | · | · |
| **Njerëzit dhe sistemi** ||||||||||
| Ndalon një llogari qytetari | ✓ | ✓ | · | · | · | · | · | · | · |
| Cakton ose ndryshon rolin e stafit | ✓ | ✓ | · | · | · | · | · | · | · |
| Heq një llogari stafi ose komune | ✓ | ✓ | · | · | · | · | · | · | · |
| Cakton planin e një komune | ✓ | ✓ | · | · | · | · | · | · | · |
| Sheh ngarkesën e ekipit të agjentëve | ✓ | ✓ | · | · | ✓ | ✓ | · | · | · |
| Hap Cilësimet e sistemit | ✓ | ✓ | · | · | · | · | · | · | · |
| Hap Sigurinë dhe Auditimin | ✓ | ✓ | · | · | · | ✓ | · | · | · |

Çdo qelizë `·` është refuzim i zbatuar nga serveri (jo vetëm buton i fshehur). Çdo refuzim regjistrohet në auditim.
