import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, readdir, rm, writeFile, mkdir, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { exportArchive, verifyArchiveArtifact, type SnapshotExport } from '../../services/archive-export';

const roots: string[] = [];
async function root() { const value = await mkdtemp(path.join(tmpdir(), 'archive-export-test-')); roots.push(value); return value; }
afterEach(async () => { await Promise.all(roots.splice(0).map(value => rm(value, { recursive: true, force: true }))); });
const row = (entityType: string, entityId: string, data: object) => ({ entityType, entityId, dataJson: JSON.stringify(data) });
function snapshot(): SnapshotExport {
  return { id: 'snapshot-1', label: '2025-2026', initiatedBy: 'admin-1', createdAt: new Date('2026-07-14T21:05:00Z'), rows: [
    row('class', 'c1', { id: 'c1', name: '1/A' }), row('class', 'c2', { id: 'c2', name: '1/B' }),
    row('user', 'u1', { id: 'u1', name: '=evil()', classId: 'c1', role: 'student' }),
    row('user', 'u2', { id: 'u2', name: '<script>alert(1)</script>', classId: 'c2', role: 'student' }),
    row('category', 'cat1', { id: 'cat1', name: 'Matematik' }),
    row('teacherAssignment', 'ta1', { id: 'ta1', classId: 'c1', teacherId: 't1', categoryId: 'cat1' }),
    row('guardianLink', 'g1', { id: 'g1', guardianId: 'p1', studentId: 'u1' }),
    row('quiz', 'q1', { id: 'q1', title: 'Ortak sınav', categoryId: 'cat1', assignedClassIds: ['c1', 'c2'] }),
    row('quiz', 'q2', { id: 'q2', title: 'Atanmamış içerik', categoryId: null, assignedClassIds: [] }),
    row('question', 'a1', { id: 'a1', quizId: 'q1', text: '<b>Soru</b>', order: 0, correctAnswer: '4' }),
    row('result', 'r1', { id: 'r1', studentId: 'u1', quizId: 'q1', score: 85 }),
    row('result', 'r2', { id: 'r2', studentId: 'u2', quizId: 'q1', score: 95 }),
    row('surveySubmission', 's1', { id: 's1', studentId: 'u1', surveyId: 'q1' }),
    row('surveyAnswer', 'sa1', { id: 'sa1', submissionId: 's1', questionId: 'a1', value: '+formula()' }),
  ] };
}
const pdfGenerator = async (html: string) => Buffer.from('%PDF-1.4\n' + html + '\n%%EOF');
function unzipStored(zip: Buffer) {
  const files = new Map<string, Buffer>(); let offset = 0;
  while (zip.readUInt32LE(offset) === 0x04034b50) {
    expect(zip.readUInt16LE(offset + 8)).toBe(0);
    const size = zip.readUInt32LE(offset + 18), nameLength = zip.readUInt16LE(offset + 26), extraLength = zip.readUInt16LE(offset + 28);
    const name = zip.subarray(offset + 30, offset + 30 + nameLength).toString();
    const start = offset + 30 + nameLength + extraLength;
    const bytes = zip.subarray(start, start + size);
    let crc = -1;
    for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0); }
    expect(zip.readUInt32LE(offset + 14)).toBe((crc ^ -1) >>> 0);
    expect(zip.readUInt16LE(offset + 6)).toBe(0x800);
    files.set(name, bytes); offset = start + size;
  }
  expect(zip.readUInt32LE(offset)).toBe(0x02014b50);
  expect(zip.readUInt32LE(zip.length - 22)).toBe(0x06054b50);
  expect(zip.readUInt16LE(zip.length - 12)).toBe(files.size);
  return files;
}

describe('archive export', () => {
  it('renders capture shaped class course assignments without quizzes or teacher assignments', async () => {
    const input = snapshot();
    input.rows = input.rows.map(record => record.entityType === 'class' && record.entityId === 'c1' ? row('class', 'c1', { id: 'c1', name: '1/A', assignedCategories: [{ id: 'cat-empty' }] }) : record);
    input.rows.push(row('category', 'cat-empty', { id: 'cat-empty', name: 'Seçmeli ders' }));
    const output = await exportArchive(input, await root(), { pdfGenerator });
    const html = unzipStored(await readFile(output.artifactPath)).get('pdfs/report.pdf')!.toString();
    const a = html.slice(html.indexOf('<h2>1/A</h2>'), html.indexOf('<h2>1/B</h2>'));
    expect(a).toContain('<h3>Seçmeli ders</h3>');
    expect(html.match(/<h3>Seçmeli ders<\/h3>/g)).toHaveLength(1);
  });
  it('renders every result and survey under its frozen participant class exactly once', async () => {
    const input = snapshot();
    input.rows.push(row('class', 'c3', { id: 'c3', name: '1/C' }));
    const people = [
      ['u3', 'Different class result', 'c3'], ['u4', 'No class survey', null],
      ['u5', 'Unassigned quiz class A result', 'c1'], ['u6', 'Unassigned quiz class B survey', 'c2'],
      ['u7', 'Unassigned quiz no class result', null], ['u8', 'Unassigned quiz no class survey', null],
    ];
    for (const [id, name, classId] of people) input.rows.push(row('user', id!, { id, name, classId, role: 'student' }));
    input.rows.push(row('result', 'r3', { id: 'r3', studentId: 'u3', quizId: 'q1', score: 678901 }));
    input.rows.push(row('result', 'r5', { id: 'r5', studentId: 'u5', quizId: 'q2', score: 567890 }));
    input.rows.push(row('result', 'r7', { id: 'r7', studentId: 'u7', quizId: 'q2', score: 345678 }));
    for (const [id, studentId, surveyId, value] of [['s4', 'u4', 'q1', 'survey-null-class'], ['s6', 'u6', 'q2', 'survey-class-b'], ['s8', 'u8', 'q2', 'survey-unassigned-null']]) {
      input.rows.push(row('surveySubmission', id, { id, studentId, surveyId }));
      input.rows.push(row('surveyAnswer', id + '-answer', { id: id + '-answer', submissionId: id, questionId: 'a1', value }));
    }
    const output = await exportArchive(input, await root(), { pdfGenerator });
    const html = unzipStored(await readFile(output.artifactPath)).get('pdfs/report.pdf')!.toString();
    for (const [, name] of people) expect(html.split(name!).length - 1).toBe(1);
    for (const value of ['survey-null-class', 'survey-class-b', 'survey-unassigned-null']) expect(html.split(value).length - 1).toBe(1);
    const a = html.slice(html.indexOf('<h2>1/A</h2>'), html.indexOf('<h2>1/B</h2>'));
    const b = html.slice(html.indexOf('<h2>1/B</h2>'), html.indexOf('<h2>1/C</h2>'));
    const c = html.slice(html.indexOf('<h2>1/C</h2>'), html.indexOf('<h2>Atanmamış sınıf</h2>'));
    const unassigned = html.slice(html.indexOf('<h2>Atanmamış sınıf</h2>'));
    expect(a).toContain('Unassigned quiz class A result'); expect(b).toContain('Unassigned quiz class B survey');
    expect(c).toContain('Different class result'); expect(unassigned).toContain('No class survey');
    expect(unassigned).toContain('Unassigned quiz no class result'); expect(unassigned).toContain('Unassigned quiz no class survey');
  });
  it('rejects excessive total input bytes before parsing rows or generating files', async () => {
    const backupRoot = await root(); const oversized = 'x'.repeat(22 * 1024 * 1024);
    const input = snapshot();
    input.rows = ['one', 'two', 'three'].map(entityId => ({ entityId, entityType: 'user', dataJson: oversized }));
    await expect(exportArchive(input, backupRoot, { pdfGenerator })).rejects.toThrow(/input.*size|size.*input/i);
    expect(await readdir(backupRoot)).toEqual([]);
  });
  it('preserves frozen question bank and announcement business rows within four CSV groups', async () => {
    const input = snapshot();
    input.rows.push(row('questionBank', 'bank1', { id: 'bank1', teacherId: 't1', text: 'Bankadaki soru', correctAnswer: '42' }));
    input.rows.push(row('announcement', 'notice1', { id: 'notice1', title: 'Yıl sonu', content: 'Duyuru içeriği', createdBy: 't1', targetClassId: 'c1' }));
    const output = await exportArchive(input, await root(), { pdfGenerator });
    const files = unzipStored(await readFile(output.artifactPath));
    expect([...files.keys()].filter(name => name.endsWith('.csv'))).toHaveLength(4);
    expect(files.get('csv/quizzes-questions.csv')!.toString()).toContain('Bankadaki soru');
    expect(files.get('csv/people-classes.csv')!.toString()).toContain('Duyuru içeriği');
    const records = JSON.parse(files.get('records.json')!.toString()).rows;
    expect(records.find((record: any) => record.entityType === 'questionBank').data.correctAnswer).toBe('42');
    expect(records.find((record: any) => record.entityType === 'announcement').data.targetClassId).toBe('c1');
  });
  it('publishes actual ZIP entries with four safe CSV groups, frozen records and non-circular hashes', async () => {
    const backupRoot = await root(); const input = snapshot();
    const output = await exportArchive(input, backupRoot, { pdfGenerator });
    const zip = await readFile(output.artifactPath); const files = unzipStored(zip);
    expect(output.zipSha256).toBe(createHash('sha256').update(zip).digest('hex'));
    expect(output.sizeBytes).toBe(zip.length);
    expect([...files.keys()].filter(name => name.endsWith('.csv')).sort()).toEqual(['csv/courses-assignments.csv', 'csv/people-classes.csv', 'csv/quizzes-questions.csv', 'csv/results-surveys.csv']);
    expect(files.get('csv/people-classes.csv')!.subarray(0, 3)).toEqual(Buffer.from([239, 187, 191]));
    expect(files.get('csv/people-classes.csv')!.toString()).toContain("'=evil()");
    expect(files.get('csv/results-surveys.csv')!.toString()).toContain("'+formula()");
    const records = JSON.parse(files.get('records.json')!.toString());
    expect(records.rows).toHaveLength(input.rows.length);
    expect(records.rows.find((record: any) => record.entityType === 'question').data.correctAnswer).toBe('4');
    const checksums = JSON.parse(files.get('checksums.json')!.toString());
    expect(Object.keys(checksums)).not.toContain('archive.zip');
    expect(Object.keys(checksums)).not.toContain('meta.json');
    for (const [name, digest] of Object.entries(checksums)) expect(createHash('sha256').update(files.get(name)!).digest('hex')).toBe(digest);
    expect(JSON.parse(files.get('meta.json')!.toString()).snapshotId).toBe(input.id);
    expect(files.get('README.txt')!.toString()).toContain('geri yükleme');
  });
  it('renders separate class/course/quiz sections with escaped text and frozen participants', async () => {
    const output = await exportArchive(snapshot(), await root(), { pdfGenerator });
    const html = unzipStored(await readFile(output.artifactPath)).get('pdfs/report.pdf')!.toString();
    expect(html).toContain('<h2>1/A</h2>'); expect(html).toContain('<h2>1/B</h2>');
    expect(html.match(/<h4>Ortak sınav<\/h4>/g)).toHaveLength(2);
    expect(html).toContain('Atanmamış sınıf'); expect(html).toContain('Atanmamış ders');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;'); expect(html).not.toContain('<script>');
    const a = html.slice(html.indexOf('<h2>1/A</h2>'), html.indexOf('<h2>1/B</h2>'));
    expect(a).toContain('85'); expect(a).not.toContain('95');
  });
  it('validates idempotent packages and refuses modified payloads or conflicting snapshot data', async () => {
    const backupRoot = await root(); const input = snapshot();
    const output = await exportArchive(input, backupRoot, { pdfGenerator });
    expect(await exportArchive(input, backupRoot, { pdfGenerator: async () => { throw new Error('must reuse'); } })).toEqual(output);
    await expect(exportArchive({ ...input, rows: [] }, backupRoot, { pdfGenerator })).rejects.toThrow();
    await writeFile(path.join(path.dirname(output.artifactPath), 'pdfs/report.pdf'), '%PDF-tampered');
    await expect(verifyArchiveArtifact(input, backupRoot)).rejects.toThrow();
  });
  it('rejects a modified ZIP and payload symlink without following it', async () => {
    const backupRoot = await root(); const input = snapshot();
    const output = await exportArchive(input, backupRoot, { pdfGenerator });
    const zip = await readFile(output.artifactPath); zip[40] ^= 1;
    await writeFile(output.artifactPath, zip);
    await expect(verifyArchiveArtifact(input, backupRoot)).rejects.toThrow(/ZIP/);
    await rm(path.join(path.dirname(output.artifactPath), 'pdfs'), { recursive: true });
    const elsewhere = await root(); await symlink(elsewhere, path.join(path.dirname(output.artifactPath), 'pdfs'), 'junction');
    await expect(verifyArchiveArtifact(input, backupRoot)).rejects.toThrow(/symlink/);
  });
  it('rejects traversal and malformed years before generating any artifacts', async () => {
    const backupRoot = await root();
    for (const values of [{ id: '../escape' }, { id: 'CON' }, { label: '2025-2027' }, { label: '../2025-2026' }]) {
      await expect(exportArchive({ ...snapshot(), ...values }, backupRoot, { pdfGenerator })).rejects.toThrow();
    }
    expect(await readdir(backupRoot)).toEqual([]);
  });
  it('leaves no completed or temporary package when PDF generation fails or returns invalid bytes', async () => {
    const backupRoot = await root();
    await expect(exportArchive(snapshot(), backupRoot, { pdfGenerator: async () => { throw new Error('browser unavailable'); } })).rejects.toThrow('browser unavailable');
    expect(await readdir(path.join(backupRoot, snapshot().label))).toEqual([]);
    await expect(exportArchive(snapshot(), backupRoot, { pdfGenerator: async () => Buffer.from('not pdf') })).rejects.toThrow();
    expect(await readdir(path.join(backupRoot, snapshot().label))).toEqual([]);
  });
  it('bounds a stalled PDF generator and cleans up its staging directory', async () => {
    const backupRoot = await root();
    await expect(exportArchive(snapshot(), backupRoot, { pdfGenerator: () => new Promise(() => {}), pdfTimeoutMs: 20 })).rejects.toThrow(/timeout/i);
    expect(await readdir(path.join(backupRoot, snapshot().label))).toEqual([]);
  });
  it('rejects symlinked roots and arbitrary existing target directories', async () => {
    const backupRoot = await root(); const destination = await root(); const link = path.join(backupRoot, 'link');
    await symlink(destination, link, 'junction');
    await expect(exportArchive(snapshot(), link, { pdfGenerator })).rejects.toThrow();
    await mkdir(path.join(backupRoot, '2025-2026', 'snapshot-1'), { recursive: true });
    await writeFile(path.join(backupRoot, '2025-2026', 'snapshot-1', 'unrelated.txt'), 'keep');
    await expect(exportArchive(snapshot(), backupRoot, { pdfGenerator })).rejects.toThrow();
    expect(await readFile(path.join(backupRoot, '2025-2026', 'snapshot-1', 'unrelated.txt'), 'utf8')).toBe('keep');
  });
  it('produces a real Chromium PDF from local frozen HTML', async () => {
    const output = await exportArchive(snapshot(), await root());
    const pdf = unzipStored(await readFile(output.artifactPath)).get('pdfs/report.pdf')!;
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-'); expect(pdf.length).toBeGreaterThan(3000);
  }, 60000);
});
