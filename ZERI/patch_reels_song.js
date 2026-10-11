import fs from 'fs';
let content = fs.readFileSync('src/components/forum/ReelsTab.tsx', 'utf8');

content = content.replace("music: newMusic || 'Tingull origjinal',", "song: newMusic || 'Tingull origjinal',");

fs.writeFileSync('src/components/forum/ReelsTab.tsx', content);
