/**
 * Escape text for interpolation into an HTML string.
 *
 * Several admin screens build a print/export document with
 * `window.open('') + document.write(template)`. That window inherits this
 * origin, so markup smuggled into a citizen-written field (a report title, a
 * name) would run with the signed-in admin's privileges. Every dynamic value in
 * such a template must go through this function. Prefer React for anything that
 * stays on screen; React escapes automatically.
 */
const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '`': '&#96;',
};

export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"'`]/g, (character) => HTML_ESCAPES[character]);
}
