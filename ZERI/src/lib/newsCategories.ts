/**
 * News taxonomy.
 *
 * Three groups, so a reader can tell where a story comes from before opening it:
 *  - `platform`: published by or about this website (official notices, platform
 *    updates, resolved reports, polls and ideas).
 *  - `external`: stories about Kosovo and the world outside the website.
 *  - `topic`: the editorial subject areas that apply to either side.
 */
export const PLATFORM_CATEGORIES = [
  'Njoftim Zyrtar',
  'Nga Platforma',
  'Raporte të Zgjidhura',
  'Sondazhe & Ide',
] as const;

export const EXTERNAL_CATEGORIES = [
  'Kosovë',
  'Rajon & Evropë',
  'Botë',
] as const;

export const TOPIC_CATEGORIES = [
  'Komuna & Shërbime',
  'Politikë & Institucione',
  'Ekonomi & Punësim',
  'Infrastrukturë & Transport',
  'Mjedis & Energji',
  'Arsim & Rini',
  'Financa & Buxhet',
  'Shëndetësi',
  'Siguri & Emergjenca',
  'Kulturë & Sport',
  'Teknologji & Digjitalizim',
] as const;

export const NEWS_CATEGORIES = [
  ...TOPIC_CATEGORIES,
  ...PLATFORM_CATEGORIES,
  ...EXTERNAL_CATEGORIES,
] as const;

export type NewsOrigin = 'all' | 'platform' | 'external';

/** Which side of the website a category belongs to. Unknown/topic categories count as platform editorial. */
export function originOfCategory(category: string): Exclude<NewsOrigin, 'all'> {
  return (EXTERNAL_CATEGORIES as readonly string[]).includes(category) ? 'external' : 'platform';
}
