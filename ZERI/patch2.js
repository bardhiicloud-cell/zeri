import fs from 'fs';

let serverContent = fs.readFileSync('server.ts', 'utf8');

// Bypass botnet
const botnetRegex = /app\.post\("\/api\/check-botnet", async \(req, res\) => \{[\s\S]*?res\.status\(500\)\.json\(\{ error: e\.message \|\| 'Gabim botnet check' \}\);\s*\}\s*\}\);/m;

if (botnetRegex.test(serverContent)) {
  serverContent = serverContent.replace(botnetRegex, `app.post("/api/check-botnet", async (req, res) => {
    try {
      res.json({ is_bot: false, confidence: 0, block_reason: "Bypassed" });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message || 'Gabim botnet check' });
    }
  });`);
  console.log('patched botnet');
} else {
  console.log('botnet regex not matched');
}

// Bypass duplicates
const dupRegex = /app\.post\("\/api\/detect-duplicate", async \(req, res\) => \{[\s\S]*?res\.status\(500\)\.json\(\{ error: e\.message \|\| 'Gabim gjatë detektimit të duplikatave' \}\);\s*\}\s*\}\);/m;

if (dupRegex.test(serverContent)) {
  serverContent = serverContent.replace(dupRegex, `app.post("/api/detect-duplicate", async (req, res) => {
    try {
      res.json({ is_duplicate: false, duplicate_of_id: null, reason: "Bypassed" });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message || 'Gabim gjatë detektimit të duplikatave' });
    }
  });`);
  console.log('patched duplicate');
} else {
  console.log('duplicate regex not matched');
}

fs.writeFileSync('server.ts', serverContent);
