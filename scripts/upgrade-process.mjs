import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// A pipe held by the launcher is a lifetime lease. Its EOF also covers a
// parent-only hard termination, where JavaScript signal handlers cannot run.
export function runSupervisedCommand(command,args,{cwd,env,onProgress=()=>{},signal,spawnProcess=spawn}={}){
  if(signal?.aborted)return Promise.reject(new Error('Upgrade cancelled'));
  return new Promise((resolve,reject)=>{
    const supervisor=spawnProcess(process.execPath,[fileURLToPath(new URL('./upgrade-process-supervisor.mjs',import.meta.url)),JSON.stringify({command,args})],{cwd,env,windowsHide:true,stdio:['pipe','pipe','pipe']});
    const cancel=()=>supervisor.stdin.end('cancel\n');
    supervisor.stdin.on('error',()=>{});
    signal?.addEventListener('abort',cancel,{once:true});
    supervisor.stdout.on('data',chunk=>onProgress(chunk.toString()));
    supervisor.stderr.on('data',chunk=>onProgress(chunk.toString()));
    supervisor.once('error',reject);
    supervisor.once('close',(code,exitSignal)=>{
      signal?.removeEventListener('abort',cancel);
      if(code===0&&!signal?.aborted)resolve();
      else {
        const cleanupUncertain=code===3||code===null||Boolean(exitSignal);
        const error=new Error(cleanupUncertain?'Owned command cleanup could not be verified':signal?.aborted?'Upgrade cancelled':`Command failed (${code}): ${args.join(' ')}`);
        error.cleanupUncertain=cleanupUncertain;reject(error);
      }
    });
  });
}
