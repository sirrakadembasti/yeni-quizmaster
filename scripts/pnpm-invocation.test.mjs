import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {pnpmInvocation} from './pnpm-invocation.mjs';

test('Windows pnpm runs through Node and preserves shell metacharacters as arguments',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'quizmaster-pnpm-test-'));
  t.after(()=>{assert.equal(path.dirname(root),os.tmpdir());assert.match(path.basename(root),/^quizmaster-pnpm-test-/);fs.rmSync(root,{recursive:true,force:true});});
  const entry=path.join(root,'node_modules/pnpm/bin/pnpm.cjs');
  fs.mkdirSync(path.dirname(entry),{recursive:true});fs.writeFileSync(entry,'');
  const args=['run','upgrade','--project','F:\\quiz&master'];
  const invocation=pnpmInvocation(args,{platform:'win32',env:{PATH:root,npm_execpath:path.join(root,'npm-cli.js')}});
  assert.deepEqual(invocation,{command:process.execPath,args:[entry,...args]});
});
test('Windows fails safely when no pnpm Node entry can be resolved',()=>{
  assert.throws(()=>pnpmInvocation(['--version'],{platform:'win32',env:{PATH:'',npm_execpath:'npm-cli.js'}}),/pnpm/i);
});
