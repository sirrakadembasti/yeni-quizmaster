import path from 'node:path';
import { lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { uploadsDirectory } from '../utils/upload-paths';
import { archiveReport, type FrozenRow } from './archive-report';
import { freezeArchiveImages } from './archive-images';
import { archivePdfParts } from './archive-pdf-parts';
import { MAX_PACKAGE_BYTES, MAX_SNAPSHOT_JSON_BYTES, packArchive, sha256 } from './archive-package';

export interface SnapshotExport {
  id: string; label: string; initiatedBy: string | null; createdAt: Date; capturedAt?: Date | null;
  rows: Array<{ entityType: string; entityId: string; dataJson: string }>;
}
export interface ArchiveExportOptions { pdfGenerator?: (html: string) => Promise<Buffer>; pdfTimeoutMs?: number; uploadsRoot?: string; imageByteLimit?:number; htmlByteLimit?:number }
export interface ArchiveMeta {
  formatVersion: number; snapshotId: string; academicYear: string; initiatedBy: string | null;
  createdAt: string; capturedAt?: string; inputBytes?: number; rowCount: number; inputSha256: string;
}
export interface ArchiveArtifact { artifactPath: string; zipSha256: string; sizeBytes: number; meta: ArchiveMeta }
export interface FrozenImage { entityType: string; entityId: string; originalUrl: string; path: string; mime: string }
export interface ArchiveManifest { formatVersion: 2; payloadBytes: number; files: Array<{ path: string; bytes: number; sha256: string }>; images: FrozenImage[] }
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
function compareCodePoints(left: string, right: string) {
  let a = 0, b = 0;
  while (a < left.length && b < right.length) {
    const leftPoint = left.codePointAt(a)!, rightPoint = right.codePointAt(b)!;
    if (leftPoint !== rightPoint) return leftPoint - rightPoint;
    a += leftPoint > 0xffff ? 2 : 1; b += rightPoint > 0xffff ? 2 : 1;
  }
  return a < left.length ? 1 : b < right.length ? -1 : 0;
}
function prepare(input: SnapshotExport, formatVersion = 2) {
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(input.id) || /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i.test(input.id)) throw new Error('Unsafe snapshot ID');
  const match = /^(\d{4})-(\d{4})$/.exec(input.label);
  if (!match || +match[1] < 1900 || +match[2] !== +match[1] + 1) throw new Error('Invalid academic year');
  if (!(input.createdAt instanceof Date) || !Number.isFinite(input.createdAt.getTime())) throw new Error('Invalid snapshot timestamp');
  const capturedAt = input.capturedAt ?? input.createdAt;
  if (!(capturedAt instanceof Date) || !Number.isFinite(capturedAt.getTime())) throw new Error('Invalid capture timestamp');
  // Check the complete raw input before parsing any row or allocating derived exports.
  let inputBytes = 0;
  for (const row of input.rows) {
    if (typeof row.dataJson !== 'string') throw new Error('Invalid snapshot JSON');
    inputBytes += Buffer.byteLength(row.dataJson, 'utf8');
    if (inputBytes > MAX_SNAPSHOT_JSON_BYTES) throw new Error('Archive input size limit exceeded');
  }
  const validTypes = Object.values(GROUPS).flat(), ids = new Set<string>();
  const sourceRows = input.rows.map(row => {
    if (!validTypes.includes(row.entityType) || typeof row.entityId !== 'string' || !row.entityId) throw new Error('Invalid snapshot row');
    const key = row.entityType + ':' + row.entityId;
    if (ids.has(key)) throw new Error('Duplicate snapshot row');
    ids.add(key);
    // Only the public frozen row fields participate; internal Prisma IDs do not.
    return { entityType: row.entityType, entityId: row.entityId, dataJson: row.dataJson };
  }).sort((a, b) => compareCodePoints(a.entityType, b.entityType) || compareCodePoints(a.entityId, b.entityId));
  const rows = sourceRows.map(row => {
    const data = JSON.parse(row.dataJson);
    if (!data || Array.isArray(data) || typeof data !== 'object') throw new Error('Invalid snapshot JSON');
    return { entityType: row.entityType, entityId: row.entityId, data };
  });
  const source = { id: input.id, label: input.label, initiatedBy: input.initiatedBy, createdAt: input.createdAt.toISOString(), ...(formatVersion === 2 ? { capturedAt: capturedAt.toISOString() } : {}), rows: sourceRows };
  const meta: ArchiveMeta = { formatVersion, snapshotId: input.id, academicYear: input.label, initiatedBy: input.initiatedBy, createdAt: input.createdAt.toISOString(), ...(formatVersion === 2 ? { capturedAt: capturedAt.toISOString(), inputBytes } : {}), rowCount: rows.length, inputSha256: sha256(json(source)) };
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
async function generatePdf(html: string, timeoutMs: number) {
  let browser: Awaited<ReturnType<typeof chromium.launch>>;
  try {
    browser = await chromium.launch({ headless: true, timeout: timeoutMs });
  } catch (error: any) {
    if (/Executable doesn't exist|playwright install/i.test(String(error?.message))) {
      throw new Error("PDF üretimi için Chromium kurulu değil. Sunucu hesabıyla şu komutu çalıştırın: pnpm --filter quiz-master-server run archive:prepare");
    }
    throw error;
  }
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
  const modern = meta.formatVersion === 2;
  const roots = ['csv', 'pdfs', 'records.json', 'README.txt', 'checksums.json', 'meta.json', 'archive.zip', ...(modern ? ['images', 'index.json', 'manifest.json'] : [])];
  if (names.sort().join('|') !== roots.sort().join('|')) throw new Error('Archive contains missing or unexpected files');
  let partNames:string[]=[];
  for (const subdirectory of ['csv', 'pdfs']) {
    await ensureSafeDirectory(path.join(directory, subdirectory));
    const actual = (await readdir(path.join(directory, subdirectory))).sort();
    let expected = FILE_NAMES.filter(name => name.startsWith(subdirectory + '/')).map(name => name.split('/')[1]).sort();
    if(modern&&subdirectory==='pdfs'){
      partNames=actual.filter(name=>name!=='report.pdf');
      if(!actual.includes('report.pdf')||partNames.some(name=>!/^report-[0-9]{4,5}\.pdf$/.test(name))||partNames.length>65500||partNames.some((_name,index)=>!actual.includes('report-'+String(index+1).padStart(4,'0')+'.pdf')))throw new Error('Archive contains missing or unexpected PDF files');
      expected=actual;
    }
    if (actual.join('|') !== expected.join('|')) throw new Error('Archive contains missing or unexpected payload files');
  }
  let payloadNames = [...PAYLOAD_NAMES], fileNames = [...FILE_NAMES];
  if (modern) {
    await ensureSafeDirectory(path.join(directory, 'images'));
    const images = (await readdir(path.join(directory, 'images'))).sort();
    if (images.some(name => !/^[a-f0-9]{64}\.(png|jpg|webp)$/.test(name))) throw new Error('Unsafe archive payload');
    payloadNames = [...payloadNames,...partNames.map(name=>'pdfs/'+name), 'index.json', ...images.map(name => 'images/' + name), 'manifest.json'];
    fileNames = [...payloadNames, 'checksums.json', 'meta.json'];
  }
  const files = new Map<string, Buffer>();
  let payloadBytes = 0;
  for (const name of fileNames) {
    const file = path.join(directory, name), stat = await lstat(file);
    payloadBytes += stat.size;
    if (!stat.isFile() || stat.isSymbolicLink() || payloadBytes > MAX_PACKAGE_BYTES) throw new Error('Unsafe archive payload');
    files.set(name, await readFile(file));
  }
  if (!files.get('meta.json')!.equals(json(meta))) throw new Error('Archive snapshot metadata conflict');
  const checksums = JSON.parse(files.get('checksums.json')!.toString('utf8'));
  if (!checksums || typeof checksums !== 'object' || Array.isArray(checksums) || Object.getPrototypeOf(checksums) !== Object.prototype) throw new Error('Invalid archive manifest');
  if (Object.keys(checksums).sort().join('|') !== [...payloadNames].sort().join('|')) throw new Error('Invalid archive manifest');
  if (Object.values(checksums).some(value => typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value))) throw new Error('Invalid archive manifest');
  for (const name of payloadNames) if (checksums[name] !== sha256(files.get(name)!)) throw new Error('Archive payload checksum mismatch');
  if (modern) {
    const index=JSON.parse(files.get('index.json')!.toString('utf8')),pdfNames=['pdfs/report.pdf',...partNames.map(name=>'pdfs/'+name)];
    if(index.pdf!=='pdfs/report.pdf'||!Array.isArray(index.documents)||index.documents.length!==pdfNames.length||index.documents[0]?.path!=='pdfs/report.pdf'||new Set(index.documents.map((document:any)=>document.path)).size!==pdfNames.length||index.documents.some((document:any)=>!pdfNames.includes(document.path))||!Array.isArray(index.classes))throw new Error('Invalid archive manifest PDF index');
    const referenced=new Set<string>();
    const validateReferences=(owner:any)=>{if(!Array.isArray(owner.documents)||!owner.documents.length||new Set(owner.documents).size!==owner.documents.length||owner.documents.some((name:any)=>typeof name!=='string'||!pdfNames.includes(name)||(partNames.length&&name==='pdfs/report.pdf')))throw new Error('Invalid archive manifest PDF references');for(const name of owner.documents)referenced.add(name);};
    for(const klass of index.classes){validateReferences(klass);if(!Array.isArray(klass.courses))throw new Error('Invalid archive manifest PDF index');for(const course of klass.courses){validateReferences(course);if(!Array.isArray(course.quizzes))throw new Error('Invalid archive manifest PDF index');for(const quiz of course.quizzes)validateReferences(quiz);}}
    if(partNames.some(name=>!referenced.has('pdfs/'+name)))throw new Error('Invalid archive manifest unreferenced PDF');
    const manifest: ArchiveManifest = JSON.parse(files.get('manifest.json')!.toString('utf8'));
    const entries = [...files].filter(([name]) => !['manifest.json', 'checksums.json'].includes(name)).map(([name, bytes]) => ({ path: name, bytes: bytes.length, sha256: sha256(bytes) })).sort((a,b) => compareCodePoints(a.path,b.path));
    if (manifest.formatVersion !== 2 || manifest.payloadBytes !== entries.reduce((sum,entry) => sum + entry.bytes,0) || JSON.stringify(manifest.files) !== JSON.stringify(entries) || !Array.isArray(manifest.images)) throw new Error('Invalid archive manifest');
    for (const image of manifest.images) {
      if (!['question','questionBank'].includes(image.entityType) || typeof image.entityId !== 'string' || typeof image.originalUrl !== 'string' || !/^images\/[a-f0-9]{64}\.(png|jpg|webp)$/.test(image.path) || !files.has(image.path)) throw new Error('Invalid archive manifest');
      const extension = image.path.split('.').pop();
      if (image.mime !== 'image/' + (extension === 'jpg' ? 'jpeg' : extension) || sha256(files.get(image.path)!) !== path.basename(image.path).split('.')[0]) throw new Error('Archive payload checksum mismatch');
    }
  }
  const zipPath = path.join(directory, 'archive.zip'), stat = await lstat(zipPath);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_PACKAGE_BYTES) throw new Error('Unsafe archive ZIP');
  const zip = await readFile(zipPath);
  const ordered = modern ? new Map([...files].sort(([a],[b])=>compareCodePoints(a,b))) : files;
  if (!zip.equals(packArchive(ordered))) throw new Error('Archive ZIP verification failed');
  return { artifactPath: zipPath, zipSha256: sha256(zip), sizeBytes: zip.length, meta };
}
async function verifyStoredDirectory(directory: string, input: SnapshotExport) {
  await ensureSafeDirectory(directory);
  const filename = path.join(directory,'meta.json'), stat = await lstat(filename);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 65536) throw new Error('Unsafe archive payload');
  const version = JSON.parse(await readFile(filename,'utf8')).formatVersion;
  if (version !== 1 && version !== 2) throw new Error('Invalid archive manifest');
  return verifyDirectory(directory, prepare(input,version).meta);
}
export async function verifyArchiveArtifact(input: SnapshotExport, backupRoot: string): Promise<ArchiveArtifact> {
  prepare(input);
  const root = await ensureSafeDirectory(backupRoot);
  return verifyStoredDirectory(path.join(root, input.label, input.id), input);
}
/** Called only by explicitly reserved failed-job recovery, never by automatic export or download. */
export async function prepareArchiveRecovery(input: SnapshotExport, backupRoot: string, details: { actorId: string; previousAttempts: number; assertOwned: () => Promise<void> }): Promise<string | null> {
  prepare(input); const absoluteRoot = path.resolve(backupRoot);
  if (!await exists(absoluteRoot)) return null;
  const root = await ensureSafeDirectory(absoluteRoot), yearPath = path.join(root, input.label);
  if (!await exists(yearPath)) return null;
  const year = await ensureSafeDirectory(yearPath), target = path.join(year, input.id);
  if (!await exists(target)) return null;
  await ensureSafeDirectory(target);
  // Reject links anywhere inside a partial package before moving it. Quarantine never follows links.
  let entries = 0;
  async function inspect(directory: string) {
    for (const name of await readdir(directory)) {
      if (++entries > 10000) throw new Error('Unsafe archive recovery entry limit');
      const file = path.join(directory, name), stat = await lstat(file);
      if (stat.isSymbolicLink() || (!stat.isFile() && !stat.isDirectory())) throw new Error('Unsafe archive recovery symlink or special file');
      if (stat.isDirectory()) await inspect(file);
    }
  }
  await inspect(target);
  try { await verifyStoredDirectory(target, input); return null; }
  catch (error: any) {
    // Permission/I/O failures and unsafe paths require storage repair; only integrity failures are quarantined.
    if (!(error instanceof SyntaxError) && error.code !== 'ENOENT' && !/^(Archive contains|Archive snapshot metadata conflict|Invalid archive manifest|Archive payload checksum mismatch|Archive ZIP verification failed|Unsafe archive payload|Unsafe archive ZIP)/.test(error.message ?? '')) throw error;
  }
  await details.assertOwned();
  const quarantineRoot = await ensureSafeDirectory(path.join(root, '.quarantine'), true);
  const quarantine = await mkdtemp(path.join(quarantineRoot, input.label + '-' + input.id + '-'));
  // The durable manifest survives even if a subsequent audit transaction fails or the process restarts.
  await writeFile(path.join(quarantine, 'reason.json'), json({ snapshotId: input.id, academicYear: input.label, reason: 'artifact_integrity_failed', actorId: details.actorId, previousAttempts: details.previousAttempts, quarantinedAt: new Date().toISOString() }), { flag: 'wx', mode: 0o600 });
  await ensureSafeDirectory(year); await ensureSafeDirectory(target); await ensureSafeDirectory(quarantine);
  await details.assertOwned();
  await rename(target, path.join(quarantine, 'package'));
  return path.relative(root, quarantine);
}
export async function exportArchive(input: SnapshotExport, backupRoot: string, options: ArchiveExportOptions = {}): Promise<ArchiveArtifact> {
  const { rows, meta } = prepare(input);
  const imageLimit=options.imageByteLimit??MAX_PACKAGE_BYTES,htmlLimit=options.htmlByteLimit??MAX_PACKAGE_BYTES;
  if([imageLimit,htmlLimit].some(limit=>!Number.isSafeInteger(limit)||limit<1||limit>MAX_PACKAGE_BYTES))throw new Error('Invalid archive resource size limit');
  const root = await ensureSafeDirectory(backupRoot, true), year = await ensureSafeDirectory(path.join(root, input.label), true);
  const target = path.join(year, input.id);
  if (await exists(target)) return verifyStoredDirectory(target, input);
  let temporary: string | undefined;
  try {
    if (await exists(target)) return await verifyStoredDirectory(target, input);
    temporary = await mkdtemp(path.join(year, '.' + input.id + '-'));
    const files = new Map<string, Buffer>();
    let payloadSize=0;
    const addFile=(name:string,bytes:Buffer)=>{payloadSize+=bytes.length;if(payloadSize>MAX_PACKAGE_BYTES)throw new Error('Archive size limit exceeded');files.set(name,bytes);};
    for (const [filename, types] of Object.entries(GROUPS)) addFile(filename, csv(rows.filter(row => types.includes(row.entityType))));
    addFile('records.json', json({ meta, rows }));addFile('meta.json',json(meta));
    const remaining=MAX_PACKAGE_BYTES-payloadSize;if(remaining<1)throw new Error('Archive size limit exceeded');
    const images = await freezeArchiveImages(rows, options.uploadsRoot ?? uploadsDirectory, ensureSafeDirectory,Math.min(imageLimit,remaining));
    const report = archiveReport(input.label, meta.capturedAt!, rows, images.inline,htmlLimit);
    for (const [name, bytes] of images.files) addFile(name, bytes);
    for(const document of archivePdfParts(report))addFile(document.path,await boundedPdf(document.html,options));
    addFile('index.json', json(report.index));
    addFile('README.txt', Buffer.from('Eğitim yılı arşivi\ncsv/ dört mantıksal CSV grubunu içerir. pdfs/report.pdf normal arşivde tam sınıf/şube → ders → içerik raporudur; büyük arşivde sıralı report-NNNN.pdf parçalarının dizinidir. index.json tüm dosyaları ve sınıf/ders/içerik eşlemesini içerir. PDF parçaları en fazla100 içerik bölümü ve2MiB HTML ile üretilir; her PDF için süre sınırı30s, bölünemeyen aşırı tek satır/görsel açık boyut hatası verir.\nrecords.json dondurulmuş tam iş kayıtlarını içerir. Yerel soru görselleri paket oluşturulurken images/ içine kopyalanır; uzak/harici görseller indirilmez.\nBu paket tam veritabanı/uygulama geri yükleme yedeği değildir.\nmanifest.json dosya byte uzunlukları ve SHA-256 özetlerini, checksums.json payload özetlerini içerir. Hiçbiri ZIP dosyasını kendi içinde özetlemez; ZIP özeti veritabanında ayrıca saklanır.\n', 'utf8'));
    const entries = [...files].map(([name, bytes]) => ({ path: name, bytes: bytes.length, sha256: sha256(bytes) })).sort((a,b)=>compareCodePoints(a.path,b.path));
    const manifest: ArchiveManifest = { formatVersion: 2, payloadBytes: entries.reduce((sum,entry)=>sum+entry.bytes,0), files: entries, images: images.images };
    addFile('manifest.json',json(manifest));
    addFile('checksums.json', json(Object.fromEntries([...files].filter(([name])=>name!=='meta.json').map(([name, bytes]) => [name, sha256(bytes)]))));
    await ensureSafeDirectory(temporary);
    await mkdir(path.join(temporary, 'csv')); await mkdir(path.join(temporary, 'pdfs')); await mkdir(path.join(temporary, 'images'));
    for (const [name, bytes] of files) await writeFile(path.join(temporary, name), bytes, { flag: 'wx', mode: 0o600 });
    await writeFile(path.join(temporary, 'archive.zip'), packArchive(new Map([...files].sort(([a],[b])=>compareCodePoints(a,b)))), { flag: 'wx', mode: 0o600 });
    const verified = await verifyDirectory(temporary, meta);
    await ensureSafeDirectory(year);
    if (await exists(target)) return await verifyStoredDirectory(target, input);
    try { await rename(temporary, target); }
    catch (error: any) {
      if (['EEXIST', 'ENOTEMPTY', 'EPERM'].includes(error.code) && await exists(target)) return await verifyStoredDirectory(target, input);
      throw error;
    }
    temporary = undefined;
    return { ...verified, artifactPath: path.join(target, 'archive.zip') };
  } finally {
    if (temporary) await rm(temporary, { recursive: true, force: true });
  }
}
