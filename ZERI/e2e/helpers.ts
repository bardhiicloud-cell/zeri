import type { Page } from '@playwright/test';

/** Gets past the age gate, the cookie banner and the first-visit tour, as a returning visitor would be. */
export async function asReturningVisitor(page: Page, language = 'sq') {
  await page.addInitScript((lang) => {
    localStorage.setItem('zeri_age_verified_v1', 'passed');
    localStorage.setItem('zeri:tour:v1', '1');
    localStorage.setItem('zeri_cookie_consent_v1', JSON.stringify({ version: 1, essential: true, analytics: false, marketing: false, decidedAt: new Date().toISOString() }));
    localStorage.setItem('app_language', lang);
    localStorage.setItem('kosova_user_muni', 'Prishtinë');
  }, language);
}
