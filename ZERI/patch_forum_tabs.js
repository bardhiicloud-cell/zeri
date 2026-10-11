import fs from 'fs';
let content = fs.readFileSync('src/pages/ForumPage.tsx', 'utf8');

// Remove reels tab from array
content = content.replace(
  "{ id: 'feed', label: 'Të Gjitha Diskutimet', icon: MessageSquare },\n              { id: 'reels', label: 'Reels & Video', icon: Video },",
  "{ id: 'feed', label: 'Të Gjitha Diskutimet', icon: MessageSquare },"
);

// Remove ReelsTab import
content = content.replace("import { ReelsTab } from '../components/forum/ReelsTab';\n", "");

// Remove ReelsTab component usage
const reelsTabRegex = /\{activeTab === 'reels' && \(\s*<ReelsTab[\s\S]*?\/>\s*\)\}/;
content = content.replace(reelsTabRegex, "");

fs.writeFileSync('src/pages/ForumPage.tsx', content);
