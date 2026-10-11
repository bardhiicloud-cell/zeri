import fs from 'fs';
let content = fs.readFileSync('src/components/forum/ReelsTab.tsx', 'utf8');

content = content.replace("song: 'Tingull origjinal - ' + (currentUser?.name || 'Anonim'),", "");

fs.writeFileSync('src/components/forum/ReelsTab.tsx', content);
