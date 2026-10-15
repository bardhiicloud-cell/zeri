import { parseLocalePath } from './seo';

/**
 * Pages where a visitor is already doing something: the optional municipality
 * question must not cover them. Until a choice is made the scope is the whole
 * country, which is a valid, complete view; the picker stays one click away in
 * the sidebar. Locale prefixes (/en/raporto) are ignored.
 */
const TASK_PATHS = [
  '/raporto', '/trackid', '/login', '/register',
  '/kushtet-e-perdorimit', '/terms', '/privatesia', '/politika-e-priveritetit', '/politika-e-cookies',
];

export function isTaskPath(pathname: string): boolean {
  const { pagePath } = parseLocalePath(pathname);
  const clean = pagePath.replace(/\/+$/, '') || '/';
  return TASK_PATHS.some(path => clean === path || clean.startsWith(`${path}/`));
}
