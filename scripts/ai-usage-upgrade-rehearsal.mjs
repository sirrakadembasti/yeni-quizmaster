// Explicitly read-only source; migrate and inspect only an owned private clone.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import assert from 'node:assert/strict';
import {createRequire} from 'node:module';import {execFileSync} from 'node:child_process';
const repo=path.resolve(import.meta.dirname,'..'),require=createRequire(path.join(repo,'server/package.json'));
const SQLite=require('better-sqlite3');
const directory=fs.mkdtempSync(path.join(repo,'server/data/quizmaster-test-ai-usage-upgrade-'));
const filename=path.join(directory,'quiz.db');
const source=new SQLite(path.join(repo,'server/data/quiz.db'),{readonly:true,fileMustExist:true});
try{await source.backup(filename);}finally{source.close();}
fs.copyFileSync(path.join(repo,'server/data/ai-encryption.key'),path.join(directory,'ai-encryption.key'));
const q=s=>'"'+s.replaceAll('"','""')+'"';
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x,(_k,v)=>typeof v==='bigint'?v.toString():v)).digest('hex');
const beforeDb=new SQLite(filename,{readonly:true});
const tables=beforeDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map(r=>r.name);
const before=new Map(tables.map(name=>[name,beforeDb.prepare('SELECT * FROM '+q(name)).all().map(hash).sort()]));beforeDb.close();
execFileSync(process.execPath,[require.resolve('prisma/build/index.js'),'migrate','deploy','--schema',path.join(repo,'server/prisma/schema.prisma')],{cwd:path.join(repo,'server'),env:{...process.env,DATABASE_URL:'file:'+filename.replaceAll('\\','/')},stdio:'pipe',timeout:120000});
const after=new SQLite(filename,{readonly:true});
try{
 for(const [name,old] of before){const now=after.prepare('SELECT * FROM '+q(name)).all().map(hash).sort();if(name==='_prisma_migrations')for(const row of old)assert.ok(now.includes(row));else assert.deepEqual(now,old,'Rows changed: '+name);}
 assert.equal(after.prepare('SELECT COUNT(*) n FROM AIUsage').get().n,0);
 assert.equal(after.pragma('integrity_check',{simple:true}),'ok');assert.deepEqual(after.pragma('foreign_key_check'),[]);
 const key=fs.readFileSync(path.join(directory,'ai-encryption.key'));
 for(const p of after.prepare('SELECT encryptedApiKey FROM AIProfile').all()){const [version,iv,data,tag]=p.encryptedApiKey.split('.');assert.equal(version,'v1');const d=crypto.createDecipheriv('aes-256-gcm',key,Buffer.from(iv,'base64'));d.setAuthTag(Buffer.from(tag,'base64'));d.update(Buffer.from(data,'base64'));d.final();}
 const result={passed:true,directory,preservedTables:tables.length,newUsageRows:0,integrity:'ok',foreignKeyViolations:0,existingProfileKeysVerified:true};
 fs.writeFileSync(path.join(directory,'rehearsal-result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{after.close();}
