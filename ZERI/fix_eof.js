import fs from 'fs';
let content = fs.readFileSync('src/pages/StatisticsPage.tsx', 'utf8');

content = content.replace("  );\n}", "    </div>\n  );\n}");

fs.writeFileSync('src/pages/StatisticsPage.tsx', content);
