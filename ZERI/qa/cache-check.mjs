export default async function run(page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  // Disable the HTTP cache so the old module cannot be reused.
  await page.route("**/*", function (route) { route.continue(); });
  await page.goto(page.url().replace(/#.*$/, "") + "?v=" + Date.now() + "#/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(6000);
  await page.evaluate("(function(){var b=Array.from(document.querySelectorAll(\"button\"));var a=b.find(function(x){return /Prano t\\u00eb gjitha/i.test(x.textContent||\"\")});if(a)a.click();return !!a;})()");
  await page.waitForTimeout(7000);
  await page.evaluate("(function(){var b=Array.from(document.querySelectorAll(\"button\"));var s=b.find(function(x){return /Kosov\\u00eb/i.test(x.textContent||\"\")&&!/Prano/i.test(x.textContent||\"\")});if(s)s.click();return !!s;})()");
  await page.waitForTimeout(3500);
  await page.keyboard.press("Control+k");
  await page.waitForTimeout(2500);
  return await page.evaluate("(function(){var i=document.querySelector(\"input[role=combobox]\");if(!i)return {error:\"no input\"};var row=i.parentElement;var me=Array.from(row.querySelectorAll(\"a[rel*=me]\"));return {kids:Array.from(row.children).map(function(c){return c.tagName.toLowerCase()}),meCount:me.length,labels:me.map(function(a){return a.getAttribute(\"aria-label\")})};})()");
}
