const fs = require('fs');
const path = require('path');

const dirs = ['client/src', 'server'];
const exts = ['.ts', '.tsx', '.html', '.md', '.json'];
const corruptions = new Set();
const fileMap = new Map();

function scanDir(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            scanDir(fullPath);
        } else {
            if (exts.includes(path.extname(fullPath))) {
                const content = fs.readFileSync(fullPath, 'utf8');
                if (content.includes('\uFFFD')) {
                    if (!fileMap.has(fullPath)) fileMap.set(fullPath, new Set());
                    // Find all words containing \uFFFD. Include Turkish chars just in case.
                    const regex = /[a-zA-Z\uFFFD]+/g;
                    let match;
                    while ((match = regex.exec(content)) !== null) {
                        if (match[0].includes('\uFFFD')) {
                            corruptions.add(match[0]);
                            fileMap.get(fullPath).add(match[0]);
                        }
                    }
                }
            }
        }
    }
}

dirs.forEach(scanDir);
console.log("Unique corrupted words:");
console.log(Array.from(corruptions).sort().join(', '));
console.log("\nFiles affected:");
for (const [file, words] of fileMap.entries()) {
    console.log(`${file}: ${Array.from(words).join(', ')}`);
}
