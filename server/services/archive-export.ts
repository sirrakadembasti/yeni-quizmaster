import path from 'node:path';
import { lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { MAX_PACKAGE_BYTES, MAX_SNAPSHOT_JSON_BYTES, packArchive, sha256 } from './archive-package';

export interface SnapshotExport {
  id: string; label: string; initiatedBy: string | null; createdAt: Date;
  rows: Array<{ entityType: string; entityId: string; dataJson: string }>;
}
export interface ArchiveExportOptions { pdfGenerator?: (html: string) => Promise<Buffer>; pdfTimeoutMs?: number }
export interface ArchiveMeta {
  formatVersion: number; snapshotId: string; academicYear: string; initiatedBy: string | null;
  createdAt: string; rowCount: number; inputSha256: string;
}
export interface ArchiveArtifact { artifactPath: string; zipSha256: string; sizeBytes: number; meta: ArchiveMeta }
type FrozenRow = { entityType: string; entityId: string; data: Record<string, any> };
const GROUPS: Record<string, string[]> = {
  'csv/people-classes.csv': ['user', 'class', 'guardianLink', 'announcement'],
  'csv/courses-assignments.csv': ['category', 'teacherAssignment'],
  'csv/quizzes-questions.csv': ['quiz', 'question', 'questionBank'],
  'csv/results-surveys.csv': ['result', 'surveySubmission', 'surveyAnswer'],
};
const PAYLOAD_NAMES = [...Object.keys(GROUPS), 'records.json', 'pdfs/report.pdf', 'README.txt'];
const FILE_NAMES = [...PAYLOAD_NAMES, 'checksums.json', 'meta.json'];
const json = (data: unknown) => Buffer.from(JSON.stringify(data, null, 2) + '\n', 'utf8');
const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
const display = (value: unknown) => typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value ?? '');
function csvCell(value: unknown) {
  let text = display(value);
  if (/^[\s\u0000-\u001f]*[=+@-]/u.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
function csv(rows: FrozenRow[]) {
  const columns = [...new Set(rows.flatMap(row => Object.keys(row.data)))].sort();
  const lines = [['entityType', 'entityId', ...columns].map(csvCell).join(',')];
  for (const row of rows) lines.push([row.entityType, row.entityId, ...columns.map(column => row.data[column])].map(csvCell).join(','));
  return Buffer.from('\ufeff' + lines.join('\r\n') + '\r\n', 'utf8');
}
function prepare(input: SnapshotExport) {
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(input.id) || /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i.test(input.id)) throw new Error('Unsafe snapshot ID');
  const match = /^(\d{4})-(\d{4})$/.exec(input.label);
  if (!match || +match[1] < 1900 || +match[2] !== +match[1] + 1) throw new Error('Invalid academic year');
  if (!(input.createdAt instanceof Date) || !Number.isFinite(input.createdAt.getTime())) throw new Error('Invalid snapshot timestamp');
  // Check the complete raw input before parsing any row or allocating derived exports.
  let inputBytes = 0;
  for (const row of input.rows) {
    if (typeof row.dataJson !== 'string') throw new Error('Invalid snapshot JSON');
    inputBytes += Buffer.byteLength(row.dataJson, 'utf8');
    if (inputBytes > MAX_SNAPSHOT_JSON_BYTES) throw new Error('Archive input size limit exceeded');
  }
  const validTypes = Object.values(GROUPS).flat(), ids = new Set<string>();
  const rows = input.rows.map(row => {
    if (!validTypes.includes(row.entityType) || typeof row.entityId !== 'string' || !row.entityId) throw new Error('Invalid snapshot row');
    const key = row.entityType + ':' + row.entityId;
    if (ids.has(key)) throw new Error('Duplicate snapshot row');
    ids.add(key);
    const data = JSON.parse(row.dataJson);
    if (!data || Array.isArray(data) || typeof data !== 'object') throw new Error('Invalid snapshot JSON');
    return { entityType: row.entityType, entityId: row.entityId, data };
  });
  const meta: ArchiveMeta = { formatVersion: 1, snapshotId: input.id, academicYear: input.label, initiatedBy: input.initiatedBy, createdAt: input.createdAt.toISOString(), rowCount: rows.length, inputSha256: sha256(json({ ...input, createdAt: input.createdAt.toISOString() })) };
  return { rows, meta };
}
async function ensureSafeDirectory(directory: string, create = false) {
  const absolute = path.resolve(directory), parsed = path.parse(absolute);
  let current = parsed.root;
  for (const component of absolute.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, component);
    if (create) { try { await mkdir(current); } catch (error: any) { if (error.code !== 'EEXIST') throw error; } }
    const stat = await lstat(current);
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error('Archive path contains symlink or non-directory');
  }
  return absolute;
}
async function exists(directory: string) {
  try { await lstat(directory); return true; } catch (error: any) { if (error.code === 'ENOENT') return false; throw error; }
}
function htmlReport(input: SnapshotExport, rows: FrozenRow[]) {
  const of = (type: string) => rows.filter(row => row.entityType === type);
  const users = new Map(of('user').map(row => [row.entityId, row.data]));
  const classes = of('class'), categories = of('category'), quizzes = of('quiz');
  const assignments = of('teacherAssignment'), results = of('result'), submissions = of('surveySubmission');
  const questions = of('question'), answers = of('surveyAnswer');
  const relationIds = (values: unknown): string[] => Array.isArray(values) ? values.map(value => typeof value === 'string' ? value : value?.id).filter((id): id is string => typeof id === 'string' && Boolean(id)) : [];
  const classIds = (quiz: FrozenRow) => [...new Set([
    ...relationIds(quiz.data.assignedClassIds), ...relationIds(quiz.data.classIds), ...relationIds(quiz.data.assignedClasses),
  ])];
  const classCourseIds = (klass: FrozenRow) => [...new Set([
    ...relationIds(klass.data.assignedCategoryIds), ...relationIds(klass.data.assignedCategories),
  ])];
  const knownClassIds = new Set(classes.map(klass => klass.entityId));
  const participantClassId = (studentId: string): string => {
    const classId = users.get(studentId)?.classId;
    return knownClassIds.has(classId) ? classId : '';
  };
  const quizSections = new Map(quizzes.map(quiz => {
    const assigned = classIds(quiz), sections = new Set(assigned.map(id => knownClassIds.has(id) ? id : ''));
    if (!assigned.length) sections.add('');
    for (const result of results) if (result.data.quizId === quiz.entityId) sections.add(participantClassId(result.data.studentId));
    for (const submission of submissions) if (submission.data.surveyId === quiz.entityId) sections.add(participantClassId(submission.data.studentId));
    return [quiz.entityId, sections] as const;
  }));
  let html = '<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'"><style>body{font-family:Arial,sans-serif;font-size:11px}h2{border-bottom:1px solid #777;break-before:page}h3{color:#333}table{border-collapse:collapse;width:100%;margin:8px 0}td,th{border:1px solid #bbb;padding:5px;text-align:left}tr{break-inside:avoid}pre{white-space:pre-wrap;overflow-wrap:anywhere}</style></head><body>';
  html += `<h1>Eğitim yılı arşivi ${escapeHtml(input.label)}</h1><p>${escapeHtml(input.createdAt.toISOString())}</p>`;
  const table = (data: unknown[][]) => '<table>' + data.map(row => '<tr>' + row.map(cell => '<td>' + escapeHtml(display(cell)) + '</td>').join('') + '</tr>').join('') + '</table>';
  for (const klass of [...classes, { entityType: 'class', entityId: '', data: { name: 'Atanmamış sınıf' } }]) {
    html += `<section><h2>${escapeHtml(klass.data.name)}</h2>`;
    const matching = quizzes.filter(quiz => quizSections.get(quiz.entityId)!.has(klass.entityId));
    const categoryIds = new Set([
      ...classCourseIds(klass),
      ...assignments.filter(row => row.data.classId === klass.entityId).map(row => row.data.categoryId),
      ...matching.map(row => row.data.categoryId ?? ''),
    ]);
    // Courses without any assignment still appear under the unassigned class.
    if (!klass.entityId) for (const category of categories) if (!classes.some(c => classCourseIds(c).includes(category.entityId)) && !assignments.some(a => a.data.categoryId === category.entityId) && !quizzes.some(q => q.data.categoryId === category.entityId && classIds(q).length)) categoryIds.add(category.entityId);
    for (const category of [...categories, { entityType: 'category', entityId: '', data: { name: 'Atanmamış ders' } }].filter(category => categoryIds.has(category.entityId))) {
      html += `<h3>${escapeHtml(category.data.name)}</h3>`;
      const teachers = assignments.filter(row => row.data.classId === klass.entityId && row.data.categoryId === category.entityId);
      if (teachers.length) html += table(teachers.map(row => ['Öğretmen', users.get(row.data.teacherId)?.name ?? row.data.teacherId]));
      for (const quiz of matching.filter(row => (row.data.categoryId ?? '') === category.entityId)) {
        html += `<article><h4>${escapeHtml(quiz.data.title)}</h4><p>${escapeHtml(quiz.data.description)}</p>`;
        html += table(questions.filter(row => row.data.quizId === quiz.entityId).sort((a, b) => (a.data.order ?? 0) - (b.data.order ?? 0)).map(row => [row.data.text, row.data.type, row.data.options, row.data.correctAnswer]));
        const participantInClass = (studentId: string) => participantClassId(studentId) === klass.entityId;
        html += table(results.filter(row => row.data.quizId === quiz.entityId && participantInClass(row.data.studentId)).map(row => [users.get(row.data.studentId)?.name ?? row.data.studentId, row.data.score, row.data.status, row.data.answers]));
        for (const submission of submissions.filter(row => row.data.surveyId === quiz.entityId && participantInClass(row.data.studentId))) {
          html += `<p>${escapeHtml(users.get(submission.data.studentId)?.name ?? submission.data.studentId)}</p>`;
          html += table(answers.filter(row => row.data.submissionId === submission.entityId).map(row => [questions.find(q => q.entityId === row.data.questionId)?.data.text ?? row.data.questionId, row.data.value]));
        }
        html += '</article>';
      }
    }
    html += '</section>';
  }
  return html + '</body></html>';
}
async function generatePdf(html: string, timeoutMs: number) {
  const browser = await chromium.launch({ headless: true, timeout: timeoutMs });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      (async () => {
        const page = await browser.newPage({ javaScriptEnabled: false });
        await page.route('**/*', route => route.abort());
        await page.setContent(html, { waitUntil: 'load', timeout: timeoutMs });
        return page.pdf({ format: 'A4', printBackground: true, margin: { top: '15mm', bottom: '15mm', left: '12mm', right: '12mm' } });
      })(),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('PDF generation timeout')), timeoutMs); }),
    ]);
  } finally { if (timer) clearTimeout(timer); await browser.close(); }
}
async function boundedPdf(html: string, options: ArchiveExportOptions) {
  const timeout = options.pdfTimeoutMs ?? 30000;
  if (!Number.isFinite(timeout) || timeout < 1 || timeout > 120000) throw new Error('Invalid PDF timeout');
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const bytes = options.pdfGenerator ? await Promise.race([
      options.pdfGenerator(html),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('PDF generation timeout')), timeout); }),
    ]) : await generatePdf(html, timeout);
    if (!Buffer.isBuffer(bytes) || bytes.subarray(0, 5).toString() !== '%PDF-' || !bytes.subarray(-1024).includes(Buffer.from('%%EOF'))) throw new Error('Invalid PDF output');
    return bytes;
  } finally { if (timer) clearTimeout(timer); }
}
async function verifyDirectory(directory: string, meta: ArchiveMeta): Promise<ArchiveArtifact> {
  await ensureSafeDirectory(directory);
  const names = await readdir(directory);
  if (names.sort().join('|') !== ['csv', 'pdfs', 'records.json', 'README.txt', 'checksums.json', 'meta.json', 'archive.zip'].sort().join('|')) throw new Error('Archive contains missing or unexpected files');
  for (const subdirectory of ['csv', 'pdfs']) {
    await ensureSafeDirectory(path.join(directory, subdirectory));
    const actual = (await readdir(path.join(directory, subdirectory))).sort();
    const expected = FILE_NAMES.filter(name => name.startsWith(subdirectory + '/')).map(name => name.split('/')[1]).sort();
    if (actual.join('|') !== expected.join('|')) throw new Error('Archive contains missing or unexpected payload files');
  }
  const files = new Map<string, Buffer>();
  let payloadBytes = 0;
  for (const name of FILE_NAMES) {
    const file = path.join(directory, name), stat = await lstat(file);
    payloadBytes += stat.size;
    if (!stat.isFile() || stat.isSymbolicLink() || payloadBytes > MAX_PACKAGE_BYTES) throw new Error('Unsafe archive payload');
    files.set(name, await readFile(file));
  }
  if (!files.get('meta.json')!.equals(json(meta))) throw new Error('Archive snapshot metadata conflict');
  const checksums = JSON.parse(files.get('checksums.json')!.toString('utf8'));
  if (Object.keys(checksums).sort().join('|') !== [...PAYLOAD_NAMES].sort().join('|')) throw new Error('Invalid archive manifest');
  for (const name of PAYLOAD_NAMES) if (checksums[name] !== sha256(files.get(name)!)) throw new Error('Archive payload checksum mismatch');
  const zipPath = path.join(directory, 'archive.zip'), stat = await lstat(zipPath);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_PACKAGE_BYTES) throw new Error('Unsafe archive ZIP');
  const zip = await readFile(zipPath);
  if (!zip.equals(packArchive(files))) throw new Error('Archive ZIP verification failed');
  return { artifactPath: zipPath, zipSha256: sha256(zip), sizeBytes: zip.length, meta };
}
export async function verifyArchiveArtifact(input: SnapshotExport, backupRoot: string): Promise<ArchiveArtifact> {
  const { meta } = prepare(input), root = await ensureSafeDirectory(backupRoot);
  return verifyDirectory(path.join(root, input.label, input.id), meta);
}
export async function exportArchive(input: SnapshotExport, backupRoot: string, options: ArchiveExportOptions = {}): Promise<ArchiveArtifact> {
  const { rows, meta } = prepare(input);
  const root = await ensureSafeDirectory(backupRoot, true), year = await ensureSafeDirectory(path.join(root, input.label), true);
  const target = path.join(year, input.id);
  if (await exists(target)) return verifyDirectory(target, meta);
  let temporary: string | undefined;
  try {
    if (await exists(target)) return await verifyDirectory(target, meta);
    temporary = await mkdtemp(path.join(year, '.' + input.id + '-'));
    const files = new Map<string, Buffer>();
    for (const [filename, types] of Object.entries(GROUPS)) files.set(filename, csv(rows.filter(row => types.includes(row.entityType))));
    files.set('records.json', json({ meta, rows }));
    files.set('pdfs/report.pdf', await boundedPdf(htmlReport(input, rows), options));
    files.set('README.txt', Buffer.from('Eğitim yılı arşivi\ncsv/ dört mantıksal CSV grubunu içerir. pdfs/report.pdf sınıf/şube → ders → içerik bölümleri ve dondurulmuş katılımcı sonuçlarını içerir.\nrecords.json dondurulmuş tam iş kayıtlarını içerir.\nBu paket tam veritabanı/uygulama geri yükleme yedeği değildir.\nchecksums.json yalnız payload dosyalarının SHA-256 özetlerini içerir. ZIP özeti veritabanında ayrıca saklanır.\n', 'utf8'));
    files.set('checksums.json', json(Object.fromEntries([...files].map(([name, bytes]) => [name, sha256(bytes)]))));
    files.set('meta.json', json(meta));
    await ensureSafeDirectory(temporary);
    await mkdir(path.join(temporary, 'csv')); await mkdir(path.join(temporary, 'pdfs'));
    for (const [name, bytes] of files) await writeFile(path.join(temporary, name), bytes, { flag: 'wx', mode: 0o600 });
    await writeFile(path.join(temporary, 'archive.zip'), packArchive(files), { flag: 'wx', mode: 0o600 });
    const verified = await verifyDirectory(temporary, meta);
    await ensureSafeDirectory(year);
    if (await exists(target)) return await verifyDirectory(target, meta);
    try { await rename(temporary, target); }
    catch (error: any) {
      if (['EEXIST', 'ENOTEMPTY', 'EPERM'].includes(error.code) && await exists(target)) return await verifyDirectory(target, meta);
      throw error;
    }
    temporary = undefined;
    return { ...verified, artifactPath: path.join(target, 'archive.zip') };
  } finally {
    if (temporary) await rm(temporary, { recursive: true, force: true });
  }
}
