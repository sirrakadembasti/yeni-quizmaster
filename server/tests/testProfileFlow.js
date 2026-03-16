const fs = require('fs');
const path = require('path');
const logPath = path.join(__dirname, 'testProfileFlow.log');
// Clear previous log
try { fs.writeFileSync(logPath, ''); } catch (e) {}
function writeLog(...args) {
  try { fs.appendFileSync(logPath, args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ') + '\n'); } catch (e) {}
}
const _log = console.log;
const _err = console.error;
console.log = (...args) => { writeLog(...args); _log(...args); };
console.error = (...args) => { writeLog(...args); _err(...args); };

(async () => {
  const base = 'http://127.0.0.1:5000';
  const rand = Date.now();
  const email = `testuser+${rand}@example.com`;
  const password = 'Test1234!';
  const name = 'Test User';

  function getCookieHeader(res) {
    const sc = res.headers.get('set-cookie');
    if (!sc) return null;
    // If multiple cookies, join by '; '
    return sc.split(/,(?=\s*[^;]+=)/).map(s => s.split(';')[0]).join('; ');
  }

  try {
    console.log('Registering user', email);
    const reg = await fetch(`${base}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });
    const regBody = await reg.json();
    if (!reg.ok) {
      console.error('Register failed', regBody);
      process.exit(1);
    }
    const cookie = getCookieHeader(reg);
    console.log('Registered. Cookie:', !!cookie);

    // Update profile
    const newName = name + ' Updated';
    console.log('Updating profile name to', newName);
    const upd = await fetch(`${base}/api/auth/me`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: newName }),
    });
    const updBody = await upd.json();
    console.log('Update response:', upd.status, updBody);
    if (!upd.ok) { process.exit(1); }

    // Verify profile
    const me = await fetch(`${base}/api/auth/me`, { headers: { Cookie: cookie } });
    const meBody = await me.json();
    console.log('Current user after update:', meBody);

    // Change password
    const newPassword = 'New' + password;
    console.log('Changing password to', newPassword);
    const ch = await fetch(`${base}/api/auth/password`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ currentPassword: password, newPassword }),
    });
    const chBody = await ch.json();
    console.log('Change password response:', ch.status, chBody);
    if (!ch.ok) { process.exit(1); }

    // Logout by clearing cookie (just test login)
    console.log('Attempting login with new password');
    const login = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: newPassword }),
    });
    const loginBody = await login.json();
    console.log('Login response:', login.status, loginBody);
    if (!login.ok) { process.exit(1); }

    console.log('All tests passed');
    process.exit(0);
  } catch (e) {
    console.error('Test flow error:', e);
    process.exit(1);
  }
})();