import {getOfflineSession,getOfflineUser,offlineIdentityGeneration,offlineEntry,reconcileOfflineSession,savePreparedOfflineSession,type OfflineQuizSession} from './offline-quiz';
import {ensureOfflineShell} from './offline-shell';
const IMAGE_LIMIT=768*1024,SESSION_LIMIT=2*1024*1024;
const failure=()=>new Error('Soru görseli çevrimdışı kullanım için hazırlanamadı. Bağlantıyı ve görsel boyutunu kontrol edip yeniden deneyin.');
function mimeOf(bytes:Uint8Array) {
  if(bytes.length>=24&&[137,80,78,71,13,10,26,10].every((b,n)=>bytes[n]===b))return 'image/png';
  if(bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
  if(bytes.length>=12&&String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP')return 'image/webp';
  throw failure();
}
async function privateImage(source:string,signal:AbortSignal):Promise<string> {
  let bytes:Uint8Array,mime:string;
  if(source.startsWith('data:')) {
    const match=/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]*={0,2})$/.exec(source);
    if(!match||match[2].length>Math.ceil(IMAGE_LIMIT/3)*4)throw failure();
    try {bytes=Uint8Array.from(atob(match[2]),c=>c.charCodeAt(0));}catch{throw failure();}
    mime=match[1];
  } else {
    let url:URL;try{url=new URL(source,window.location.origin);}catch{throw failure();}
    const base=import.meta.env.BASE_URL;
    const allowed=[`/uploads/`,`${base}uploads/`];
    if(url.origin!==window.location.origin||url.username||url.password||url.search||url.hash||!allowed.some(prefix=>url.pathname.startsWith(prefix))||!/^https?:$/.test(url.protocol)||!/^.+\.(?:png|jpe?g|webp)$/i.test(url.pathname))throw failure();
    const controller=new AbortController(),abort=()=>controller.abort();signal.addEventListener('abort',abort,{once:true});
    const timer=setTimeout(abort,12000);
    try {
      const response=await fetch(url.href,{credentials:'same-origin',redirect:'error',signal:controller.signal});
      mime=(response.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
      if(!response.ok||!['image/png','image/jpeg','image/webp'].includes(mime)||Number(response.headers.get('content-length')||0)>IMAGE_LIMIT)throw failure();
      const reader=response.body?.getReader();if(!reader)throw failure();const chunks:Uint8Array[]=[];let size=0;
      try {while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>IMAGE_LIMIT){await reader.cancel();throw failure();}chunks.push(value);}}
      finally{reader.releaseLock();}
      bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    }catch{throw failure();}finally{clearTimeout(timer);signal.removeEventListener('abort',abort);}
  }
  if(signal.aborted||bytes.length>IMAGE_LIMIT||mimeOf(bytes)!==mime)throw failure();
  if(typeof createImageBitmap==='function') {
    const image=await createImageBitmap(new Blob([bytes as BlobPart],{type:mime})).catch(()=>{throw failure();});
    const valid=image.width>0&&image.height>0;image.close();if(!valid)throw failure();
  }
  let binary='';for(let n=0;n<bytes.length;n+=16384)binary+=String.fromCharCode(...bytes.slice(n,n+16384));
  return `data:${mime};base64,${btoa(binary)}`;
}
export async function prepareOfflineSession(server:OfflineQuizSession,{signal,ensureShell=ensureOfflineShell}:{signal:AbortSignal;ensureShell?:()=>Promise<void>}) {
  const generation=offlineIdentityGeneration();
  const current=()=>{if(signal.aborted||generation!==offlineIdentityGeneration()||getOfflineUser()?.id!==server.userId)throw Error('Çevrimdışı hazırlama iptal edildi.');};
  current();await ensureShell();current();
  const questions=[];
  for(const question of server.questions) {
    current();const source=question.imageUrl;
    questions.push(source?{...question,imageUrl:await privateImage(source,signal),offlineImageSource:source}:question);
  }
  current();
  // Image and shell work is asynchronous. Re-read just before the synchronous
  // write so newer local answer revisions/submission cannot be overwritten.
  const prepared=reconcileOfflineSession({...server,questions,offlinePrepared:true,offlineEntry},getOfflineSession(server.userId,server.quizId));
  // Two MiB of JSON keeps base64/UTF16 expansion below typical browser quotas.
  if(JSON.stringify(prepared).length>SESSION_LIMIT)throw failure();
  current();savePreparedOfflineSession(prepared);return prepared;
}
