import fs from 'node:fs';
import path from 'node:path';

export function noLinks(target) {
  const resolved = path.resolve(target);
  let current = path.parse(resolved).root;
  for (const part of path.relative(current, resolved).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    try { if (fs.lstatSync(current).isSymbolicLink()) throw Error('Linked path rejected'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return resolved;
}
export function ownedFile(root, relative, mustExist = false) {
  noLinks(root);
  if (!relative || path.isAbsolute(relative) || relative.includes('\\') || relative.split('/').some(p => !p || p === '.' || p === '..')) throw Error('Unsafe relative path');
  const file = noLinks(path.join(root, relative));
  if (!file.startsWith(path.resolve(root) + path.sep)) throw Error('Escaped root');
  if (fs.existsSync(file)) { if (!fs.lstatSync(file).isFile()) throw Error('Regular file required'); }
  else if (mustExist) throw Error('Missing file');
  return file;
}
export function exclusiveJson(root, name, value) {
  fs.writeFileSync(ownedFile(root, name), JSON.stringify(value, null, 2), {flag:'wx', mode:0o600});
}

export function readPerformanceRuntime(repo, file, {runId, requireDatabase=true}={}) {
  const canonicalRepo=noLinks(repo),runtimeFile=noLinks(file),root=path.dirname(runtimeFile);
  if(path.basename(runtimeFile)!=='runtime.json'||path.dirname(root)!==path.join(canonicalRepo,'server/data')||!/^quizmaster-test-academic-performance-[a-zA-Z0-9]+$/.test(path.basename(root)))throw Error('Runtime root rejected');
  ownedFile(root,'runtime.json',true);
  const runtime=JSON.parse(fs.readFileSync(runtimeFile,'utf8'));
  if(runtime.root!==root||runtime.database!==path.join(root,'server/data/academic.db')||typeof runtime.runId!=='string'||(runId!==undefined&&runtime.runId!==runId))throw Error('Runtime identity rejected');
  for(const relative of ['.env','server/.env'])ownedFile(root,relative,true);
  ownedFile(root,'server/data/academic.db',requireDatabase);
  return runtime;
}
