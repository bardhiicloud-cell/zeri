import fs from 'fs';
let content = fs.readFileSync('src/components/forum/ReelsTab.tsx', 'utf8');
content = content.replace(/\/\* \{!showCreate .*?\*\//, '{!showCreate && (');
fs.writeFileSync('src/components/forum/ReelsTab.tsx', content);
