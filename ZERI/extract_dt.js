const fs = require('fs');
const path = require('path');

const { dynamicTranslations } = require('./src/lib/dynamicTranslations.js') || { dynamicTranslations: {} };
// Wait, dynamicTranslations is TS. Let's just use regex.

function getAllFiles(dirPath, arrayOfFiles) {
  const files = fs.readdirSync(dirPath);
  arrayOfFiles = arrayOfFiles || [];
  files.forEach(function(file) {
    if (fs.statSync(dirPath + "/" + file).isDirectory()) {
      arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
    } else {
      if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        arrayOfFiles.push(path.join(dirPath, "/", file));
      }
    }
  });
  return arrayOfFiles;
}

const files = getAllFiles('./src');
const keys = new Set();

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf-8');
  // Match dt('...') or dt("...") or dt(`...`)
  const regex = /dt\(\s*(['"`])(.*?)\1\s*\)/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    keys.add(match[2]);
  }
});

const dynTransContent = fs.readFileSync('./src/lib/dynamicTranslations.ts', 'utf-8');
const missing = [];
keys.forEach(k => {
  if (!dynTransContent.includes(`"${k}":`) && !dynTransContent.includes(`'${k}':`)) {
    missing.push(k);
  }
});

console.log("Missing keys count:", missing.length);
console.log("Missing keys:", missing);
