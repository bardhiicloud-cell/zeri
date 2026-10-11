const fs = require('fs');
const path = './src/pages/ContactNumbersPage.tsx';
let data = Object.assign('', fs.readFileSync(path, 'utf8'));

const start = data.indexOf('const Trunk =');
const end = data.indexOf('export default function ContactNumbersPage');

if (start !== -1 && end !== -1) {
    const importStatement = `import { EMERGENCY_NUMBERS, MINISTRY_CONTACTS, UTILITY_CONTACTS, MUNICIPALITY_CONTACTS } from '../lib/data/contacts';\n`;
    const before = data.substring(0, start);
    const after = data.substring(end);
    fs.writeFileSync(path, before + importStatement + '\n' + after);
    console.log('Successfully updated ContactNumbersPage.tsx');
} else {
    console.error('Could not find markers in file.');
}
