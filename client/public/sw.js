const APP_BASE = new URL(self.registration.scope).pathname.replace(/\/$/, '') || '';
const CACHE_NAME = `quiz-master-app-v3:${APP_BASE || '/'}`;
const APP_HOME = `${APP_BASE}/`;
const APP_INDEX = `${APP_BASE}/index.html`;
const SHELL_MANIFEST = `${APP_BASE}/app-shell-assets.json`;
const ownedAsset = value => {
  const url = new URL(value, self.location.origin);
  return url.origin === self.location.origin && !url.search && !url.hash &&
    url.pathname.startsWith(`${APP_BASE}/assets/`) && /\/[A-Za-z0-9_.-]+\.(?:js|css)$/.test(url.pathname);
};
async function shellAssets() {
  const response=await fetch(SHELL_MANIFEST,{cache:'no-store',redirect:'error'});
  if(!response.ok)throw Error('Public app shell manifest unavailable');
  const manifest=await response.json();
  if(manifest.version!==1||!Array.isArray(manifest.assets)||!manifest.assets.length||manifest.assets.length>100||!manifest.assets.every(ownedAsset))throw Error('Invalid public app shell assets');
  return [...new Set(manifest.assets)];
}
async function prepareShell() {
  const assets=await shellAssets(),cache=await caches.open(CACHE_NAME);
  const publicRequest=url=>new Request(url,{redirect:'error',credentials:'omit',mode:'same-origin'});
  const read=async(url,kind)=>{
    const request=publicRequest(url),response=await fetch(request);
    const type=(response.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
    const expected=kind==='html'?['text/html']:kind==='css'?['text/css']:['application/javascript','text/javascript','application/ecmascript','text/ecmascript'];
    if(!response.ok||response.redirected||!expected.includes(type))throw Error('Public app shell asset type mismatch');
    const text=(await response.clone().text()).trim();
    if(!text||(kind!=='html'&&/^<(?:!doctype|html)/i.test(text)))throw Error('Public app shell asset body mismatch');
    return [request,response];
  };
  // Verify every asset before touching a previous good HTML entry. Missing
  // hashed files can be served as SPA HTML200; those are never offline-ready JS.
  const verifiedAssets=await Promise.all(assets.map(asset=>read(asset,asset.endsWith('.css')?'css':'js')));
  const verifiedHtml=await Promise.all([APP_HOME,APP_INDEX].map(url=>read(url,'html')));
  for(const [request,response] of verifiedAssets)await cache.put(request,response);
  for(const [request,response] of verifiedHtml)await cache.put(request,response);
  return (await Promise.all(assets.map(asset=>cache.match(asset)))).every(Boolean);
}

self.addEventListener('install', event => {
  event.waitUntil(prepareShell().then(()=>self.skipWaiting()));
});

self.addEventListener('activate', event => {
  // Legacy v1/v2 names were shared by every base path. Leave them untouched
  // and unused; this worker reads/writes only its own v3 base namespace.
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message',event=>{
  if(event.data?.type!=='QUIZMASTER_SHELL_READY'||!event.ports[0])return;
  event.waitUntil(prepareShell().then(ready=>event.ports[0].postMessage({ready})).catch(()=>event.ports[0].postMessage({ready:false})));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/')) return;
  if (request.mode === 'navigate') {
    if(!url.pathname.startsWith(APP_HOME))return;
    event.respondWith(fetch(request).catch(() => caches.open(CACHE_NAME).then(cache=>cache.match(APP_INDEX))));
    return;
  }
  if(!ownedAsset(url.href))return;
  // Global CORS adds Vary: Origin. Module/CSS requests carry Origin while our
  // credential-free precache does not. These exact owned public hashed assets
  // are immutable and already MIME/body validated; private requests never reach
  // this branch, so their cache policy is unaffected.
  event.respondWith(caches.open(CACHE_NAME).then(cache=>cache.match(request,{ignoreVary:true})).then(cached=>cached||fetch(request)));
});
