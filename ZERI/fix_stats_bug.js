import fs from 'fs';
let content = fs.readFileSync('src/pages/StatisticsPage.tsx', 'utf8');

content = content.replace(/stats\.timelineData/g, 'timelineData');
content = content.replace(/stats\.categoryByMunicipality/g, 'categoryByMunicipality');
content = content.replace(/stats\.categoryData/g, 'categoryData');
content = content.replace(/stats\.municipalityStats/g, 'municipalityStats');

fs.writeFileSync('src/pages/StatisticsPage.tsx', content);
