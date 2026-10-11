import fs from 'fs';
let content = fs.readFileSync('src/components/forum/ReelsTab.tsx', 'utf8');

content = content.replace('      {/* Comments Modal */}', '      )}\n\n      {/* Comments Modal */}');
fs.writeFileSync('src/components/forum/ReelsTab.tsx', content);
