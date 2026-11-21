const usage=`Offline QuizMaster maintenance (stop the application first):
  node scripts/maintenance.mjs backup --project <project> [--name <backup-name>]
  node scripts/maintenance.mjs restore --backup <backup-directory> --project <empty-data-project>
  node scripts/maintenance.mjs restore-auto --auto-backup <server/backups/auto-directory> --project <empty-data-project> [--date <YYYYMMDD>]
restore-auto only restores the database and uploads; .env, ai-encryption.key and installation.lock are not part of automatic backups.
Backups contain private configuration. Keep them outside public storage.
`;
const args=process.argv.slice(2);
if(!args.length||args[0]==='--help'){
  process.stdout.write(usage);
}else{
  try{
    const action=args.shift(),options={};
    if(!['backup','restore','restore-auto'].includes(action))throw new Error('Use backup, restore or restore-auto');
    while(args.length){
      const flag=args.shift(),value=args.shift();
      if(!['--project','--backup','--name','--auto-backup','--date'].includes(flag)||!value||value.startsWith('--')||Object.hasOwn(options,flag))throw new Error('Invalid maintenance arguments');
      options[flag]=value;
    }
    if(!options['--project'])throw new Error('An explicit --project is required');
    if(action==='restore'&&!options['--backup'])throw new Error('An explicit --backup is required');
    if(action==='restore-auto'&&!options['--auto-backup'])throw new Error('An explicit --auto-backup is required');
    if(action==='backup'&&options['--backup']||action==='restore'&&options['--name'])throw new Error('Unsupported maintenance argument');
    if(action!=='restore-auto'&&(options['--auto-backup']||options['--date'])||action==='restore-auto'&&(options['--backup']||options['--name']))throw new Error('Unsupported maintenance argument');
    const {createApplicationBackup,restoreApplicationBackup,restoreAutoBackup}=await import('./maintenance-lib.mjs');
    const result=action==='backup'?await createApplicationBackup(options['--project'],{name:options['--name']})
      :action==='restore'?await restoreApplicationBackup(options['--backup'],options['--project'])
      :await restoreAutoBackup(options['--auto-backup'],options['--project'],{date:options['--date']});
    process.stdout.write(JSON.stringify(result)+'\n');
  }catch(error){
    process.stderr.write('Maintenance failed: '+error.message+'\n');
    process.exitCode=2;
  }
}
