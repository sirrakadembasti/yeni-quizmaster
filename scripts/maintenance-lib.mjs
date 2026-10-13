import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import net from 'node:net';
import {createRequire} from 'node:module';
import {getSetupPaths} from './setup-bootstrap-lib.mjs';
const require=createRequire(new URL('../server/package.json',import.meta.url));
const sqlite3=require(createRequire(require.resolve('connect-sqlite3')).resolve('sqlite3'));
const dotenv=require('dotenv');
const inside=(root,target)=>{const rel=path.relative(root,target);return rel===''||(!rel.startsWith('..')&&!path.isAbsolute(rel));};

function rejectAncestorLinks(target){
  const absolute=path.resolve(target),base=path.parse(absolute).root;
  let current=base;
  for(const component of path.relative(base,absolute).split(path.sep).filter(Boolean)){
    current=path.join(current,component);
    try{if(fs.lstatSync(current).isSymbolicLink())throw new Error('Symlink ancestor storage is not supported');}
    catch(error){if(error.code!=='ENOENT')throw error;}
  }
}

function safePath(root,relative){
  if(typeof relative!=='string'||!relative||relative.includes('\\')||path.posix.isAbsolute(relative)||relative.split('/').some(part=>!part||part==='.'||part==='..'))throw new Error('Unsafe backup path');
  const target=path.resolve(root,...relative.split('/'));
  if(!inside(root,target))throw new Error('Unsafe backup path');
  rejectAncestorLinks(target);
  return target;
}
async function filesUnder(root){
  if(!fs.existsSync(root))return [];
  const found=[];
  async function visit(target){
    const stat=await fsp.lstat(target);
    if(stat.isSymbolicLink())throw new Error('Symlink storage is not supported');
    if(stat.isFile())found.push(target);
    else if(stat.isDirectory())for(const entry of await fsp.readdir(target))await visit(path.join(target,entry));
    else throw new Error('Unsupported storage entry');
  }
  await visit(root);return found;
}
async function digest(file){
  const hash=crypto.createHash('sha256');
  for await(const chunk of fs.createReadStream(file))hash.update(chunk);
  return hash.digest('hex');
}
const open=(file,mode=sqlite3.OPEN_READONLY)=>new Promise((resolve,reject)=>{const db=new sqlite3.Database(file,mode,error=>error?reject(error):resolve(db));});
const close=db=>new Promise((resolve,reject)=>db.close(error=>error?reject(error):resolve()));
const query=(db,sql)=>new Promise((resolve,reject)=>db.all(sql,(error,rows)=>error?reject(error):resolve(rows)));
async function checkDatabase(file){
  const db=await open(file);
  try{
    const integrity=await query(db,'PRAGMA integrity_check');
    if(integrity.length!==1||integrity[0].integrity_check!=='ok'||(await query(db,'PRAGMA foreign_key_check')).length)throw new Error('SQLite integrity check failed');
  }finally{await close(db);}
}
async function sqliteBackup(source,target){
  const db=await open(source);
  let backup;
  try{
    backup=await new Promise((resolve,reject)=>{const job=db.backup(target,error=>error?reject(error):resolve(job));});
    const started=Date.now();let done=false;
    while(!done){
      if(Date.now()-started>120000)throw new Error('SQLite backup deadline exceeded');
      done=await new Promise((resolve,reject)=>backup.step(256,(error,completed)=>error?reject(error):resolve(completed)));
    }
  }finally{
    try{if(backup)await new Promise((resolve,reject)=>backup.finish(error=>error?reject(error):resolve()));}
    finally{await close(db);}
  }
  // A portable snapshot is a standalone DB, not a new WAL-mode database
  // whose validation opens unmanifested sidecars in the backup directory.
  const snapshot=await open(target,sqlite3.OPEN_READWRITE);
  try{
    const mode=await query(snapshot,'PRAGMA journal_mode=DELETE');
    if(mode[0]?.journal_mode!=='delete')throw new Error('SQLite snapshot is not standalone');
  }finally{await close(snapshot);}
  await checkDatabase(target);
}
function readConfiguration(root){
  const parsed=relative=>{const file=safePath(root,relative);return fs.existsSync(file)?dotenv.parse(fs.readFileSync(file)):{};};
  // Match server/index.ts: server/.env takes precedence over root fallback.
  return {...parsed('.env'),...parsed('server/.env')};
}
async function requireStopped(root,configuration){
  const config=configuration??readConfiguration(root);
  const port=Number(config.PORT??5000);
  if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Invalid application port');
  const host=config.HOST||'0.0.0.0';
  const addresses=host==='0.0.0.0'?['127.0.0.1']:(host==='::'||host==='localhost'?['::1','127.0.0.1']:[host]);
  const listening=await Promise.all(addresses.map(address=>new Promise(resolve=>{
    const socket=net.createConnection({host:address,port});
    let settled=false;
    const finish=value=>{if(settled)return;settled=true;socket.destroy();resolve(value);};
    socket.setTimeout(1000,()=>finish(true));
    socket.once('connect',()=>finish(true));
    socket.once('error',error=>finish(error.code!=='ECONNREFUSED'));
  })));
  if(listening.some(Boolean))throw new Error('Stop the application before backup or restore');
}
function storageSources(root){
  const paths=getSetupPaths(root);
  const env=readConfiguration(root);
  if(env.DATABASE_URL&&env.DATABASE_URL!=='file:../data/quiz.db'&&env.DATABASE_URL!=='file:'+paths.quizDb.replaceAll('\\','/'))throw new Error('Only the standard local SQLite database is supported');
  const archives=path.resolve(root,env.ARCHIVE_BACKUP_ROOT||'server/data/backups');
  rejectAncestorLinks(archives);
  if(archives===path.parse(archives).root||archives===root||inside(archives,paths.backupsRoot)||inside(paths.backupsRoot,archives))throw new Error('Unsafe archive storage root');
  const sources=[['.env',safePath(root,'.env')],['server/.env',paths.env],['server/data/quiz.db',paths.quizDb],['server/data/sessions.db',paths.sessionsDb],['server/data/installation.lock',paths.lock],['server/data/installation.pending',paths.pending],['server/data/deployment-config.json',paths.deploymentConfig],['server/data/setup-artifacts',paths.setupArtifacts],['server/uploads',paths.uploadsRoot],['server/data/backups',archives]];
  for(const [relative,source]of sources){if(source!==archives)safePath(root,relative);}
  return {paths,sources};
}

/** Offline application backup: SQLite snapshots plus private config and files. */
export async function createApplicationBackup(projectRoot,{name='maintenance-'+crypto.randomUUID()}={}){
  const root=fs.realpathSync(projectRoot);
  await requireStopped(root);
  const {paths,sources}=storageSources(root);
  if(!fs.existsSync(paths.quizDb))throw new Error('Application database is missing');
  if(!/^[A-Za-z0-9_-]+$/.test(name))throw new Error('Unsafe backup name');
  safePath(root,'server/backups');
  await fsp.mkdir(paths.backupsRoot,{recursive:true,mode:0o700});
  const target=path.join(paths.backupsRoot,name);
  await fsp.mkdir(target,{mode:0o700});
  const manifest={formatVersion:1,createdAt:new Date().toISOString(),files:[]};
  try{
    for(const [relative,source]of sources){
      if(!fs.existsSync(source))continue;
      const files=await filesUnder(source);
      for(const file of files){
        const suffix=path.relative(source,file).replaceAll('\\','/');
        const destination=relative+(suffix?'/'+suffix:'');
        const output=safePath(target,destination);
        await fsp.mkdir(path.dirname(output),{recursive:true,mode:0o700});
        if(destination==='server/data/quiz.db'||destination==='server/data/sessions.db')await sqliteBackup(file,output);
        else{
          await fsp.copyFile(file,output,fs.constants.COPYFILE_EXCL);
          if(await digest(file)!==await digest(output))throw new Error('Source changed during backup');
        }
        await fsp.chmod(output,0o600);
        manifest.files.push({backup:destination,bytes:(await fsp.stat(output)).size,sha256:await digest(output)});
      }
    }
    await fsp.writeFile(path.join(target,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{mode:0o600,flag:'wx'});
    return {backupRoot:target,files:manifest.files.length};
  }catch(error){
    if(path.dirname(target)!==paths.backupsRoot)throw new Error('Unsafe backup cleanup');
    await fsp.rm(target,{recursive:true,force:true});throw error;
  }
}

/** Validate completely before publishing into an empty installation data area. */
export async function restoreApplicationBackup(backupRoot,projectRoot){
  const backup=fs.realpathSync(backupRoot),root=path.resolve(projectRoot);
  rejectAncestorLinks(root);
  if(inside(backup,root)||inside(root,backup))throw new Error('Restore target must be independent');
  if(fs.existsSync(root)&&fs.lstatSync(root).isSymbolicLink())throw new Error('Symlink restore root is not supported');
  const manifest=JSON.parse(await fsp.readFile(safePath(backup,'manifest.json'),'utf8'));
  if(manifest.formatVersion!==1||!Array.isArray(manifest.files)||!manifest.files.length)throw new Error('Unsupported backup manifest');
  const allowed=/^(?:\.env|server\/(?:\.env|data\/(?:quiz\.db|sessions\.db|installation\.(?:lock|pending)|deployment-config\.json)|(?:uploads|data\/(?:backups|setup-artifacts))\/.+))$/;
  const seen=new Set();
  for(const file of manifest.files){
    if(!allowed.test(file.backup)||seen.has(file.backup)||!Number.isSafeInteger(file.bytes)||file.bytes<0||!/^[a-f0-9]{64}$/.test(file.sha256))throw new Error('Unsafe backup manifest');
    seen.add(file.backup);
    const input=safePath(backup,file.backup);
    if(!fs.existsSync(input)||(await fsp.stat(input)).size!==file.bytes||await digest(input)!==file.sha256)throw new Error('Backup hash integrity mismatch');
  }
  const actualFiles=(await filesUnder(backup)).map(file=>path.relative(backup,file).replaceAll('\\','/'));
  if(actualFiles.length!==seen.size+1||actualFiles.some(file=>file!=='manifest.json'&&!seen.has(file)))throw new Error('Unlisted backup file violates manifest');
  if(!seen.has('server/data/quiz.db'))throw new Error('Backup database is missing');
  await checkDatabase(safePath(backup,'server/data/quiz.db'));
  if(seen.has('server/data/sessions.db'))await checkDatabase(safePath(backup,'server/data/sessions.db'));
  for(const relative of ['.env','server/.env','server/data','server/uploads'])if(fs.existsSync(safePath(root,relative)))throw new Error('Restore requires empty data storage; existing files are preserved');
  const configuration=readConfiguration(backup);
  await requireStopped(root,configuration);
  await fsp.mkdir(root,{recursive:true,mode:0o700});
  const stage=await fsp.mkdtemp(path.join(root,'.quizmaster-restore-'));
  const published=[];
  try{
    for(const file of manifest.files){
      const output=safePath(stage,file.backup);
      await fsp.mkdir(path.dirname(output),{recursive:true,mode:0o700});
      await fsp.copyFile(safePath(backup,file.backup),output,fs.constants.COPYFILE_EXCL);
      await fsp.chmod(output,0o600);
      if(await digest(output)!==file.sha256)throw new Error('Restore hash integrity mismatch');
    }
    const envFile=seen.has('server/.env')?path.join(stage,'server/.env'):path.join(stage,'.env');
    if(fs.existsSync(envFile)){
      const env=await fsp.readFile(envFile,'utf8');
      // Dotenv uses the last assignment, including export/duplicate keys.
      // Append explicit overrides without re-serializing unrelated secrets.
      await fsp.writeFile(envFile,env+'\n# Restored portable storage locations\nDATABASE_URL=file:../data/quiz.db\nARCHIVE_BACKUP_ROOT=server/data/backups\n',{mode:0o600});
    }
    await fsp.mkdir(path.join(root,'server'),{recursive:true,mode:0o700});
    for(const relative of ['server/data','server/uploads','server/.env','.env']){
      const source=safePath(stage,relative),target=safePath(root,relative);
      if(!fs.existsSync(source))continue;
      if(fs.existsSync(target))throw new Error('Restore target changed during validation');
      await fsp.rename(source,target);published.push(target);
    }
    return {projectRoot:root,files:manifest.files.length};
  }catch(error){
    for(const target of published.reverse()){
      if(!inside(root,target))throw new Error('Unsafe restore rollback');
      await fsp.rm(target,{recursive:true,force:true});
    }
    throw error;
  }finally{
    if(path.dirname(stage)!==root||!path.basename(stage).startsWith('.quizmaster-restore-'))throw new Error('Unsafe staging cleanup');
    await fsp.rm(stage,{recursive:true,force:true});
  }
}
