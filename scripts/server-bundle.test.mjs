import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildServer } from './build-server.mjs';

test('root production bundle resolves external server dependencies after relocation and from another cwd', async t => {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'quizmaster-bundle-'));
  t.after(()=>{const resolved=fs.realpathSync(root);assert.equal(path.dirname(resolved),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(resolved).startsWith('quizmaster-bundle-'));fs.rmSync(resolved,{recursive:true,force:true});});
  const source=path.join(root,'source'),target=path.join(root,'relocated');
  fs.mkdirSync(path.join(source,'server/node_modules/@prisma/client'),{recursive:true});
  fs.writeFileSync(path.join(source,'server/package.json'),'{}');
  fs.writeFileSync(path.join(source,'server/node_modules/@prisma/client/index.js'),'exports.identity="server-dependency"');
  fs.writeFileSync(path.join(source,'server/index.ts'),'import {identity} from "@prisma/client"; console.log(identity)');
  await buildServer(source);
  fs.renameSync(source,target);
  const result=spawnSync(process.execPath,[path.join(target,'dist/index.cjs')],{cwd:root,encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);assert.equal(result.stdout.trim(),'server-dependency');
});
