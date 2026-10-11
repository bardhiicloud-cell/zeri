/**
 * Verify language switching end to end.
 *
 * The first-visit gate is a two-step flow: an age dialog, then a location
 * dialog. Both are dismissed here the same way a visitor would, using role names
 * taken from the accessibility tree rather than guessed, because the location
 * buttons are municipality names and the age input has no accessible label.
 *
 * Then it does the three things the user reported:
 *   1. counts the languages the switcher offers
 *   2. switches to English and checks visible text changed
 *   3. switches to Arabic and checks the document direction flipped
 */
export default async function run(page, ui) {
  const out = {};

  const trigger = page.getByRole('button', { name: /Ndrysho gjuhën|Change language/i }).first();
  try {
    await trigger.waitFor({ state: 'visible', timeout: 60000 });
  } catch {
    out.error = 'language button never appeared';
    return out;
  }

  out.htmlLang = await page.evaluate(() => document.documentElement.lang);
  out.htmlDir = await page.evaluate(() => document.documentElement.dir);
  out.title = await page.title();
  out.dismissed = [];

  // ---- Age gate ----
  // The input is identified by id rather than by locator order: the header
  // renders a search box and a Track-ID box before the dialog, so `locator('input').first()`
  // was filling the wrong field and silently never dismissing the gate.
  if (await page.getByText(/Sa vjeç jeni|What is your age/i).count() > 0) {
    const ageInput = page.locator('#age-verification-input');
    if ((await ageInput.count()) > 0) {
      await ageInput.fill('30').catch(() => {});
      await page.waitForTimeout(300);
      await page.getByRole('button', { name: /^Vazhdo$|^Continue$/i }).first()
        .click({ force: true }).catch(() => {});
      out.dismissed.push('age-gate');
      await page.waitForTimeout(1500);
    }
  }

  // ---- Location gate ----
  // Offers geolocation or a municipality list. Geolocation always fails in a
  // headless run, so pick the municipality the way a resident would.
  if (await page.getByText(/Zgjidhni Vendndodhjen|Choose Location/i).count() > 0) {
    const city = page.getByRole('button', { name: /^Prishtinë$/i }).first();
    if ((await city.count()) > 0) {
      await city.click({ force: true }).catch(() => {});
      out.dismissed.push('location');
      await page.waitForTimeout(2000);
    } else {
      // Fall back to whatever dismiss control the dialog exposes.
      const tree = await ui.snapshot({ full: true });
      out.locationTree = tree.slice(0, 900);
    }
  }

  out.dialogStillOpen = (await page.getByRole('dialog').count()) > 0;

  // ---- Read baseline text ----
  const bodyBefore = await page.evaluate(() => document.body.innerText.slice(0, 500));
  out.bodyBefore = bodyBefore.slice(0, 140).replace(/\n+/g, ' | ');

  // ---- Open the language menu ----
  await page.getByRole('button', { name: /Ndrysho gjuhën|Change language/i }).first()
    .click({ force: true });
  await page.waitForTimeout(900);

  const menuText = await page.evaluate(() => document.body.innerText);
  const expected = [
    'Shqip', 'English', 'Deutsch', 'Bosanski', 'العربية', 'Türkçe', 'Srpski',
    'Français', 'Italiano', 'Español', 'Português', 'Deutsch (Schweiz)',
    'Македонски', 'Slovenščina', 'Hrvatski', 'Română', 'Svenska', 'Norsk',
    'Հայերեն', 'Nederlands',
  ];
  out.languagesVisible = expected.filter((l) => menuText.includes(l));
  out.languageCount = out.languagesVisible.length;
  out.menuItems = await page.getByRole('menuitemradio').count();

  // ---- Switch to English ----
  await page.getByRole('menuitemradio', { name: /English/i }).first()
    .click({ force: true });
  await page.waitForTimeout(1800);

  out.urlAfterEnglish = page.url();
  out.htmlLangAfterEnglish = await page.evaluate(() => document.documentElement.lang);
  const bodyEn = await page.evaluate(() => document.body.innerText.slice(0, 500));
  out.bodyAfterEnglish = bodyEn.slice(0, 140).replace(/\n+/g, ' | ');
  out.textChanged = bodyEn !== bodyBefore;
  out.headerIsEnglish = /Home|Municipalities|Public Services|News|Contact/i.test(bodyEn);

  // ---- Switch to Arabic and check RTL ----
  await page.getByRole('button', { name: /Change language|Ndrysho gjuhën|اللغة/i }).first()
    .click({ force: true });
  await page.waitForTimeout(800);
  await page.getByRole('menuitemradio', { name: /العربية/i }).first()
    .click({ force: true });
  await page.waitForTimeout(1800);

  out.urlAfterArabic = page.url();
  out.htmlLangAfterArabic = await page.evaluate(() => document.documentElement.lang);
  out.htmlDirAfterArabic = await page.evaluate(() => document.documentElement.dir);

  return out;
}
