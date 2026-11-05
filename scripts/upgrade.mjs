const args=process.argv.slice(2);
if(args.length===0||args[0]==='--help'){
  console.log('Offline upgrade: node scripts/upgrade.mjs --project <installed-project>\nSupply approved release code and stop application/worker processes first.\nA verified private backup precedes frozen install, build and migrations.');
}else{
  try{
    const parentLease=args.length===3&&args[2]==='--parent-lease';
    if((args.length!==2&&!parentLease)||args[0]!=='--project'||!args[1]||args[1].startsWith('--'))throw new Error('An explicit --project is required');
    const {upgradeApplication}=await import('./upgrade-lib.mjs');
    const controller=new AbortController();
    const cancel=()=>{console.error('Upgrade cancellation requested; stopping the active command.');controller.abort();};
    process.once('SIGINT',cancel);process.once('SIGTERM',cancel);
    // Bootstrap owns this pipe; EOF asks this CLI to stop its single command
    // supervisor before releasing the operation lock. No nested process groups.
    if(parentLease){process.stdin.resume();for(const event of ['data','end','close','error'])process.stdin.once(event,cancel);}
    try{console.log(JSON.stringify(await upgradeApplication(args[1],{signal:controller.signal,onProgress:message=>process.stdout.write(message)})));}
    finally{process.removeListener('SIGINT',cancel);process.removeListener('SIGTERM',cancel);if(parentLease){for(const event of ['data','end','close','error'])process.stdin.removeListener(event,cancel);process.stdin.pause();}}
  }catch(error){console.error(error.message);process.exitCode=2;}
}
