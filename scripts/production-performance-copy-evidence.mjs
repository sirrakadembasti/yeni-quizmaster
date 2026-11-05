import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {noLinks,ownedFile,exclusiveJson} from './production-performance-guard.mjs';
const repo=path.resolve(import.meta.dirname,'..'),main=noLinks(process.argv[2]);
if(!path.basename(repo).startsWith('quizmaster-test-performance-'))throw Error('Native source export required');
const relative='.superpowers/sdd/2026-10-06-production-rehearsal-plan';
const source=noLinks(path.join(repo,relative,'task4-private')),base=noLinks(path.join(main,relative));
if(process.argv[3]){
 const relativeProof=process.argv[3];if(!/^task4-native-[a-f0-9-]+\/archive-[a-f0-9-]+$/.test(relativeProof))throw Error('PDF proof root rejected');
 const from=noLinks(path.join(base,relativeProof)),destination=noLinks(path.join(source,path.basename(from)));
 if(!fs.statSync(from).isDirectory()||!fs.statSync(destination).isDirectory())throw Error('Owned PDF proof directories required');
 for(const name of ['archive-pdf-first-page.png','archive-pdf-diagram-page.png','pdf-render-proof.json','pdf-visual-proof.json']){
   const input=ownedFile(from,name,true),output=ownedFile(destination,name);if(fs.existsSync(output))throw Error('PDF proof destination exists');
   fs.copyFileSync(input,output,fs.constants.COPYFILE_EXCL);fs.chmodSync(output,0o600);
 }
}
const target=noLinks(path.join(base,'task4-native-'+crypto.randomUUID()));fs.mkdirSync(target,{mode:0o700});
const files=[];
function copy(directory,destination){for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
 if(entry.isSymbolicLink())throw Error('Linked evidence rejected');
 const from=noLinks(path.join(directory,entry.name)),to=noLinks(path.join(destination,entry.name));
 if(entry.isDirectory()){fs.mkdirSync(to,{mode:0o700});copy(from,to);}
 else if(entry.isFile()){if(fs.existsSync(to))throw Error('Evidence destination exists');fs.copyFileSync(from,to,fs.constants.COPYFILE_EXCL);fs.chmodSync(to,0o600);files.push(path.relative(target,to));}
 else throw Error('Nonregular evidence rejected');
}}
copy(source,target);exclusiveJson(target,'copy-proof.json',{source,target,files,protectedSourceExcluded:true});
const testCounts=[];
for(const file of fs.readdirSync(source).filter(file=>file.endsWith('.log'))){
 const raw=fs.readFileSync(ownedFile(source,file,true),'utf8').replace(/\u001b\[[0-9;]*m/g,''),counts=raw.split('\n').filter(line=>/^\s*(?:Test Files\s+\d|Tests\s+\d|# tests \d|# pass \d|# fail \d)/.test(line));
 if(!counts.length)continue;const commandFile=ownedFile(source,file.slice(0,-4)+'.json');const command=fs.existsSync(commandFile)?JSON.parse(fs.readFileSync(commandFile,'utf8')):null;
 testCounts.push({label:file.slice(0,-4),counts,code:command?.code,elapsedMs:command?.elapsedMs,stopped:command?.cleanup?.stopped});
}
exclusiveJson(target,'test-counts.json',{testCounts});
console.log(JSON.stringify({target,files:files.length,screenshots:files.filter(f=>f.endsWith('.png'))}));
