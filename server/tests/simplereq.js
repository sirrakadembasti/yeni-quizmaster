// Super simple test to see API response
const http = require('http');

const req = http.request({
  hostname: '127.0.0.1',
  port: 5000,
  path: '/api/auth/register',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log(`Status: ${res.statusCode}`);
    console.log(`Body: ${data}`);
    process.exit(0);
  });
});

req.on('error', (err) => {
  console.log(`Error: ${err.message}`);
  process.exit(1);
});

req.write(JSON.stringify({name: 'test', email: 'test@test.com', password: 'test123'}));
req.end();
