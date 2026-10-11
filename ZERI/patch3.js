import fs from 'fs';

let serverContent = fs.readFileSync('server.ts', 'utf8');

const dupRegex = /app\.post\("\/api\/detect-duplicate", async \(req, res\) => \{[\s\S]*?res\.status\(500\)\.json\(\{ error: e\.message \|\| 'Gabim gjatë krahasimit' \}\);\s*\}\s*\}\);/m;

if (dupRegex.test(serverContent)) {
  serverContent = serverContent.replace(dupRegex, `app.post("/api/detect-duplicate", async (req, res) => {
    try {
      res.json({ is_duplicate: false, duplicate_of_id: null, reason: "Bypassed" });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message || 'Gabim gjatë krahasimit' });
    }
  });`);
  console.log('patched duplicate');
} else {
  console.log('duplicate regex not matched');
}

fs.writeFileSync('server.ts', serverContent);
