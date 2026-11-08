import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {runSupervisedCommand} from './upgrade-process.mjs';
import {createApplicationBackup} from './maintenance-lib.mjs';
import {createInvocation,selectManager} from './package-manager.mjs';

export function runUpgradeCommand(projectRoot,op,onProgress=()=>{},signal){
  // Yönetici açık seçimden (QUIZMASTER_PM, kurulu yönetici, varsayılan npm); komut kabuksuz üretilir.
  const {command,args:argv}=createInvocation(selectManager({env:process.env,root:projectRoot}),op,{root:projectRoot,env:process.env});
  return runSupervisedCommand(command,argv,{cwd:projectRoot,env:{...process.env,DATABASE_URL:'file:'+path.join(projectRoot,'server/data/quiz.db').replaceAll('\\','/'),RUST_LOG:'info',FORCE_COLOR:'0',CI:'true'},onProgress,signal});
}

/** Code is supplied by the operator; no Git/network source selection or data reset. */
export async function upgradeApplication(projectRoot,{run,onProgress=()=>{},signal}={}){
  const root=fs.realpathSync(projectRoot),data=path.join(root,'server/data');
  for(const relative of ['server/.env','server/data/quiz.db','server/data/installation.lock']){
    const file=path.join(root,relative);
    if(!fs.existsSync(file)||!fs.lstatSync(file).isFile()||fs.lstatSync(file).isSymbolicLink())throw new Error('Upgrade requires an installed local SQLite application');
  }
  // The backup implementation subsequently validates every storage ancestor.
  // Reject these ancestors before acquiring our own exclusive control file too.
  for(const directory of [root,path.join(root,'server'),data])if(fs.lstatSync(directory).isSymbolicLink())throw new Error('Unsafe upgrade storage');
  const lock=path.join(data,'upgrade.lock'),owner=crypto.randomUUID();
  let handle;
  try{handle=await fsp.open(lock,'wx',0o600);}catch(error){if(error.code==='EEXIST')throw new Error('Another upgrade owns the upgrade lock');throw error;}
  let backupRoot,step='backup',cleanupUncertain=false;
  try{
    await handle.writeFile(owner);await handle.close();handle=null;
    const backup=await createApplicationBackup(root,{name:'upgrade-'+owner});backupRoot=backup.backupRoot;
    onProgress('Verified private backup: '+backupRoot+'\n');
    const runner=run??(args=>runUpgradeCommand(root,args,onProgress,signal));
    // Compilation tools are needed even when a production service launches
    // maintenance. npm ci installs devDependencies unless omitted explicitly.
    // Bun için kilit dosyası depoda tutulmaz; donmuş kurulum yalnız npm içindir.
    const frozen=selectManager({env:process.env,root})!=='bun';
    for(const [name,args]of [['install',{type:'install',frozen}],['build',{type:'run',script:'build'}],['migrate',{type:'run',workspace:'server',script:'db:deploy'}],['status',{type:'run',workspace:'server',script:'db:status'}]]){
      if(signal?.aborted)throw new Error('Upgrade cancelled');
      step=name;onProgress('Upgrade step: '+step+'\n');await runner(args);
    }
    return {projectRoot:root,backupRoot,status:'completed',restartRequired:true};
  }catch(error){
    cleanupUncertain=error.cleanupUncertain===true;
    const failure=new Error(`Upgrade failed at ${step}; ${backupRoot?'recovery backup: '+backupRoot:'no verified backup created'}. ${error.message}`);
    failure.backupRoot=backupRoot;failure.step=step;failure.cleanupUncertain=cleanupUncertain;throw failure;
  }finally{
    if(handle)await handle.close();
    if(!cleanupUncertain&&fs.existsSync(lock)&&await fsp.readFile(lock,'utf8')===owner)await fsp.unlink(lock);
  }
}
