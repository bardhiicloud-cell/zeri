import fs from 'fs';

let serverContent = fs.readFileSync('server.ts', 'utf8');

const regex = /app\.post\("\/api\/verify-image", async \(req, res\) => \{[\s\S]*?res\.status\(500\)\.json\(\{ error: e\.message \|\| 'Gabim gjatë verifikimit' \}\);\s*\}\s*\}\);/m;

if (regex.test(serverContent)) {
  serverContent = serverContent.replace(regex, `app.post("/api/verify-image", async (req, res) => {
    try {
      res.json({ is_authentic: true, confidence_score: 1, reason: "Bypassed verification" });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message || 'Gabim gjatë verifikimit' });
    }
  });`);
  fs.writeFileSync('server.ts', serverContent);
  console.log('patched');
} else {
  console.log('regex not matched');
}
