import fs from 'fs';
function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function (file) {
        file = dir + '/' + file;
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        }
        else {
            if (file.endsWith('.tsx') || file.endsWith('.ts')) {
                results.push(file);
            }
        }
    });
    return results;
}
const files = walk('./src');
files.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    let newContent = content;
    newContent = newContent.replace(/\[#A92222\]/g, 'rose-700');
    newContent = newContent.replace(/#A92222/g, '#be123c'); // rose-700 HEX
    // Also any remaining font sizes that are extremely small: text-[10px] -> text-xs, text-[11px] -> text-sm
    newContent = newContent.replace(/text-\[10px\]/g, 'text-xs');
    newContent = newContent.replace(/text-\[11px\]/g, 'text-sm');
    newContent = newContent.replace(/text-\[7px\]/g, 'text-xs');
    newContent = newContent.replace(/text-\[6px\]/g, 'text-xs');
    newContent = newContent.replace(/text-\[8px\]/g, 'text-xs');
    newContent = newContent.replace(/text-\[9px\]/g, 'text-xs');
    if (content !== newContent) {
        fs.writeFileSync(file, newContent, 'utf8');
        console.log('Cleaned up hex and tiny text in ' + file);
    }
});
