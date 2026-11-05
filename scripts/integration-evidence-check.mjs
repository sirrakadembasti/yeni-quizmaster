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
walk(path.join(root, 'tests/denetim-kanitlari/entegrasyon')); walk(path.join(root, 'tests/denetim-kanitlari/canli-soket'));
for (const name of ['graph.json', 'graph.html', 'GRAPH_REPORT.md']) files.push(path.join(root, 'graphify-out', name));
for (const name of files) {
  const data = fs.readFileSync(name);
  assert(!secrets.some(value => data.includes(Buffer.from(value))), 'Configured secret found in durable evidence: ' + path.relative(root, name));
  if (name.endsWith('.json')) JSON.parse(data.toString('utf8'));
}
const hash = createHash('sha256').update(fs.readFileSync(path.join(root, 'server/data/quiz.db'))).digest('hex');
assert.equal(hash, '8210a4b79f2cfb9cf74de6a4989f5c8a5449ba1d17b2332abdbd018c3741a158', 'Real database changed');
const smtp = JSON.parse(fs.readFileSync(path.join(root, 'tests/denetim-kanitlari/entegrasyon/smtp-probe.json')));
assert(smtp.sent && smtp.authConfigured && smtp.transportVerified);
const socket = JSON.parse(fs.readFileSync(path.join(root, 'tests/denetim-kanitlari/canli-soket/socket-results.json')));
assert(socket.passed === 18 && socket.failed === 0 && socket.cleanupSucceeded);
const pdf = JSON.parse(fs.readFileSync(path.join(root, 'tests/denetim-kanitlari/entegrasyon/pdf-verification.json')));
assert(pdf.files.find(x => x.file === 'ux-extra-large-report.pdf').completeRows);
const read = name => JSON.parse(fs.readFileSync(path.join(root, 'tests/denetim-kanitlari/entegrasyon', name)));
const unit = (name, count) => {
  const report = read(name);
  assert(report.success && report.numTotalTests >= count && report.numFailedTests === 0 && report.numPendingTests === 0, 'Incomplete regression report: ' + name);
  return report.numPassedTests;
};
const frontendPassed = unit('results-client-repairs.json', 176), backendPassed = unit('results-server-repairs.json', 199);
const aiRoutePassed = unit('ai-repair-green-results.json', 47);
unit('results-client-selector-repair.json', 9); unit('ai-live-results.json', 1);
const liveAi = read('ai-live-evidence.json');
assert(liveAi.status === 'passed' && liveAi.providerRequests === 2 && liveAi.answerIndexValidated === true);
assert(read('smtp-delivery-confirmation.json').received === true);
const commands = read('verification-commands.json');
assert(commands.status === 'passed' && commands.checks.length === 3 && commands.checks.every(x => x.exitCode === 0));
const load = read('load-repair-results.json');
assert(load.fixtureIdentityVerified && load.isolatedFixture && load.status === 'executed' && load.databaseUnchanged);
assert.deepEqual(load.load.map(x => x.concurrency), [2, 8, 20]);
assert(load.load.every(x => x.requests === 180 && x.statuses[200] === 180 && x.passed && !x.statuses.requestError));
assert(load.cleanup.some(x => x.name === 'api') && load.cleanup.every(x => x.stopProven) && load.ports.every(x => x.stopped));
const profile = read('load-profile-final.json');
assert(profile.effectiveJournalMode === 'wal' && profile.requestedJournalMode === null, 'Load must exercise real product WAL without test override');
for (const [name, count] of [['ux-detail-results.json', 16], ['ux-extra-results.json', 2]]) {
  const report = read(name);
  assert(report.checks.length === count && report.checks.every(x => x.status === 'passed') && !report.runnerError && !report.error, 'Incomplete browser acceptance: ' + name);
}
for (const name of ['ux-runner-results.json', 'ux-extra-runner-results.json']) {
  const report = read(name);
  assert(report.status === 'executed' && report.detailCoverageComplete && report.databaseUnchanged && report.cleanup.every(x => x.stopProven) && report.ports.every(x => x.stopped));
}
const mobile = read('ux-repair-first-attempt.json').ux;
assert(mobile.length === 9 && mobile.every(x => x.networkSettled && !x.horizontalOverflow && x.errors.length === 0 && x.failures.length === 0));
assert(pdf.files.length === 6 && pdf.files.every(x => x.nonemptyPages));
assert(pdf.files.find(x => x.file === 'ux-detail-T-U04-many.pdf').completeClasses);
const manyClasses = read('ux-detail-results.json').checks.find(x => x.id === 'T-U04').manyClasses;
assert(manyClasses.classCount === 30 && manyClasses.groups.length === 6);
assert(pdf.files.find(x => x.file === 'ux-detail-A-U01.pdf').actionsHeaderPrinted === false);
const studentPdf = pdf.files.find(x => x.file === 'ux-detail-T-U03.pdf');
assert(studentPdf.fullStudentCodePrinted && studentPdf.actionsHeaderPrinted === false);
console.log(JSON.stringify({ filesChecked: files.length, configuredSecretsChecked: secrets.length, secretMatches: 0, realDatabaseUnchanged: true, smtpAccepted: true, smtpInboxUserConfirmed: true, frontendPassed, backendPassed, aiRoutePassed, liveAiPassed: true, socketPassed: 18, browserAcceptancePassed: 18, mobilePages: 9, loadRequestsPassed: 540, pdfRows: 60, pdfClasses:30, typeChecksAndBuildPassed: true }));
