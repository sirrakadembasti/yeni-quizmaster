// Read configuration without importing storage or starting background workers.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const root = path.resolve(import.meta.dirname, '..');
const require = createRequire(path.join(root, 'server/package.json'));
const dotenv = require('dotenv'), nodemailer = require('nodemailer');
const env = { ...process.env };
for (const file of ['server/.env', '.env']) {
  const target = path.join(root, file);
  if (fs.existsSync(target)) for (const [key, value] of Object.entries(dotenv.parse(fs.readFileSync(target)))) {
    if (env[key] === undefined) env[key] = value;
  }
}
const port = Number.parseInt(env.EMAIL_PORT || '587', 10) === 465 ? 465 : 587;
const configured = Boolean(env.EMAIL_USER?.trim() && env.EMAIL_PASS);
const recipient = process.argv[2];
if (recipient && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) throw new Error('Invalid authorized recipient');
const report = { at: new Date().toISOString(), host: 'smtp.gmail.com', port,
  authConfigured: configured, sent: false, scope: configured ? 'TLS and account authentication, no send' : 'TLS and SMTP availability only, no authentication or send' };
const transport = nodemailer.createTransport({ host: report.host, port, secure: port === 465,
  requireTLS: port !== 465, connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
  ...(configured ? { auth: { user: env.EMAIL_USER.trim(), pass: env.EMAIL_PASS } } : {}) });
try {
  await transport.verify(); report.transportVerified = true;
  if (recipient && configured) {
    const info = await transport.sendMail({ from: env.EMAIL_FROM?.trim() || env.EMAIL_USER.trim(), to: recipient,
      subject: 'QuizMaster SMTP doğrulama testi', text: 'Bu e-posta, talep ettiğiniz QuizMaster Gmail SMTP testidir. Gerçek kullanıcı verisi içermez.' });
    report.sent = info.accepted?.includes(recipient) === true;
    report.acceptedCount = info.accepted?.length || 0;
    report.rejectedCount = info.rejected?.length || 0;
    report.scope = 'TLS, account authentication and authorized test message SMTP acceptance; inbox delivery unverified';
  }
}
catch (error) { report.transportVerified = false; report.errorCode = error.code || 'SMTP_ERROR'; }
finally { transport.close(); }
fs.mkdirSync(path.join(root, 'docs/integration-audit'), { recursive: true });
fs.writeFileSync(path.join(root, 'docs/integration-audit/smtp-probe.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
if (!report.transportVerified || (recipient && (!configured || !report.sent || report.rejectedCount !== 0))) process.exitCode = 1;
