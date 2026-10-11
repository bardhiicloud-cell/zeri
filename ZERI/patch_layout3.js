import fs from 'fs';
let content = fs.readFileSync('src/components/layout/AppLayout.tsx', 'utf8');

// I will just add Video to the lucide-react import
const lucideMatch = content.match(/import \{([^}]+)\} from 'lucide-react';/);
if (lucideMatch && !lucideMatch[1].includes('Video')) {
  const newImport = lucideMatch[0].replace("} from 'lucide-react';", ", Video } from 'lucide-react';");
  content = content.replace(lucideMatch[0], newImport);
  fs.writeFileSync('src/components/layout/AppLayout.tsx', content);
}
