/**
 * Find user-visible Albanian text that never passes through dt() or t().
 *
 * Anything found here renders in Albanian no matter which language is selected,
 * which is exactly the "not 100%" gap. We look at JSX text nodes and the most
 * common user-facing props (placeholder, title, aria-label, alt, label...).
 */
import fs from 'fs';
import path from 'path';

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

// Albanian diacritics / very common Albanian words that should never appear in
// a string that is rendered directly.
const ALB = /[ëçËÇ]|\b(Shqip|Kosov|Komun|Qytetar|raporto|Raporto|Kërko|Dërgo|Ruaj|Anulo|Mbyll|Hap|Shto|Fshi|Ndrysho|Zgjidh|Shiko|Përdorues|Fjalëkalim|Emri|Titulli|Përshkrimi|Lajme|Njoftime|Fillo|Kthehu|Vazhdo|Përfund|Konfirmo)\w*/i;

const SKIP_KEYS = /^(className|key|id|type|href|to|path|name|value|src|from|color|size|data-.*)$/;

const results = [];
const files = walk('src');

for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  const lines = src.split('\n');

  lines.forEach((line, i) => {
    const lineNo = i + 1;
    // Already translated?
    if (/\bdt\(|\bt\(|newLanguageTranslations/.test(line)) return;

    // JSX text node: >Some Albanian text<
    const jsxText = line.match(/>\s*([A-Za-zÀ-ÿËëÇç][^<>{}\n]{3,})\s*</);
    if (jsxText && ALB.test(jsxText[1])) {
      results.push({ file, lineNo, kind: 'jsx-text', text: jsxText[1].trim() });
      return;
    }

    // User-facing attributes with a literal string.
    const attr = line.match(/\b(placeholder|title|aria-label|alt|label)\s*=\s*["']([^"']{3,})["']/);
    if (attr && ALB.test(attr[2])) {
      results.push({ file, lineNo, kind: attr[1], text: attr[2] });
      return;
    }

    // toast.error('...') / setError('...') and similar user-facing calls.
    const call = line.match(/\b(toast\.(?:error|success|info|warning)|alert|setError|setMessage)\s*\(\s*["']([^"']{4,})["']/);
    if (call && ALB.test(call[2])) {
      results.push({ file, lineNo, kind: call[1], text: call[2] });
      return;
    }

    // const X = ['Albanian', ...] used as option lists.
    const arr = line.match(/["']([^"']{4,})["']/g);
    if (arr && /(const|let)\s+\w*(option|label|text|title|name|placeholder|msg|message)/i.test(line)) {
      for (const a of arr) {
        const v = a.slice(1, -1);
        if (ALB.test(v) && !SKIP_KEYS.test(v)) {
          results.push({ file, lineNo, kind: 'array', text: v });
        }
      }
    }
  });
}

console.log(`Untranslated user-visible strings: ${results.length}`);
const byFile = {};
for (const r of results) byFile[r.file] = (byFile[r.file] || 0) + 1;
const top = Object.entries(byFile).sort((a, b) => b[1] - a[1]).slice(0, 40);
console.log('\nTop files:');
for (const [f, n] of top) console.log(String(n).padStart(5), f);
fs.writeFileSync('_untranslated.json', JSON.stringify(results, null, 2), 'utf8');
console.log('\nWritten _untranslated.json');
