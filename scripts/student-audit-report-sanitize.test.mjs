import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
const helper = await import('./student-audit-report-sanitize.mjs').catch(() => null);

test('recursive reports redact fixture passwords and raw or encoded signed cookies', () => {
  assert.equal(typeof helper?.sanitizeStudentAuditReport, 'function', 'Student report sanitizer is missing');
  const original = { title: 'student password change and cookie renewal', stats: { expected: 6, unexpected: 1 },
    suites: [{ tests: [{ error: { message: 'Expected StudentAuditOnly2026!; received TemporaryAuditPassword2026!\nCookie: quizmaster.sid=s:abcdefghijklmnopqrstuv.signature1234567890\nnext line',
      stack: 'Expected s%3Aabcdefghijklmnopqrstuv.signature1234567890; actual s:zyxwvutsrqponmlkjihgfed.sign0987654321' } }] }],
    password: 'unique-field-sentinel', headers: { 'x-csrf-token': 'csrf-field-sentinel' } };
  const result = helper.sanitizeStudentAuditReport(original);
  const encoded = JSON.stringify(result.report);
  for (const secret of ['StudentAuditOnly2026!', 'TemporaryAuditPassword2026!', 'abcdefghijklmnopqrstuv',
    'zyxwvutsrqponmlkjihgfed', 'unique-field-sentinel', 'csrf-field-sentinel']) assert(!encoded.includes(secret));
  assert.equal(result.report.title, original.title);
  assert.deepEqual(result.report.stats, original.stats);
  assert(result.report.suites[0].tests[0].error.message.includes('next line'));
  assert(result.redactions >= 6);
  assert.equal(original.password, 'unique-field-sentinel', 'The input report must not be mutated');
});

test('assignment headers and token URLs are redacted without changing ordinary words', () => {
  assert.equal(typeof helper?.sanitizeStudentAuditReport, 'function');
  const original = { title: 'password reset, session expiry and authorization checks',
    text: 'SESSION_SECRET=assignment-sentinel\nAuthorization: Bearer header-sentinel\npassword: "password-sentinel"\nGET /reset?token=url-sentinel&tab=security',
    ordinary: 'The password field and session checks are visible; score: 0', id: 'student-audit-result', count: 14 };
  const result = helper.sanitizeStudentAuditReport(original);
  const encoded = JSON.stringify(result.report);
  for (const secret of ['assignment-sentinel', 'header-sentinel', 'password-sentinel', 'url-sentinel']) assert(!encoded.includes(secret));
  assert.equal(result.report.title, original.title);
  assert.equal(result.report.ordinary, original.ordinary);
  assert.equal(result.report.id, original.id);
  assert.equal(result.report.count, 14);
  assert(result.report.text.includes('&tab=security'));
  const repeated = helper.sanitizeStudentAuditReport(result.report);
  assert.deepEqual(repeated.report, result.report);
  assert.equal(repeated.redactions, 0);
});

test('sanitizing an already safe report is idempotent', () => {
  assert.equal(typeof helper?.sanitizeStudentAuditReport, 'function');
  const first = helper.sanitizeStudentAuditReport({ errors: ['StudentAuditOnly2026!'], password: 'sentinel' });
  const second = helper.sanitizeStudentAuditReport(first.report);
  assert.deepEqual(second.report, first.report);
  assert.equal(second.redactions, 0);
});

test('file sanitizer updates only allowed report files and preserves counts', t => {
  assert.equal(typeof helper?.sanitizeStudentAuditReportFile, 'function');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'student-report-sanitize-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const file = path.join(directory, 'results-synthetic.json');
  fs.writeFileSync(file, JSON.stringify({ stats: { expected: 3 }, error: 'StudentAuditOnly2026!' }));
  const result = helper.sanitizeStudentAuditReportFile(file, { directory });
  assert.equal(result.redactions, 1);
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { stats: { expected: 3 }, error: '[redacted]' });
  const outside = path.join(directory, '..', 'results-outside.json');
  assert.throws(() => helper.sanitizeStudentAuditReportFile(outside, { directory }), /Allowed student report/);
  assert.throws(() => helper.sanitizeStudentAuditReportFile(path.join(directory, 'runtime.json'), { directory }), /Allowed student report/);
  assert.throws(() => helper.sanitizeStudentAuditReportFile(directory, { directory }), /Allowed student report/);
});

test('file sanitizer rejects a symlink without reading or changing its target', { skip: process.platform === 'win32' }, t => {
  assert.equal(typeof helper?.sanitizeStudentAuditReportFile, 'function');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'student-report-symlink-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const target = path.join(directory, 'target.json');
  const content = JSON.stringify({ password: 'unchanged-target-sentinel' });
  fs.writeFileSync(target, content);
  const link = path.join(directory, 'results-link.json');
  fs.symlinkSync(target, link);
  assert.throws(() => helper.sanitizeStudentAuditReportFile(link, { directory }), /Allowed student report/);
  assert.equal(fs.readFileSync(target, 'utf8'), content);
});
