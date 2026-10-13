import {spawn} from 'node:child_process';
const {command,args}=JSON.parse(process.argv[2]);
const windows=process.platform==='win32';
let cancelling=false,closed=false;
const child=spawn(command,args,{cwd:process.cwd(),env:process.env,detached:!windows,windowsHide:true,stdio:['ignore','inherit','inherit']});
const finished=new Promise(resolve=>{
  child.once('error',()=>{closed=true;resolve(2);});
  child.once('close',code=>{closed=true;resolve(code??2);});
});
async function cancel(){
  if(cancelling||closed)return;
  cancelling=true;
  if(windows){
    // PID belongs to our still-live child; never enumerate unrelated processes.
    const killer=spawn('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});
    const killed=await new Promise(resolve=>{killer.once('error',()=>resolve(false));killer.once('close',code=>resolve(code===0));});
    if(!killed){console.error('Owned upgrade process tree could not be stopped');process.exit(3);}
  }else{
    try{process.kill(-child.pid,'SIGTERM');}catch(error){if(error.code!=='ESRCH')throw error;}
    await new Promise(resolve=>setTimeout(resolve,500));
    try{process.kill(-child.pid,'SIGKILL');}catch(error){if(error.code!=='ESRCH')throw error;}
  }
  await finished;
  process.exit(2);
}
process.stdin.resume();
process.stdin.on('data',()=>cancel().catch(()=>process.exit(3)));
process.stdin.once('end',()=>cancel().catch(()=>process.exit(3)));
process.once('SIGINT',()=>cancel().catch(()=>process.exit(3)));
process.once('SIGTERM',()=>cancel().catch(()=>process.exit(3)));
const code=await finished;
if(!cancelling)process.exit(code);
