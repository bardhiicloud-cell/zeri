import fs from 'fs';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function translateChunk(texts, tl) {
  const combined = texts.join('\n');
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=sq&tl=${tl}&dt=t&q=${encodeURIComponent(combined)}`;
  
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    let result = '';
    for (const item of data[0]) {
      result += item[0];
    }
    const split = result.split('\n').map(s => s.trim());
    if (split.length !== texts.length) return null;
    return split;
  } catch (e) {
    return null;
  }
}

async function translateSingle(text, tl) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=sq&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return text;
    const data = await res.json();
    let result = '';
    for (const item of data[0]) {
      result += item[0];
    }
    return result.trim();
  } catch (e) {
    return text;
  }
}

async function run() {
  console.log("Reading file...");
  const fileContent = fs.readFileSync('src/lib/dynamicTranslations.ts', 'utf-8');
  const match = fileContent.match(/export const dynamicTranslations: Record<string, Record<string, string>> = (\{[\s\S]*?\});/);
  if (!match) throw new Error('Not found');
  let dict = eval('(' + match[1] + ')');
  
  const keysToTranslate = [];
  for (const [key, val] of Object.entries(dict)) {
    // Check if any lang is untranslated (or matching sq)
    if ((val.sq === val.en || val.sq === val.bs || val.sq === val.sr || val.sq === val.tr || val.sq === val.de) && key.length > 1) {
      keysToTranslate.push(key);
    }
  }
  
  console.log(`Found ${keysToTranslate.length} phrases to translate.`);
  if (keysToTranslate.length === 0) return;
  
  const targetLangs = ['en', 'bs', 'sr', 'tr', 'de'];
  const chunkSize = 20;
  
  let translatedCount = 0;

  for (let i = 0; i < keysToTranslate.length; i += chunkSize) {
    const chunk = keysToTranslate.slice(i, i + chunkSize);
    console.log(`\nTranslating chunk ${i/chunkSize + 1}/${Math.ceil(keysToTranslate.length/chunkSize)}...`);
    
    for (const lang of targetLangs) {
      let results = await translateChunk(chunk, lang);
      if (!results) {
        results = [];
        for (const text of chunk) {
          const res = await translateSingle(text, lang);
          results.push(res);
          await sleep(200);
        }
      } else {
        await sleep(500);
      }
      for (let j = 0; j < chunk.length; j++) {
        const originalKey = chunk[j];
        if (dict[originalKey]) {
           dict[originalKey][lang] = results[j] || dict[originalKey][lang];
        }
      }
    }
    
    translatedCount += chunk.length;
    const newContent = `export const dynamicTranslations: Record<string, Record<string, string>> = ${JSON.stringify(dict, null, 2)};\n`;
    fs.writeFileSync('src/lib/dynamicTranslations.ts', newContent);
    console.log(`Saved progress (${translatedCount}/${keysToTranslate.length}).`);
  }
  console.log("Translations completed!");
}
run();
