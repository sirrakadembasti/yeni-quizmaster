import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import {spawn} from 'node:child_process';
import test from 'node:test';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {runSupervisedCommand} from './upgrade-process.mjs';

test('unexpected supervisor termination reports uncertain cleanup to retain the upgrade lock',async()=>{
 const spawnProcess=()=>{const child=new EventEmitter();child.stdin=new PassThrough();child.stdout=new PassThrough();child.stderr=new PassThrough();setImmediate(()=>child.emit('close',null,'SIGKILL'));return child;};
 await assert.rejects(runSupervisedCommand('controlled-absent-command',[],{spawnProcess}),error=>error.cleanupUncertain===true);
});

test('parent-only termination stops an active upgrade descendant',{timeout:20000},async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'quizmaster-upgrade-stop-'));
  t.after(async()=>{assert.equal(path.dirname(root),os.tmpdir());assert.match(path.basename(root),/^quizmaster-upgrade-stop-/);await fs.rm(root,{recursive:true,force:true});});
  const proof=path.join(root,'port.txt'),payload=path.join(root,'payload.cjs');
  await fs.writeFile(payload,`const {spawn}=require('node:child_process');spawn(process.execPath,['-e',"const s=require('node:net').createServer();s.listen(0,'127.0.0.1',()=>require('node:fs').writeFileSync(process.argv[1],String(s.address().port)))",process.argv[2]],{stdio:'inherit'});setInterval(()=>{},1000);`);
  const helper=new URL('./upgrade-process.mjs',import.meta.url).href;
  const parent=spawn(process.execPath,['--input-type=module','-e',`import {runSupervisedCommand} from ${JSON.stringify(helper)};await runSupervisedCommand(process.execPath,${JSON.stringify([payload,proof])},{cwd:${JSON.stringify(root)},env:process.env});`],{windowsHide:true,stdio:['ignore','ignore','pipe']});
  let errors='';parent.stderr.on('data',data=>errors+=data);
  const deadline=Date.now()+10000;
  while(Date.now()<deadline){if(parent.exitCode!==null)assert.fail('Parent exited before descendant ready: '+errors);try{await fs.stat(proof);break;}catch{}await new Promise(resolve=>setTimeout(resolve,50));}
  assert.ok(await fs.stat(proof),'Descendant did not open its isolated port');
  const port=Number(await fs.readFile(proof,'utf8'));
  const closed=new Promise(resolve=>parent.once('close',resolve));parent.kill('SIGTERM');await closed;
  const open=()=>new Promise(resolve=>{const socket=net.connect({host:'127.0.0.1',port});socket.on('connect',()=>{socket.destroy();resolve(true);});socket.on('error',()=>resolve(false));});
  while(Date.now()<deadline&&await open())await new Promise(resolve=>setTimeout(resolve,50));
  assert.equal(await open(),false,'Upgrade descendant survived its parent');
});
