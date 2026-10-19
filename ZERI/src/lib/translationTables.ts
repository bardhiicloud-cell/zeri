/**
 * One import point for the generated translation tables, so the bundler can put
 * all of them in a single lazy chunk. Only dt.ts imports this file, and only
 * through a dynamic import().
 */
export { dynamicTranslations } from './dynamicTranslations';
export { uiTranslations } from './uiTranslations';
export { newLanguageTranslations } from './newLanguageTranslations';
export { siteTranslations } from './siteTranslations';
export { publicPagesTranslations } from './publicPagesTranslations';
