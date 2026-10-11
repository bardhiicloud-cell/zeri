export default async function run(page, ui) {
  const out = {};

  // Dismiss the first-run location prompt with the explicit whole-country button.
  const skip = page.getByRole('button', { name: /Shiko gjithë Kosovën/i });
  out.skipFound = await skip.count();
  if (out.skipFound) {
    await skip.first().click();
    await page.waitForTimeout(600);
  }
  out.dialogGone = (await page.locator('[role=dialog]').count()) === 0;
  out.stored = await page.evaluate(() => localStorage.getItem('kosova_user_muni'));

  const trigger = page.locator('aside button[aria-haspopup="listbox"]').first();
  out.triggerVisible = await trigger.isVisible().catch((e) => 'ERR:' + e.message.slice(0, 60));
  out.triggerLabel = await trigger.innerText().catch(() => null);
  out.triggerBox = await trigger.boundingBox().catch(() => null);

  // Does the navigation column itself scroll? (sh > ch means yes.)
  const nav = page.locator('aside nav').first();
  out.navScroll = await nav.evaluate((el) => ({ sh: el.scrollHeight, ch: el.clientHeight })).catch(() => null);

  await trigger.click();
  await page.waitForTimeout(400);
  out.optionCount = await page.locator('[role="option"]').count();
  out.hasPeje = await page.locator('[role="option"]', { hasText: 'Pejë' }).count();
  out.hasZvecan = await page.locator('[role="option"]', { hasText: 'Zveçan' }).count();
  out.listScroll = await page.locator('[role="listbox"] ul').first()
    .evaluate((el) => ({ sh: el.scrollHeight, ch: el.clientHeight })).catch(() => null);

  await page.locator('[role="option"]', { hasText: 'Pejë' }).first().click();
  await page.waitForTimeout(700);
  out.storedAfter = await page.evaluate(() => localStorage.getItem('kosova_user_muni'));
  out.triggerAfter = await trigger.innerText().catch(() => null);
  out.navScrollAfter = await nav.evaluate((el) => ({ sh: el.scrollHeight, ch: el.clientHeight })).catch(() => null);
  out.mainHasPeje = await page.locator('main').innerText().then((t) => /Pejë/.test(t)).catch(() => null);

  return out;
}
