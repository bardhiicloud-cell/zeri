/**
 * Build-time prerender of the public routes.
 *
 * The app is a client-side React SPA: every URL used to be answered with the same
 * index.html, so a crawler (or a visitor on a slow connection) saw the homepage's
 * title, description and canonical URL on every page until JavaScript ran.
 *
 * This step runs after `vite build`. For each public route in src/lib/routeSeo.ts
 * it writes dist/<route>/index.html: the built index.html with that route's
 * <title>, description, canonical, Open Graph tags and a small semantic summary
 * (header, main, one h1, intro, link back to the homepage) inside #root.
 *
 * This is static metadata plus a summary, not server-side rendering: the app
 * still renders client-side and createRoot() replaces the summary on mount, so
 * there is no duplicate content and no hydration. Nothing here reads user data.
 *
 * Firebase Hosting serves dist/<route>/index.html for /<route> directly; the
 * Express server (server.ts) does the same lookup before its SPA fallback.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  PUBLIC_ROUTES,
  SITE_BRAND,
  SITE_URL,
  documentTitleFor,
  type PublicRouteSeo,
} from '../src/lib/routeSeo';

const distDir = path.resolve(process.cwd(), 'dist');

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Replace exactly one match, or fail the build: a silent miss would ship homepage tags on a subpage. */
function replaceOnce(html: string, pattern: RegExp, replacement: string, label: string): string {
  if (!pattern.test(html)) throw new Error(`prerender: could not find ${label} in dist/index.html`);
  return html.replace(pattern, () => replacement);
}

function renderRoute(template: string, route: PublicRouteSeo): string {
  const title = escapeHtml(documentTitleFor(route));
  const description = escapeHtml(route.description);
  const url = `${SITE_URL}${route.path}`;

  let html = template;
  html = replaceOnce(html, /<title>[^<]*<\/title>/, `<title>${title}</title>`, '<title>');
  html = replaceOnce(
    html,
    /<meta name="description" content="[^"]*" ?\/>/,
    `<meta name="description" content="${description}" />`,
    'meta description',
  );
  html = replaceOnce(html, /<link rel="canonical" href="[^"]*" ?\/>/, `<link rel="canonical" href="${url}" />`, 'canonical');
  html = replaceOnce(
    html,
    /<link rel="alternate" hreflang="sq" href="[^"]*" ?\/>/,
    `<link rel="alternate" hreflang="sq" href="${url}" />`,
    'hreflang sq',
  );
  html = replaceOnce(
    html,
    /<link rel="alternate" hreflang="x-default" href="[^"]*" ?\/>/,
    `<link rel="alternate" hreflang="x-default" href="${url}" />`,
    'hreflang x-default',
  );
  html = replaceOnce(
    html,
    /<meta property="og:title" content="[^"]*" ?\/>/,
    `<meta property="og:title" content="${title}" />\n    <meta property="og:url" content="${url}" />`,
    'og:title',
  );
  html = replaceOnce(
    html,
    /<meta property="og:description" content="[^"]*" ?\/>/,
    `<meta property="og:description" content="${description}" />`,
    'og:description',
  );

  const summary = `<div id="root">
      <header style="max-width:720px;margin:0 auto;padding:16px 16px 0;font-family:system-ui,sans-serif">
        <p style="margin:0;font-weight:700"><a href="/" style="color:inherit;text-decoration:none">${escapeHtml(SITE_BRAND)}</a></p>
      </header>
      <main style="max-width:720px;margin:0 auto;padding:8px 16px 24px;font-family:system-ui,sans-serif;line-height:1.55;min-height:60vh">
        <h1>${escapeHtml(route.h1)}</h1>
        <p>${escapeHtml(route.intro)}</p>
        <nav aria-label="Navigimi"><ul>
          <li><a href="/">Ballina — ${escapeHtml(SITE_BRAND)}</a></li>
        </ul></nav>
      </main>
    </div>`;
  return replaceOnce(html, /<div id="root">[\s\S]*?<\/main>\s*<\/div>/, summary, '#root fallback');
}

const template = readFileSync(path.join(distDir, 'index.html'), 'utf8');
for (const route of PUBLIC_ROUTES) {
  const outDir = path.join(distDir, ...route.path.split('/').filter(Boolean));
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, 'index.html'), renderRoute(template, route), 'utf8');
}
console.log(`prerender: wrote ${PUBLIC_ROUTES.length} route(s) into dist/`);
