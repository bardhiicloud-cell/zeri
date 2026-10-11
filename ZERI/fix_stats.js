import fs from 'fs';
let content = fs.readFileSync('src/pages/StatisticsPage.tsx', 'utf8');

content = content.replace(/const reports = useStore\(state => state\.reports\);/, "const reports = useStore(state => state.reports) || [];");
content = content.replace(/const users = useStore\(state => state\.users\);/, "const users = useStore(state => state.users) || [];");

fs.writeFileSync('src/pages/StatisticsPage.tsx', content);
