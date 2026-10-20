import { expect, test } from '@playwright/test';
import { asReturningVisitor } from './helpers';

const PAGES = ['/', '/raporto', '/track', '/lajme', '/harta', '/login', '/kontakt', '/privatesia', '/nuk-ekziston'];

for (const path of PAGES) {
  test(`${path} opens without script errors`, async ({ page }) => {
    await asReturningVisitor(page);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(path);
    await expect(page.locator('#root')).not.toBeEmpty();
    await page.waitForTimeout(1500);
    expect(errors).toEqual([]);
  });
}

test('the visitor gets only the language they choose', async ({ page }) => {
  await asReturningVisitor(page, 'en');
  const tables: string[] = [];
  page.on('request', (request) => {
    const match = /\/(?:assets\/)?([a-z]{2,3})-[\w-]{8}\.js|locales\/([a-z]{2,3})\.json/.exec(request.url());
    if (match && request.resourceType() === 'script') tables.push(request.url());
  });
  await page.goto('/kontakt-numrat');
  await expect(page.getByText('Emergency numbers').first()).toBeVisible();
  // One table for English; none of the other languages are fetched.
  expect(tables.filter((url) => /\/(de|fr|sr|tr|ar)-/.test(url))).toEqual([]);
});

test('Albanian needs no translation table', async ({ page }) => {
  await asReturningVisitor(page, 'sq');
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.goto('/kontakt-numrat');
  await expect(page.getByText('Numrat e emergjencës').first()).toBeVisible();
  expect(requests.filter((url) => /\/locales\/[a-z]+\.json|\/(en|de|sr|tr)-[\w-]{8}\.js/.test(url))).toEqual([]);
});

test('the age gate blocks a first-time visitor until an age is given', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Sa vjeç jeni?')).toBeVisible();
});
