import fs from 'fs';
let content = fs.readFileSync('src/components/forum/ReelsTab.tsx', 'utf8');

const regex = /<\/div>\s*<\/div>\s*<\/div>\s*<div className="space-y-2">/;
const replacement = `</div>
              </div>
              
              <div className="space-y-2">`;

content = content.replace(regex, replacement);

fs.writeFileSync('src/components/forum/ReelsTab.tsx', content);
