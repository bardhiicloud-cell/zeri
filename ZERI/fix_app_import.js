import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace("import LiveChatPage from './pages/LiveChatPage';\n", "");

fs.writeFileSync('src/App.tsx', content);
