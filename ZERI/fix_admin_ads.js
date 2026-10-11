import fs from 'fs';
let content = fs.readFileSync('src/components/admin/AdminAds.tsx', 'utf8');

content = content.replace("<option value=\"bisedo\">Bisedo (Chat)</option>", "");

fs.writeFileSync('src/components/admin/AdminAds.tsx', content);
