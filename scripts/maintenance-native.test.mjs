import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import net from 'node:net';
import test from 'node:test';
const require=createRequire(new URL('../server/package.json',import.meta.url));
const sqlite3=require(createRequire(require.resolve('connect-sqlite3')).resolve('sqlite3'));
const dotenv=require('dotenv');
let maintenance={};
try{maintenance=await import('./maintenance-lib.mjs');}catch(error){if(error.code!=='ERR_MODULE_NOT_FOUND'||!error.message.includes('maintenance-lib.mjs'))throw error;}
const query=(db,sql)=>new Promise((resolve,reject)=>db.all(sql,(error,rows)=>error?reject(error):resolve(rows)));
const execute=(db,sql)=>new Promise((resolve,reject)=>db.exec(sql,error=>error?reject(error):resolve()));
const close=db=>new Promise((resolve,reject)=>db.close(error=>error?reject(error):resolve()));

test('backs up WAL data and private files, restores independently, and rejects corrupted backups',async t=>{
  assert.equal(typeof maintenance.createApplicationBackup,'function','A complete native SQLite backup entry point is required');
  assert.equal(typeof maintenance.restoreApplicationBackup,'function');
  const owned=fs.mkdtempSync(path.join(os.tmpdir(),'quizmaster-maintenance-native-'));
  t.after(()=>{
    const target=fs.realpathSync(owned);
    if(path.dirname(target)!==fs.realpathSync(os.tmpdir())||!path.basename(target).startsWith('quizmaster-maintenance-native-'))throw new Error('Unsafe fixture cleanup');
    fs.rmSync(target,{recursive:true,force:true});
  });
  const source=path.join(owned,'source'),target=path.join(owned,'restored');
  const data=path.join(source,'server/data'),archives=path.join(owned,'custom-archives');
  fs.mkdirSync(data,{recursive:true});fs.mkdirSync(path.join(source,'server/uploads'),{recursive:true});
  fs.mkdirSync(path.join(archives,'2025-2026','snapshot'),{recursive:true});
  const env=`DATABASE_URL=file:../data/quiz.db\nexport DATABASE_URL="file:${path.join(data,'quiz.db').replaceAll('\\','/')}"\nPORT=64231\nSESSION_SECRET=synthetic-maintenance-secret\nSMTP_PASSWORD=synthetic-test-only\nARCHIVE_BACKUP_ROOT=${archives.replaceAll('\\','/')}\nexport ARCHIVE_BACKUP_ROOT="${archives.replaceAll('\\','/')}"\n`;
  fs.writeFileSync(path.join(source,'server/.env'),env);
  fs.writeFileSync(path.join(source,'server/uploads/question.png'),'synthetic image');
  fs.writeFileSync(path.join(data,'installation.lock'),'installed');
  fs.writeFileSync(path.join(data,'deployment-config.json'),'{}');
  fs.writeFileSync(path.join(archives,'2025-2026/snapshot/archive.zip'),'frozen synthetic ZIP');
  const db=new sqlite3.Database(path.join(data,'quiz.db'));
  const sessions=new sqlite3.Database(path.join(data,'sessions.db'));
  try{
    await execute(db,"PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0; CREATE TABLE Person(id TEXT PRIMARY KEY); CREATE TABLE Result(id TEXT PRIMARY KEY,personId TEXT REFERENCES Person(id),score INTEGER); INSERT INTO Person VALUES('student'); INSERT INTO Result VALUES('result','student',87);");
    await execute(sessions,"CREATE TABLE sessions(sid TEXT PRIMARY KEY,sess TEXT); INSERT INTO sessions VALUES('synthetic-session','{}');");
    const before=await query(db,'SELECT * FROM Result');
    const backup=await maintenance.createApplicationBackup(source,{name:'native-roundtrip'});
    assert.deepEqual(await query(db,'SELECT * FROM Result'),before);
    assert.equal(fs.readFileSync(path.join(source,'server/.env'),'utf8'),env);
    const manifest=JSON.parse(fs.readFileSync(path.join(backup.backupRoot,'manifest.json'),'utf8'));
    assert.equal(manifest.formatVersion,1);
    assert.ok(manifest.files.some(file=>file.backup.endsWith('archive.zip')));
    assert.ok(!manifest.files.some(file=>/-wal$|-shm$/.test(file.backup)),'Native SQLite snapshots must not depend on copied WAL sidecars');
    const blocker=net.createServer();
    await new Promise((resolve,reject)=>{blocker.once('error',reject);blocker.listen(64231,'127.0.0.1',resolve);});
    try{
      await assert.rejects(maintenance.restoreApplicationBackup(backup.backupRoot,path.join(owned,'running-target')),/Stop the application/);
    }finally{await new Promise(resolve=>blocker.close(resolve));}
    const alias=path.join(owned,'backup-alias');
    fs.symlinkSync(backup.backupRoot,alias,'junction');
    try{
      await assert.rejects(maintenance.restoreApplicationBackup(backup.backupRoot,path.join(alias,'nested-restore')),/independent|symlink|ancestor/i);
      assert.equal(fs.existsSync(path.join(backup.backupRoot,'nested-restore')),false);
    }finally{fs.unlinkSync(alias);}
    await maintenance.restoreApplicationBackup(backup.backupRoot,target);
    const restored=new sqlite3.Database(path.join(target,'server/data/quiz.db'));
    try{
      assert.deepEqual(await query(restored,'SELECT * FROM Result'),before);
      assert.deepEqual(await query(restored,'PRAGMA integrity_check'),[{integrity_check:'ok'}]);
      assert.deepEqual(await query(restored,'PRAGMA foreign_key_check'),[]);
    }finally{await close(restored);}
    const restoredSessions=new sqlite3.Database(path.join(target,'server/data/sessions.db'));
    try{assert.deepEqual(await query(restoredSessions,'SELECT * FROM sessions'),[{sid:'synthetic-session',sess:'{}'}]);}
    finally{await close(restoredSessions);}
    assert.equal(fs.readFileSync(path.join(target,'server/uploads/question.png'),'utf8'),'synthetic image');
    assert.equal(fs.readFileSync(path.join(target,'server/data/backups/2025-2026/snapshot/archive.zip'),'utf8'),'frozen synthetic ZIP');
    assert.match(fs.readFileSync(path.join(target,'server/.env'),'utf8'),/SMTP_PASSWORD=synthetic-test-only/);
    assert.match(fs.readFileSync(path.join(target,'server/.env'),'utf8'),/ARCHIVE_BACKUP_ROOT=server\/data\/backups/);
    const effective=dotenv.parse(fs.readFileSync(path.join(target,'server/.env')));
    assert.equal(effective.DATABASE_URL,'file:../data/quiz.db','Restored effective config must never refer to the source DB');
    assert.equal(effective.ARCHIVE_BACKUP_ROOT,'server/data/backups');
    await assert.rejects(maintenance.restoreApplicationBackup(backup.backupRoot,target),/existing|empty|mevcut/i);
    const extra=path.join(backup.backupRoot,'unlisted.txt');fs.writeFileSync(extra,'not covered by manifest');
    await assert.rejects(maintenance.restoreApplicationBackup(backup.backupRoot,path.join(owned,'extra-rejected')),/manifest|unlisted/i);
    fs.unlinkSync(extra);
    const manifestPath=path.join(backup.backupRoot,'manifest.json');
    const originalManifest=fs.readFileSync(manifestPath,'utf8');
    fs.writeFileSync(manifestPath,JSON.stringify({...manifest,files:[...manifest.files,{backup:'../outside.db',bytes:0,sha256:'0'.repeat(64)}]}));
    await assert.rejects(maintenance.restoreApplicationBackup(backup.backupRoot,path.join(owned,'traversal-rejected')),/Unsafe backup/);
    fs.writeFileSync(manifestPath,originalManifest);
    const uploaded=manifest.files.find(file=>file.backup.endsWith('question.png'));
    const uploadedPath=path.join(backup.backupRoot,uploaded.backup),uploadedBytes=fs.readFileSync(uploadedPath);
    fs.unlinkSync(uploadedPath);
    await assert.rejects(maintenance.restoreApplicationBackup(backup.backupRoot,path.join(owned,'missing-rejected')),/hash integrity/);
    fs.writeFileSync(uploadedPath,uploadedBytes);
    const archiveFile=manifest.files.find(file=>file.backup.endsWith('archive.zip'));
    fs.appendFileSync(path.join(backup.backupRoot,archiveFile.backup),'corruption');
    const rejected=path.join(owned,'rejected');
    await assert.rejects(maintenance.restoreApplicationBackup(backup.backupRoot,rejected),/hash|integrity|bütünlük|özet/i);
    assert.equal(fs.existsSync(path.join(rejected,'server/data/quiz.db')),false);
  }finally{await close(db);await close(sessions);}
});

for(const variant of ['ipv6','exported-port'])test(`rejects backup while the effective ${variant} application address is listening`,async t=>{
  const owned=fs.mkdtempSync(path.join(os.tmpdir(),'quizmaster-maintenance-native-'));
  t.after(()=>{
    const canonical=fs.realpathSync(owned);
    if(path.dirname(canonical)!==fs.realpathSync(os.tmpdir())||!path.basename(canonical).startsWith('quizmaster-maintenance-native-'))throw new Error('Unsafe fixture cleanup');
    fs.rmSync(canonical,{recursive:true,force:true});
  });
  const data=path.join(owned,'server/data');fs.mkdirSync(data,{recursive:true});
  const db=new sqlite3.Database(path.join(data,'quiz.db'));
  const listener=net.createServer(),spare=net.createServer();
  const host=variant==='ipv6'?'::1':'127.0.0.1';
  try{
    await execute(db,'CREATE TABLE Marker(id INTEGER PRIMARY KEY); INSERT INTO Marker VALUES(1)');
    await new Promise((resolve,reject)=>{listener.once('error',reject);listener.listen(0,host,resolve);});
    await new Promise((resolve,reject)=>{spare.once('error',reject);spare.listen(0,'127.0.0.1',resolve);});
    const freePort=spare.address().port;await new Promise(resolve=>spare.close(resolve));
    const portLines=variant==='ipv6'?`PORT=${listener.address().port}`:`PORT=${freePort}\nexport PORT=${listener.address().port}`;
    fs.writeFileSync(path.join(owned,'server/.env'),`DATABASE_URL=file:../data/quiz.db\nHOST=${host}\n${portLines}\n`);
    await assert.rejects(maintenance.createApplicationBackup(owned,{name:'running-rejected'}),/Stop the application/);
    assert.deepEqual(await query(db,'SELECT * FROM Marker'),[{id:1}]);
    assert.equal(fs.existsSync(path.join(owned,'server/backups/running-rejected')),false);
  }finally{
    if(listener.listening)await new Promise(resolve=>listener.close(resolve));
    if(spare.listening)await new Promise(resolve=>spare.close(resolve));
    await close(db);
  }
});
