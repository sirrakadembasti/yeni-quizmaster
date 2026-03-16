(async () => {
  const base = 'http://localhost:5000';
  const rand = Date.now();
  const email = `testuser+${rand}@example.com`;
  const password = 'Test1234!';
  const name = 'Test User';

  function getCookieHeader(res) {
    const raw = res.headers.get('set-cookie');
    if (!raw) return null;
    // take first cookie header value
    const parts = raw.split(/,(?=\s*[^;]+=)/);
    return parts.map(p => p.split(';')[0]).join('; ');
  }

  try {
    console.log('REGISTER ->', email);
    let res = await fetch(`${base}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });
    console.log('REGISTER status', res.status);
    const regBody = await res.text();
    console.log('REGISTER body', regBody);
    if (!res.ok) throw new Error('Register failed');
    const cookie = getCookieHeader(res);
    console.log('COOKIE:', cookie);

    // PATCH profile
    const newName = name + ' Updated';
    console.log('PATCH /api/auth/me ->', newName);
    res = await fetch(`${base}/api/auth/me`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie || '' },
      body: JSON.stringify({ name: newName }),
    });
    console.log('PATCH status', res.status);
    console.log('PATCH body', await res.text());
    if (!res.ok) throw new Error('Profile update failed');

    // GET current user
    console.log('GET /api/auth/me');
    res = await fetch(`${base}/api/auth/me`, { headers: { Cookie: cookie || '' } });
    console.log('GET status', res.status);
    console.log('GET body', await res.text());

    // Change password
    const newPassword = 'New' + password;
    console.log('PATCH /api/auth/password -> change to', newPassword);
    res = await fetch(`${base}/api/auth/password`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie || '' },
      body: JSON.stringify({ currentPassword: password, newPassword }),
    });
    console.log('PASSWORD PATCH status', res.status);
    console.log('PASSWORD PATCH body', await res.text());
    if (!res.ok) throw new Error('Password change failed');

    // Login with new password
    console.log('POST /api/auth/login ->', email);
    res = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: newPassword }),
    });
    console.log('LOGIN status', res.status);
    console.log('LOGIN body', await res.text());
    if (!res.ok) throw new Error('Login with new password failed');

    console.log('VERBOSE TEST PASSED');
  } catch (err) {
    console.error('VERBOSE TEST ERROR', err);
    process.exit(1);
  }
})();