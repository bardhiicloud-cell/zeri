import fs from 'fs';
import path from 'path';

function walk(dir: string) {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = dir + '/' + file;
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else { 
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
  
  // Replace hardcoded brutalist colors with softer modern alternatives
  newContent = newContent.replace(/\[#0A192F\]/g, 'slate-900');
  newContent = newContent.replace(/#0A192F/g, '#0f172a');
  
  newContent = newContent.replace(/\[#D32F2F\]/g, 'rose-600');
  newContent = newContent.replace(/#D32F2F/g, '#e11d48');
  
  newContent = newContent.replace(/\[#1A365D\]/g, 'blue-900');
  newContent = newContent.replace(/#1A365D/g, '#1e3a8a');
  
  newContent = newContent.replace(/\[#F8F9FA\]/g, 'slate-50');
  newContent = newContent.replace(/#F8F9FA/g, '#f8fafc');

  // One more check for transition/rounded
  newContent = newContent.replace(/rounded-none/g, 'rounded-xl');
  
  if (content !== newContent) {
    fs.writeFileSync(file, newContent, 'utf8');
    console.log('Updated colors in ' + file);
  }
});
