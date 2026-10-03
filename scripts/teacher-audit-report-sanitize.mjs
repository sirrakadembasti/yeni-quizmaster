import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const defaultDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../docs/teacher-audit');
const mask = '[redacted]';
const fixtureSecrets = [
  'TeacherAuditOnly2026!', 'TemporaryAuditPassword2026!', 'UnusedAuditPassword2026!',
  'WrongAuditPassword!', 'IncorrectAuditPassword!', 'MismatchAuditPassword2026!',
  'isolated-teacher-audit-only-secret',
];
const secretKey = /^(?:password|currentPassword|newPassword|confirmPassword|apiKey|customApiKey|csrfToken|sessionSecret|sessionId|sid|cookie|set-cookie|authorization|proxy-authorization|x-csrf-token|x-setup-csrf|SESSION_SECRET|EMAIL_PASS|GEMINI_API_KEY|OPENAI_API_KEY)$/i;

export function sanitizeTeacherAuditReport(value) {
  let redactions = 0;
  const replacement = raw => {
    if (raw === mask) return raw;
    redactions++;
    return mask;
  };
  const scalar = original => {
    let text = original;
    for (const secret of fixtureSecrets) text = text.replaceAll(secret, () => replacement(secret));
    text = text.replace(/\bs(?::|%3a|%253a)[A-Za-z0-9_%+/-]{16,}\.[A-Za-z0-9_%+/=-]{8,}/gi, replacement);
    text = text.replace(/([?&](?:token|csrfToken|apiKey)=)([^&\s"']+)/gi,
      (_, prefix, raw) => prefix + replacement(raw));
    text = text.replace(/\b(cookie|set-cookie|authorization|proxy-authorization|x-csrf-token|x-setup-csrf)\b([\\"']*\s*[:=]\s*)([^\r\n]*)/gi,
      (_, name, separator, raw) => name + separator + replacement(raw));
    text = text.replace(/\b((?:password|currentPassword|newPassword|confirmPassword|apiKey|customApiKey|csrfToken|sessionSecret|sessionId|SESSION_SECRET|EMAIL_PASS|GEMINI_API_KEY|OPENAI_API_KEY|SETUP_TOKEN)[\\"']*\s*[:=]\s*)(?:"([^"\r\n]*)"|'([^'\r\n]*)'|(\[redacted\]|[^\s,;}\]]+))/gi,
      (_, prefix, doubleQuoted, singleQuoted, bare) => {
        const raw = doubleQuoted ?? singleQuoted ?? bare;
        const quote = doubleQuoted !== undefined ? '"' : singleQuoted !== undefined ? "'" : '';
        return prefix + quote + replacement(raw) + quote;
      });
    return text;
  };
  const walk = item => {
    if (typeof item === 'string') return scalar(item);
    if (Array.isArray(item)) return item.map(walk);
    if (item && typeof item === 'object') return Object.fromEntries(Object.entries(item).map(([key, child]) =>
      [key, secretKey.test(key) ? replacement(child) : walk(child)]));
    return item;
  };
  return { report: walk(value), redactions };
}

const samePath = (left, right) => process.platform === 'win32'
  ? left.toLowerCase() === right.toLowerCase() : left === right;
function allowedFile(file, directory) {
  const target = path.resolve(file), base = path.resolve(directory);
  if (!samePath(path.dirname(target), base) || !/^results[^/\\]*\.json$/.test(path.basename(target)))
    throw new Error('Allowed teacher report file required');
  try {
    const directoryStat = fs.lstatSync(base), stat = fs.lstatSync(target);
    if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink() || !stat.isFile() || stat.isSymbolicLink()
      || !samePath(fs.realpathSync(base), base) || !samePath(fs.realpathSync(target), target))
      throw new Error('Rejected path');
    return { target, stat };
  } catch { throw new Error('Allowed teacher report regular file required'); }
}

export function sanitizeTeacherAuditReportFile(file, { directory = defaultDirectory } = {}) {
  const { target, stat } = allowedFile(file, directory);
  let descriptor;
  let value;
  try {
    descriptor = fs.openSync(target, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
    const opened = fs.fstatSync(descriptor);
    if (!opened.isFile() || opened.dev !== stat.dev || opened.ino !== stat.ino)
      throw new Error('Report identity changed');
    value = JSON.parse(fs.readFileSync(descriptor, 'utf8'));
  } catch { throw new Error('Teacher report could not be safely read as JSON'); }
  finally { if (descriptor !== undefined) fs.closeSync(descriptor); }
  const result = sanitizeTeacherAuditReport(value);
  // Preserve the original report on a write failure, and never follow a newly
  // substituted report symlink while replacing it.
  const current = allowedFile(target, directory);
  if (current.stat.dev !== stat.dev || current.stat.ino !== stat.ino)
    throw new Error('Teacher report identity changed before write');
  const temporary = path.join(path.dirname(target), `.teacher-report-${crypto.randomBytes(8).toString('hex')}.tmp`);
  try {
    fs.writeFileSync(temporary, JSON.stringify(result.report, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    allowedFile(target, directory);
    fs.renameSync(temporary, target);
  } catch { throw new Error('Teacher report could not be safely written'); }
  finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  return { file: path.basename(target), redactions: result.redactions };
}

if (process.argv[1] && samePath(path.resolve(process.argv[1]), fileURLToPath(import.meta.url))) {
  try {
    const files = process.argv.slice(2);
    const targets = files.length ? files : fs.readdirSync(defaultDirectory)
      .filter(name => /^results[^/\\]*\.json$/.test(name)).map(name => path.join(defaultDirectory, name));
    // Validate every target before modifying any of this batch.
    for (const file of targets) allowedFile(file, defaultDirectory);
    const results = targets.map(file => sanitizeTeacherAuditReportFile(file));
    console.log(JSON.stringify({ files: results.length, redactions: results.reduce((sum, item) => sum + item.redactions, 0) }));
  } catch {
    console.error(JSON.stringify({ failed: true }));
    process.exitCode = 1;
  }
}
