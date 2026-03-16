const fs = require('fs');
const out = [];
out.push('node version: ' + process.version);
out.push('cwd: ' + process.cwd());
out.push('typeof fetch: ' + (typeof fetch));
out.push('env PATH: ' + process.env.PATH);
fs.writeFileSync('d:/dnm/Quiz-Master/server/tests/node_diag.out', out.join('\n'));
console.log('WROTE DIAG');
