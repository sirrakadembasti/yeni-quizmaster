import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import net from 'node:net';
import test from 'node:test';

// Disk kaybı senaryosu: yedek proje dışına (harici disk/ağ paylaşımı gibi) kopyalanır, kaynak proje
// tamamen silinir ve yedek yalnız o kopyadan boş bir hedefe geri yüklenir. Yalnız geçici dizinler kullanılır.
const require=createRequire(new URL('../server/package.json',import.meta.url));
const sqlite3=require(createRequire(require.resolve('connect-sqlite3')).resolve('sqlite3'));
const maintenance=await import('./maintenance-lib.mjs');
const query=(db,sql)=>new Promise((resolve,reject)=>db.all(sql,(error,rows)=>error?reject(error):resolve(rows)));
const execute=(db,sql)=>new Promise((resolve,reject)=>db.exec(sql,error=>error?reject(error):resolve()));
const close=db=>new Promise((resolve,reject)=>db.close(error=>error?reject(error):resolve()));

async function freePort(){
  const probe=net.createServer();
  await new Promise((resolve,reject)=>{probe.once('error',reject);probe.listen(0,'127.0.0.1',resolve);});
  const port=probe.address().port;
  await new Promise(resolve=>probe.close(resolve));
  return port;
}

async function makeBackup(t){
  const owned=fs.mkdtempSync(path.join(os.tmpdir(),'quizmaster-offsite-restore-'));
  t.after(()=>{
    const target=fs.realpathSync(owned);
    if(path.dirname(target)!==fs.realpathSync(os.tmpdir())||!path.basename(target).startsWith('quizmaster-offsite-restore-'))throw new Error('Unsafe fixture cleanup');
    fs.rmSync(target,{recursive:true,force:true});
  });
  const source=path.join(owned,'source'),data=path.join(source,'server/data');
  fs.mkdirSync(data,{recursive:true});fs.mkdirSync(path.join(source,'server/uploads'),{recursive:true});
  fs.writeFileSync(path.join(source,'server/.env'),`DATABASE_URL=file:../data/quiz.db\nPORT=${await freePort()}\nSESSION_SECRET=synthetic-offsite-secret\n`);
  fs.writeFileSync(path.join(source,'server/uploads/question.png'),'synthetic image');
  fs.writeFileSync(path.join(data,'installation.lock'),'installed');
  const db=new sqlite3.Database(path.join(data,'quiz.db'));
  await execute(db,"PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0; CREATE TABLE Person(id TEXT PRIMARY KEY); CREATE TABLE Result(id TEXT PRIMARY KEY,personId TEXT REFERENCES Person(id),score INTEGER); INSERT INTO Person VALUES('student'); INSERT INTO Result VALUES('r1','student',90),('r2','student',70);");
  const before=await query(db,'SELECT * FROM Result ORDER BY id');
  const backup=await maintenance.createApplicationBackup(source,{name:'offsite'});
  await close(db);
  // "Harici disk": proje ağacının dışında, ayrı bir dizine ham kopya (dosya yöneticisi/rsync gibi).
  const external=path.join(owned,'external-drive','quizmaster-yedek');
  fs.mkdirSync(path.dirname(external),{recursive:true});
  fs.cpSync(backup.backupRoot,external,{recursive:true});
  return {owned,source,external,before};
}

test('proje dışına kopyalanan yedek, kaynak proje silindikten sonra boş hedefe geri yüklenir',async t=>{
  const {owned,source,external,before}=await makeBackup(t);
  fs.rmSync(source,{recursive:true,force:true}); // disk kaybı: kaynak proje ve içindeki yedek yok
  assert.equal(fs.existsSync(source),false);
  const target=path.join(owned,'new-server');
  await maintenance.restoreApplicationBackup(external,target);
  const restored=new sqlite3.Database(path.join(target,'server/data/quiz.db'));
  try{
    assert.deepEqual(await query(restored,'SELECT * FROM Result ORDER BY id'),before);
    assert.deepEqual(await query(restored,'PRAGMA integrity_check'),[{integrity_check:'ok'}]);
    assert.deepEqual(await query(restored,'PRAGMA foreign_key_check'),[]);
  }finally{await close(restored);}
  assert.equal(fs.readFileSync(path.join(target,'server/uploads/question.png'),'utf8'),'synthetic image');
  assert.match(fs.readFileSync(path.join(target,'server/.env'),'utf8'),/SESSION_SECRET=synthetic-offsite-secret/);
  assert.equal(fs.readFileSync(path.join(target,'server/data/installation.lock'),'utf8'),'installed');
});

test('kopyalama sırasında bozulan dosya geri yüklemeyi reddettirir ve hedefe yazılmaz',async t=>{
  const {owned,external}=await makeBackup(t);
  const manifest=JSON.parse(fs.readFileSync(path.join(external,'manifest.json'),'utf8'));
  const db=manifest.files.find(file=>file.backup==='server/data/quiz.db');
  const file=path.join(external,db.backup);
  const bytes=fs.readFileSync(file);bytes[bytes.length-1]^=0xff; // tek bayt bozulur, boyut aynı kalır
  fs.writeFileSync(file,bytes);
  const target=path.join(owned,'rejected-corrupt');
  await assert.rejects(maintenance.restoreApplicationBackup(external,target),/hash integrity/);
  assert.equal(fs.existsSync(path.join(target,'server/data/quiz.db')),false);
});

test('yarım kalan kopya (kesilmiş dosya) reddedilir',async t=>{
  const {owned,external}=await makeBackup(t);
  const file=path.join(external,'server/uploads/question.png');
  fs.truncateSync(file,3);
  await assert.rejects(maintenance.restoreApplicationBackup(external,path.join(owned,'rejected-truncated')),/hash integrity/);
});

test('manifest.json kopyalanmadıysa geri yükleme başlamaz',async t=>{
  const {owned,external}=await makeBackup(t);
  fs.rmSync(path.join(external,'manifest.json'));
  const target=path.join(owned,'rejected-no-manifest');
  await assert.rejects(maintenance.restoreApplicationBackup(external,target));
  assert.equal(fs.existsSync(path.join(target,'server/data/quiz.db')),false);
});

test('geri yükleme hedefi yedek kopyasının içinde olamaz',async t=>{
  const {external}=await makeBackup(t);
  await assert.rejects(maintenance.restoreApplicationBackup(external,path.join(external,'nested-restore')),/independent|ancestor/i);
  assert.equal(fs.existsSync(path.join(external,'nested-restore')),false);
});
