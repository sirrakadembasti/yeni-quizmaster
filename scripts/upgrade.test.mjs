import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import net from 'node:net';
import {fileURLToPath} from 'node:url';
import {runUpgradeCommand,upgradeApplication} from './upgrade-lib.mjs';
const require=createRequire(new URL('../server/package.json',import.meta.url));
const sqlite=require(createRequire(require.resolve('connect-sqlite3')).resolve('sqlite3'));
async function fixture(t){
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'quizmaster-upgrade-test-'));
  t.after(async()=>{assert.equal(path.dirname(root),os.tmpdir());assert.match(path.basename(root),/^quizmaster-upgrade-test-/);await fs.rm(root,{recursive:true,force:true});});
  await fs.mkdir(path.join(root,'server/data'),{recursive:true});
  const db=await new Promise((resolve,reject)=>{const value=new sqlite.Database(path.join(root,'server/data/quiz.db'),error=>error?reject(error):resolve(value));});
  await new Promise((resolve,reject)=>db.exec('CREATE TABLE Person(id INTEGER PRIMARY KEY,name TEXT); INSERT INTO Person VALUES(1,"Preserved Student");',error=>error?reject(error):resolve()));
  await new Promise((resolve,reject)=>db.close(error=>error?reject(error):resolve()));
  await fs.writeFile(path.join(root,'server/.env'),'DATABASE_URL=file:../data/quiz.db\nHOST=127.0.0.1\nPORT=64241\nSESSION_SECRET=synthetic-upgrade-only\n');
  await fs.writeFile(path.join(root,'server/data/installation.lock'),'synthetic-installation');
  return root;
}
test('upgrade saves a verified backup before commands and preserves configuration and installation identity',async t=>{
  const root=await fixture(t),env=await fs.readFile(path.join(root,'server/.env')),calls=[];
  const result=await upgradeApplication(root,{run:async args=>{assert.equal((await fs.readdir(path.join(root,'server/backups'))).length,1);calls.push(args);}});
  assert.deepEqual(calls,[['install','--frozen-lockfile'],['build'],['--filter','quiz-master-server','db:deploy'],['--filter','quiz-master-server','db:status']]);
  assert.deepEqual(await fs.readFile(path.join(root,'server/.env')),env);
  assert.equal(await fs.readFile(path.join(root,'server/data/installation.lock'),'utf8'),'synthetic-installation');
  assert.ok(JSON.parse(await fs.readFile(path.join(result.backupRoot,'manifest.json'),'utf8')).files.some(file=>file.backup==='server/data/quiz.db'));
  await assert.rejects(fs.stat(path.join(root,'server/data/upgrade.lock')),error=>error.code==='ENOENT');
});
test('failed build never applies migration and keeps the recovery backup and original data',async t=>{
  const root=await fixture(t),before=await fs.readFile(path.join(root,'server/data/quiz.db')),calls=[];
  await assert.rejects(upgradeApplication(root,{run:async args=>{calls.push(args);if(args[0]==='build')throw new Error('Injected build failure');}}),/build/);
  assert.equal(calls.length,2);assert.deepEqual(await fs.readFile(path.join(root,'server/data/quiz.db')),before);
  assert.equal((await fs.readdir(path.join(root,'server/backups'))).length,1);
  await assert.rejects(fs.stat(path.join(root,'server/data/upgrade.lock')),error=>error.code==='ENOENT');
});
test('an existing upgrade lock blocks a second operation without creating a new backup',async t=>{
  const root=await fixture(t);await fs.writeFile(path.join(root,'server/data/upgrade.lock'),'other-operator');
  await assert.rejects(upgradeApplication(root,{run:async()=>assert.fail('Must not run')}),/upgrade|lock/i);
  assert.equal(await fs.readFile(path.join(root,'server/data/upgrade.lock'),'utf8'),'other-operator');
  await assert.rejects(fs.stat(path.join(root,'server/backups')),error=>error.code==='ENOENT');
});
test('uncertain process cleanup retains the operation lock and recovery backup',async t=>{
 const root=await fixture(t);
 await assert.rejects(upgradeApplication(root,{run:async()=>{const error=new Error('Owned child cleanup uncertain');error.cleanupUncertain=true;throw error;}}),/uncertain/);
 assert.ok(await fs.stat(path.join(root,'server/data/upgrade.lock')),'Uncertain cleanup must not permit a second upgrade');
 assert.equal((await fs.readdir(path.join(root,'server/backups'))).length,1);
});
test('migration subprocess cannot inherit a foreign database or Prisma log level',async t=>{
  const root=await fixture(t),shim=path.join(root,'pnpm.cjs');
  await fs.writeFile(shim,"require('node:fs').writeFileSync('child-env-proof.json',JSON.stringify({database:process.env.DATABASE_URL,rust:process.env.RUST_LOG}));");
  const keys=['npm_execpath','DATABASE_URL','RUST_LOG'],before=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
  try{
    Object.assign(process.env,{npm_execpath:shim,DATABASE_URL:'file:/foreign-database-must-never-be-used.db',RUST_LOG:'warn'});
    await runUpgradeCommand(root,['--filter','quiz-master-server','db:deploy']);
    assert.deepEqual(JSON.parse(await fs.readFile(path.join(root,'child-env-proof.json'),'utf8')),{database:'file:'+path.join(root,'server/data/quiz.db').replaceAll('\\','/'),rust:'info'});
  }finally{for(const key of keys){if(before[key]===undefined)delete process.env[key];else process.env[key]=before[key];}}
});
test('frozen install is noninteractive even when the caller disables CI',async t=>{
 const root=await fixture(t),shim=path.join(root,'pnpm.cjs');
 await fs.writeFile(shim,"if(process.env.CI!=='true'){console.error('Controlled modules replacement requires confirmation');process.exit(43)}require('node:fs').writeFileSync('noninteractive-install-proof.json',JSON.stringify(process.argv.slice(2)));");
 const keys=['npm_execpath','CI'],before=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
 try{Object.assign(process.env,{npm_execpath:shim,CI:'false'});await runUpgradeCommand(root,['install','--frozen-lockfile']);assert.deepEqual(JSON.parse(await fs.readFile(path.join(root,'noninteractive-install-proof.json'),'utf8')),['install','--frozen-lockfile']);}
 finally{for(const key of keys){if(before[key]===undefined)delete process.env[key];else process.env[key]=before[key];}}
});
for(const hardStop of [false,true])test(hardStop?'hard parent stop preserves recovery evidence and stops the upgrade descendant':'graceful bootstrap lease cancellation stops a TERM-resistant descendant and releases the CLI lock',{timeout:20000},async t=>{
  const root=await fixture(t),shim=path.join(root,'pnpm.cjs'),proof=path.join(root,'lease-port.txt');
  await fs.writeFile(shim,`const {spawn}=require('node:child_process');spawn(process.execPath,['-e',"process.on('SIGTERM',()=>{});const s=require('node:net').createServer();s.listen(0,'127.0.0.1',()=>require('node:fs').writeFileSync(process.argv[1],String(s.address().port)))",${JSON.stringify(proof)}],{stdio:'inherit'});setInterval(()=>{},1000);`);
  const cli=fileURLToPath(new URL('./upgrade.mjs',import.meta.url));
  const capture=path.join(root,'lease-diagnostic.txt');
  const parent=spawn(process.execPath,['-e',`const fs=require('node:fs');const output=fs.openSync(${JSON.stringify(capture)},'a');const child=require('node:child_process').spawn(process.execPath,${JSON.stringify([cli,'--project',root,'--parent-lease'])},{env:{...process.env,npm_execpath:${JSON.stringify(shim)}},stdio:['pipe',output,output]});process.stdin.on('data',()=>child.stdin.end('cancel\\n'));setInterval(()=>{},1000);`],{windowsHide:true,stdio:['pipe','ignore','ignore']});
  t.after(()=>{if(parent.exitCode===null&&parent.signalCode===null)parent.kill('SIGTERM');});
  const deadline=Date.now()+15000;
  while(Date.now()<deadline){try{await fs.stat(proof);break;}catch{}await new Promise(resolve=>setTimeout(resolve,50));}
  assert.ok(await fs.stat(proof),'Real upgrade did not reach its controlled install step');
  const port=Number(await fs.readFile(proof,'utf8'));
  if(hardStop){const closed=new Promise(resolve=>parent.once('close',resolve));parent.kill('SIGTERM');await closed;}
  else parent.stdin.write('cancel\n');
  const open=()=>new Promise(resolve=>{const socket=net.connect({host:'127.0.0.1',port});socket.on('connect',()=>{socket.destroy();resolve(true);});socket.on('error',()=>resolve(false));});
  let unlocked=false;
  while(Date.now()<deadline){unlocked=await fs.stat(path.join(root,'server/data/upgrade.lock')).then(()=>false,error=>error.code==='ENOENT');if((unlocked||(hardStop&&process.platform==='win32'))&&!await open())break;await new Promise(resolve=>setTimeout(resolve,50));}
  assert.equal(await open(),false,'TERM-resistant upgrade descendant survived bootstrap');
  if(!hardStop||process.platform!=='win32')assert.equal(unlocked,true,'Graceful CLI cancellation retained its operation lock: '+await fs.readFile(capture,'utf8'));
  // In this Windows host a hard parent stop can hard-kill its CLI too. Its
  // finally cannot run; retain any lock as conservative operator evidence.
  assert.equal((await fs.readdir(path.join(root,'server/backups'))).length,1,'Verified pre-upgrade recovery backup was lost');
});
