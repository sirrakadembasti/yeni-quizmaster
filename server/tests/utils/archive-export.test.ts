import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, readdir, rm, writeFile, mkdir, symlink, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { exportArchive, verifyArchiveArtifact, prepareArchiveRecovery, type SnapshotExport } from '../../services/archive-export';
import { packArchive,sha256 } from '../../services/archive-package';
import sharp from 'sharp';
import {archiveReport} from '../../services/archive-report';
import {verifiedImageManifest} from '../../services/archive-asset-manifest';

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
it('shows frozen quiz publication dates separately from capture time with creation fallback',()=>{
  const input=snapshot(),publishedAt='2025-11-03T09:15:00.000Z',createdAt='2025-09-07T12:30:00.000Z',capturedAt='2026-07-14T21:05:13.000Z';
  const rows=input.rows.map(record=>({entityType:record.entityType,entityId:record.entityId,data:JSON.parse(record.dataJson)}));
  Object.assign(rows.find(record=>record.entityType==='quiz'&&record.entityId==='q1')!.data,{publishedAt,createdAt});
  Object.assign(rows.find(record=>record.entityType==='quiz'&&record.entityId==='q2')!.data,{publishedAt:null,createdAt});
  const {html}=archiveReport(input.label,capturedAt,rows,new Map(),256*1024*1024);
  const quizSections=[...html.matchAll(/<article>([\s\S]*?)<\/article>/g)].map(match=>match[1]);
  expect(html).toContain(capturedAt);
  const published=quizSections.filter(section=>section.includes('<h4>Ortak sınav</h4>'));
  expect(published).toHaveLength(2);
  for(const section of published){expect(section).toContain('İçerik tarihi: '+publishedAt);expect(section).not.toContain(createdAt);expect(section).not.toContain(capturedAt);}
  const fallback=quizSections.find(section=>section.includes('<h4>Atanmamış içerik</h4>'))!;
  expect(fallback).toContain('İçerik tarihi: '+createdAt);expect(fallback).not.toContain(capturedAt);
});
async function legacyVersionOne(input:SnapshotExport,backupRoot:string){
  const encode=(data:unknown)=>Buffer.from(JSON.stringify(data,null,2)+'\n');
  const sourceRows=[...input.rows].sort((a,b)=>a.entityType<b.entityType?-1:a.entityType>b.entityType?1:a.entityId<b.entityId?-1:a.entityId>b.entityId?1:0);
  const source={id:input.id,label:input.label,initiatedBy:input.initiatedBy,createdAt:input.createdAt.toISOString(),rows:sourceRows};
  const meta={formatVersion:1,snapshotId:input.id,academicYear:input.label,initiatedBy:input.initiatedBy,createdAt:input.createdAt.toISOString(),rowCount:sourceRows.length,inputSha256:sha256(encode(source))};
  const files=new Map<string,Buffer>();
  for(const name of ['people-classes','courses-assignments','quizzes-questions','results-surveys'])files.set('csv/'+name+'.csv',Buffer.from('\ufeff"entityType","entityId"\r\n'));
  files.set('records.json',encode({meta,rows:sourceRows.map(row=>({entityType:row.entityType,entityId:row.entityId,data:JSON.parse(row.dataJson)}))}));
  files.set('pdfs/report.pdf',Buffer.from('%PDF-1.4\nLegacy version one\n%%EOF'));files.set('README.txt',Buffer.from('Legacy archive; not a complete database backup.\n'));
  files.set('checksums.json',encode(Object.fromEntries([...files].map(([name,bytes])=>[name,sha256(bytes)]))));files.set('meta.json',encode(meta));
  const directory=path.join(backupRoot,input.label,input.id);await mkdir(path.join(directory,'csv'),{recursive:true});await mkdir(path.join(directory,'pdfs'));
  for(const [name,bytes]of files)await writeFile(path.join(directory,name),bytes);
  const zip=packArchive(files);await writeFile(path.join(directory,'archive.zip'),zip);
  return {artifactPath:path.join(directory,'archive.zip'),zipSha256:sha256(zip),sizeBytes:zip.length,meta};
}
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
  it('authenticates a relocated package without changing the immutable snapshot locator',async()=>{
    const input=snapshot(),original=await root(),restored=await root();
    const artifact=await exportArchive(input,original,{pdfGenerator});
    await cp(path.join(original,input.label),path.join(restored,input.label),{recursive:true});
    const frozen={id:input.id,label:input.label,artifactPath:artifact.artifactPath,zipSha256:artifact.zipSha256};
    await expect(verifiedImageManifest(frozen,restored)).resolves.toMatchObject({formatVersion:2});
    await expect(verifyArchiveArtifact(input,restored)).resolves.toMatchObject({zipSha256:artifact.zipSha256,artifactPath:path.join(restored,input.label,input.id,'archive.zip')});
    await expect(verifiedImageManifest({...frozen,artifactPath:path.join(original,input.label,'different-job','archive.zip')},restored)).rejects.toThrow(/identity|path/i);
    await writeFile(path.join(restored,input.label,input.id,'archive.zip'),'tampered');
    await expect(verifiedImageManifest(frozen,restored)).rejects.toThrow(/checksum/i);
  });
  it('rejects missing PDFs and forged duplicate unlisted or unsafe PDF indexes even after checksums are rebuilt',async()=>{
    for(const condition of ['duplicate','unsafe','unlisted','omitted','missing-file']){
      const input={...snapshot(),id:'pdf-index-'+condition,rows:Array.from({length:101},(_,index)=>row('quiz','quiz-'+String(index).padStart(3,'0'),{id:'quiz-'+String(index).padStart(3,'0'),title:'Quiz '+index,assignedClassIds:[]}))};
      const backupRoot=await root(),output=await exportArchive(input,backupRoot,{pdfGenerator}),directory=path.dirname(output.artifactPath);
      if(condition==='missing-file'){await rm(path.join(directory,'pdfs/report-0002.pdf'));await expect(verifyArchiveArtifact(input,backupRoot)).rejects.toThrow(/missing|unexpected|manifest/i);continue;}
      const files=unzipStored(await readFile(output.artifactPath)),index=JSON.parse(files.get('index.json')!.toString());
      if(condition==='duplicate')index.documents[1]=index.documents[0];
      if(condition==='unsafe')index.documents[1].path='../private.pdf';
      if(condition==='unlisted')index.documents.push({path:'pdfs/report-0099.pdf',title:'Unlisted'});
      if(condition==='omitted')index.documents.pop();
      const encode=(data:unknown)=>Buffer.from(JSON.stringify(data,null,2)+'\n');files.set('index.json',encode(index));
      const manifest=JSON.parse(files.get('manifest.json')!.toString());
      manifest.files=[...files].filter(([name])=>!['checksums.json','manifest.json'].includes(name)).map(([name,bytes])=>({path:name,bytes:bytes.length,sha256:sha256(bytes)})).sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);manifest.payloadBytes=manifest.files.reduce((sum:number,entry:any)=>sum+entry.bytes,0);files.set('manifest.json',encode(manifest));
      files.set('checksums.json',encode(Object.fromEntries([...files].filter(([name])=>!['checksums.json','meta.json'].includes(name)).map(([name,bytes])=>[name,sha256(bytes)]))));
      for(const name of ['index.json','manifest.json','checksums.json'])await writeFile(path.join(directory,name),files.get(name)!);
      await writeFile(output.artifactPath,packArchive(new Map([...files].sort(([a],[b])=>a<b?-1:a>b?1:0))));
      await expect(verifyArchiveArtifact(input,backupRoot)).rejects.toThrow(/manifest.*PDF|PDF.*index|references/i);
    }
  });
  it('splits one oversized quiz table at row boundaries and keeps every result and answer',async()=>{
    const input={...snapshot(),rows:[row('user','participant',{id:'participant',name:'Frozen Participant',role:'student'}),row('quiz','huge-quiz',{id:'huge-quiz',title:'One oversized quiz',assignedClassIds:[]})]};
    for(let index=0;index<1500;index++)input.rows.push(row('result','result-'+String(index).padStart(4,'0'),{id:'result-'+String(index).padStart(4,'0'),studentId:'participant',quizId:'huge-quiz',score:index,answers:'Unique Oversized Answer '+index+' '+ 'X'.repeat(2000)}));
    const backupRoot=await root(),output=await exportArchive(input,backupRoot,{pdfGenerator}),files=unzipStored(await readFile(output.artifactPath));
    const index=JSON.parse(files.get('index.json')!.toString()),parts=index.documents.slice(1).map((document:any)=>document.path);
    expect(parts.length).toBeGreaterThanOrEqual(2);
    const text=parts.map((name:string)=>files.get(name)!.toString()).join('\n');
    const answers=[...text.matchAll(/Unique Oversized Answer (\d+) /g)].map(match=>Number(match[1])).sort((a,b)=>a-b);
    expect(answers).toEqual(Array.from({length:1500},(_,index)=>index));
    expect(index.classes.flatMap((klass:any)=>klass.courses.flatMap((course:any)=>course.quizzes))[0].documents).toEqual(parts);
    expect(await verifyArchiveArtifact(input,backupRoot)).toEqual(output);
  });
  it('partitions large reports with complete verified PDF and quiz document indexes',async()=>{
    const input={...snapshot(),rows:[row('user','participant',{id:'participant',name:'Frozen Participant',role:'student'})]};
    for(let index=0;index<205;index++){
      const id='quiz-'+String(index).padStart(3,'0');
      input.rows.push(row('quiz',id,{id,title:'Unique Quiz '+id,contentType:'exam',assignedClassIds:[]}),row('question','question-'+id,{id:'question-'+id,quizId:id,text:'Unique Question '+id,type:'short-answer'}),row('result','result-'+id,{id:'result-'+id,quizId:id,studentId:'participant',score:index,answers:'Unique Answer '+id}));
    }
    const output=await exportArchive(input,await root(),{pdfGenerator}),files=unzipStored(await readFile(output.artifactPath));
    const index=JSON.parse(files.get('index.json')!.toString());
    expect(index.documents).toHaveLength(4);expect(index.documents[0].path).toBe('pdfs/report.pdf');
    const partPaths=index.documents.slice(1).map((document:any)=>document.path);
    expect(partPaths).toEqual(['pdfs/report-0001.pdf','pdfs/report-0002.pdf','pdfs/report-0003.pdf']);
    const contents=partPaths.map((name:string)=>files.get(name)!.toString());
    expect(contents.every((html:string)=>(html.match(/<article>/g)??[]).length<=100)).toBe(true);
    const combined=contents.join('\n');
    for(let number=0;number<205;number++){const id='quiz-'+String(number).padStart(3,'0');for(const prefix of ['Unique Quiz ','Unique Question ','Unique Answer '])expect(combined.split(prefix+id).length-1).toBe(1);}
    const quizzes=index.classes.flatMap((klass:any)=>klass.courses.flatMap((course:any)=>course.quizzes));
    expect(quizzes).toHaveLength(205);expect(quizzes.every((quiz:any)=>quiz.documents.length===1&&partPaths.includes(quiz.documents[0]))).toBe(true);
    expect(JSON.parse(files.get('manifest.json')!.toString()).files.filter((entry:any)=>entry.path.endsWith('.pdf'))).toHaveLength(4);
    expect(await verifyArchiveArtifact(input,path.dirname(path.dirname(path.dirname(output.artifactPath))))).toEqual(output);
  });
  it('rejects aggregate frozen image bytes before base64 reporting or PDF generation',async()=>{
    const backupRoot=await root(),uploadsRoot=await root(),input=snapshot();
    const first=await sharp({create:{width:2,height:2,channels:3,background:'#ff0000'}}).png().toBuffer();
    const second=await sharp({create:{width:2,height:2,channels:3,background:'#0000ff'}}).png().toBuffer();
    await writeFile(path.join(uploadsRoot,'first.png'),first);await writeFile(path.join(uploadsRoot,'second.png'),second);
    input.rows.push(row('question','image-first',{id:'image-first',quizId:'q1',text:'First image',imageUrl:'/uploads/first.png'}),row('question','image-second',{id:'image-second',quizId:'q1',text:'Second image',imageUrl:'/uploads/second.png'}));
    const pdf=vi.fn(pdfGenerator);
    await expect(exportArchive(input,backupRoot,{uploadsRoot,pdfGenerator:pdf,imageByteLimit:first.length+second.length-1} as any)).rejects.toThrow(/image.*size|size.*image/i);
    expect(pdf).not.toHaveBeenCalled();expect(await readdir(path.join(backupRoot,input.label))).toEqual([]);
  });
  it('bounds repeated image report growth before handing amplified HTML to Chromium',async()=>{
    const backupRoot=await root(),uploadsRoot=await root(),input=snapshot();
    const bytes=await sharp({create:{width:2,height:2,channels:3,background:'#ff0000'}}).png().toBuffer();await writeFile(path.join(uploadsRoot,'repeated.png'),bytes);
    const classes=Array.from({length:40},(_,index)=>'report-class-'+index);
    input.rows.push(...classes.map(id=>row('class',id,{id,name:'Report '+id})),row('quiz','image-quiz',{id:'image-quiz',title:'Repeated image quiz',assignedClassIds:classes}),row('question','image-question',{id:'image-question',quizId:'image-quiz',text:'Repeated image',imageUrl:'/uploads/repeated.png'}));
    const pdf=vi.fn(pdfGenerator);
    await expect(exportArchive(input,backupRoot,{uploadsRoot,pdfGenerator:pdf,htmlByteLimit:8192} as any)).rejects.toThrow(/HTML.*size|size.*HTML/i);
    expect(pdf).not.toHaveBeenCalled();expect(await readdir(path.join(backupRoot,input.label))).toEqual([]);
  });
  it('verifies and reuses deterministic version-one ZIPs without quarantine or source timestamp reinterpretation',async()=>{
    const input={...snapshot(),capturedAt:new Date('2026-07-14T21:06:00Z')},backupRoot=await root();
    const legacy=await legacyVersionOne(input,backupRoot);
    expect(await verifyArchiveArtifact(input,backupRoot)).toEqual(legacy);
    expect(await exportArchive(input,backupRoot,{pdfGenerator:async()=>{throw new Error('Legacy package must be reused');}})).toEqual(legacy);
    const assertOwned=vi.fn(async()=>{});
    expect(await prepareArchiveRecovery(input,backupRoot,{actorId:'synthetic-admin',previousAttempts:5,assertOwned})).toBeNull();expect(assertOwned).not.toHaveBeenCalled();
    await expect(verifyArchiveArtifact({...input,rows:input.rows.map((row,index)=>index?row:{...row,dataJson:row.dataJson+' '})},backupRoot)).rejects.toThrow(/metadata conflict/);
    const zip=await readFile(legacy.artifactPath);zip[40]^=1;await writeFile(legacy.artifactPath,zip);
    await expect(verifyArchiveArtifact(input,backupRoot)).rejects.toThrow(/ZIP/);
  });
  it('records the distinct capture time and an explicit payload byte/hash manifest without ZIP self hashing', async () => {
    const source={...snapshot(),capturedAt:new Date('2026-07-14T21:06:00Z')};
    const output=await exportArchive(source,await root(),{pdfGenerator});
    const files=unzipStored(await readFile(output.artifactPath));
    expect(JSON.parse(files.get('meta.json')!.toString())).toMatchObject({createdAt:source.createdAt.toISOString(),capturedAt:source.capturedAt.toISOString()});
    expect(files.has('manifest.json')).toBe(true);
    const manifest=JSON.parse(files.get('manifest.json')!.toString());
    expect(manifest.files.length).toBeGreaterThanOrEqual(7);
    expect(manifest.files.some((entry:any)=>['archive.zip','manifest.json','checksums.json'].includes(entry.path))).toBe(false);
    for(const entry of manifest.files){expect(entry.bytes).toBe(files.get(entry.path)!.length);expect(entry.sha256).toBe(createHash('sha256').update(files.get(entry.path)!).digest('hex'));}
  });
  it('publishes an explicit frozen class course content index including unassigned participant sections',async()=>{
    const output=await exportArchive(snapshot(),await root(),{pdfGenerator});
    const files=unzipStored(await readFile(output.artifactPath));
    expect(files.has('index.json')).toBe(true);
    const index=JSON.parse(files.get('index.json')!.toString());
    expect(index.pdf).toBe('pdfs/report.pdf');
    expect(index.classes.find((item:any)=>item.id==='c1')).toMatchObject({name:'1/A',courses:expect.arrayContaining([expect.objectContaining({id:'cat1',name:'Matematik',quizzes:expect.arrayContaining([expect.objectContaining({id:'q1',title:'Ortak sınav'})])})])});
    expect(index.classes.find((item:any)=>item.id==='c2').courses.some((course:any)=>course.quizzes.some((quiz:any)=>quiz.id==='q1'))).toBe(true);
    expect(index.classes.find((item:any)=>item.id===null).courses.some((course:any)=>course.quizzes.some((quiz:any)=>quiz.id==='q2'))).toBe(true);
  });
  it('freezes a permitted local raster image in its package and verifies it after the upload changes',async()=>{
    const uploadsRoot=await root();const filename='00000000-0000-4000-8000-000000000099.png';
    const image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jF7sAAAAASUVORK5CYII=','base64');
    await writeFile(path.join(uploadsRoot,filename),image);
    const source=snapshot();source.rows.push(row('question','image-question',{id:'image-question',quizId:'q1',text:'Frozen raster question',imageUrl:'/uploads/'+filename}));
    const output=await exportArchive(source,await root(),{pdfGenerator,uploadsRoot} as any);
    const files=unzipStored(await readFile(output.artifactPath));
    const images=[...files.keys()].filter(name=>name.startsWith('images/'));
    expect(images).toHaveLength(1);expect(files.get(images[0])).toEqual(image);
    const html=files.get('pdfs/report.pdf')!.toString();expect(html).toContain('data:image/png;base64,');expect(html).not.toContain('src="/uploads/');
    await writeFile(path.join(uploadsRoot,filename),'changed upload');
    expect(await verifyArchiveArtifact(source,path.dirname(path.dirname(path.dirname(output.artifactPath))))).toEqual(output);
  });
  it('fails before publication for a missing local image instead of silently omitting its question evidence',async()=>{
    const source=snapshot();source.rows.push(row('question','missing-image',{id:'missing-image',quizId:'q1',imageUrl:'/uploads/00000000-0000-4000-8000-000000000098.png'}));
    const backupRoot=await root();
    await expect(exportArchive(source,backupRoot,{pdfGenerator,uploadsRoot:await root()} as any)).rejects.toThrow(/image|görsel/i);
  });
  it('rejects local image traversal and symlinks without reading arbitrary server files',async()=>{
    const uploadsRoot=await root();const elsewhere=await root();const destination=path.join(elsewhere,'private.txt');await writeFile(destination,'synthetic private canary');
    const linked=path.join(uploadsRoot,'linked.png');await symlink(destination,linked,'file');
    for(const imageUrl of ['/uploads/../private.txt','/uploads/linked.png']){
      const source=snapshot();source.rows.push(row('question','unsafe-image',{id:'unsafe-image',quizId:'q1',imageUrl}));
      await expect(exportArchive(source,await root(),{pdfGenerator,uploadsRoot} as any)).rejects.toThrow(/image|görsel|symlink|unsafe/i);
    }
  });
  it('does not fetch remote image URLs and declares their historical rendering boundary',async()=>{
    const fetch=vi.spyOn(globalThis,'fetch').mockRejectedValue(new Error('network forbidden'));
    try{
      const source=snapshot();source.rows.push(row('question','remote-image',{id:'remote-image',quizId:'q1',imageUrl:'https://example.invalid/question.png'}));
      const output=await exportArchive(source,await root(),{pdfGenerator});const files=unzipStored(await readFile(output.artifactPath));
      expect(fetch).not.toHaveBeenCalled();expect(files.get('README.txt')!.toString()).toMatch(/uzak|harici/i);
      expect(files.get('pdfs/report.pdf')!.toString()).not.toContain('src="https://');
    }finally{fetch.mockRestore();}
  });
  it('verifies worker produced snapshots from reordered API input and minimal frozen row fields', async () => {
    const source = snapshot(); const backupRoot = await root();
    const workerInput = {
      id: source.id, label: source.label, createdAt: source.createdAt, initiatedBy: source.initiatedBy,
      rows: source.rows.map((record, index) => ({ id: 'internal-' + index, snapshotId: source.id, ...record })),
    };
    const output = await exportArchive(workerInput, backupRoot, { pdfGenerator });
    const apiInput = {
      initiatedBy: source.initiatedBy, rows: [...source.rows].reverse().map(record => ({ dataJson: record.dataJson, entityId: record.entityId, entityType: record.entityType })),
      createdAt: source.createdAt, label: source.label, id: source.id,
    };
    expect(await verifyArchiveArtifact(apiInput, backupRoot)).toEqual(output);
    expect(await exportArchive(apiInput, backupRoot, { pdfGenerator: async () => { throw new Error('must reuse the verified worker package'); } })).toEqual(output);
    const secondRoot = await root();
    const secondOutput = await exportArchive(apiInput, secondRoot, { pdfGenerator });
    expect(secondOutput.zipSha256).toBe(output.zipSha256);
    const changed = { ...apiInput, rows: apiInput.rows.map(record => record.entityId === 'u1' && record.entityType === 'user' ? { ...record, dataJson: record.dataJson + ' ' } : record) };
    await expect(verifyArchiveArtifact(changed, backupRoot)).rejects.toThrow(/metadata conflict/);
  });
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
