import fs from 'fs';
let content = fs.readFileSync('src/pages/ForumPage.tsx', 'utf8');

content = content.replace("setExpandedImage(post.imageUrl)", "window.open(post.imageUrl, '_blank')");

fs.writeFileSync('src/pages/ForumPage.tsx', content);
