import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';
import { request } from 'node:https';

const blocked = new BlockList();
for (const [address, prefix] of [
  ['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],
  ['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.0.2.0',24],
  ['192.168.0.0',16],['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],
  ['224.0.0.0',4],['240.0.0.0',4],
] as const) blocked.addSubnet(address,prefix,'ipv4');
const globalV6 = new BlockList(); globalV6.addSubnet('2000::',3,'ipv6');
blocked.addSubnet('2001::',23,'ipv6'); blocked.addSubnet('2001:db8::',32,'ipv6');
blocked.addSubnet('2002::',16,'ipv6');

export function isPublicAddress(address: string) {
  const family = isIP(address);
  return family === 4 ? !blocked.check(address,'ipv4') :
    family === 6 && globalV6.check(address,'ipv6') && !blocked.check(address,'ipv6');
}
export function isSafeUrl(value: string) {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^\[|\]$/g,'').replace(/\.$/,'').toLowerCase();
    if (url.protocol !== 'https:' || url.username || url.password || !host || host === 'localhost' || host.endsWith('.localhost') || !host.includes('.') && !isIP(host)) return false;
    return !isIP(host) || isPublicAddress(host);
  } catch { return false; }
}

// Resolve once, validate every answer, and pin the connection to that address.
// HTTPS still verifies the original hostname. Redirects never forward credentials.
export async function safeExternalFetch(value: string, options: RequestInit = {}): Promise<Response> {
  if (!isSafeUrl(value)) throw new Error('UNSAFE_EXTERNAL_URL');
  const url = new URL(value);
  const host = url.hostname.replace(/^\[|\]$/g,'');
  const addresses = isIP(host) ? [{address:host,family:isIP(host)}] : await lookup(host,{all:true});
  if (!addresses.length || addresses.some(a=>!isPublicAddress(a.address))) throw new Error('UNSAFE_EXTERNAL_URL');
  const target = addresses[0];
  return new Promise((resolve,reject)=>{
    const req = request(url,{
      method: options.method || 'GET', headers: Object.fromEntries(new Headers(options.headers).entries()),
      agent: false, signal: options.signal || undefined,
      lookup: ((_host: string, settings: any, callback: any) => settings?.all
        ? callback(null,[target]) : callback(null,target.address,target.family)) as any,
    },res=>{
      if ((res.statusCode || 0) >= 300 && (res.statusCode || 0) < 400) {
        res.resume(); reject(new Error('EXTERNAL_REDIRECT_BLOCKED')); return;
      }
      const chunks: Buffer[]=[];let size=0;
      res.on('data',(chunk:Buffer)=>{
        size+=chunk.length;
        if(size>2*1024*1024) req.destroy(new Error('EXTERNAL_RESPONSE_TOO_LARGE'));
        else chunks.push(chunk);
      });
      res.on('error',reject);
      res.on('end', () => {
        try {
          const status = res.statusCode || 502;
          const body = status === 204 || status === 205 ? null : Buffer.concat(chunks);
          resolve(new Response(body, {
            status, headers: { 'content-type': String(res.headers['content-type'] || 'application/json') },
          }));
        } catch (error) { reject(error); }
      });
    });
    req.setTimeout(30000,()=>req.destroy(new Error('EXTERNAL_TIMEOUT')));
    req.on('error',reject);
    req.end(typeof options.body === 'string' ? options.body : undefined);
  });
}
