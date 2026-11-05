import {mkdtempSync,readFileSync,writeFileSync,rmSync,mkdirSync,realpathSync} from 'node:fs';
import {basename,dirname,join,relative,resolve} from 'node:path';
import {expect,it} from 'vitest';
import {isolateTestDatabase} from './test-database-isolation';

it('gives each test file an independent copy without changing the pristine template',()=>{
  const root=realpathSync(resolve(import.meta.dirname,'../../data'));
  const owned=mkdtempSync(join(root,'quizmaster-test-isolation-'));
  try{
    const template=join(owned,'migration-template.db');
    writeFileSync(template,'pristine fixture');
    const first=isolateTestDatabase(template).slice(5);
    const second=isolateTestDatabase(template).slice(5);
    expect(first).not.toBe(second);
    writeFileSync(first,'changed by file one');
    expect(readFileSync(second,'utf8')).toBe('pristine fixture');
    expect(readFileSync(template,'utf8')).toBe('pristine fixture');
    expect(dirname(resolve(first))).toBe(owned);
  }finally{
    if(dirname(owned)!==root||!basename(owned).startsWith('quizmaster-test-isolation-'))throw new Error('Unsafe cleanup');
    rmSync(owned,{recursive:true,force:true});
  }
});

it('rejects live filenames and nested directories instead of copying them',()=>{
  const root=realpathSync(resolve(import.meta.dirname,'../../data'));
  const owned=mkdtempSync(join(root,'quizmaster-test-isolation-'));
  try{
    const liveName=join(owned,'quiz.db');
    writeFileSync(liveName,'synthetic only');
    expect(()=>isolateTestDatabase(liveName)).toThrow('Only an owned');
    const nested=join(owned,'quizmaster-test-nested');
    mkdirSync(nested);
    const template=join(nested,'migration-template.db');
    writeFileSync(template,'synthetic only');
    expect(()=>isolateTestDatabase(template)).toThrow('Only an owned');
    expect(relative(root,owned)).not.toContain('..');
  }finally{
    if(dirname(owned)!==root||!basename(owned).startsWith('quizmaster-test-isolation-'))throw new Error('Unsafe cleanup');
    rmSync(owned,{recursive:true,force:true});
  }
});
