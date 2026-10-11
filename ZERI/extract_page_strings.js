/**
 * Extract every user-visible Albanian string from the page/data files that
 * currently bypass dt() entirely — the service catalogue, contact directory,
 * dashboard cards and help centre.
 *
 * These are the strings that make language switching feel broken: the chrome
 * translates, the content does not. Output feeds the same translation cache the
 * generator uses, so both paths land in newLanguageTranslations.ts.
 *
 * Usage:  node extract_page_strings.js
 */
import fs from 'fs';
import path from 'path';

const TARGETS = [
  'src/pages/SherbimetPage.tsx',
  'src/pages/CitizenHelpCenterPage.tsx',
  'src/lib/data/contacts.tsx',
  'src/pages/KomunatPage.tsx',
  'src/pages/KontaktPage.tsx',
  'src/pages/ProjektetPage.tsx',
  'src/pages/RrethProjektitPage.tsx',
  'src/pages/InstitutionalUpdatesPage.tsx',
  // News: the categories, demo articles and page chrome all carry Albanian
  // copy that citizens read, so the news surface has to translate too.
  'src/lib/demoNews.ts',
  'src/lib/newsCategories.ts',
  'src/pages/LajmePage.tsx',
  'src/pages/ForumPage.tsx',
  'src/pages/PollsPage.tsx',
  'src/pages/DonationsPage.tsx',
  'src/pages/MapPage.tsx',
  'src/pages/StatisticsPage.tsx',
  'src/pages/TrackIdPage.tsx',
  'src/pages/IdeaPage.tsx',
  'src/pages/HealthRegistryPage.tsx',
  'src/pages/ReportIssue.tsx',
  'src/pages/Dashboard.tsx',
  'src/lib/reportTopics.ts',
];

// Albanian markers: diacritics plus the words that only make sense in Albanian.
const ALB = /[ëçËÇ]|\b(Shqip|Kosov|Komun|Qytetar|Shërbim|Raport|Kërk|Arsim|Shëndet|Financ|Drejtor|Ministri|Gjykat|Polici|Institucion|Aplikim|Plotëso|Dokument|Certifikat|Tarif|Afat|Kusht|Kategori|Status|Përshkrim)\w*/i;

// Class/attribute plumbing that is not user-visible text.
const NOT_TEXT = /^(className|key|id|type|href|to|path|name|value|src|from|icon|color|size|data-|aria-|role|target|rel|method|action)/;

function extractFromFile(file) {
  const src = fs.readFileSync(file, 'utf8');
  const found = new Set();

  // Every single-quoted or double-quoted string literal on its own.
  const strRe = /(['"])((?:\\.|(?!\1)[^\\]){4,})\1/g;
  let m;
  while ((m = strRe.exec(src)) !== null) {
    const v = m[2];
    if (NOT_TEXT.test(v)) continue;
    if (v.includes('<') || v.includes('{') || v.includes('=>')) continue;
    if (ALB.test(v)) found.add(v);
  }

  return [...found];
}

const all = new Set();
const perFile = {};
for (const t of TARGETS) {
  const abs = path.join(process.cwd(), t);
  if (!fs.existsSync(abs)) continue;
  const items = extractFromFile(abs);
  perFile[t] = items.length;
  for (const i of items) all.add(i);
}

console.log('Extracted per file:');
for (const [f, n] of Object.entries(perFile)) console.log(String(n).padStart(5), f);
console.log('\nUnique strings:', all.size);

fs.writeFileSync('_page_strings.json', JSON.stringify([...all], null, 2), 'utf8');
console.log('Written _page_strings.json');
