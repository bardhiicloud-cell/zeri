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
  
  // Convert brutalist shadows to soft shadows
  newContent = newContent.replace(/shadow-\[[1-9]px_[1-9]px_0px_[^\]]+\]/g, 'shadow-md hover:shadow-lg transition-all duration-300 rounded-xl');
  
  // Soften borders
  newContent = newContent.replace(/border-4 border-\[#0A192F\]/g, 'border-2 border-slate-200 rounded-xl');
  newContent = newContent.replace(/border-4 border-transparent/g, 'border-2 border-transparent rounded-xl');
  newContent = newContent.replace(/border-2 border-\[#0A192F\]/g, 'border border-slate-200 rounded-xl');
  newContent = newContent.replace(/border-b-4 border-\[#0A192F\]/g, 'border-b border-slate-200');
  newContent = newContent.replace(/border-r-4 border-\[#0A192F\]/g, 'border-r border-slate-200');
  newContent = newContent.replace(/border-t-4 border-\[#0A192F\]/g, 'border-t border-slate-200');
  newContent = newContent.replace(/border-4 border-\[#D32F2F\]/g, 'border-2 border-red-200 rounded-xl');
  newContent = newContent.replace(/border-l-4 border-\[#D32F2F\]/g, 'border-l-4 border-red-500 rounded-l-xl');
  
  // Soften typography
  newContent = newContent.replace(/font-black/g, 'font-bold');
  newContent = newContent.replace(/uppercase tracking-widest/g, 'tracking-wide');
  newContent = newContent.replace(/uppercase tracking-wider/g, 'tracking-wide');
  newContent = newContent.replace(/uppercase tracking-tighter/g, 'tracking-normal');
  
  // Update buttons and inputs (often missed by just borders)
  // Ensure we don't have too many rounded-xl
  newContent = newContent.replace(/rounded-none/g, 'rounded-xl');
  
  if (content !== newContent) {
    fs.writeFileSync(file, newContent, 'utf8');
    console.log('Updated classes in ' + file);
  }
});
