/**
 * Flattens the five generated translation tables into one small JSON file per
 * language (src/lib/i18n/generated/<lang>.json), so a visitor downloads only the
 * language they read instead of all of them.
 *
 * Precedence is the one dt() always used, most specific first:
 *   publicPages > newLanguage > site > ui > dynamic[lang] > dynamic.sq > the text itself
 * Strings whose result equals the key are left out; dt() falls back to the key.
 */
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SUPPORTED_LANGUAGES } from '../src/lib/languageConstants';
import { translationLanguageFor } from '../src/lib/seo';
import { dynamicTranslations } from '../src/lib/dynamicTranslations';
import { uiTranslations } from '../src/lib/uiTranslations';
import { newLanguageTranslations } from '../src/lib/newLanguageTranslations';
import { siteTranslations } from '../src/lib/siteTranslations';
import { publicPagesTranslations } from '../src/lib/publicPagesTranslations';

type Entry = Partial<Record<string, string>> | undefined;
const layers: Record<string, Entry>[] = [
  publicPagesTranslations,
  newLanguageTranslations,
  siteTranslations,
  uiTranslations as Record<string, Entry>,
];

const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/lib/i18n/generated');
mkdirSync(outDir, { recursive: true });
for (const file of readdirSync(outDir)) if (file.endsWith('.json')) rmSync(path.join(outDir, file));

const keys = new Set<string>([
  ...Object.keys(dynamicTranslations),
  ...layers.flatMap((layer) => Object.keys(layer)),
]);

// Regional variants (ca, au) read the English table; Albanian needs no table.
const languages = SUPPORTED_LANGUAGES.filter((lang) => lang !== 'sq' && translationLanguageFor(lang) === lang);

for (const lang of languages) {
  const table: Record<string, string> = {};
  for (const key of keys) {
    let value: string | undefined;
    for (const layer of layers) {
      value = layer[key]?.[lang];
      if (value) break;
    }
    if (!value) {
      const entry = dynamicTranslations[key] as Entry;
      value = entry?.[lang] || entry?.sq;
    }
    if (value && value !== key) table[key] = value;
  }
  writeFileSync(path.join(outDir, `${lang}.json`), JSON.stringify(table));
  console.log(`${lang}: ${Object.keys(table).length} strings`);
}
