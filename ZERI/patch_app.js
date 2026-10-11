import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf8');

// Add import
content = content.replace("import PollsPage from './pages/PollsPage';", "import PollsPage from './pages/PollsPage';\nimport ReelsPage from './pages/ReelsPage';");

// Add route
content = content.replace("<Route path=\"/sondazhet\" element={<PollsPage />} />", "<Route path=\"/sondazhet\" element={<PollsPage />} />\n              <Route path=\"/reels\" element={<ReelsPage />} />");

fs.writeFileSync('src/App.tsx', content);
