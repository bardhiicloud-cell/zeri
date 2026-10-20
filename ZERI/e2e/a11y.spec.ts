import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { asReturningVisitor } from './helpers';

/**
 * WCAG 2.2 AA scan of the public pages, light and dark. Fails on any violation, so a
 * new unlabelled control or low-contrast text cannot reach main unnoticed.
 */
const PAGES = ['/', '/raporto', '/track', '/lajme', '/harta', '/login', '/kontakt', '/privatesia'];

for (const dark of [false, true]) {
  for (const path of PAGES) {
    test(`a11y ${dark ? 'dark' : 'light'} ${path}`, async ({ page }) => {
      await asReturningVisitor(page);
      await page.emulateMedia({ colorScheme: dark ? 'dark' : 'light' });
      await page.goto(path);
      await page.waitForTimeout(2000);
      const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
      const summary = violations.map((v) => `${v.id} (${v.impact}) x${v.nodes.length}: ${v.nodes.slice(0, 2).map((n) => n.html.slice(0, 110)).join(' | ')}`);
      expect(summary, summary.join('\n')).toEqual([]);
    });
  }
}
