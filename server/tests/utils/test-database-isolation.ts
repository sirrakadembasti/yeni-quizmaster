import {constants,copyFileSync,lstatSync,realpathSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {basename,dirname,isAbsolute,join,relative,resolve} from 'node:path';

export function isolateTestDatabase(template:string):string {
  const dataRoot=realpathSync(resolve(import.meta.dirname,'../../data'));
  const source=resolve(template),directory=realpathSync(dirname(source));
  const child=relative(dataRoot,directory);
  if(!child||child.startsWith('..')||isAbsolute(child)||dirname(child)!=='.'||
    !basename(directory).startsWith('quizmaster-test-')||basename(source)!=='migration-template.db'||
    !lstatSync(source).isFile()||lstatSync(source).isSymbolicLink()){
    throw new Error('Only an owned pristine test template may be copied');
  }
  const target=join(directory,'file-'+randomUUID()+'.db');
  copyFileSync(source,target,constants.COPYFILE_EXCL);
  return 'file:'+target.split('\\').join('/');
}
