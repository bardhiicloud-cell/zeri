import fs from 'fs';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function run() {
  const fileContent = fs.readFileSync('src/lib/dynamicTranslations.ts', 'utf-8');
  
  // A simple regex extraction isn't enough, let's use eval to get the object
  // But dynamicTranslations.ts has `export const dynamicTranslations = { ... }`
  
  let jsonString = fileContent.replace('export const dynamicTranslations: Record<string, Record<string, string>> = ', '').replace(/;$/, '');
  let dict = eval('(' + jsonString + ')');
  
  const keysToTranslate = [];
  for (const [key, val] of Object.entries(dict)) {
    if (val.sq === val.en && key.length > 2) {
      keysToTranslate.push(key);
    }
  }
  
  console.log(`Found ${keysToTranslate.length} phrases to translate.`);
  
  const chunkSize = 100;
  for (let i = 0; i < keysToTranslate.length; i += chunkSize) {
    const chunk = keysToTranslate.slice(i, i + chunkSize);
    console.log(`Translating chunk ${i / chunkSize + 1} of ${Math.ceil(keysToTranslate.length / chunkSize)}...`);
    
    const prompt = `Translate the following Albanian phrases into English (en), Bosnian (bs), Serbian (sr), Turkish (tr), and German (de).
Respond ONLY with a valid JSON object where the keys are the EXACT Albanian phrases provided, and the values are objects containing the translations for en, bs, sr, tr, de. Do not wrap in markdown tags like \`\`\`json.
Example output:
{
  "Përshëndetje": { "en": "Hello", "bs": "Zdravo", "sr": "Zdravo", "tr": "Merhaba", "de": "Hallo" }
}

Phrases to translate:
${JSON.stringify(chunk, null, 2)}
`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
      });
      
      const translatedJson = JSON.parse(response.text.replace(/```json/g, '').replace(/```/g, '').trim());
      
      for (const key of chunk) {
        if (translatedJson[key]) {
          dict[key] = {
            sq: key,
            ...translatedJson[key]
          };
        }
      }
    } catch (e) {
      console.error(`Error translating chunk ${i}:`, e.message);
    }
  }
  
  const newContent = `export const dynamicTranslations: Record<string, Record<string, string>> = ${JSON.stringify(dict, null, 2)};\n`;
  fs.writeFileSync('src/lib/dynamicTranslations.ts', newContent);
  console.log("Translations saved!");
}

run();
