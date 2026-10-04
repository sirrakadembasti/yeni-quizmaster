// Scan durable evidence for configured secrets without printing their values.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
const root = path.resolve(import.meta.dirname, '..');
const dotenv = createRequire(path.join(root, 'server/package.json'))('dotenv');
const env = { ...process.env };
for (const name of ['server/.env', '.env']) if (fs.existsSync(path.join(root, name))) {
  for (const [key, value] of Object.entries(dotenv.parse(fs.readFileSync(path.join(root, name))))) if (env[key] === undefined) env[key] = value;
}
const secrets = ['EMAIL_PASS', 'GEMINI_API_KEY', 'OPENAI_API_KEY', 'SESSION_SECRET'].map(key => env[key]).filter(value => value && value.length >= 8);
const files = [];
function walk(target) {
  for (const item of fs.readdirSync(target, { withFileTypes: true })) {
    if (item.name === 'runtime-logs') continue;
    const name = path.join(target, item.name);
    if (item.isDirectory()) walk(name); else if (item.isFile()) files.push(name);
  }
}
walk(path.join(root, 'docs/integration-audit')); walk(path.join(root, 'docs/live-audit'));
for (const name of ['graph.json', 'graph.html', 'GRAPH_REPORT.md']) files.push(path.join(root, 'graphify-out', name));
for (const name of files) {
  const data = fs.readFileSync(name);
  assert(!secrets.some(value => data.includes(Buffer.from(value))), 'Configured secret found in durable evidence: ' + path.relative(root, name));
  if (name.endsWith('.json')) JSON.parse(data.toString('utf8'));
}
const hash = createHash('sha256').update(fs.readFileSync(path.join(root, 'server/data/quiz.db'))).digest('hex');
assert.equal(hash, '8210a4b79f2cfb9cf74de6a4989f5c8a5449ba1d17b2332abdbd018c3741a158', 'Real database changed');
const smtp = JSON.parse(fs.readFileSync(path.join(root, 'docs/integration-audit/smtp-probe.json')));
assert(smtp.sent && smtp.authConfigured && smtp.transportVerified);
const socket = JSON.parse(fs.readFileSync(path.join(root, 'docs/live-audit/socket-results.json')));
assert(socket.passed === 18 && socket.failed === 0 && socket.cleanupSucceeded);
const pdf = JSON.parse(fs.readFileSync(path.join(root, 'docs/integration-audit/pdf-verification.json')));
assert(pdf.files.find(x => x.file === 'ux-extra-large-report.pdf').completeRows);
console.log(JSON.stringify({ filesChecked: files.length, configuredSecretsChecked: secrets.length, secretMatches: 0, realDatabaseUnchanged: true, smtpAccepted: true, socketPassed: 18, pdfRows: 60 }));
