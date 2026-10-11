import fs from 'fs';
let content = fs.readFileSync('src/lib/store.ts', 'utf8');

content = content.replace("Bisedo dhe Shpërndaj", "Debato dhe Shpërndaj");

fs.writeFileSync('src/lib/store.ts', content);
