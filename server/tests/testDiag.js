const fs = require('fs');

const logs = [];

function log(msg) {
  const s = typeof msg === 'string' ? msg : JSON.stringify(msg);
  console.log(s);
  logs.push(s);
}

(async () => {
  try {
    log('=== Test Start ===');
    const base = 'http://127.0.0.1:5000';
    const rand = Date.now();
    const email = `testuser+${rand}@example.com`;
    const password = 'Test1234!';

    log('Registering: ' + email);
    const reg = await fetch(`${base}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test', email, password }),
    });
    log('Register status: ' + reg.status);
    const regBody = await reg.json();
    log('Register body: ' + JSON.stringify(regBody));
    
    if (!reg.ok) {
      log('REGISTER FAILED');
      fs.writeFileSync(__dirname + '/testDiag.log', logs.join('\n'));
      process.exit(1);
    }

    log('All steps passed!');
    fs.writeFileSync(__dirname + '/testDiag.log', logs.join('\n'));
    process.exit(0);
  } catch (e) {
    log('ERROR: ' + e.message);
    fs.writeFileSync(__dirname + '/testDiag.log', logs.join('\n'));
    process.exit(1);
  }
})();
