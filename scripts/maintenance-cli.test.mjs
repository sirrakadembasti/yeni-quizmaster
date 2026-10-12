import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
const script=fileURLToPath(new URL('./maintenance.mjs',import.meta.url));
test('maintenance CLI explains explicit offline backup and restore commands',()=>{
  const result=spawnSync(process.execPath,[script,'--help'],{encoding:'utf8',windowsHide:true});
  assert.equal(result.status,0);
  assert.match(result.stdout,/backup --project/);
  assert.match(result.stdout,/restore --backup/);
});
test('maintenance CLI rejects a missing explicit project without touching data',()=>{
  const result=spawnSync(process.execPath,[script,'backup'],{encoding:'utf8',windowsHide:true});
  assert.equal(result.status,2);
  assert.match(result.stderr,/--project/);
});
