# Zëri Qytetar

Platforma e raportimit dhe e informimit qytetar (React + Vite, Express, Firebase).

## Nisja lokale

Kërkohet Node.js 20+.

```bash
npm install
npm run dev
```

Kopjo `.env.example` në `.env.local` dhe plotëso çelësat që të duhen.

## Komandat kryesore

| Komanda | Çfarë bën |
| --- | --- |
| `npm run dev` | Server + frontend për zhvillim |
| `npm run build` | Ndërtimi për prodhim (`dist/`) |
| `npm run lint` | Kontrolli i tipave |
| `npm test` | Testet e serverit dhe të bibliotekës |
| `npm run test:rules` | Rregullat e Firestore/Storage (emulator, duhet Java 21) |
| `npm run dev:admin-prototype` | Paneli i adminit me emulator (`admin@kosova.com` / `admin123`) |

Deploy: `docs/DEPLOY_BACKEND.md` dhe `docs/PRODUCTION_CHECKLIST.md`.
