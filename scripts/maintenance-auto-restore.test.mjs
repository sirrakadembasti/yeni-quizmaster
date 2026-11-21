import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import test from 'node:test';

// S-09 devamı: günlük otomatik yedekten (quiz-YYYYMMDD.db + uploads yansısı) boş bir hedefe geri yükleme.
const require=createRequire(new URL('../server/package.json',import.meta.url));
const SQLite=require('better-sqlite3');
const maintenance=await import('./maintenance-lib.mjs');
const script=fileURLToPath(new URL('./maintenance.mjs',import.meta.url));

function owned(t){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'quizmaster-auto-restore-'));
  t.after(()=>{
    const real=fs.realpathSync(root);
    if(path.dirname(real)!==fs.realpathSync(os.tmpdir())||!path.basename(real).startsWith('quizmaster-auto-restore-'))throw new Error('Unsafe fixture cleanup');
    fs.rmSync(real,{recursive:true,force:true});
  });
  return root;
}
function makeDb(file,rows){
  const db=new SQLite(file);
  db.exec('CREATE TABLE Person(id TEXT PRIMARY KEY); CREATE TABLE Result(id TEXT PRIMARY KEY,personId TEXT REFERENCES Person(id),score INTEGER); INSERT INTO Person VALUES(\'student\');');
  for(const [id,score] of rows)db.prepare('INSERT INTO Result VALUES(?,?,?)').run(id,'student',score);
  db.close();
}
function makeAutoDir(root){
  const auto=path.join(root,'auto');
  fs.mkdirSync(path.join(auto,'uploads','nested'),{recursive:true});
  makeDb(path.join(auto,'quiz-20261120.db'),[['r1',70]]);
  makeDb(path.join(auto,'quiz-20261121.db'),[['r1',70],['r2',90]]);
  fs.writeFileSync(path.join(auto,'uploads','a.png'),'AAAA');
  fs.writeFileSync(path.join(auto,'uploads','nested','b.png'),'BB');
  return auto;
}
const rows=file=>{const db=new SQLite(file,{readonly:true});try{return db.prepare('SELECT id,score FROM Result ORDER BY id').all();}finally{db.close();}};

test('en yeni otomatik yedek ve uploads yansısı boş hedefe geri yüklenir',async t=>{
  const root=owned(t),auto=makeAutoDir(root),target=path.join(root,'restored');
  const result=await maintenance.restoreAutoBackup(auto,target);
  assert.equal(result.database,'quiz-20261121.db');
  assert.deepEqual(rows(path.join(target,'server/data/quiz.db')),[{id:'r1',score:70},{id:'r2',score:90}]);
  const db=new SQLite(path.join(target,'server/data/quiz.db'),{readonly:true});
  try{assert.equal(db.pragma('integrity_check',{simple:true}),'ok');}finally{db.close();}
  assert.equal(fs.readFileSync(path.join(target,'server/uploads/nested/b.png'),'utf8'),'BB');
  assert.equal(fs.readFileSync(path.join(target,'server/uploads/a.png'),'utf8'),'AAAA');
});

test('belirli bir gün seçilebilir ve proje dışına kopyalanmış yedek dizininden de geri yüklenir',async t=>{
  const root=owned(t),auto=makeAutoDir(root);
  const external=path.join(root,'external-drive','auto-kopya');
  fs.mkdirSync(path.dirname(external),{recursive:true});
  fs.cpSync(auto,external,{recursive:true});
  fs.rmSync(auto,{recursive:true,force:true}); // disk kaybı
  const target=path.join(root,'restored-old');
  const result=await maintenance.restoreAutoBackup(external,target,{date:'20261120'});
  assert.equal(result.database,'quiz-20261120.db');
  assert.deepEqual(rows(path.join(target,'server/data/quiz.db')),[{id:'r1',score:70}]);
});

test('bozuk yedek, dolu hedef, yedeğin içi ve geçersiz tarih reddedilir; hedef bozulmaz',async t=>{
  const root=owned(t),auto=makeAutoDir(root);
  fs.writeFileSync(path.join(auto,'quiz-20261122.db'),'bu bir sqlite dosyasi degil');
  const corrupt=path.join(root,'rejected-corrupt');
  await assert.rejects(maintenance.restoreAutoBackup(auto,corrupt,{date:'20261122'}));
  assert.equal(fs.existsSync(path.join(corrupt,'server/data/quiz.db')),false);

  const full=path.join(root,'full');fs.mkdirSync(path.join(full,'server/data'),{recursive:true});fs.writeFileSync(path.join(full,'server/data/quiz.db'),'operator-owned');
  await assert.rejects(maintenance.restoreAutoBackup(auto,full,{date:'20261121'}),/empty|existing/i);
  assert.equal(fs.readFileSync(path.join(full,'server/data/quiz.db'),'utf8'),'operator-owned');

  await assert.rejects(maintenance.restoreAutoBackup(auto,path.join(auto,'nested-restore'),{date:'20261121'}),/independent/i);
  await assert.rejects(maintenance.restoreAutoBackup(auto,path.join(root,'bad-date'),{date:'../x'}),/date|tarih/i);
  await assert.rejects(maintenance.restoreAutoBackup(auto,path.join(root,'missing-date'),{date:'20250101'}),/not found|bulunamad/i);
  const empty=path.join(root,'empty-auto');fs.mkdirSync(empty);
  await assert.rejects(maintenance.restoreAutoBackup(empty,path.join(root,'no-backups')),/No automatic backups/i);
});

test('yedekte sembolik bağlantı varsa geri yükleme reddedilir ve hedef bozulmaz',async t=>{
  const root=owned(t),auto=makeAutoDir(root);
  const secret=path.join(root,'secret.txt');fs.writeFileSync(secret,'gizli');
  try{fs.symlinkSync(secret,path.join(auto,'uploads','link.txt'));}catch{t.skip('sembolik bağlantı oluşturulamadı');return;}
  const target=path.join(root,'restored-links');
  await assert.rejects(maintenance.restoreAutoBackup(auto,target),/Symlink/);
  assert.equal(fs.existsSync(path.join(target,'server/data')),false);
  assert.equal(fs.existsSync(path.join(target,'server/uploads')),false);
});

test('CLI: restore-auto komutu yardım metninde ve gerekli bağımsız değişkenlerle çalışır',async t=>{
  const help=spawnSync(process.execPath,[script,'--help'],{encoding:'utf8',windowsHide:true});
  assert.match(help.stdout,/restore-auto --auto-backup/);
  const missing=spawnSync(process.execPath,[script,'restore-auto','--project',path.join(os.tmpdir(),'quizmaster-never-created')],{encoding:'utf8',windowsHide:true});
  assert.equal(missing.status,2);
  assert.match(missing.stderr,/--auto-backup/);
  const root=owned(t),auto=makeAutoDir(root),target=path.join(root,'cli-restored');
  const ok=spawnSync(process.execPath,[script,'restore-auto','--auto-backup',auto,'--project',target,'--date','20261121'],{encoding:'utf8',windowsHide:true});
  assert.equal(ok.status,0,ok.stderr);
  assert.deepEqual(rows(path.join(target,'server/data/quiz.db')),[{id:'r1',score:70},{id:'r2',score:90}]);
});
