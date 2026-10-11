import fs from 'fs';
let content = fs.readFileSync('src/pages/ReelsPage.tsx', 'utf8');

content = content.replace(
  "<ReelsTab requireAuth={requireAuth} currentUser={currentUser} />",
  "<ReelsTab requireAuth={requireAuth} currentUser={currentUser} onClose={() => navigate(-1)} />"
);

fs.writeFileSync('src/pages/ReelsPage.tsx', content);
