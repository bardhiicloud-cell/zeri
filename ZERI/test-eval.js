const fs = require('fs');
const content = fs.readFileSync('src/lib/dynamicTranslations.ts', 'utf-8');
const match = content.match(/export const dynamicTranslations: Record<string, Record<string, string>> = (\{[\s\S]*?\});/);
if (match) {
  const dict = eval('(' + match[1] + ')');
  console.log('Parsed! keys:', Object.keys(dict).length);
}
