const usage=`Offline QuizMaster maintenance (stop the application first):
  node scripts/maintenance.mjs backup --project <project> [--name <backup-name>]
  node scripts/maintenance.mjs restore --backup <backup-directory> --project <empty-data-project>
Backups contain private configuration. Keep them outside public storage.
`;
const args=process.argv.slice(2);
if(!args.length||args[0]==='--help'){
  process.stdout.write(usage);
}else{
  try{
    const action=args.shift(),options={};
    if(!['backup','restore'].includes(action))throw new Error('Use backup or restore');
    while(args.length){
      const flag=args.shift(),value=args.shift();
      if(!['--project','--backup','--name'].includes(flag)||!value||value.startsWith('--')||Object.hasOwn(options,flag))throw new Error('Invalid maintenance arguments');
      options[flag]=value;
    }
    if(!options['--project'])throw new Error('An explicit --project is required');
    if(action==='restore'&&!options['--backup'])throw new Error('An explicit --backup is required');
    if(action==='backup'&&options['--backup']||action==='restore'&&options['--name'])throw new Error('Unsupported maintenance argument');
    const {createApplicationBackup,restoreApplicationBackup}=await import('./maintenance-lib.mjs');
    const result=action==='backup'?await createApplicationBackup(options['--project'],{name:options['--name']}):await restoreApplicationBackup(options['--backup'],options['--project']);
    process.stdout.write(JSON.stringify(result)+'\n');
  }catch(error){
    process.stderr.write('Maintenance failed: '+error.message+'\n');
    process.exitCode=2;
  }
}
