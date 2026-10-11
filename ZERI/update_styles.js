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
    let newContent = content.replace(/transition-none/g, 'transition-colors duration-300 ease-in-out');
    newContent = newContent.replace(/text-neutral-500/g, 'text-neutral-600');
    newContent = newContent.replace(/text-neutral-400/g, 'text-neutral-500');
    newContent = newContent.replace(/text-neutral-600/g, 'text-neutral-700');
    if (content !== newContent) {
        fs.writeFileSync(file, newContent, 'utf8');
        console.log('Updated ' + file);
    }
});
