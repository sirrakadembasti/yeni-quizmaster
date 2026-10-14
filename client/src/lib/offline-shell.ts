export async function ensureOfflineShell():Promise<void> {
  if(!('serviceWorker' in navigator)||!window.isSecureContext)throw Error('Bu bağlantıda çevrimdışı hazırlama kullanılamıyor. Güvenli bağlantıda yeniden deneyin.');
  let timer:ReturnType<typeof setTimeout>;
  const timeout=new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('Çevrimdışı uygulama hazırlanamadı. Bağlantıyı kontrol edip yeniden deneyin.')),15000);});
  try {await Promise.race([(async()=>{
    const registration=await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`,{scope:import.meta.env.BASE_URL});
    await registration.update();
    const worker=registration.installing??registration.waiting??registration.active;
    if(!worker)throw Error('Çevrimdışı uygulama başlatılamadı.');
    if(worker.state!=='activated')await new Promise<void>((resolve,reject)=>{const changed=()=>{if(worker.state==='activated'){worker.removeEventListener('statechange',changed);resolve();}else if(worker.state==='redundant'){worker.removeEventListener('statechange',changed);reject(Error('Çevrimdışı uygulama güncellenemedi.'));}};worker.addEventListener('statechange',changed);changed();});
    await new Promise<void>((resolve,reject)=>{const channel=new MessageChannel();channel.port1.onmessage=event=>{channel.port1.close();if(event.data?.ready===true)resolve();else reject(Error('Çevrimdışı uygulama hazırlanamadı. Yeniden deneyin.'));};worker.postMessage({type:'QUIZMASTER_SHELL_READY'},[channel.port2]);});
  })(),timeout]);}finally{clearTimeout(timer!);}
}
