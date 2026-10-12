import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {createVerifiedBackup,getSetupPaths} from './setup-bootstrap-lib.mjs';

test('full application backup preserves annual archive package files',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'quizmaster-maintenance-'));
  t.after(()=>{
    const canonical=fs.realpathSync(root);
    if(path.dirname(canonical)!==fs.realpathSync(os.tmpdir())||!path.basename(canonical).startsWith('quizmaster-maintenance-'))throw new Error('Unsafe cleanup');
    fs.rmSync(canonical,{recursive:true,force:true});
  });
  const paths=getSetupPaths(root);
  const archive=path.join(paths.dataRoot,'backups','2025-2026','synthetic-snapshot');
  fs.mkdirSync(archive,{recursive:true});
  // This case checks file coverage only; DB validity is tested separately.
  fs.writeFileSync(paths.quizDb,'synthetic database placeholder');
  fs.writeFileSync(path.join(archive,'archive.zip'),'synthetic frozen package');
  const result=createVerifiedBackup(root,'coverage');
  const preserved=path.join(result.backupRoot,'server/data/backups/2025-2026/synthetic-snapshot/archive.zip');
  assert.equal(fs.existsSync(preserved),true,'Academic ZIP must be part of the full application backup');
  assert.equal(fs.readFileSync(preserved,'utf8'),'synthetic frozen package');
});
