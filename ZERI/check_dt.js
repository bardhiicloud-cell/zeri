const fs = require('fs');
const glob = require('glob'); // Not available? We can use child_process
const { execSync } = require('child_process');

const dtRegex = /dt\(\s*(["'])(.*?)\1\s*\)/g;
const files = execSync('find src -name "*.tsx"').toString().split('\n').filter(Boolean);

let allStrings = new Set();
for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  let match;
  while ((match = dtRegex.exec(content)) !== null) {
    allStrings.add(match[2]);
  }
}

console.log("Total dt strings:", allStrings.size);

const dtContent = fs.readFileSync('src/lib/dynamicTranslations.ts', 'utf8');
let missing = 0;
for (const str of allStrings) {
  if (!dtContent.includes(`"${str}"`)) {
    missing++;
    console.log("Missing:", str);
  }
}
console.log("Missing count:", missing);
