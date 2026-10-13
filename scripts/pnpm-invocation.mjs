import fs from 'node:fs';
import path from 'node:path';

// Avoid cmd.exe: project paths are data, including spaces and shell operators.
export function pnpmInvocation(args,{platform=process.platform,env=process.env}={}){
  const inherited=env.npm_execpath;
  if(inherited&&/^pnpm\.(?:c?js|mjs)$/i.test(path.basename(inherited))&&fs.existsSync(inherited))
    return {command:process.execPath,args:[inherited,...args]};
  const searchPath=Object.entries(env).find(([key])=>key.toUpperCase()==='PATH')?.[1]||'';
  for(const directory of searchPath.split(platform==='win32'?';':':').filter(Boolean)){
    for(const relative of ['node_modules/pnpm/bin/pnpm.cjs','node_modules/corepack/dist/pnpm.js','pnpm.cjs']){
      const entry=path.resolve(directory,relative);
      if(fs.existsSync(entry)&&fs.statSync(entry).isFile())return {command:process.execPath,args:[entry,...args]};
    }
  }
  if(platform==='win32')throw new Error('pnpm Node entry could not be resolved; install the supported pnpm runtime');
  return {command:'pnpm',args};
}
