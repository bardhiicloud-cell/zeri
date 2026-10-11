import fs from 'fs';
let content = fs.readFileSync('src/pages/ReelsPage.tsx', 'utf8');
content = content.replace("import { ReelsTab }", "import ReelsTab");
fs.writeFileSync('src/pages/ReelsPage.tsx', content);
