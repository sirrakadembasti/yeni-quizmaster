import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ownedFile, exclusiveJson} from './production-performance-guard.mjs';
test('rejects escaped, linked and existing evidence destinations without changing sentinels', () => {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'quizmaster-performance-guard-'));
  try {
    for(const name of ['../sentinel','a/../../sentinel','a\\sentinel','/absolute']) assert.throws(()=>ownedFile(root,name));
    exclusiveJson(root,'sentinel.json',{sentinel:true});
    assert.throws(()=>exclusiveJson(root,'sentinel.json',{}));
    const link=path.join(root,'link');fs.symlinkSync(root,link,process.platform==='win32'?'junction':'dir');
    assert.throws(()=>ownedFile(root,'link/sentinel.json',true));
    assert.equal(fs.readFileSync(path.join(root,'sentinel.json'),'utf8'),JSON.stringify({sentinel:true},null,2));
    fs.unlinkSync(link);
  } finally { fs.rmSync(root,{recursive:true,force:true}); }
});
