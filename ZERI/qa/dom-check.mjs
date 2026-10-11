export default async function run(page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(page.url().replace(/#.*$/, "") + "#/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);
  await page.evaluate("(function(){var b=Array.from(document.querySelectorAll(\"button\"));var a=b.find(function(x){return /Prano t\\u00eb gjitha/i.test(x.textContent||\"\")});if(a)a.click();return !!a;})()");
  await page.waitForTimeout(6000);
  await page.evaluate("(function(){var b=Array.from(document.querySelectorAll(\"button\"));var s=b.find(function(x){return /Kosov\\u00eb/i.test(x.textContent||\"\")&&!/Prano/i.test(x.textContent||\"\")});if(s)s.click();return !!s;})()");
  await page.waitForTimeout(3500);
  var before = await page.evaluate("document.querySelectorAll(\"input[role=combobox]\").length");
  await page.keyboard.press("Control+k");
  await page.waitForTimeout(2500);
  return await page.evaluate("(function(){var inputs=document.querySelectorAll(\"input[role=combobox]\");var out=[];for(var k=0;k<inputs.length;k++){var i=inputs[k];var row=i.parentElement;out.push({idx:k,rowCls:(row.className||\"\").toString().slice(0,60),kids:Array.from(row.children).map(function(c){return c.tagName.toLowerCase()}),me:row.querySelectorAll(\"a[rel*=me]\").length});}return {inputsBefore:BF,count:inputs.length,rows:out};})()".replace("BF", String(before)));
}
