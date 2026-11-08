// Test-only: independent Git exports and synthetic offline backups; no live DB queries.
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {createApplicationBackup,restoreApplicationBackup} from './maintenance-lib.mjs';
import {upgradeApplication} from './upgrade-lib.mjs';
import {createInvocation} from './package-manager.mjs';
// npm komutları mantıksal işlemlerden (install/run) kabuksuz üretilir; ownedLaunch yalnız argümanları alır (komut process.execPath).
const npmInvocation=op=>createInvocation('npm',op);
const stepLabel=op=>(op.script||op.type).replace(/[^\w.-]/g,'_');
import {launchOwned,cleanupOwned} from './academic-owned-process.mjs';
import {waitForAuditServer} from './audit-server-readiness.mjs';
import {verifyFixturePortsReleased} from './linux-owned-process-cleanup.mjs';
const repo=path.resolve(import.meta.dirname,'..');
const options=Object.fromEntries(process.argv.slice(2).map(x=>{const i=x.indexOf('=');return [x.slice(0,i),x.slice(i+1)];}));
const gitRepo=fs.realpathSync(options['--git-repo']||repo);
const selectedCases=(options['--cases']||'install,build,migrate,start').split(',');
if(!selectedCases.length||new Set(selectedCases).size!==selectedCases.length||selectedCases.some(x=>!['install','build','migrate','start'].includes(x)))throw Error('Invalid case selection');
const evidenceBase=path.resolve(options['--evidence']||'');
if(!options['--backup']||!options['--snapshot']||!options['--session']||!options['--evidence'])throw Error('Required: --backup= --snapshot= --session= --evidence=');
function noLinks(target){let current=path.parse(path.resolve(target)).root;for(const part of path.relative(current,path.resolve(target)).split(path.sep).filter(Boolean)){current=path.join(current,part);if(fs.existsSync(current)&&fs.lstatSync(current).isSymbolicLink())throw Error('Symlink ancestor rejected');}}
const plan=fs.realpathSync(path.join(repo,'.superpowers/sdd/2026-10-06-production-rehearsal-plan'));
noLinks(evidenceBase);if(!evidenceBase.startsWith(plan+path.sep))throw Error('Evidence must be in this plan workspace');
for(const [option,filename]of [['--snapshot','rollback-before-private.json'],['--session','rollback-old-session-private.json']]){const file=path.resolve(options[option]);noLinks(file);if(path.dirname(fs.realpathSync(file))!==plan||path.basename(file)!==filename||!fs.lstatSync(file).isFile())throw Error('Private input guard rejected');}
noLinks(repo);noLinks(gitRepo);noLinks(path.join(repo,'server/data'));noLinks(path.resolve(options['--backup']));
const inputBackup=fs.realpathSync(options['--backup']);noLinks(inputBackup);const backupFixture=path.dirname(path.dirname(path.dirname(inputBackup)));if(path.dirname(backupFixture)!==fs.realpathSync(path.join(repo,'server/data'))||!/^quizmaster-test-(?:upgrade|rollback)-/.test(path.basename(backupFixture))||path.dirname(inputBackup)!==path.join(backupFixture,'server/backups')||!fs.lstatSync(inputBackup).isDirectory())throw Error('Synthetic backup guard rejected');
fs.mkdirSync(evidenceBase,{recursive:true,mode:0o700});
const evidence=path.join(evidenceBase,'run-'+process.platform+'-'+crypto.randomUUID());
fs.mkdirSync(evidence,{mode:0o700});
const evidenceFiles=new Set(),commandLogs=new Map();
function privateFile(name){if(!/^[a-zA-Z0-9_.-]+$/.test(name)||evidenceFiles.has(name))throw Error('Duplicate or unsafe evidence name');const file=path.join(evidence,name);noLinks(file);if(fs.existsSync(file))throw Error('Evidence destination exists');evidenceFiles.add(name);return file;}
function writeJson(name,value){fs.writeFileSync(privateFile(name),JSON.stringify(value,null,2),{flag:'wx',mode:0o600});}
function privateLog(name){const file=privateFile(name),fd=fs.openSync(file,'wx',0o600);return {file,stream:fs.createWriteStream(file,{fd,autoClose:true})};}
const diagnostic=label=>fs.readFileSync(commandLogs.get(label),'utf8');
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const protectedFiles=['client/src/lib/api.ts','client/src/pages/server-setup.tsx','server/data/quiz.db'];
const protectedBefore=protectedFiles.map(x=>hash(path.join(gitRepo,x)));
const protectedExpected=['de94a69161d940db1e10268fb95120da5a77325dbd3b90e3b26774f30a41831c','3e2d02a470166cc33df798c2316b1345ea0a9e7c2467ccc6c4bdd95703b459cb','8210a4b79f2cfb9cf74de6a4989f5c8a5449ba1d17b2332abdbd018c3741a158'];
if(protectedBefore.some((value,i)=>value!==protectedExpected[i]))throw Error('Protected baseline mismatch');
const expected=JSON.parse(fs.readFileSync(options['--snapshot'],'utf8'));
if(!expected.users?.length||expected.users.some(u=>!u.email.endsWith('.test')||typeof u.password!=='string'||!Number.isInteger(u.sessionVersion)))throw Error('Synthetic complete user identities required');
for(const key of ['guardians','assignments','quizzes','results','submissions','answers'])if(!Array.isArray(expected[key])||!expected[key].length)throw Error('Nonempty business relation input required');
if(expected.users.filter(u=>u.role==='admin').length!==1)throw Error('One synthetic original admin required');
const old='1298cf8266348cf2bfd338ad431b4136c5f2ae2e',current='9cf56f5';
const roots=[],results=[],commands=[];
async function ownedLaunch(args,options){let state;try{return await launchOwned(args,{...options,onState:s=>{state=s;options.onState?.(s);}});}catch(error){if(state&&!state.stopped)writeJson('launch-rejection-'+crypto.randomUUID()+'.json',await cleanupOwned(state));throw error;}}
const environment=Object.fromEntries(Object.entries(process.env).filter(([k])=>/^(PATH|SYSTEMROOT|WINDIR|TEMP|TMP|COMSPEC|PATHEXT|LOCALAPPDATA|APPDATA|USERPROFILE|HOME|npm_execpath)$/i.test(k)));
Object.assign(environment,{CI:'true',RUST_LOG:'info',FORCE_COLOR:'0',PRISMA_HIDE_UPDATE_MESSAGE:'1'});
function guard(root){noLinks(root);const actual=fs.realpathSync(root);if(path.dirname(actual)!==fs.realpathSync(path.join(repo,'server/data'))||!path.basename(actual).startsWith('quizmaster-test-rollback-'))throw Error('Unsafe owned root');return actual;}
function regular(root,relative,required=true){if(typeof relative!=='string'||!relative||relative.includes('\\')||path.isAbsolute(relative)||relative.split('/').some(x=>!x||x==='.'||x==='..'))throw Error('Unsafe storage relative path');const file=path.resolve(root,relative);if(!file.startsWith(root+path.sep))throw Error('Unsafe storage path');noLinks(file);if(!fs.existsSync(file)){if(required)throw Error('Required storage file absent');return file;}if(!fs.lstatSync(file).isFile())throw Error('Regular storage file required');return file;}
function storage(root){guard(root);regular(root,'server/data/quiz.db');regular(root,'server/.env');regular(root,'server/data/sessions.db',false);regular(root,'.env',false);regular(root,'verify-private.cjs',false);noLinks(path.join(root,'server/uploads'));}
function fixture(label,ref){const root=guard(fs.mkdtempSync(path.join(repo,'server/data/quizmaster-test-rollback-'+label+'-')));roots.push(root);const tar=path.join(root,'source.tar');const a=spawnSync('git',['archive','--format=tar','--output='+tar,ref],{cwd:gitRepo,windowsHide:true});if(a.status!==0)throw Error('Git export failed');const b=spawnSync('tar',['-xf',tar,'-C',root,'--exclude=server/data'],{windowsHide:true});if(b.status!==0)throw Error('Source extraction failed');fs.unlinkSync(tar);fs.appendFileSync(path.join(root,'.npmrc'),'\npackage-import-method=hardlink\n');return root;}
async function freePort(){const s=net.createServer();await new Promise((r,j)=>{s.once('error',j);s.listen(0,'127.0.0.1',r);});const p=s.address().port;await new Promise(r=>s.close(r));return p;}
function env(root,port){storage(root);const dotenv=createRequire(path.join(repo,'server/package.json'))('dotenv'),parse=relative=>{const file=regular(root,relative,false);return fs.existsSync(file)?dotenv.parse(fs.readFileSync(file)):{};};const sessionSecret={...parse('.env'),...parse('server/.env')}.SESSION_SECRET;if(!sessionSecret)throw Error('Stored synthetic service session secret required');const origin='http://127.0.0.1:'+port;return {...environment,DATABASE_URL:'file:'+path.join(root,'server/data/quiz.db').replaceAll('\\','/'),HOST:'127.0.0.1',PORT:String(port),FRONTEND_URL:origin,ALLOWED_ORIGINS:origin,NODE_ENV:'production',SESSION_SECRET:sessionSecret,CHECKPOINT_DISABLE:'1'};}
async function command(root,args,label,port=1){
 const invocation=npmInvocation(args);if(invocation.command!==process.execPath)throw Error('Resolve npm JavaScript entry first');
 const {file,stream:log}=privateLog(label+'-'+crypto.randomUUID()+'.private.log');commandLogs.set(label,file);
 let state,timer,code=null,cleanup;const started=Date.now();
 try{
  state=await ownedLaunch(invocation.args,{cwd:root,env:env(root,port),onState:s=>state=s,onOutput:t=>log.write(t)});
  code=await Promise.race([state.finished,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Owned command deadline')),20*60*1000);})]);
  return {code};
 }finally{
  clearTimeout(timer);if(state)cleanup=await cleanupOwned(state);await new Promise(r=>log.end(r));
  const proof={label,args,code,elapsedMs:Date.now()-started,cleanup};commands.push(proof);writeJson('command-'+commands.length+'.json',proof);
 }
}
async function configure(root,port){storage(root);fs.appendFileSync(regular(root,'server/.env'),`\nHOST=127.0.0.1\nPORT=${port}\n`);}
function allowedCacheAliases(source){
 const trees=['node_modules','server/node_modules','client/node_modules'].map(relative=>path.join(source,relative)),aliases=[];
 for(const tree of trees){noLinks(tree);if(!fs.lstatSync(tree).isDirectory())throw Error('Regular cache module tree required');}
 function walk(directory){for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
  const file=path.join(directory,entry.name);
  if(entry.isSymbolicLink()){
   const actual=fs.realpathSync(file),relative=path.relative(source,file);
   const workspace=['client','server'].some(kind=>actual===path.join(source,kind)&&[path.join('node_modules','quiz-master-'+kind)].includes(relative));
   if(!workspace&&!trees.some(tree=>actual===tree||actual.startsWith(tree+path.sep)))throw Error('Private or external cache alias rejected');
   aliases.push({relative,target:path.relative(source,actual),directory:fs.statSync(actual).isDirectory(),workspace});
  }
  else if(entry.isDirectory())walk(file);
 }}
 for(const tree of trees)walk(tree);return aliases;
}
async function warmDependencies(root,source,label,port){
 source=guard(path.resolve(source));storage(root);
 for(const file of ['package-lock.json','server/prisma/schema.prisma'])if(hash(regular(root,file))!==hash(regular(source,file)))throw Error('Same-version dependency cache required');
 for(const relative of ['node_modules','server/node_modules','client/node_modules']){const dir=path.join(source,relative);noLinks(dir);if(!fs.lstatSync(dir).isDirectory()||fs.existsSync(path.join(root,relative)))throw Error('Independent cache destination required');}
 const preflight=allowedCacheAliases(source);
 if(process.platform!=='win32')throw Error('Native Linux cache warming not implemented; use real frozen installation');
 const script=path.join(root,'warm-'+crypto.randomUUID()+'.private.cjs');
 fs.writeFileSync(script,`const fs=require('fs'),path=require('path'),{spawnSync}=require('child_process');
const source=${JSON.stringify(source)},root=${JSON.stringify(root)};let aliases=0,rebased=0;
const noLinks=${noLinks.toString()},allowedCacheAliases=${allowedCacheAliases.toString()};const preflight=allowedCacheAliases(source),skipped=preflight.filter(x=>x.workspace).map(x=>path.join(source,x.relative));let skippedWorkspaceAliases=0;
for(const relative of ['node_modules','server/node_modules','client/node_modules']){
 const result=spawnSync('robocopy',[path.join(source,relative),path.join(root,relative),'/E','/XJ','/COPY:DAT','/DCOPY:DAT','/MT:4','/R:0','/W:0','/NFL','/NDL','/NP',...(skipped.length?['/XD',...skipped]:[])],{windowsHide:true,stdio:'inherit'});
 if(result.status===null||result.status>7)throw Error('Independent native copy rejected');
}
function visit(relative){for(const entry of fs.readdirSync(path.join(source,relative),{withFileTypes:true})){
 const next=path.join(relative,entry.name),from=path.join(source,next),to=path.join(root,next);
 if(entry.isSymbolicLink()){
  if(preflight.some(x=>x.workspace&&x.relative===next)){skippedWorkspaceAliases++;continue;}
  const actual=fs.realpathSync(from);if(!['node_modules','server/node_modules','client/node_modules'].some(relative=>actual===path.join(source,relative)||actual.startsWith(path.join(source,relative)+path.sep)))throw Error('Private or external cache alias rejected');
  if(fs.existsSync(to)||fs.lstatSync(path.dirname(to)).isSymbolicLink())throw Error('Unsafe alias destination');
  const target=path.join(root,path.relative(source,actual));fs.mkdirSync(path.dirname(to),{recursive:true});
  if(fs.statSync(actual).isDirectory())fs.symlinkSync(target,to,'junction');else fs.copyFileSync(actual,to);aliases++;
 }else if(entry.isDirectory())visit(next);
 else if(next.includes(path.sep+'.bin'+path.sep)||entry.name==='.modules.yaml'){
  const bytes=fs.readFileSync(to);if(!bytes.includes(0)){const prior=bytes.toString('utf8'),text=prior.split(source).join(root).split(source.replaceAll('\\\\','/')).join(root.replaceAll('\\\\','/'));if(text!==prior){fs.writeFileSync(to,text);rebased++;}}
 }
}}
for(const relative of ['node_modules','server/node_modules','client/node_modules'])visit(relative);
const {createRequire}=require('module');const requireServer=createRequire(path.join(root,'server/package.json')),client=fs.realpathSync(requireServer.resolve('@prisma/client'));
if(!client.startsWith(root+path.sep))throw Error('Generated client outside independent root');
fs.writeFileSync(path.join(root,'warm-proof.private.json'),JSON.stringify({source,root,aliases,rebased,preflightAliases:preflight.length,skippedWorkspaceAliases,moduleTargetsOnly:true,independentPhysicalCopies:true,privateClient:true}),{flag:'wx',mode:384});
`,{flag:'wx',mode:0o600});
 const {stream:log}=privateLog(label+'-warm.private.log');let state,timer,code=null;const started=Date.now();
 try{state=await ownedLaunch([script],{cwd:root,env:env(root,port),onState:s=>state=s,onOutput:t=>log.write(t)});code=await Promise.race([state.finished,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Warm-copy deadline')),20*60*1000);})]);if(code!==0)throw Error('Warm dependency copy failed');const proof=JSON.parse(fs.readFileSync(regular(root,'warm-proof.private.json')));writeJson(label+'-warm-copy.json',proof);}
 finally{clearTimeout(timer);const cleanup=state?await cleanupOwned(state):null;await new Promise(r=>log.end(r));writeJson(label+'-warm-cleanup.json',{code,elapsedMs:Date.now()-started,cleanup});}
}
function verifyFiles(backup,root){noLinks(backup);guard(root);const manifest=JSON.parse(fs.readFileSync(regular(backup,'manifest.json')));for(const f of manifest.files){regular(backup,f.backup);regular(root,f.backup);if(f.backup==='server/.env'||f.backup.endsWith('.db'))continue;if(hash(regular(root,f.backup))!==f.sha256)throw Error('Preserved file mismatch');}const dotenv=createRequire(path.join(repo,'server/package.json'))('dotenv');const parsed=(r,file)=>{const target=regular(r,file,false);return fs.existsSync(target)?dotenv.parse(fs.readFileSync(target)):{};};const prior={...parsed(backup,'.env'),...parsed(backup,'server/.env')},after={...parsed(root,'.env'),...parsed(root,'server/.env')};for(const k of Object.keys(prior)){if(['DATABASE_URL','ARCHIVE_BACKUP_ROOT','PORT','HOST'].includes(k))continue;if(prior[k]!==after[k])throw Error('Setting mismatch');}}
const fingerprint=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
async function databaseProof(root){storage(root);const req=createRequire(path.join(repo,'server/package.json'));const sqlite=req(createRequire(req.resolve('connect-sqlite3')).resolve('sqlite3'));const db=await new Promise((resolve,reject)=>{const instance=new sqlite.Database(regular(root,'server/data/quiz.db'),sqlite.OPEN_READONLY,error=>error?reject(error):resolve(instance));});const all=sql=>new Promise((resolve,reject)=>db.all(sql,(error,rows)=>error?reject(error):resolve(rows)));try{const users=await all('SELECT email FROM User');if(!users.length||users.some(x=>!x.email.endsWith('.test')))throw Error('Non synthetic fixture rejected');const migrations=await all('SELECT migration_name,finished_at,rolled_back_at FROM _prisma_migrations');if((await all('PRAGMA integrity_check'))[0].integrity_check!=='ok'||(await all('PRAGMA foreign_key_check')).length)throw Error('Fixture integrity failure');return {finished:migrations.filter(x=>x.finished_at&&!x.rolled_back_at).length,failed:migrations.filter(x=>!x.finished_at&&!x.rolled_back_at).length};}finally{await new Promise((resolve,reject)=>db.close(error=>error?reject(error):resolve()));}}
async function verify(root,label){
 storage(root);regular(root,'server/package.json');regular(root,'server/prisma/schema.prisma');
 const clientRequire=createRequire(path.join(root,'server/package.json')),clientPath=fs.realpathSync(clientRequire.resolve('@prisma/client'));if(!clientPath.startsWith(root+path.sep))throw Error('Prisma client outside owned root');
 const script=path.join(root,'verify-'+crypto.randomUUID()+'.private.cjs');
 const verifierFd=fs.openSync(script,'wx',0o600);
 fs.writeFileSync(verifierFd,`const fs=require('fs'),{PrismaClient}=require('./server/node_modules/@prisma/client');const db=new PrismaClient();(async()=>{try{const expected=JSON.parse(fs.readFileSync(${JSON.stringify(path.resolve(options['--snapshot']))},'utf8'));const models={users:'user',guardians:'guardianStudent',assignments:'classTeacherCourse',quizzes:'quiz',results:'studentResult',submissions:'surveySubmission',answers:'surveyAnswer'};for(const [key,model] of Object.entries(models)){const fields=Object.fromEntries(Object.keys(expected[key][0]||{id:true}).map(k=>[k,true]));const got=JSON.parse(JSON.stringify(await db[model].findMany({select:fields})));const sorted=x=>x.sort((a,b)=>a.id.localeCompare(b.id));if(JSON.stringify(sorted(got))!==JSON.stringify(sorted(expected[key])))throw Error('collection mismatch '+key);}const migrations=await db.$queryRawUnsafe('SELECT migration_name,finished_at,rolled_back_at FROM _prisma_migrations');if(migrations.filter(x=>x.finished_at&&!x.rolled_back_at).length!==17||migrations.some(x=>!x.finished_at))throw Error('migration mismatch');const integrity=await db.$queryRawUnsafe('PRAGMA integrity_check');if(integrity[0].integrity_check!=='ok'||(await db.$queryRawUnsafe('PRAGMA foreign_key_check')).length)throw Error('integrity');console.log('seven collections,17 migrations, integrity/FK verified');}finally{await db.$disconnect();}})().catch(()=>process.exitCode=1);`);
 fs.closeSync(verifierFd);
 const {stream:log}=privateLog(label+'-orm.private.log');let s,timer;try{s=await ownedLaunch([script],{cwd:root,env:env(root,1),onState:state=>s=state,onOutput:t=>log.write(t)});const code=await Promise.race([s.finished,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('ORM deadline')),180000);})]);if(code!==0)throw Error('ORM verification failed');}finally{clearTimeout(timer);if(s)writeJson(label+'-orm-cleanup.json',await cleanupOwned(s));await new Promise(r=>log.end(r));}
 const tokenize=text=>(text.match(/"(?:\\.|[^"\\])*"|\/\/[^\n]*|\/\*[\s\S]*?\*\/|[A-Za-z_][\w]*|[^\s]/g)||[]).filter(x=>!x.startsWith('//')&&!x.startsWith('/*')).join(' ');
 const generated=path.join(root,'server/node_modules/.prisma/client/schema.prisma');
 let schema=generated;if(!fs.existsSync(schema)){const req=createRequire(path.join(root,'server/package.json'));schema=createRequire(req.resolve('@prisma/client')).resolve('.prisma/client/schema.prisma');}
 schema=fs.realpathSync(schema);if(!schema.startsWith(root+path.sep)||!fs.statSync(schema).isFile())throw Error('Generated schema outside owned root');
 if(tokenize(fs.readFileSync(schema,'utf8'))!==tokenize(fs.readFileSync(path.join(root,'server/prisma/schema.prisma'),'utf8')))throw Error('Generated old schema mismatch');
}
async function browser(root,label,port){
 const invocation=npmInvocation({type:'run',workspace:'server',script:'start'});const {stream:log}=privateLog(label+'-server.private.log');let state,b;
 try{
  state=await ownedLaunch(invocation.args,{cwd:root,env:env(root,port),onState:s=>state=s,onOutput:t=>log.write(t)});
  const base='http://127.0.0.1:'+port;await waitForAuditServer(base+'/api/csrf-token',state);
  const {chromium}=createRequire(path.join(repo,'package.json'))('playwright');
  const storage=JSON.parse(fs.readFileSync(options['--session'],'utf8'));if(storage.cookies.some(c=>c.domain!=='127.0.0.1'))throw Error('Original cookie domain mismatch');
  b=await chromium.launch();const context=await b.newContext({storageState:storage});const page=await context.newPage(),pageErrors=[];page.on('pageerror',e=>pageErrors.push(e));
  await page.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
  const auth=await context.request.get(base+'/api/auth/me');if(auth.status()!==200||(await auth.json()).user.id!==expected.users.find(u=>u.role==='admin').id)throw Error('Original cookie identity rejected');
  await page.goto(base+'/archive',{waitUntil:'domcontentloaded'});await page.getByRole('heading',{name:/Arşiv/}).first().waitFor({timeout:30000});
  await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('heading',{name:/Arşiv/}).first().waitFor({timeout:30000});
  for(const quiz of expected.quizzes)await page.getByText(quiz.title+(quiz.contentType==='survey'?' (Anket)':' (Sınav)'),{exact:true}).waitFor({timeout:30000});
  fs.writeFileSync(privateFile(label+'-archive.png'),await page.screenshot({fullPage:true}),{flag:'wx',mode:0o600});
  const uploads=fs.readdirSync(path.join(root,'server/uploads'),{recursive:true}).filter(x=>/\.(png|jpe?g|gif|svg|webp)$/i.test(x));if(!uploads.length)throw Error('No preserved image');
  const imageURL=base+'/uploads/'+uploads[0].replaceAll('\\','/'),image=await context.request.get(imageURL);
  if(image.status()!==200||crypto.createHash('sha256').update(await image.body()).digest('hex')!==hash(path.join(root,'server/uploads',uploads[0])))throw Error('Image access/hash failed');
  await page.goto(imageURL,{waitUntil:'load'});fs.writeFileSync(privateFile(label+'-image.png'),await page.screenshot(),{flag:'wx',mode:0o600});
  if(pageErrors.length)throw Error('Browser page errors');return {cookie:200,originalAdmin:true,archive:true,reload:true,image:200,imageHash:true,pageErrors:0};
 }finally{
  let browserClosed=false,job=null,cleanupError;
  try{if(b){await b.close();browserClosed=true;}}catch(error){cleanupError=error;}
  try{if(state)job=await cleanupOwned(state);}catch(error){cleanupError??=error;}
  finally{await new Promise(r=>log.end(r));const ports=await verifyFixturePortsReleased([port]);writeJson(label+'-browser-cleanup.json',{job,ports,browserClosed,cleanupFailed:!!cleanupError});if(ports.some(x=>!x.stopped))cleanupError??=Error('Port cleanup failed');}
  if(cleanupError)throw cleanupError;
 }
}
try{
 if(options['--cache-preflight']){const source=guard(path.resolve(options['--cache-preflight']));const aliases=allowedCacheAliases(source);writeJson('cache-preflight.json',{source,aliases:aliases.length,skippedWorkspaceAliases:aliases.filter(x=>x.workspace).length,moduleTargetsOnly:true});console.log('Cache preflight passed');
 }else if(options['--verify-root']){
  const root=guard(path.resolve(options['--verify-root']));if(!/-old-[A-Za-z0-9]{6}$/.test(path.basename(root)))throw Error('Old recovery root required');
  if((await databaseProof(root)).finished!==17)throw Error('Old17 recovery required');verifyFiles(inputBackup,root);await verify(root,'recheck');
  const port=await freePort();await configure(root,port);const ui=await browser(root,'recheck',port);results.push({name:'recheck',recoveryRoot:root,status:'passed',ui});console.log('Recovery recheck passed');
 }else for(const name of selectedCases){
  console.log('case '+name+' prepare');const root=fixture(name,current),port=await freePort();await restoreApplicationBackup(path.resolve(options['--backup']),root);await configure(root,port);if((await databaseProof(root)).finished!==17)throw Error('Pre17 fixture required');
  if(options['--cache-current']){console.log('case '+name+' dependency warm copy');await warmDependencies(root,options['--cache-current'],name+'-current',port);}
  // Validate the restored synthetic copy with SQLite only; generated current ORM comes later.
  if(name==='install'){const file=path.join(root,'package.json'),p=JSON.parse(fs.readFileSync(file));p.devDependencies.concurrently='0.0.1';fs.writeFileSync(file,JSON.stringify(p));}
  if(name==='build')fs.appendFileSync(path.join(root,'client/src/App.tsx'),'\nconst controlled syntax failure = ;\n');
  if(name==='migrate'){const d=path.join(root,'server/prisma/migrations/99999999999999_controlled_failure');fs.mkdirSync(d);fs.writeFileSync(path.join(d,'migration.sql'),'THIS IS CONTROLLED INVALID SQL;');}
  let backup,step='completed';try{const u=await upgradeApplication(root,{run:async args=>{const r=await command(root,args,name+'-'+stepLabel(args),port);if(r.code!==0)throw Error('Actual command rejected '+r.code);}});backup=u.backupRoot;}catch(e){backup=e.backupRoot;step=e.step;}
  if(step!==(name==='start'?'completed':name))throw Error('Unexpected upgrade failure step '+step);
  if(name==='install'&&!/can only install packages when your package\.json and package-lock\.json/.test(diagnostic('install-install')))throw Error('Frozen lock mismatch not proved');
  if(name==='build'){const text=diagnostic('build-build');if(!text.includes('App.tsx')||!text.includes('controlled syntax failure'))throw Error('Injected App.tsx diagnostic not proved');}
  const failureSchema=await databaseProof(root);if(failureSchema.finished!==(name==='migrate'||name==='start'?22:17))throw Error('Unexpected schema after failure');if(name==='migrate'){const text=diagnostic(name+'-db_deploy');if(failureSchema.failed!==1||!text.includes('99999999999999_controlled_failure')||!/syntax error/i.test(text))throw Error('Controlled SQL failure not proved');}
  if(name==='start'){fs.writeFileSync(path.join(root,'dist/index.cjs'),'throw new Error("controlled startup failure");');const r=await command(root,{type:'run',workspace:'server',script:'start'},name+'-rejected-start',port);if(r.code===0||!diagnostic(name+'-rejected-start').includes('controlled startup failure'))throw Error('Corrupt start rejection not proved');}
  const recovery=fixture(name+'-old',old);
  if(name==='install'){
   const corrupt=guard(fs.mkdtempSync(path.join(repo,'server/data/quizmaster-test-rollback-corrupt-')));roots.push(corrupt);fs.cpSync(backup,corrupt,{recursive:true});fs.appendFileSync(path.join(corrupt,'server/data/quiz.db'),'controlled corruption');let rejected=false;try{await restoreApplicationBackup(corrupt,recovery);}catch(error){rejected=/Backup hash integrity mismatch/.test(error.message);}if(!rejected||['server/data','server/uploads','server/.env','.env'].some(x=>fs.existsSync(path.join(recovery,x))))throw Error('Corrupt backup published data');
  }
  await restoreApplicationBackup(backup,recovery);verifyFiles(backup,recovery);let existingRejected=false;try{await restoreApplicationBackup(backup,recovery);}catch(error){existingRejected=/existing files are preserved/.test(error.message);}if(!existingRejected)throw Error('Existing data overwritten');verifyFiles(backup,recovery);const recoveryPort=await freePort();await configure(recovery,recoveryPort);
  if(options['--cache-old']){console.log('case '+name+' old dependency warm copy');await warmDependencies(recovery,options['--cache-old'],name+'-old',recoveryPort);}
  for(const args of [{type:'install'},{type:'run',script:'build'},{type:'run',workspace:'server',script:'db:generate'},{type:'run',workspace:'server',script:'db:status'}]){console.log('case '+name+' recovery '+stepLabel(args));if((await command(recovery,args,name+'-old-'+stepLabel(args),recoveryPort)).code!==0)throw Error('Old recovery command rejected');}
  await verify(recovery,name);const ui=await browser(recovery,name,recoveryPort);results.push({name,step,backupRoot:backup,recoveryRoot:recovery,failureSchema,recoveredSchema:{finished:17,failed:0},manifestSha256:hash(path.join(backup,'manifest.json')),ui,status:'passed'});writeJson('case-'+name+'.json',results.at(-1));console.log('case '+name+' passed');
 }
}catch(e){writeJson('failure.private.json',{message:e.message,stack:e.stack,roots,results});console.error('Rehearsal stopped; inspect private diagnostic.');process.exitCode=1;}
finally{const after=protectedFiles.map(x=>hash(path.join(gitRepo,x)));if(fingerprint(after)!==fingerprint(protectedBefore))throw Error('Protected hash changed');writeJson('protected-hashes.json',{files:protectedFiles,hashes:after,unchanged:true});writeJson('results.json',{platform:process.platform,results,roots});}
