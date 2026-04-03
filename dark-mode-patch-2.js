const fs = require('fs');
const path = require('path');

// __dirname ile göreli yol: script nerede çalıştırılırsa çalıştırılsın doğru klasörü bulur.
// Eski hardcoded yollar: 'D:/dnm/Quiz-Master/...' (sadece tek makinede çalışıyordu)
const directory = path.resolve(__dirname, 'client', 'src', 'pages');
const componentsDir = path.resolve(__dirname, 'client', 'src', 'components');

const replacements = [
  { regex: /bg-white/g, replace: 'bg-white dark:bg-slate-900' },
  { regex: /text-slate-900/g, replace: 'text-slate-900 dark:text-slate-50' },
  { regex: /text-slate-800/g, replace: 'text-slate-800 dark:text-slate-100' },
  { regex: /text-slate-700/g, replace: 'text-slate-700 dark:text-slate-200' },
  { regex: /text-slate-600/g, replace: 'text-slate-600 dark:text-slate-300' },
  { regex: /text-slate-500/g, replace: 'text-slate-500 dark:text-slate-400' },
  { regex: /text-slate-400/g, replace: 'text-slate-400 dark:text-slate-500' },
  { regex: /bg-slate-50\/50/g, replace: 'bg-slate-50/50 dark:bg-slate-900/50' },
  { regex: /bg-slate-50(?![\/])/g, replace: 'bg-slate-50 dark:bg-slate-900/80' },
  { regex: /bg-slate-100\/50/g, replace: 'bg-slate-100/50 dark:bg-slate-800/50' },
  { regex: /bg-slate-100\/80/g, replace: 'bg-slate-100/80 dark:bg-slate-800/80' },
  { regex: /bg-slate-100(?![\/])/g, replace: 'bg-slate-100 dark:bg-slate-800' },
  { regex: /bg-slate-200(?![\/])/g, replace: 'bg-slate-200 dark:bg-slate-700' },
  { regex: /border-slate-100/g, replace: 'border-slate-100 dark:border-slate-800' },
  { regex: /border-slate-200/g, replace: 'border-slate-200 dark:border-slate-700' },
  { regex: /shadow-sm/g, replace: 'shadow-sm dark:shadow-none' },
  { regex: /data-\[state=active\]:bg-white/g, replace: 'data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800' },
  { regex: /data-\[state=active\]:text-indigo-600/g, replace: 'data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-400' }
];

// Deduplicate the 'dark:' classes in case they get added multiple times
function deduplicate(str) {
  return str.split(' ').filter((item, pos, self) => self.indexOf(item) == pos).join(' ');
}

function processContent(content) {
  let newContent = content;
  replacements.forEach(r => {
    newContent = newContent.replace(r.regex, r.replace);
  });
  
  // Custom deduplication of classes inside className="" strings
  newContent = newContent.replace(/className=(["'])(.*?)\1/g, (match, quote, classes) => {
    return 'className=' + quote + deduplicate(classes) + quote;
  });
  
  // Custom deduplication inside template literals
  newContent = newContent.replace(/cn\(([\s\S]*?)\)/g, (match, inner) => {
    // A bit hacky but we just want to remove duplicate words
    let cleaned = inner.replace(/(['"])([^'"]+)\1/g, (m2, q2, cl2) => {
       return q2 + deduplicate(cl2) + q2;
    });
    return 'cn(' + cleaned + ')';
  });

  return newContent;
}

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = path.join(dir, file);
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

let allFiles = [...walk(directory), ...walk(componentsDir)];
let updatedFilesCount = 0;

allFiles.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;

  content = processContent(content);

  // Quick fix for duplicated dark classes if any happened due to overlapping regexes
  content = content.replace(/dark:bg-slate-900 dark:bg-slate-900/g, 'dark:bg-slate-900');
  content = content.replace(/dark:bg-slate-800\/50 dark:bg-slate-800\/50/g, 'dark:bg-slate-800/50');

  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf8');
    updatedFilesCount++;
  }
});

console.log('Updated ' + updatedFilesCount + ' files.');
